import { Billboard, Edges } from '@react-three/drei'
import { Fragment, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TileType } from '../../types/city'
import { NoWaterMarker, SupplyShortageMarker } from './StatusMarkers'
import { ChristmasTreeMesh } from './SeasonalMeshes'
import { ParkingLotMesh, PlazaMesh, TownSquareMesh, TrafficLight, UniversityMesh } from './CivicMeshes'
import { BrickLoftMesh, GlassSkyscraperMesh, ModernBlockMesh, OfficeTowerMesh, StreetTree } from './ModernMeshes'
import {
  Box,
  Cone,
  Cylinder,
  Dome,
  OUTLINE_COLOR,
  PAD_HEIGHT,
  Pad,
  ROAD_ASPHALT_WIDTH,
  ROAD_CURB_OFFSET,
  ROAD_CURB_WIDTH,
  ROAD_TILE_LENGTH,
  Smoke,
  Window,
  cinemaSignMaterial,
  getFacadeMaterial,
  getGradientMap,
  getPaverMaterial,
  getToonMaterial,
  hash01,
  lampBulbMaterial,
  lampGlowInnerMaterial,
  lampGlowOuterMaterial,
  nightSignMaterial,
  townHallClockMaterial,
  type Vec3,
} from './primitives'
import {
  BalconyBlockMesh,
  BayTowersMesh,
  BrickWalkupMesh,
  BridgeTileMesh,
  ClockTowerMesh,
  CollegeHallMesh,
  ColorBlockMesh,
  DeptStoreMesh,
  DiagridSkyscraperMesh,
  DiamondArenaMesh,
  FreightStationMesh,
  GlassPodiumTowerMesh,
  GridOfficeTowerMesh,
  HighriseSlabMesh,
  RailStopMesh,
  RailTileMesh,
  StalinkaPinkMesh,
  StreamlineCurveMesh,
  TrainStationMesh,
  VillaConservatoryMesh,
  WaterIntakeMesh,
  WaterTileMesh,
  WaterfrontPromenadeMesh,
} from './CityRTMeshes'

export { Smoke }

const foliageMaterialCache = new Map<string, THREE.MeshToonMaterial>()

function getFoliageMaterial(color: string): THREE.MeshToonMaterial {
  let material = foliageMaterialCache.get(color)
  if (material === undefined) {
    material = new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() })
    ;(material as THREE.MeshToonMaterial & { flatShading: boolean }).flatShading = true
    material.needsUpdate = true
    foliageMaterialCache.set(color, material)
  }
  return material
}

const roadCenterMaterial = new THREE.MeshToonMaterial({
  color: '#e8b923', gradientMap: getGradientMap(),
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
})
const roadMarkingMaterial = new THREE.MeshToonMaterial({
  color: '#ffffff', gradientMap: getGradientMap(),
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
})

const outlineMaterial = new THREE.LineBasicMaterial({ color: OUTLINE_COLOR, transparent: true, opacity: 0.92 })
const bushGeometry = new THREE.IcosahedronGeometry(1, 0)
const bushEdges = new THREE.EdgesGeometry(bushGeometry)

function ResidentialBase() {
  return <group>
    <Box size={[0.99, 0.05, 0.99]} position={[0, 0.025, 0]} color="#b8aa8f" />
    <Box size={[0.84, 0.018, 0.78]} position={[0, 0.06, 0.04]} color="#d7ccb7" />
    <Box size={[0.98, 0.025, 0.14]} position={[0, 0.064, -0.41]} color="#729148" />
    <Box size={[0.98, 0.06, 0.035]} position={[0, 0.07, 0.47]} color="#cbbda5" />
    {[-0.47, 0.47].map((x) => <Box key={x} size={[0.035, 0.06, 0.99]} position={[x, 0.07, 0]} color="#cbbda5" />)}
  </group>
}

function CommercialBase() {
  return <group>
    <Box size={[0.99, 0.055, 0.99]} position={[0, 0.0275, 0]} color="#55585a" />
    <Box size={[0.99, 0.035, 0.16]} position={[0, 0.045, 0.415]} color="#d2c8b5" />
    {[-0.3, 0, 0.3].map((x) => <Box key={x} size={[0.012, 0.008, 0.12]} position={[x, 0.076, 0.38]} color="#f4efe2" />)}
  </group>
}

function IndustrialBase() {
  return <group>
    <Box size={[0.99, 0.055, 0.99]} position={[0, 0.0275, 0]} color="#484b4c" />
    <Box size={[0.9, 0.015, 0.86]} position={[0, 0.062, 0]} color="#6e6b63" />
    {[-0.46, 0.46].map((x) => <group key={x}>
      <Box size={[0.025, 0.34, 0.025]} position={[x, 0.19, -0.4]} color="#34383a" />
      <Box size={[0.025, 0.34, 0.025]} position={[x, 0.19, 0.4]} color="#34383a" />
      <Box size={[0.025, 0.025, 0.8]} position={[x, 0.28, 0]} color="#34383a" />
    </group>)}
    <Box size={[0.92, 0.025, 0.025]} position={[0, 0.28, -0.46]} color="#34383a" />
    {[-0.3, -0.1, 0.1, 0.3].map((x) => <Box key={x} size={[0.018, 0.2, 0.018]} position={[x, 0.17, -0.46]} color="#34383a" />)}
  </group>
}

/* -------------------------------------------------------------------------- */
/*  Модели зданий                                                               */
/* -------------------------------------------------------------------------- */

export interface RoadLinks {
  north: boolean
  south: boolean
  east: boolean
  west: boolean
  /** True only for a real junction; prevents parallel roads becoming false intersections. */
  junction?: boolean
}


/** Дорога: серый плоский тайл с пунктирной разметкой вдоль соседних дорог. */
export function Road({ north, south, east, west, junction, variant = 0 }: RoadLinks & { variant?: number }) {
  const isIntersection = junction ?? ((north || south) && (east || west))
  const isStraightX = east || west || (!north && !south)
  const isStraightZ = !isStraightX && (north || south)
  const half = ROAD_TILE_LENGTH / 2
  const asphaltHalf = ROAD_ASPHALT_WIDTH / 2
  const walk = ROAD_CURB_WIDTH
  const walkOffset = ROAD_CURB_OFFSET
  const paver = getPaverMaterial()
  // Для прямого участка: стороны поперёк движения. Если там тоже дорога (широкий проспект) — продолжаем асфальт, иначе тротуар.
  const sides: Array<{ key: string; road: boolean; along: 'x' | 'z'; sign: number }> = isIntersection ? [] : isStraightX
    ? [{ key: 'n', road: !!north, along: 'x', sign: -1 }, { key: 's', road: !!south, along: 'x', sign: 1 }]
    : [{ key: 'w', road: !!west, along: 'z', sign: -1 }, { key: 'e', road: !!east, along: 'z', sign: 1 }]

  return (
    <group>
      {/* Асфальт */}
      {isIntersection
        ? <Box size={[ROAD_TILE_LENGTH, 0.04, ROAD_TILE_LENGTH]} position={[0, 0.02, 0]} color="#3a3735" />
        : isStraightX
          ? <Box size={[ROAD_TILE_LENGTH, 0.04, ROAD_ASPHALT_WIDTH]} position={[0, 0.02, 0]} color="#3a3735" />
          : <Box size={[ROAD_ASPHALT_WIDTH, 0.04, ROAD_TILE_LENGTH]} position={[0, 0.02, 0]} color="#3a3735" />}

      {/* Тротуары с плиткой (или продолжение асфальта у широкого проспекта) */}
      {sides.map(({ key, road, along, sign }) => {
        const size: Vec3 = along === 'x' ? [ROAD_TILE_LENGTH, road ? 0.04 : 0.06, walk] : [walk, road ? 0.04 : 0.06, ROAD_TILE_LENGTH]
        const position: Vec3 = along === 'x' ? [0, road ? 0.02 : 0.03, sign * walkOffset] : [sign * walkOffset, road ? 0.02 : 0.03, 0]
        return road
          ? <Box key={key} size={size} position={position} color="#3a3735" outline={false} />
          : <Box key={key} size={size} position={position} color="#d8d5cb" material={paver} />
      })}
      {isIntersection && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <Box key={`corner-${sx}-${sz}`} size={[walk, 0.06, walk]} position={[sx * walkOffset, 0.03, sz * walkOffset]} color="#d8d5cb" material={paver} />)}
      {isIntersection && [
        { key: 'n', open: north, pos: [0, -walkOffset] as const, along: 'x' as const },
        { key: 's', open: south, pos: [0, walkOffset] as const, along: 'x' as const },
        { key: 'w', open: west, pos: [-walkOffset, 0] as const, along: 'z' as const },
        { key: 'e', open: east, pos: [walkOffset, 0] as const, along: 'z' as const },
      ].filter((side) => !side.open).map(({ key, pos, along }) => <Box key={`closed-${key}`} size={along === 'x' ? [ROAD_ASPHALT_WIDTH, 0.06, walk] : [walk, 0.06, ROAD_ASPHALT_WIDTH]} position={[pos[0], 0.03, pos[1]]} color="#d8d5cb" material={paver} />)}

      {/* Жёлтая осевая */}
      {!isIntersection && isStraightX && !north && !south && <Box size={[ROAD_TILE_LENGTH, 0.008, 0.022]} position={[0, 0.045, 0]} color="#e8b923" material={roadCenterMaterial} outline={false} castShadow={false} />}
      {!isIntersection && isStraightZ && !east && !west && <Box size={[0.022, 0.008, ROAD_TILE_LENGTH]} position={[0, 0.045, 0]} color="#e8b923" material={roadCenterMaterial} outline={false} castShadow={false} />}

      {/* Зебры на каждом въезде в перекрёсток */}
      {isIntersection && [
        { key: 'n', open: north, rotate: false, at: -half + 0.12 },
        { key: 's', open: south, rotate: false, at: half - 0.12 },
        { key: 'w', open: west, rotate: true, at: -half + 0.12 },
        { key: 'e', open: east, rotate: true, at: half - 0.12 },
      ].filter((side) => side.open).map(({ key, rotate, at }) => <group key={`zebra-${key}`} position={[rotate ? at : 0, 0.045, rotate ? 0 : at]}>
        {[-0.24, -0.144, -0.048, 0.048, 0.144, 0.24].filter((offset) => Math.abs(offset) < asphaltHalf - 0.02).map((offset) => <Box key={offset} size={rotate ? [0.16, 0.008, 0.05] : [0.05, 0.008, 0.16]} position={rotate ? [0, 0, offset] : [offset, 0, 0]} color="#f4f1ea" material={roadMarkingMaterial} outline={false} castShadow={false} />)}
      </group>)}

      {/* Светофоры на перекрёстках с тремя и более направлениями */}
      {isIntersection && [north, south, east, west].filter(Boolean).length >= 3 && <>
        <TrafficLight position={[walkOffset, 0.06, walkOffset]} rotation={Math.PI} />
        <TrafficLight position={[-walkOffset, 0.06, -walkOffset]} phase={1} />
      </>}

      {/* Фонари и уличные деревья по очереди вдоль тротуара */}
      {sides.filter((side) => !side.road).map(({ key, along, sign }) => {
        const position: Vec3 = along === 'x' ? [0, 0.06, sign * (walkOffset + 0.02)] : [sign * (walkOffset + 0.02), 0.06, 0]
        if (variant % 2 === 0) {
          const rotation: Vec3 = along === 'x' ? [0, sign < 0 ? 0 : Math.PI, 0] : [0, sign < 0 ? Math.PI / 2 : -Math.PI / 2, 0]
          return <Streetlight key={`lamp-${key}`} position={position} rotation={rotation} />
        }
        return <StreetTree key={`tree-${key}`} position={position} />
      })}
    </group>
  )
}

function Streetlight({ position, rotation = [0, 0, 0] }: { position: Vec3, rotation?: Vec3 }) {
  return (
    <group position={position} rotation={rotation}>
      <Cylinder radius={0.01} height={0.4} segments={6} position={[0, 0.2, 0]} color="#333" />
      <Box size={[0.12, 0.02, 0.02]} position={[0, 0.4, 0.05]} color="#333" />
      <Box size={[0.04, 0.02, 0.04]} position={[0, 0.39, 0.08]} color="#6b6354" material={lampBulbMaterial} outline={false} castShadow={false} />
      <mesh position={[0, 0.006, 0.08]} rotation={[-Math.PI / 2, 0, 0]} material={lampGlowOuterMaterial} renderOrder={2}><circleGeometry args={[0.18, 16]} /></mesh>
      <mesh position={[0, 0.008, 0.08]} rotation={[-Math.PI / 2, 0, 0]} material={lampGlowInnerMaterial} renderOrder={3}><circleGeometry args={[0.09, 16]} /></mesh>
    </group>
  )
}

function SmallTree({ position, scale = 1 }: { position: Vec3, scale?: number }) {
  const foliage = ['#d99b26', '#c86d24', '#963824']
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <Cylinder radius={0.1} radiusTop={0.06} height={0.75} segments={6} position={[0, 0.375, 0]} color="#3a281c" />
      {[
        { p: [0, 0.78, 0] as Vec3, r: 0.24, c: foliage[0], rot: [0.08, 0.2, 0.1] as Vec3 },
        { p: [-0.13, 0.88, 0.04] as Vec3, r: 0.19, c: foliage[1], rot: [0.25, 0.7, 0.1] as Vec3 },
        { p: [0.12, 0.9, -0.03] as Vec3, r: 0.18, c: foliage[2], rot: [0.1, 0.3, 0.35] as Vec3 },
      ].map((cluster, index) => (
        <mesh key={index} position={cluster.p} rotation={cluster.rot} material={getFoliageMaterial(cluster.c)} castShadow receiveShadow>
          <icosahedronGeometry args={[cluster.r, 1]} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Жилой дом: трёхъярусная ступенчатая (черепичная) скатная крыша с контрастным цветом,
 * слуховое окно, труба с оголовком, окна с рамами и переплётами, дверь с крыльцом.
 */
export function Residential({ variant = 0, style = 'EU', catalogId }: { variant?: number, style?: string, catalogId?: string }) {
  const floors = catalogId === 'res_cottage' || catalogId === 'res_cozy_estate' ? 1 : catalogId === 'res_townhouse' || catalogId === 'res_half_timbered' ? 2 : catalogId === 'res_apartment' ? 4 : 2 + (variant % 3)

  if (catalogId === 'res_cottage' || catalogId === 'res_cozy_estate') {
    return <group><ResidentialBase />
      <Box size={[0.78, 0.32, 0.74]} position={[0, PAD_HEIGHT + 0.16, 0]} color="#e2cda9" />
      <Box size={[0.88, 0.06, 0.84]} position={[0, PAD_HEIGHT + 0.34, 0]} color="#9b4934" />
      <Box size={[0.58, 0.42, 0.76]} position={[0, PAD_HEIGHT + 0.55, 0]} rotation={[0, 0, Math.PI / 4]} color="#a34830" />
      <Window position={[-0.18, 0.28, 0.32]} width={0.14} height={0.14} glass="#293746" frame="#f5ead7" />
      <Window position={[0.18, 0.28, 0.32]} width={0.14} height={0.14} glass="#293746" frame="#f5ead7" />
      <Box size={[0.2, 0.04, 0.04]} position={[0, 0.11, 0.36]} color="#e7d8bb" />
      <Box size={[0.27, 0.04, 0.22]} position={[0.34, 0.04, 0.16]} color="#6d8c46" />
      {[-0.3, 0, 0.3].map((x) => <Box key={`fence-front-${x}`} size={[0.025, 0.14, 0.025]} position={[x + 0.34, 0.11, 0.29]} color="#79583a" />)}
      <Box size={[0.34, 0.025, 0.025]} position={[0.34, 0.16, 0.29]} color="#79583a" />
      <mesh position={[0.34, 0.16, 0.16]} geometry={bushGeometry} scale={0.12} castShadow receiveShadow material={getFoliageMaterial('#587c3b')}><lineSegments geometry={bushEdges} material={outlineMaterial} /></mesh>
      <Box size={[0.1, 0.38, 0.1]} position={[0.24, PAD_HEIGHT + 0.74, -0.2]} color="#8f3f2d" />
      <Box size={[0.14, 0.04, 0.14]} position={[0.24, PAD_HEIGHT + 0.94, -0.2]} color="#672d24" />
      <Box size={[0.36, 0.045, 0.13]} position={[0, PAD_HEIGHT + 0.04, 0.39]} color="#f2e8d6" />
    </group>
  }
  
  if (style === 'US') {
    const brick = ['#8b4513', '#a52a2a', '#a0522d'][variant % 3]
    const fh = 0.18 // compact story height
    return (
      <group>
        <ResidentialBase />
        {/* Base */}
        <Box size={[0.92, 0.05, 0.92]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#5a5a5a" />
        {/* Main Body */}
        <Box size={[0.84, (floors * fh), 0.84]} position={[0, PAD_HEIGHT + 0.05 + (floors * fh)/2, 0]} color={brick} />
        {/* Parapet */}
        <Box size={[0.9, 0.05, 0.9]} position={[0, PAD_HEIGHT + 0.05 + (floors * fh) + 0.025, 0]} color="#4a4a4a" />
        
        {/* Windows */}
        {Array.from({ length: floors }).map((_, i) => (
          <group key={i} position={[0, PAD_HEIGHT + 0.05 + i * fh + fh/2, 0.31]}>
            {[-0.15, 0.15].map(x => (
              <Window key={x} position={[x, 0, 0]} width={0.12} height={0.16} glass="#ffffff" cross />
            ))}
          </group>
        ))}

        {/* Fire Escape (Black Metal) */}
        {Array.from({ length: floors - 1 }).map((_, i) => (
          <group key={`fe-${i}`} position={[0, PAD_HEIGHT + 0.05 + (i + 1) * fh, 0.35]}>
            {/* Balcony */}
            <Box size={[0.5, 0.02, 0.15]} position={[0, -0.1, 0]} color="#222" />
            <Box size={[0.5, 0.08, 0.02]} position={[0, -0.05, 0.075]} color="#222"  />
            {/* Ladder */}
            <Box size={[0.05, fh, 0.02]} position={[0.2, -fh/2 - 0.1, 0.05]} color="#222" rotation={[0, 0, 0.3]} />
          </group>
        ))}

        {/* Roof details: Water Tank & Vent */}
        <group position={[0, PAD_HEIGHT + 0.05 + (floors * fh) + 0.05, 0]}>
          <Cylinder radius={0.08} height={0.15} segments={8} position={[-0.15, 0.15, -0.15]} color="#8b5a2b" />
          {/* Tank Legs */}
          <Cylinder radius={0.01} height={0.1} segments={4} position={[-0.2, 0.05, -0.1]} color="#222" />
          <Cylinder radius={0.01} height={0.1} segments={4} position={[-0.1, 0.05, -0.1]} color="#222" />
          <Cylinder radius={0.01} height={0.1} segments={4} position={[-0.15, 0.05, -0.2]} color="#222" />
          
          <Box size={[0.12, 0.1, 0.12]} position={[0.15, 0.05, 0.1]} color="#777" />
        </group>
      </group>
    )
  }
  
  if (style === 'EAST') {
    const plaster = ['#d8c29d', '#e0cdac', '#d1ba92'][variant % 3] // Песчано-бежевые
    const fh = 0.16
    return (
      <group>
        <ResidentialBase />
        {/* Base */}
        <Box size={[0.92, 0.05, 0.92]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#bda783" />
        
        {/* Tiers */}
        {Array.from({ length: floors }).map((_, i) => (
          <group key={i} position={[0, PAD_HEIGHT + 0.05 + i * fh, 0]}>
            <Box size={[0.82, fh, 0.82]} position={[0, fh/2, 0]} color={plaster} />
            
            {/* Arched windows */}
            <group position={[0, fh/2, 0.28]}>
              <Window position={[-0.12, 0, 0]} width={0.12} height={0.14} glass="#8f97a1" cross={false} />
              {/* Arch over window */}
              <Cylinder radius={0.06} height={0.01} segments={16} position={[-0.12, 0.07, 0]} rotation={[Math.PI/2, 0, 0]} color="#fff8ea" />
              <Window position={[0.12, 0, 0]} width={0.12} height={0.14} glass="#8f97a1" cross={false} />
              <Cylinder radius={0.06} height={0.01} segments={16} position={[0.12, 0.07, 0]} rotation={[Math.PI/2, 0, 0]} color="#fff8ea" />
            </group>
          </group>
        ))}

        {/* Roof Parapet (Зубчатые бойницы) */}
        <group position={[0, PAD_HEIGHT + 0.05 + floors * fh, 0]}>
      <Box size={[0.84, 0.05, 0.84]} position={[0, 0.025, 0]} color={plaster} />
          {[-0.25, -0.15, -0.05, 0.05, 0.15, 0.25].map(x => (
            <group key={x}>
              <Box size={[0.04, 0.05, 0.04]} position={[x, 0.075, 0.25]} color={plaster} />
              <Box size={[0.04, 0.05, 0.04]} position={[x, 0.075, -0.25]} color={plaster} />
              <Box size={[0.04, 0.05, 0.04]} position={[0.25, 0.075, x]} color={plaster} />
              <Box size={[0.04, 0.05, 0.04]} position={[-0.25, 0.075, x]} color={plaster} />
            </group>
          ))}
          {/* Dome */}
          <Box size={[0.3, 0.1, 0.3]} position={[0, 0.05, 0]} color={plaster} />
          <Dome radius={0.15} color="#2b9eb3" position={[0, 0.1, 0]} />
        </group>
        
        {/* Palm tree in courtyard */}
        <group position={[0.3, PAD_HEIGHT + 0.05, -0.3]}>
          <Cylinder radius={0.015} height={0.2} segments={6} position={[0, 0.1, 0]} color="#8b5a2b" />
          {[[0.05, 0, 0], [-0.05, 0, 0], [0, 0, 0.05], [0, 0, -0.05]].map((p, i) => (
            <mesh key={i} position={[p[0], 0.22, p[2]]} material={getFoliageMaterial(i % 2 ? '#43662d' : '#587c3b')} castShadow receiveShadow>
              <icosahedronGeometry args={[0.065, 1]} />
            </mesh>
          ))}
        </group>
      </group>
    )
  }

  if (catalogId === 'res_apartment') {
    const base = 0.22
    const levelHeight = 0.34
    const bodyHeight = levelHeight * 4
    const roofBase = base + bodyHeight
    const haussmannFacade = getFacadeMaterial({
      wall: '#ebe4d6',
      glass: '#3b4e63',
      frame: [0.24, 0.22],
      spacing: [0.24, 0.34],
    })
    return (
      <group>
        <ResidentialBase />
        {/* Рустованный первый этаж с угловым бордовым козырьком кафе (строго по референсу CityRT) */}
        <Box size={[0.92, base, 0.92]} position={[0, base / 2, 0]} color="#d6cfc2" />
        <Box size={[0.24, 0.05, 0.12]} position={[0.32, base - 0.02, 0.45]} rotation={[0.25, 0, 0]} color="#b8382c" />
        <Box size={[0.18, 0.16, 0.03]} position={[0, base / 2, 0.46]} color="#3a2d27" />

        {/* Светло-кремовый фасад в стиле Османа (Париж / Европа) */}
        <Box
          size={[0.88, bodyHeight, 0.88]}
          position={[0, base + bodyHeight / 2, 0]}
          color="#ebe4d6"
          material={haussmannFacade}
        />

        {/* Угловая круглая эркерная башня с куполом и шпилем */}
        <Cylinder
          radius={0.18}
          height={bodyHeight + base}
          segments={12}
          position={[0.34, (bodyHeight + base) / 2, 0.34]}
          color="#efe9dc"
        />

        {/* Длинные кованые балконы вдоль этажей и вокруг угловой башни */}
        {[1, 2, 3].map((fl) => {
          const fy = base + fl * levelHeight
          return (
            <group key={fl} position={[0, fy, 0]}>
              <Box size={[0.92, 0.028, 0.92]} position={[0, 0, 0]} color="#dfd7c6" />
              <Box size={[0.78, 0.055, 0.02]} position={[-0.04, 0.035, 0.46]} color="#25282c" />
              <Box size={[0.02, 0.055, 0.78]} position={[0.46, 0.035, -0.04]} color="#25282c" />
              <Cylinder radius={0.2} height={0.045} segments={12} position={[0.34, 0.03, 0.34]} color="#25282c" />
            </group>
          )
        })}

        {/* Тёмно-сланцевая мансардная крыша с белыми слуховыми окнами (люкарнами) */}
        <Box size={[0.92, 0.04, 0.92]} position={[0, roofBase + 0.02, 0]} color="#dfd7c6" />
        <Cylinder
          radius={0.64}
          radiusTop={0.48}
          height={0.34}
          segments={4}
          position={[0, roofBase + 0.21, 0]}
          rotation={[0, Math.PI / 4, 0]}
          color="#4c5563"
        />
        <Box size={[0.68, 0.03, 0.68]} position={[0, roofBase + 0.38, 0]} color="#5e6775" />

        {/* Белые слуховые окна по периметру мансарды */}
        {[-0.24, 0, 0.24].map((offset) => (
          <group key={offset}>
            <Box size={[0.11, 0.14, 0.1]} position={[offset, roofBase + 0.18, 0.38]} color="#ebe4d6" />
            <Box size={[0.07, 0.09, 0.02]} position={[offset, roofBase + 0.17, 0.435]} color="#2b3847" />
            <Box size={[0.1, 0.14, 0.11]} position={[0.38, roofBase + 0.18, offset]} color="#ebe4d6" />
          </group>
        ))}

        {/* Ребристый сланцевый купол со шпилем на угловой башне */}
        <Cylinder radius={0.19} radiusTop={0.14} height={0.16} segments={10} position={[0.34, roofBase + 0.1, 0.34]} color="#4c5563" />
        <Dome radius={0.16} position={[0.34, roofBase + 0.16, 0.34]} color="#434c59" />
        <Cone radius={0.035} height={0.18} segments={6} position={[0.34, roofBase + 0.38, 0.34]} color="#363d47" />

        {/* Печные трубы с терракотовыми дымниками на крыше */}
        {[-0.18, 0.14].map((x, idx) => (
          <group key={x} position={[x, roofBase + 0.44, idx === 0 ? -0.14 : 0.08]}>
            <Box size={[0.16, 0.12, 0.08]} position={[0, 0, 0]} color="#e3dccb" />
            {[-0.04, 0, 0.04].map((cx) => (
              <Cylinder key={cx} radius={0.015} height={0.05} segments={6} position={[cx, 0.08, 0]} color="#b84b34" />
            ))}
          </group>
        ))}
      </group>
    )
  }

  // Wall-to-wall European townhouse: one full tile with a deep, warm facade.
  const walls = ['#dfd7c5', '#d99f66', '#c4694b', '#e0ba72']
  const roofs = ['#b44a28', '#c2512e', '#8e382b']
  const wallColor = catalogId === 'res_townhouse' ? '#eedec5' : walls[variant % walls.length]
  const roofColor = catalogId === 'res_apartment' ? '#3d4450' : roofs[variant % roofs.length]
  const roofType = variant % 3
  const floorHeight = 0.35
  const bodyHeight = floors * floorHeight
  const bodyBase = 0.22
  const roofBase = bodyBase + bodyHeight
  const roofAngle = Math.PI * 0.32

  return (
    <group>
      <ResidentialBase />
      <Box size={[0.9, 0.16, 0.84]} position={[0, 0.14, -0.015]} color="#d4ccc0" />
      {/* Inner shell ends behind the open facade, leaving real depth for recessed windows. */}
      <Box size={[0.9, bodyHeight, 0.84]} position={[0, bodyBase + bodyHeight / 2, -0.025]} color={wallColor} />
      <Box size={[0.06, bodyHeight, 0.95]} position={[-0.45, bodyBase + bodyHeight / 2, 0]} color={wallColor} />
      <Box size={[0.06, bodyHeight, 0.95]} position={[0.45, bodyBase + bodyHeight / 2, 0]} color={wallColor} />
      <Box size={[0.95, bodyHeight, 0.06]} position={[0, bodyBase + bodyHeight / 2, -0.45]} color={wallColor} />
      {Array.from({ length: floors - 1 }, (_, i) => (
        <Box key={`course-${i}`} size={[0.96, 0.025, 0.035]} position={[0, bodyBase + (i + 1) * floorHeight, 0.49]} color="#cbbda8" />
      ))}
      {Array.from({ length: floors }, (_, floor) => (
        <group key={`floor-${floor}`} position={[0, bodyBase + floor * floorHeight, 0]}>
          {/* Raised plaster panels frame open window and doorway bays. */}
          {floor > 0 && <Box size={[0.95, 0.08, 0.1]} position={[0, 0.04, 0.425]} color={wallColor} />}
          <Box size={[0.95, 0.1, 0.1]} position={[0, floorHeight - 0.05, 0.425]} color={wallColor} />
          {[-0.29, 0, 0.29].map((x, index) => {
            const width = floor === 0 && index === 1 ? 0.16 : 0.14
            const left = x - width / 2
            const right = x + width / 2
            const previousRight = index === 0 ? -0.475 : [-0.29, 0, 0.29][index - 1] + ((floor === 0 && index - 1 === 1) ? 0.08 : 0.07)
            return right < 0.475 ? (
              <Fragment key={`pier-${index}`}>
                {left > previousRight && <Box size={[left - previousRight, 0.28, 0.1]} position={[(left + previousRight) / 2, 0.22, 0.425]} color={wallColor} />}
                {index === 2 && <Box size={[0.475 - right, 0.28, 0.1]} position={[(0.475 + right) / 2, 0.22, 0.425]} color={wallColor} />}
              </Fragment>
            ) : null
          })}
          {/* Dark timber frame, corner posts and fine diagonal braces. */}
          <Box size={[0.025, floorHeight, 0.035]} position={[-0.45, floorHeight / 2, 0.49]} color="#49352b" />
          <Box size={[0.025, floorHeight, 0.035]} position={[0.45, floorHeight / 2, 0.49]} color="#49352b" />
          <Box size={[0.94, 0.025, 0.035]} position={[0, floorHeight - 0.025, 0.49]} color="#49352b" />
          {[-1, 1].map((side) => (
            <Box key={`brace-${side}`} size={[0.14, 0.022, 0.035]} position={[side * 0.4, floorHeight / 2, 0.49]} rotation={[0, 0, side * -0.7]} color="#49352b" />
          ))}
          {[-0.29, 0, 0.29].map((x) => {
            const doorway = floor === 0 && x === 0
            return doorway ? (
              <group key="door" position={[x, 0.16, 0.43]}>
                <Box size={[0.16, 0.31, 0.035]} position={[0, 0, 0]} color="#51372b" />
                <Box size={[0.1, 0.23, 0.012]} position={[0, 0.025, 0.022]} color="#8e6244" outline={false} />
              </group>
            ) : (
              <Window key={`window-${x}`} position={[x, 0.22, 0.43]} width={0.14} height={0.22} glass="#23272f" frame="#f4ead8" />
            )
          })}
        </group>
      ))}
      {/* Deep eaves and two steep roof planes. */}
      <Box size={[1.04, 0.07, 1.04]} position={[0, roofBase + 0.02, 0]} color="#744034" />
      {roofType === 1 ? (
        <Cone radius={0.76} height={0.58} segments={4} position={[0, roofBase + 0.29, 0]} rotation={[0, Math.PI / 4, 0]} color={roofColor} />
      ) : (
        <>
          <Box size={[0.72, 0.07, 1.06]} position={[-0.23, roofBase + 0.29, 0]} rotation={[0, 0, -roofAngle]} color={roofColor} outline={false} />
          <Box size={[0.72, 0.07, 1.06]} position={[0.23, roofBase + 0.29, 0]} rotation={[0, 0, roofAngle]} color={roofColor} outline={false} />
        </>
      )}
      {roofType === 2 && [0, 1, 2].map((step) => (
        <Box key={step} size={[0.22 - step * 0.035, 0.12, 0.06]} position={[0, roofBase + 0.08 + step * 0.12, 0.49]} color={wallColor} />
      ))}
      {/* Brick chimney and paired dormers. */}
      <Box size={[0.11, 0.42, 0.12]} position={[0.29, roofBase + 0.38, -0.2]} color="#682a20" />
      <Box size={[0.15, 0.045, 0.16]} position={[0.29, roofBase + 0.6, -0.2]} color="#54251e" />
      {[ -0.2, 0.2 ].map((x) => (
        <group key={`dormer-${x}`} position={[x, roofBase + 0.24, 0.24]}>
          <Box size={[0.15, 0.18, 0.13]} position={[0, 0, 0]} color={wallColor} />
          <Box size={[0.18, 0.045, 0.17]} position={[-0.045, 0.13, 0]} rotation={[0, 0, -0.55]} color="#8e382b" />
          <Box size={[0.18, 0.045, 0.17]} position={[0.045, 0.13, 0]} rotation={[0, 0, 0.55]} color="#8e382b" />
          <Box size={[0.12, 0.11, 0.02]} position={[0, 0, 0.075]} color="#23272f" />
        </group>
      ))}
    </group>
  )
}

function WineTavernMesh() {
  return <group>
    <CommercialBase />
    <Box size={[0.82, 0.48, 0.72]} position={[0, PAD_HEIGHT + 0.24, -0.02]} color="#d5b98d" />
    <Box size={[0.9, 0.08, 0.82]} position={[0, 0.54, -0.02]} color="#9c452e" />
    <Box size={[0.58, 0.52, 0.72]} position={[0, 0.81, -0.02]} color="#e2c99f" />
    <Window position={[-0.18, 0.34, 0.35]} width={0.19} height={0.2} glass="#38565a" frame="#f5ead8" />
    <Window position={[0.18, 0.34, 0.35]} width={0.19} height={0.2} glass="#38565a" frame="#f5ead8" />
    <Box size={[0.3, 0.24, 0.06]} position={[0, 0.31, 0.39]} color="#65402d" />
    <Box size={[0.72, 0.045, 0.62]} position={[0, 1.11, -0.02]} color="#a94830" />
    <Box size={[0.58, 0.08, 0.13]} position={[0, 1.17, 0.37]} color="#edd4a6" />
    <Box size={[0.48, 0.04, 0.12]} position={[0, 0.62, 0.48]} rotation={[0.24, 0, 0]} color="#b84a28" />
    {/* Wine casks at the doorway and outdoor tasting tables. */}
    {[-0.39, 0.39].map((x) => <group key={`wine-cask-${x}`} position={[x, 0.08, 0.45]}>
      <Cylinder radius={0.095} radiusTop={0.075} height={0.2} segments={10} position={[0, 0.1, 0]} color="#845331" />
      <Cylinder radius={0.099} height={0.018} segments={10} position={[0, -0.055, 0]} color="#4f4336" />
      <Cylinder radius={0.089} height={0.018} segments={10} position={[0, 0.055, 0]} color="#4f4336" />
    </group>)}
    {[-0.28, 0.28].map((x) => <group key={`wine-table-${x}`} position={[x, 0.06, 0.72]}>
      <Cylinder radius={0.12} height={0.035} segments={12} position={[0, 0.22, 0]} color="#8a5937" />
      <Cylinder radius={0.018} height={0.22} segments={6} position={[0, 0.1, 0]} color="#583c2b" />
    </group>)}
    {/* Hanging grape sign. */}
    <Box size={[0.16, 0.14, 0.025]} position={[0, 1.4, 0.43]} color="#533a30" />
    {[-0.055, 0, 0.055].map((x, i) => <mesh key={`grape-${i}`} position={[x, 1.38 - (i === 1 ? 0.055 : 0), 0.45]}><sphereGeometry args={[0.035, 8, 6]} /><meshToonMaterial color={i === 1 ? '#6e3c65' : '#7a4d72'} /></mesh>)}
  </group>
}

export function Commercial({ catalogId }: { catalogId?: string }) {
  if (catalogId === 'com_wine_tavern') return <WineTavernMesh />
  const stripes = [-0.275, -0.165, -0.055, 0.055, 0.165, 0.275]
  return (
    <group>
      <CommercialBase />
      <Box size={[0.82, 0.5, 0.72]} position={[0, PAD_HEIGHT + 0.25, -0.02]} color={catalogId === 'com_grocery' ? '#dfbd76' : catalogId === 'com_mall' ? '#c9c9bd' : '#f4d9a6'} />
      <Box size={[0.88, 0.05, 0.78]} position={[0, PAD_HEIGHT + 0.525, -0.02]} color={catalogId === 'com_mall' ? '#66727d' : '#c9784a'} />
      <Box size={[0.78, 0.03, 0.68]} position={[0, PAD_HEIGHT + 0.565, -0.02]} color="#e0b183" />

      {/* крыша: вывеска и кондиционер */}
      <Box size={[0.34, 0.1, 0.04]} position={[0, PAD_HEIGHT + 0.64, 0.12]} color="#5cb3e6" material={nightSignMaterial} />
      <Box size={[0.16, 0.08, 0.14]} position={[-0.2, PAD_HEIGHT + 0.62, -0.1]} color="#c9ccd1" />
      <Cylinder radius={0.04} height={0.02} segments={10} position={[-0.2, PAD_HEIGHT + 0.67, -0.1]} color="#6b7078" />

      {/* фасад: витрины, дверь, навес, верхние окна */}
      <Window position={[-0.24, 0.22, 0.314]} width={0.2} height={0.18} glass="#4fa8e8" frame="#8a5a3c" />
      <Window position={[0.24, 0.22, 0.314]} width={0.2} height={0.18} glass="#4fa8e8" frame="#8a5a3c" />
      <Box size={[0.15, 0.22, 0.02]} position={[0, PAD_HEIGHT + 0.11, 0.315]} color="#5b4a3a" />
      <Box size={[0.09, 0.14, 0.012]} position={[0, PAD_HEIGHT + 0.12, 0.327]} color="#4fa8e8" castShadow={false} />
      {stripes.map((x, index) => (
        <Box
          key={x}
          size={[0.11, 0.025, 0.15]}
          position={[x, 0.355, 0.38]}
          rotation={[0.3, 0, 0]}
          color={index % 2 === 0 ? '#e8523f' : '#fff8ea'}
        />
      ))}
      {catalogId === 'com_mall' && <group>{[-0.31, -0.1, 0.11, 0.32].map((x) => <Box key={x} size={[0.035, 0.012, 0.22]} position={[x, 0.014, 0.61]} color="#f5f0df" />)}<Box size={[0.92, 0.025, 0.24]} position={[0, 0.012, 0.62]} color="#50545a" /></group>}
      {catalogId === 'com_bakery' && <group>
        <Box size={[0.72, 0.06, 0.1]} position={[0, 0.39, 0.37]} color="#fff5df" />
        <Box size={[0.72, 0.045, 0.1]} position={[0, 0.43, 0.37]} color="#b84832" />
        <Cylinder radius={0.075} height={0.025} segments={12} position={[0.39, 0.035, 0.4]} color="#79583a" />
        <Cylinder radius={0.018} height={0.1} segments={8} position={[0.39, 0.085, 0.4]} color="#493629" />
        <Cylinder radius={0.018} height={0.1} segments={8} position={[0.32, 0.085, 0.4]} color="#493629" />
        <Cylinder radius={0.018} height={0.1} segments={8} position={[0.46, 0.085, 0.4]} color="#493629" />
        {[-0.31, 0.31].map((x) => <group key={`autumn-pumpkin-${x}`} position={[x, 0.08, 0.47]}><mesh scale={[0.08, 0.065, 0.07]}><sphereGeometry args={[1, 8, 6]} /><meshToonMaterial color="#ea580c" /></mesh><Cylinder radius={0.012} height={0.035} segments={5} position={[0, 0.07, 0]} color="#526b35" /></group>)}
      </group>}
      {catalogId === 'com_grocery' && <group>
        <Box size={[0.72, 0.12, 0.05]} position={[0, 0.62, 0.34]} color="#355b58" />
        <Box size={[0.54, 0.17, 0.025]} position={[0, 0.31, 0.35]} color="#8cc5bf" />
        <Box size={[0.18, 0.08, 0.04]} position={[0.27, 0.1, 0.36]} color="#e5d1ab" />
      </group>}
      {catalogId === 'com_mall' && <group>
        <Box size={[0.84, 0.2, 0.62]} position={[0, 0.68, 0]} color="#d1d0c7" />
        <Box size={[0.8, 0.05, 0.05]} position={[0, 0.82, 0.34]} color="#8c3a27" />
        {[-0.28, -0.09, 0.1, 0.29].map((x) => <Box key={x} size={[0.15, 0.15, 0.02]} position={[x, 0.68, 0.32]} color="#6895a4" />)}
        <DisplayCar position={[-0.24, 0, 0.64]} color="#b84832" />
        <DisplayCar position={[0.24, 0, 0.64]} color="#526a82" />
      </group>}
      {[-0.24, 0, 0.24].map((x) => (
        <Window key={x} position={[x, 0.47, 0.314]} width={0.13} height={0.1} glass="#4fa8e8" sill={false} />
      ))}

      {/* боковые витрины */}
      {[-0.14, 0.14].map((z) => (
        <Window key={`e${z}`} position={[0.374, 0.3, z]} facing="x" width={0.14} height={0.16} glass="#4fa8e8" />
      ))}
      {[-0.14, 0.14].map((z) => (
        <Window key={`w${z}`} position={[-0.374, 0.3, z]} facing="-x" width={0.14} height={0.16} glass="#4fa8e8" />
      ))}
    </group>
  )
}

function DisplayCar({ position, color }: { position: Vec3; color: string }) {
  return <group position={position}>
    <Box size={[0.15, 0.075, 0.28]} position={[0, 0.1, 0]} color={color} />
    <Box size={[0.105, 0.065, 0.12]} position={[0, 0.16, -0.015]} color="#a9c0c8" />
    {[-1, 1].flatMap((side) => [-1, 1].map((end) => <Cylinder key={`${side}-${end}`} radius={0.035} height={0.025} segments={8} position={[side * 0.078, 0.065, end * 0.085]} rotation={[0, 0, Math.PI / 2]} color="#242424" />))}
  </group>
}

/** Завод: серый цех с пилообразной крышей, кирпичная труба и бак. */
export function Industrial({ catalogId }: { catalogId?: string }) {
  if (catalogId === 'ind_winery') return <WineryMesh />
  if (catalogId === 'ind_brickworks') return <BrickworksMesh />
  if (catalogId === 'ind_concrete_plant') return <ConcretePlantMesh />
  if (catalogId === 'ind_steel_foundry') return <SteelFoundryMesh />
  return (
    <group>
      <IndustrialBase />
      <Box size={[catalogId === 'ind_warehouse' ? 0.9 : 0.82, catalogId === 'ind_warehouse' ? 0.32 : 0.36, catalogId === 'ind_warehouse' ? 0.76 : 0.78]} position={[-0.04, PAD_HEIGHT + 0.18, 0]} color={catalogId === 'ind_warehouse' ? '#aeb4b6' : catalogId === 'ind_factory' ? '#8b3a2b' : '#b9b4a8'} />
      <Box size={[catalogId === 'ind_warehouse' ? 0.94 : 0.66, 0.05, catalogId === 'ind_warehouse' ? 0.8 : 0.66]} position={[-0.1, PAD_HEIGHT + 0.385, 0]} color={catalogId === 'ind_warehouse' ? '#68747c' : '#7b7f86'} />
      <Box size={[0.2, 0.12, 0.2]} position={[0.02, PAD_HEIGHT + 0.47, 0.12]} color="#8a8e95" />
      {catalogId !== 'ind_factory' && <><Cylinder radius={0.09} radiusTop={0.065} height={0.62} segments={14} position={[-0.28, PAD_HEIGHT + 0.31, -0.2]} color="#b4533a" /><Cylinder radius={0.085} height={0.05} segments={14} position={[-0.28, PAD_HEIGHT + 0.645, -0.2]} color="#4b2a22" /></>}
      <Cylinder
        radius={0.12}
        height={0.26}
        segments={16}
        position={[0.34, PAD_HEIGHT + 0.13, 0.14]}
        color="#dcd6c2"
      />
      <Box size={[0.22, 0.16, 0.02]} position={[-0.1, PAD_HEIGHT + 0.08, 0.315]} color="#4d5560" />
      {catalogId === 'ind_warehouse' && <Box size={[0.54, 0.1, 0.12]} position={[0.05, 0.07, 0.39]} color="#828894" />}
      {catalogId === 'ind_warehouse' && <group>{[-0.42, -0.22, 0, 0.22, 0.42].map((x, index) => <Box key={x} size={[0.035, 0.035, 0.72]} position={[x, PAD_HEIGHT + (index === 2 ? 0.59 : index % 2 ? 0.55 : 0.46), 0]} rotation={[0, 0, index < 2 ? 0.3 : index > 2 ? -0.3 : 0]} color="#c2c7c7" />)}</group>}
      {catalogId === 'ind_factory' && <group><Cylinder radius={0.15} radiusTop={0.055} height={4} segments={8} position={[-0.28, PAD_HEIGHT + 2, -0.2]} color="#8b3a2b" /><Cylinder radius={0.16} height={0.06} segments={8} position={[-0.28, PAD_HEIGHT + 3.96, -0.2]} color="#eee2cc" /><Cylinder radius={0.09} height={0.06} segments={8} position={[-0.28, PAD_HEIGHT + 4.01, -0.2]} color="#8b3a2b" /><Box size={[0.14, 0.22, 0.12]} position={[0.39, PAD_HEIGHT + 0.33, -0.18]} color="#65737b" /><Cylinder radius={0.02} height={0.42} segments={8} position={[0.3, PAD_HEIGHT + 0.22, -0.18]} rotation={[0, 0, Math.PI / 2]} color="#737d80" /></group>}
      {catalogId === 'ind_workshop' && <group>{[-0.25, 0, 0.25].map((x, index) => <group key={x}><Box size={[0.25, 0.13, 0.62]} position={[x, PAD_HEIGHT + 0.44, 0]} rotation={[0, 0, index % 2 === 0 ? 0.22 : -0.22]} color="#969ba0" /><Box size={[0.1, 0.04, 0.04]} position={[x, PAD_HEIGHT + 0.5, -0.19]} color="#9fc1c8" /></group>)}</group>}
      {catalogId === 'ind_warehouse' && <group><Box size={[0.34, 0.19, 0.08]} position={[0.18, PAD_HEIGHT + 0.09, 0.39]} color="#66727d" /><Box size={[0.42, 0.08, 0.2]} position={[0.18, 0.04, 0.48]} color="#777f84" /></group>}
      {[-0.3, 0.1].map((x) => (
        <Window key={x} position={[x, 0.27, 0.314]} width={0.1} height={0.07} glass="#9fb8c8" cross={false} sill={false} />
      ))}
    </group>
  )
}

function BrickworksMesh() {
  return <group>
    <Box size={[1.96, 0.07, 0.96]} position={[0, 0.035, 0]} color="#55504a" />
    <Box size={[1.35, 0.58, 0.72]} position={[-0.22, 0.37, -0.04]} color="#8b3a2b" />
    <Box size={[1.42, 0.09, 0.8]} position={[-0.22, 0.705, -0.04]} color="#383a3a" />
    <Box size={[0.52, 0.32, 0.18]} position={[0.28, 0.22, 0.38]} color="#4b4035" />
    {[-0.18, 0.02, 0.22].map((x, i) => <Box key={`brick-stack-${i}`} size={[0.18, 0.12, 0.12]} position={[x, 0.45 + (i % 2) * 0.12, 0.42]} color={i % 2 ? '#b8583c' : '#9a4933'} />)}
    <Cylinder radius={0.16} radiusTop={0.11} height={2.2} segments={8} position={[-0.7, 1.8, -0.2]} color="#7c3027" />
    <Cylinder radius={0.18} height={0.08} segments={8} position={[-0.7, 2.91, -0.2]} color="#d1b8a0" />
    <Smoke position={[-0.7, 2.95, -0.2]} />
    {[-0.42, 0.1, 0.56].map((x) => <Box key={`pallet-${x}`} size={[0.24, 0.04, 0.16]} position={[x, 0.1, 0.62]} color="#87613d" />)}
  </group>
}

function ConcretePlantMesh() {
  return <group>
    <Box size={[1.96, 0.07, 1.96]} position={[0, 0.035, 0]} color="#66645e" />
    <Box size={[1.72, 0.58, 1.5]} position={[0, 0.36, -0.05]} color="#aaa69c" />
    {[-0.48, 0.48].map((x) => <group key={`silo-${x}`} position={[x, 0, -0.18]}>
      <Cylinder radius={0.31} radiusTop={0.31} height={1.2} segments={12} position={[0, 1.02, 0]} color="#b9b9b1" />
      <Cone radius={0.31} height={0.28} segments={12} position={[0, 1.76, 0]} color="#858d8c" />
      <Cylinder radius={0.08} height={0.2} segments={8} position={[0, 1.98, 0]} color="#686f71" />
      {[-0.15, 0, 0.15].map((z) => <Box key={z} size={[0.025, 1.12, 0.025]} position={[0.29, 1.02, z]} color="#666f72" />)}
    </group>)}
    <Box size={[0.84, 0.13, 0.16]} position={[0, 1.05, 0.54]} rotation={[0, 0, -0.55]} color="#7a7770" />
    <Box size={[0.72, 0.1, 0.48]} position={[0.4, 0.13, 0.73]} color="#cb6b3e" />
    <Cylinder radius={0.13} height={0.17} segments={10} position={[0.4, 0.33, 0.73]} color="#c5c2b9" />
  </group>
}

function SteelFoundryMesh() {
  return <group>
    <Box size={[1.96, 0.07, 1.96]} position={[0, 0.035, 0]} color="#454747" />
    <Box size={[1.65, 0.84, 1.48]} position={[0, 0.48, -0.06]} color="#555b5c" />
    {[-0.58, -0.2, 0.2, 0.58].map((x, i) => <group key={`shed-${x}`}>
      <Box size={[0.44, 0.14, 1.62]} position={[x, 0.98 + (i % 2) * 0.14, -0.05]} rotation={[0, 0, i % 2 ? -0.24 : 0.24]} color="#4d5355" />
      {i % 2 === 0 && <Box size={[0.3, 0.025, 1.4]} position={[x + 0.07, 0.98, -0.05]} color="#d77b35" />}
    </group>)}
    <Box size={[0.56, 0.52, 0.08]} position={[0, 0.34, 0.72]} color="#2c3031" />
    <mesh position={[0, 0.34, 0.77]}>
      <planeGeometry args={[0.42, 0.34]} />
      <meshBasicMaterial color="#f97316" toneMapped={false} />
    </mesh>
    {[-0.7, 0.7].map((x) => <Cylinder key={`foundry-stack-${x}`} radius={0.1} radiusTop={0.075} height={1.35} segments={8} position={[x, 1.15, -0.55]} color="#343a3b" />)}
  </group>
}

function WineryMesh() {
  return <group>
    <Box size={[1.94, 0.06, 0.94]} position={[0, 0.03, 0]} color="#484b49" />
    <Box size={[1.72, 0.48, 0.72]} position={[-0.04, 0.32, -0.02]} color="#62564b" />
    <Box size={[1.82, 0.08, 0.82]} position={[-0.04, 0.6, -0.02]} color="#56616a" />
    {[-0.7, -0.35, 0, 0.35, 0.7].map(x => <Box key={`roof-rib-${x}`} size={[0.025, 0.04, 0.84]} position={[x, 0.655, -0.02]} color="#aeb6b6" />)}
    <Box size={[0.54, 0.32, 0.035]} position={[0.46, 0.24, 0.35]} color="#393f42" />
    <Box size={[0.4, 0.24, 0.025]} position={[0.46, 0.21, 0.373]} color="#252c30" />
    {[-0.68, -0.36, -0.04].map(x => <group key={`cask-${x}`} position={[x, 0, 0.53]}>
      <Cylinder radius={0.12} radiusTop={0.105} height={0.28} segments={12} position={[0, 0.15, 0]} color="#83552f" />
      {[-0.1, 0.1].map(y => <Cylinder key={y} radius={0.125} height={0.025} segments={12} position={[0, 0.15 + y, 0]} color="#5f4634" />)}
    </group>)}
    <DisplayCar position={[0.68, 0, 0.75]} color="#9b4934" />
    {[-0.52, 0.12].map(x => <Window key={x} position={[x, 0.33, 0.35]} width={0.24} height={0.18} glass="#5a7777" />)}
  </group>
}

function MarketHallMesh() {
  return <group>
    <Box size={[1.94, 0.06, 0.94]} position={[0, 0.03, 0]} color="#c8b99d" />
    <Box size={[1.78, 0.42, 0.68]} position={[0, 0.28, 0]} color="#e1d4bc" />
    <Box size={[1.9, 0.055, 0.82]} position={[0, 0.53, 0]} color="#78563c" />
    {[-0.82, -0.42, 0, 0.42, 0.82].map(x => <group key={x}>
      <Box size={[0.035, 0.62, 0.035]} position={[x, 0.33, -0.34]} color="#554536" />
      <Box size={[0.035, 0.62, 0.035]} position={[x, 0.33, 0.34]} color="#554536" />
      <Box size={[0.035, 0.35, 0.035]} position={[x, 0.69, 0]} color="#554536" />
    </group>)}
    {[-0.62, 0, 0.62].map((x, i) => <group key={`stall-${x}`} position={[x, 0.09, 0.08]}>
      <Box size={[0.46, 0.13, 0.28]} position={[0, 0.16, 0]} color="#9b4934" />
      <Box size={[0.5, 0.035, 0.32]} position={[0, 0.27, 0]} color={i % 2 ? '#e8dfca' : '#c02626'} />
      {[-0.12, 0, 0.12].map((x2, j) => <mesh key={x2} position={[x2, 0.24, 0.02]} castShadow><sphereGeometry args={[0.055, 7, 5]} /><meshToonMaterial color={j % 2 ? '#eab308' : '#c02626'} /></mesh>)}
    </group>)}
    <Box size={[1.76, 0.04, 0.025]} position={[0, 0.48, 0.36]} color="#52796f" />
  </group>
}

/** Водонапорная башня: бак на четырёх опорах с красной конической крышей. */
export function WaterPump() {
  const legOffsets: Array<[number, number]> = [
    [-0.17, -0.17],
    [0.17, -0.17],
    [-0.17, 0.17],
    [0.17, 0.17],
  ]
  return (
    <group>
      <Pad />
      {legOffsets.map(([x, z]) => (
        <Cylinder
          key={`${x}:${z}`}
          radius={0.035}
          height={0.36}
          segments={8}
          position={[x, PAD_HEIGHT + 0.18, z]}
          color="#7a5a3a"
        />
      ))}
      <Box size={[0.46, 0.04, 0.46]} position={[0, PAD_HEIGHT + 0.38, 0]} color="#8a6a48" />
      <Cylinder
        radius={0.22}
        height={0.3}
        segments={18}
        position={[0, PAD_HEIGHT + 0.55, 0]}
        color="#6bb6d9"
      />
      <Cylinder
        radius={0.228}
        height={0.04}
        segments={18}
        position={[0, PAD_HEIGHT + 0.5, 0]}
        color="#3f86b0"
      />
      <Cone radius={0.26} height={0.17} segments={18} position={[0, PAD_HEIGHT + 0.785, 0]} color="#d8483f" />
    </group>
  )
}



export function Park() {
  return (
    <group>
      <Box size={[0.98, 0.04, 0.98]} position={[0, 0.02, 0]} color="#cdc4b5" />
      <Box size={[0.9, 0.04, 0.9]} position={[0, 0.06, 0]} color="#729148" />
      <SmallTree position={[0, 0.08, 0]} scale={1.15} />
    </group>
  )
}

export function WindTurbine() {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.z -= delta * 2 })
  return (
    <group>
      <Pad />
      <Box size={[0.4, 0.1, 0.4]} position={[0, PAD_HEIGHT + 0.05, 0]} color="#b5b8ba" />
      <Cylinder radius={0.04} radiusTop={0.02} height={0.8} segments={8} position={[0, PAD_HEIGHT + 0.45, 0]} color="#d6dadd" />
      <group position={[0, PAD_HEIGHT + 0.85, 0.05]}>
        <Box size={[0.1, 0.1, 0.12]} position={[0, 0, -0.05]} color="#a1a5a8" />
        <group ref={ref}>
          <Box size={[0.04, 0.7, 0.02]} position={[0, 0, 0.02]} color="#f0f2f4" />
          <Box size={[0.7, 0.04, 0.02]} position={[0, 0, 0.02]} color="#f0f2f4" />
        </group>
      </group>
    </group>
  )
}

function SolarPanelMesh() {
  return (
    <group>
      <Pad />
      <Box size={[0.62, 0.045, 0.42]} position={[0, PAD_HEIGHT + 0.35, 0]} rotation={[-0.28, 0, 0]} color="#2f5065" />
      <Box size={[0.64, 0.035, 0.44]} position={[0, PAD_HEIGHT + 0.39, 0]} rotation={[-0.28, 0, 0]} color="#7899a5" />
      {[-0.14, 0, 0.14].map((x) => <Box key={`solar-v-${x}`} size={[0.012, 0.008, 0.4]} position={[x, PAD_HEIGHT + 0.414, 0]} rotation={[-0.28, 0, 0]} color="#c7d5d5" outline={false} />)}
      <Box size={[0.012, 0.008, 0.6]} position={[0, PAD_HEIGHT + 0.414, 0]} rotation={[-0.28, 0, 0]} color="#c7d5d5" outline={false} />
      <Box size={[0.045, 0.32, 0.045]} position={[-0.22, PAD_HEIGHT + 0.16, -0.14]} color="#5b5b55" />
      <Box size={[0.045, 0.32, 0.045]} position={[0.22, PAD_HEIGHT + 0.16, 0.14]} color="#5b5b55" />
    </group>
  )
}

export function CoalPlant() {
  return (
    <group>
      <Pad />
      <Box size={[0.7, 0.3, 0.6]} position={[-0.05, PAD_HEIGHT + 0.15, 0]} color="#56595c" />
      <Cylinder radius={0.12} radiusTop={0.08} height={0.7} segments={12} position={[0.15, PAD_HEIGHT + 0.35, -0.1]} color="#3a3c3e" />
      <Cylinder radius={0.12} radiusTop={0.08} height={0.7} segments={12} position={[-0.15, PAD_HEIGHT + 0.35, 0.1]} color="#3a3c3e" />
      {/* Smoke */}
      <Cylinder radius={0.06} height={0.15} segments={6} position={[0.15, PAD_HEIGHT + 0.8, -0.1]} color="#8c9195"  />
      <Cylinder radius={0.06} height={0.15} segments={6} position={[-0.15, PAD_HEIGHT + 0.8, 0.1]} color="#8c9195"  />
    </group>
  )
}

function PoliceStationMesh() {
  return (
    <group>
      <Pad />
      <Box size={[0.68, 0.56, 0.62]} position={[0, PAD_HEIGHT + 0.28, 0]} color="#d6d0c2" />
      <Box size={[0.76, 0.12, 0.7]} position={[0, PAD_HEIGHT + 0.62, 0]} color="#343f55" />
      <Box size={[0.28, 0.3, 0.035]} position={[0, PAD_HEIGHT + 0.22, 0.32]} color="#31445b" />
      <Box size={[0.35, 0.12, 0.035]} position={[0, PAD_HEIGHT + 0.48, 0.326]} color="#f2e9d7" />
      <Box size={[0.06, 0.06, 0.04]} position={[0, PAD_HEIGHT + 0.49, 0.35]} color="#a63e32" outline={false} />
      <Box size={[0.08, 0.08, 0.08]} position={[0, PAD_HEIGHT + 0.75, 0]} color="#d6d0c2" />
    </group>
  )
}

function FireStationMesh() {
  return (
    <group>
      <Pad />
      <Box size={[0.78, 0.78, 0.68]} position={[-0.04, PAD_HEIGHT + 0.39, 0]} color="#c96b4f" />
      <Box size={[0.84, 0.1, 0.74]} position={[-0.04, PAD_HEIGHT + 0.82, 0]} color="#a44732" />
      {[-0.23, 0.15].map((x) => <group key={x}>
        <Box size={[0.31, 0.34, 0.045]} position={[x, PAD_HEIGHT + 0.19, 0.355]} color="#b52f2b" />
        <Box size={[0.04, 0.38, 0.05]} position={[x - 0.14, PAD_HEIGHT + 0.19, 0.38]} color="#eee4d4" />
        <Box size={[0.04, 0.38, 0.05]} position={[x + 0.14, PAD_HEIGHT + 0.19, 0.38]} color="#eee4d4" />
        <Box size={[0.3, 0.03, 0.05]} position={[x, PAD_HEIGHT + 0.37, 0.38]} color="#eee4d4" />
      </group>)}
      {[-0.26, 0.03].map((x) => <Window key={x} position={[x, 0.65, 0.35]} width={0.14} height={0.12} glass="#293746" frame="#efe2ce" sill={false} />)}
      <Box size={[0.2, 1.12, 0.22]} position={[0.36, PAD_HEIGHT + 0.56, -0.17]} color="#d1bfa5" />
      <Box size={[0.24, 0.12, 0.26]} position={[0.36, PAD_HEIGHT + 1.18, -0.17]} color="#a44732" />
      <Cylinder radius={0.07} radiusTop={0.07} height={0.14} segments={8} position={[0.36, PAD_HEIGHT + 1.3, -0.17]} color="#d33a32" />
    </group>
  )
}

function ModernGlassTowerMesh() {
  return <group>
    {/* Shared 2x2 landscaped plaza footprint. */}
    <Box size={[1.98, 0.08, 1.98]} position={[0, 0.04, 0]} color="#707779" />
    <Box size={[1.84, 0.035, 1.84]} position={[0, 0.095, 0]} color="#a9aaa2" />
    <Box size={[1.18, 0.06, 1.18]} position={[0, 0.14, 0]} color="#52796f" />
    {/* Three setbacks form a stepped business tower; the facade shader draws windows on every side. */}
    <Box size={[1.2, 2.08, 1.2]} position={[0, 1.19, 0]} color="#3d6e75" material={getFacadeMaterial({ wall: '#3d6e75', glass: '#8cc7d6', spacing: [0.15, 0.3], frame: [0.12, 0.16] })} />
    <Box size={[1.05, 2.72, 1.05]} position={[0, 3.59, 0]} color="#527f8a" material={getFacadeMaterial({ wall: '#527f8a', glass: '#a3d4e0', spacing: [0.15, 0.3], frame: [0.12, 0.16] })} />
    <Box size={[0.9, 2.34, 0.9]} position={[0, 6.12, 0]} color="#648c99" material={getFacadeMaterial({ wall: '#648c99', glass: '#b8e0ea', spacing: [0.15, 0.3], frame: [0.12, 0.16] })} />
    {[-0.43, -0.14, 0.14, 0.43].map((x) => <Box key={`front-lamella-${x}`} size={[0.025, 6.75, 0.035]} position={[x, 3.7, 0.615]} color="#f0f6f8" />)}
    {/* Rooftop terrace and illuminated helipad crown. */}
    <Box size={[0.96, 0.1, 0.96]} position={[0, 7.27, 0]} color="#6d8c46" />
    <Cylinder radius={0.34} height={0.018} segments={32} position={[0, 7.33, 0]} color="#dceef2" />
    <Box size={[0.08, 0.02, 0.42]} position={[0, 7.35, 0]} color="#fef08a" />
    <Box size={[0.32, 0.02, 0.08]} position={[0, 7.35, 0]} color="#fef08a" />
    <Box size={[0.5, 0.2, 0.48]} position={[0, 7.38, -0.52]} color="#84b7c1" />
    <Box size={[0.56, 0.025, 0.54]} position={[0, 7.49, -0.52]} color="#f0f6f8" />
    {/* Cypress trees around the tower and small square fountain in the garden. */}
    {[-0.79, 0.79].flatMap((x) => [-0.79, 0.79].map((z) => <group key={`cypress-${x}-${z}`} position={[x, 0.13, z]}>
      <Cylinder radius={0.035} radiusTop={0.025} height={0.3} segments={6} position={[0, 0.15, 0]} color="#684b35" />
      <Cone radius={0.14} height={0.42} segments={6} position={[0, 0.42, 0]} color="#355e48" />
      <Cone radius={0.1} height={0.38} segments={6} position={[0, 0.68, 0]} color="#4f795c" />
    </group>))}
    <Cylinder radius={0.2} height={0.09} segments={12} position={[0, 0.18, -0.77]} color="#d5d0c4" />
    <Cylinder radius={0.15} height={0.025} segments={12} position={[0, 0.235, -0.77]} color="#5b9bad" />
    {[-1, 1].map((side) => <group key={`tower-bench-${side}`} position={[side * 0.76, 0.14, 0.22]} rotation={[0, Math.PI / 2, 0]}>
      <Box size={[0.34, 0.035, 0.085]} position={[0, 0.12, 0]} color="#79583a" />
      <Box size={[0.34, 0.12, 0.025]} position={[0, 0.2, -0.03]} color="#79583a" />
    </group>)}
    {/* Glass entry canopy on the street-facing edge. */}
    <Box size={[0.62, 0.035, 0.24]} position={[0, 0.42, 0.77]} color="#dce8e2" />
    <Box size={[0.06, 0.28, 0.06]} position={[-0.26, 0.27, 0.83]} color="#a9c8c0" />
    <Box size={[0.06, 0.28, 0.06]} position={[0.26, 0.27, 0.83]} color="#a9c8c0" />
  </group>
}

function MegapolisComplexMesh() {
  const towers = [
    { x: -1.25, height: 5.1, color: '#3d6e75' },
    { x: 0, height: 6.4, color: '#527f8a' },
    { x: 1.25, height: 5.6, color: '#648c99' },
  ]
  return <group>
    <Box size={[3.96, 0.08, 1.96]} position={[0, 0.04, 0]} color="#555a5d" />
    <Box size={[3.82, 0.035, 1.82]} position={[0, 0.095, 0]} color="#a9aaa2" />
    {towers.map((tower, index) => <group key={`mega-tower-${index}`} position={[tower.x, 0.12, -0.22]}>
      <Box size={[0.72, tower.height, 0.82]} position={[0, tower.height / 2, 0]} color={tower.color} />
      {Array.from({ length: Math.floor(tower.height / 0.42) }, (_, floor) => <Box key={`window-${floor}`} size={[0.53, 0.19, 0.025]} position={[0, 0.35 + floor * 0.42, 0.423]} color={floor % 3 === index % 3 ? '#fef08a' : '#dff4fb'} />)}
      <Box size={[0.78, 0.08, 0.88]} position={[0, tower.height + 0.04, 0]} color="#d9e7e8" />
      <Box size={[0.07, 0.16, 0.07]} position={[0.25, tower.height + 0.16, -0.24]} color="#d63b32" />
    </group>)}
    {[0, 1].map((index) => <Box key={`skybridge-${index}`} size={[0.64, 0.19, 0.3]} position={[-0.62 + index * 1.25, 2.45 + index * 0.52, -0.22]} color="#b9d9df" />)}
    {/* Marked parking court, three compact parked cars and lot lights. */}
    {[-1.45, -0.48, 0.48, 1.45].map((x) => <Box key={`parking-line-${x}`} size={[0.018, 0.012, 0.55]} position={[x, 0.125, 0.62]} color="#f3eee0" />)}
    {[-1.05, 0, 1.05].map((x, index) => <group key={`parked-car-${x}`} position={[x, 0.2, 0.62]}>
      <Box size={[0.48, 0.16, 0.58]} position={[0, 0.08, 0]} color={['#b84b38', '#4e7890', '#d49a45'][index]} />
      <Box size={[0.31, 0.13, 0.27]} position={[0, 0.2, -0.025]} color="#b7d2d6" />
      {[-1, 1].flatMap((side) => [-1, 1].map((front) => <Cylinder key={`${side}:${front}`} radius={0.055} height={0.04} segments={8} position={[side * 0.22, 0.035, front * 0.19]} rotation={[0, 0, Math.PI / 2]} color="#202326" />))}
    </group>)}
    {[-1.82, 1.82].map((x) => <group key={`lot-light-${x}`} position={[x, 0.12, 0.72]}>
      <Cylinder radius={0.025} height={0.72} segments={6} position={[0, 0.36, 0]} color="#3b3934" />
      <Box size={[0.18, 0.045, 0.12]} position={[0, 0.73, 0]} color="#ffe08a" />
    </group>)}
    <Box size={[0.45, 0.035, 0.34]} position={[0, 0.13, -0.72]} color="#5b9bad" />
    <Box size={[0.48, 0.035, 0.38]} position={[0, 0.18, -0.72]} color="#d9e7e8" />
  </group>
}

function CinemaLetter({ letter, x }: { letter: string; x: number }) {
  const noRaycast: THREE.Object3D['raycast'] = () => undefined
  const bar = (key: string, size: Vec3, position: Vec3, rotation: Vec3 = [0, 0, 0]) => <Box key={key} size={size} position={position} rotation={rotation} color="#e8292e" material={cinemaSignMaterial} raycast={noRaycast} />
  const upright = bar('upright', [0.035, 0.2, 0.06], [0, 0, 0])
  const horizontal = (key: string, y: number) => bar(key, [0.14, 0.035, 0.06], [0, y, 0])
  const vertical = (key: string, xPos: number, y = 0) => bar(key, [0.035, 0.14, 0.06], [xPos, y, 0])
  let glyph: ReactNode
  if (letter === 'К') glyph = <>{upright}{bar('diag-top', [0.035, 0.12, 0.06], [0.035, 0.04, 0], [0, 0, -0.65])}{bar('diag-bottom', [0.035, 0.12, 0.06], [0.035, -0.04, 0], [0, 0, 0.65])}</>
  else if (letter === 'М') glyph = <>{upright}{vertical('right', 0.13)}{bar('diag-left', [0.035, 0.12, 0.06], [0.04, 0.035, 0], [0, 0, 0.65])}{bar('diag-right', [0.035, 0.12, 0.06], [0.09, 0.035, 0], [0, 0, -0.65])}</>
  else if (letter === 'О') glyph = <>{horizontal('top', 0.08)}{horizontal('bottom', -0.08)}{vertical('left', -0.06)}{vertical('right', 0.06)}</>
  else glyph = <>{upright}{horizontal('top', 0.08)}{horizontal('bottom', -0.08)}</>
  return <group position={[x, 1.64, 0.08]}>{glyph}</group>
}

function CinemaCosmosMesh() {
  const mosaic = ['#286391', '#f0e8d8', '#df7b36', '#367a9b', '#e6e2d6', '#cf633c', '#f4efe2', '#315779', '#e78a42', '#3d7392', '#e9e2d4', '#d76f3a', '#285577', '#e9e2d4', '#3c8198']
  return <group>
    <Box size={[2.75, 0.055, 1.95]} position={[0, 0.028, 0]} color="#d7cbb5" />
    <Box size={[2.2, 1.42, 1.6]} position={[0, 0.82, -0.02]} color="#e3dbcb" />
    <Box size={[2.28, 0.18, 1.7]} position={[0, 1.53, -0.02]} color="#b7aa94" />
    <Box size={[2.38, 0.16, 0.42]} position={[0, 1.15, 0.83]} color="#d7cbb5" />
    <Box size={[2.1, 0.78, 0.035]} position={[0, 0.65, 0.79]} color="#203b43" />
    {[-0.72, -0.24, 0.24, 0.72].map((x) => <Box key={x} size={[0.025, 0.78, 0.045]} position={[x, 0.65, 0.82]} color="#eee5d4" />)}
    <Box size={[0.035, 0.78, 0.045]} position={[0, 0.65, 0.82]} color="#eee5d4" />
    {/* Side mosaic panel: a compact geometric space motif. */}
    {mosaic.map((color, i) => {
      const col = i % 5
      const row = Math.floor(i / 5)
      return <Box key={`mosaic-${i}`} size={[0.025, 0.13, 0.13]} position={[1.115, 0.48 + row * 0.15, -0.42 + col * 0.15]} color={color} />
    })}
    {Array.from('КОСМОС').map((letter, index) => <CinemaLetter key={`${letter}-${index}`} letter={letter} x={(index - 2.5) * 0.2} />)}
    <Box size={[0.34, 0.42, 0.04]} position={[-0.82, 0.27, 0.82]} color="#d5cbb9" />
    <Box size={[0.2, 0.5, 0.05]} position={[0.84, 0.28, 0.82]} color="#d5cbb9" />
  </group>
}

function CathedralMesh() {
  return <group>
    <Box size={[1.98, 0.08, 1.98]} position={[0, 0.04, 0]} color="#d8d0c0" />
    <Box size={[1.78, 0.14, 1.78]} position={[0, 0.15, 0]} color="#f4f1e9" />
    <Box size={[1.6, 1.62, 1.58]} position={[0, 1.0, 0]} color="#f4f4f0" />
    {/* Pilasters, cornices, and tall narrow arched windows. */}
    {[-0.66, -0.22, 0.22, 0.66].map((x, i) => <group key={`front-pilaster-${i}`}>
      <Box size={[0.075, 1.58, 0.1]} position={[x, 1.02, 0.8]} color="#deded8" />
      <Window position={[x + 0.11, 1.13, 0.8]} width={0.12} height={0.58} glass="#1c2c46" frame="#fffefa" cross={false} sill={false} />
      <Cone radius={0.07} height={0.12} segments={6} position={[x + 0.11, 1.48, 0.8]} rotation={[0, 0, Math.PI]} color="#fffefa" />
    </group>)}
    <Box size={[1.82, 0.12, 1.8]} position={[0, 1.82, 0]} color="#e1e0d8" />
    <Cylinder radius={0.48} height={0.58} segments={12} position={[0, 2.16, 0]} color="#eeeae0" />
    <mesh position={[0, 2.7, 0]} scale={[0.52, 0.83, 0.52]} castShadow receiveShadow>
      <sphereGeometry args={[0.56, 12, 8]} />
      <meshStandardMaterial color="#e5a93b" metalness={0.36} roughness={0.48} />
      <Edges color="#6e4f27" threshold={30} />
    </mesh>
    <Cone radius={0.23} height={0.54} segments={8} position={[0, 3.38, 0]} color="#e5a93b" />
    <Box size={[0.035, 0.72, 0.035]} position={[0, 4.12, 0]} color="#b98937" />
    <Box size={[0.24, 0.035, 0.035]} position={[0, 4.18, 0]} color="#b98937" />
    {[-0.62, 0.62].flatMap((x) => [-0.62, 0.62].map((z) => <group key={`small-dome-${x}-${z}`}>
      <Cylinder radius={0.23} height={0.32} segments={10} position={[x, 2.02, z]} color="#eeeae0" />
      <mesh position={[x, 2.26, z]} scale={[0.25, 0.33, 0.25]} castShadow receiveShadow>
        <sphereGeometry args={[0.36, 10, 7]} />
        <meshStandardMaterial color="#255491" metalness={0.22} roughness={0.48} />
        <Edges color="#18365e" threshold={30} />
      </mesh>
      <Cone radius={0.1} height={0.28} segments={8} position={[x, 2.48, z]} color="#255491" />
    </group>))}
    {/* Low stone railing around the cathedral square. */}
    {[-0.9, 0.9].flatMap((x) => [-0.9, 0.9].map((z) => <Box key={`railing-post-${x}-${z}`} size={[0.08, 0.34, 0.08]} position={[x, 0.29, z]} color="#c6c2b8" />))}
    <Box size={[1.72, 0.06, 0.05]} position={[0, 0.41, -0.9]} color="#c6c2b8" />
    <Box size={[0.05, 0.06, 1.72]} position={[-0.9, 0.41, 0]} color="#c6c2b8" />
    <Box size={[0.05, 0.06, 1.72]} position={[0.9, 0.41, 0]} color="#c6c2b8" />
    <FestivalProps position={[-0.55, 0.08, 0.78]} scale={0.78} />
  </group>
}

const trackOuterWallGeo = new THREE.CylinderGeometry(0.76, 0.72, 0.52, 28, 1, true)
const trackInnerBowlGeo = new THREE.CylinderGeometry(0.49, 0.37, 0.44, 28, 1, true)
const trackRedRingGeo = new THREE.RingGeometry(0.49, 0.76, 32)
const trackWhiteInnerLaneGeo = new THREE.RingGeometry(0.485, 0.515, 32)
const trackWhiteMidLaneGeo = new THREE.RingGeometry(0.615, 0.635, 32)
const trackWhiteOuterLaneGeo = new THREE.RingGeometry(0.735, 0.765, 32)

const trackWallMat = (() => {
  const m = getToonMaterial('#5f7080').clone()
  m.side = THREE.DoubleSide
  return m
})()
const trackBowlMat = (() => {
  const m = getToonMaterial('#8d99a6').clone()
  m.side = THREE.DoubleSide
  return m
})()
const trackRedMat = (() => {
  const m = getToonMaterial('#d9382c').clone()
  m.side = THREE.DoubleSide
  return m
})()
const trackWhiteLaneMat = (() => {
  const m = getToonMaterial('#f8fafc').clone()
  m.side = THREE.DoubleSide
  return m
})()

/**
 * 3×3 Спортивный комплекс CityRT (строго по референсу #3):
 * овальный легкоатлетический стадион с красной беговой дорожкой на верхнем ярусе, белыми вертикальными рёбрами фасада и открытым зелёным полем внутри,
 * плюс крытый спорткомплекс с голубыми сводчатыми крышами, башней и стеклянным куполом.
 */
function StadiumMesh() {
  const paver = getPaverMaterial()
  return (
    <group>
      {/* Общая благоустроенная площадь спорткомплекса */}
      <Box size={[2.96, 0.06, 2.96]} position={[0, 0.03, 0]} color="#d8d5cb" material={paver} />

      {/* 1. Овальный легкоатлетический стадион с красной беговой дорожкой (слева) */}
      <group position={[-0.56, 0, -0.14]} scale={[1.04, 1, 0.88]}>
        {/* Полая внешняя стена чаши */}
        <mesh geometry={trackOuterWallGeo} material={trackWallMat} position={[0, 0.32, 0]} castShadow receiveShadow />
        {/* Белые вертикальные колонны-рёбра по периметру стадиона */}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2
          return (
            <Box
              key={i}
              size={[0.04, 0.54, 0.05]}
              position={[Math.cos(a) * 0.75, 0.33, Math.sin(a) * 0.75]}
              rotation={[0, -a + Math.PI / 2, 0]}
              color="#f2f5f8"
            />
          )
        })}

        {/* Внутренний склон трибун */}
        <mesh geometry={trackInnerBowlGeo} material={trackBowlMat} position={[0, 0.3, 0]} />

        {/* Красная беговая дорожка с белыми линиями разметки на верхнем ярусе */}
        <mesh
          geometry={trackRedRingGeo}
          material={trackRedMat}
          position={[0, 0.58, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={trackWhiteInnerLaneGeo}
          material={trackWhiteLaneMat}
          position={[0, 0.583, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <mesh
          geometry={trackWhiteMidLaneGeo}
          material={trackWhiteLaneMat}
          position={[0, 0.583, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <mesh
          geometry={trackWhiteOuterLaneGeo}
          material={trackWhiteLaneMat}
          position={[0, 0.583, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />

        {/* Открытое зелёное поле на дне чаши со спортивной разметкой и деревьями */}
        <Cylinder radius={0.39} height={0.04} segments={24} position={[0, 0.08, 0]} color="#53a149" outline={false} />
        <Box size={[0.38, 0.01, 0.24]} position={[0, 0.105, 0]} color="#f8fafc" outline={false} />
        <Box size={[0.34, 0.012, 0.2]} position={[0, 0.107, 0]} color="#5cb050" outline={false} />
        <StreetTree position={[-0.18, 0.1, -0.12]} />
        <StreetTree position={[0.18, 0.1, 0.12]} />
      </group>

      {/* 2. Крытые спортивные павильоны с голубыми сводчатыми крышами, башней и стеклянным куполом (справа) */}
      <group position={[0.64, 0.06, 0.22]}>
        {/* Стеклянный геодезический купол бассейна/манежа */}
        <Cylinder radius={0.34} height={0.14} segments={14} position={[-0.28, 0.07, -0.46]} color="#e8edf2" />
        <Dome radius={0.32} position={[-0.28, 0.14, -0.46]} color="#89c4e6" />

        {/* Высокая песчаниковая башня комплекса */}
        <Box size={[0.24, 0.78, 0.24]} position={[-0.02, 0.39, -0.34]} color="#d6c0a3" />
        <Cone radius={0.18} height={0.22} segments={4} position={[-0.02, 0.89, -0.34]} rotation={[0, Math.PI / 4, 0]} color="#54606e" />

        {/* Два корпуса с полукруглыми голубыми сводами крыши */}
        {[-0.22, 0.26].map((zOff, idx) => (
          <group key={idx} position={[0.16, 0, zOff]}>
            <Box size={[0.78, 0.34, 0.42]} position={[0, 0.17, 0]} color="#dfd1be" />
            <Cylinder
              radius={0.21}
              height={0.78}
              segments={12}
              position={[0, 0.34, 0]}
              rotation={[0, 0, Math.PI / 2]}
              color="#71abd4"
            />
          </group>
        ))}
      </group>

      {/* Аллея зелёных деревьев вокруг спорткомплекса */}
      {[
        [-1.18, 1.08],
        [-0.78, 1.16],
        [-0.38, 1.18],
        [0.08, 1.16],
        [1.18, -1.08],
        [0.82, -1.14],
      ].map(([x, z], i) => (
        <StreetTree key={i} position={[x, 0.06, z]} />
      ))}
    </group>
  )
}

function CropField({ plowed = false }: { plowed?: boolean }) {
  return <group>
    <Box size={[0.98, 0.035, 0.98]} position={[0, 0.018, 0]} color={plowed ? '#5c4033' : '#78914a'} />
    {Array.from({ length: 7 }, (_, index) => {
      const z = -0.39 + index * 0.13
      return <group key={index}>
        <Box size={[0.86, 0.025, 0.045]} position={[0, 0.05, z]} color={plowed ? '#38291f' : index % 2 ? '#eab308' : '#ca8a04'} />
        {!plowed && Array.from({ length: 9 }, (_, stalk) => <Box key={stalk} size={[0.025, 0.16, 0.025]} position={[-0.37 + stalk * 0.092, 0.13, z]} rotation={[0, 0, (stalk % 2 ? -1 : 1) * 0.14]} color={stalk % 3 ? '#eab308' : '#ca8a04'} />)}
      </group>
    })}
    {plowed && [-0.47, 0.47].flatMap((x) => [-0.47, 0.47].map((z) => <Box key={`${x}:${z}`} size={[0.035, 0.22, 0.035]} position={[x, 0.13, z]} color="#65462e" />))}
    {plowed && <><Box size={[0.94, 0.03, 0.025]} position={[0, 0.22, -0.47]} color="#65462e" /><Box size={[0.94, 0.03, 0.025]} position={[0, 0.22, 0.47]} color="#65462e" /><Box size={[0.025, 0.03, 0.94]} position={[-0.47, 0.22, 0]} color="#65462e" /><Box size={[0.025, 0.03, 0.94]} position={[0.47, 0.22, 0]} color="#65462e" /></>}
  </group>
}

function CatalogCivicMesh({ catalogId }: { catalogId?: string }) {
  if (catalogId === 'civ_school') return <group><Pad />
    <Box size={[0.68, 0.48, 0.6]} position={[0, PAD_HEIGHT + 0.24, 0]} color="#dfd2b7" />
    <Box size={[0.28, 0.38, 0.4]} position={[-0.3, PAD_HEIGHT + 0.19, -0.08]} color="#d2c4a6" />
    <Box size={[0.32, 0.035, 0.43]} position={[-0.3, PAD_HEIGHT + 0.4, -0.08]} color="#9a4934" />
    <Box size={[0.74, 0.08, 0.66]} position={[0, PAD_HEIGHT + 0.5, 0]} color="#a74e39" />
    <Box size={[0.54, 0.025, 0.24]} position={[0, 0.018, 0.56]} color="#6d8c46" />
    {[-0.16, 0, 0.16].map((x) => <Box key={x} size={[0.018, 0.012, 0.2]} position={[x, 0.034, 0.56]} color="#f5f0df" />)}
    <Box size={[0.28, 0.18, 0.03]} position={[0, PAD_HEIGHT + 0.13, 0.31]} color="#487a9b" />
    {[-1, 1].map((side) => <group key={`hoop-${side}`} position={[side * 0.2, 0.04, 0.68]}><Box size={[0.1, 0.01, 0.012]} position={[0, 0.13, 0]} color="#f5f0df" /><Box size={[0.012, 0.14, 0.012]} position={[0, 0.07, 0]} color="#f5f0df" /></group>)}
  </group>
  if (catalogId === 'civ_hospital') return <group><Pad />
    <Box size={[0.72, 0.7, 0.64]} position={[0, PAD_HEIGHT + 0.35, 0]} color="#e5e1d7" />
    <Box size={[0.78, 0.07, 0.7]} position={[0, PAD_HEIGHT + 0.72, 0]} color="#7895a0" />
    <Box size={[0.24, 0.23, 0.035]} position={[0, PAD_HEIGHT + 0.18, 0.34]} color="#f8f5eb" />
    <Box size={[0.045, 0.18, 0.04]} position={[0, PAD_HEIGHT + 0.18, 0.365]} color="#bd493f" />
    <Box size={[0.18, 0.045, 0.04]} position={[0, PAD_HEIGHT + 0.18, 0.365]} color="#bd493f" />
    {[-0.23, 0.23].map((x) => <Window key={x} position={[x, 0.57, 0.33]} width={0.13} height={0.16} glass="#7399ab" />)}
  </group>
  return <FireStationMesh />
}

function CatalogLandmarkMesh({ catalogId }: { catalogId?: string }) {
  if (catalogId === 'lnd_church') return <group><Pad />
    <Box size={[0.52, 0.78, 0.58]} position={[-0.08, PAD_HEIGHT + 0.39, 0]} color="#d5c8ad" />
    {[-0.32, 0.32].map((x) => <group key={x}><Box size={[0.12, 0.66, 0.12]} position={[x, PAD_HEIGHT + 0.33, 0.13]} color="#b9aa8e" /><Box size={[0.18, 0.12, 0.16]} position={[x, PAD_HEIGHT + 0.69, 0.13]} rotation={[0, 0, Math.PI / 4]} color="#b9aa8e" /></group>)}
    <Box size={[0.56, 0.12, 0.62]} position={[0, PAD_HEIGHT + 0.8, 0]} color="#4b5563" />
    <Box size={[0.15, 0.35, 0.04]} position={[0, PAD_HEIGHT + 0.2, 0.31]} color="#483b35" />
    <Box size={[0.24, 0.66, 0.25]} position={[0.26, PAD_HEIGHT + 0.91, -0.12]} color="#b9aa8e" />
    <Box size={[0.15, 0.2, 0.035]} position={[0.26, PAD_HEIGHT + 0.95, 0.02]} color="#3b4650" />
    <Cone radius={0.22} height={1.1} segments={6} position={[0.26, PAD_HEIGHT + 1.78, -0.12]} color="#3d454d" />
    <Box size={[0.035, 0.24, 0.035]} position={[0.26, PAD_HEIGHT + 2.37, -0.12]} color="#625b4f" />
    <Cone radius={0.18} height={0.54} segments={6} position={[-0.08, PAD_HEIGHT + 1.08, 0]} color="#343e4e" />
    <Cone radius={0.11} height={0.44} segments={6} position={[0, PAD_HEIGHT + 0.95, 0.17]} color="#4b5563" />
    {[-0.18, 0.18].map((x) => <group key={x}><Window position={[x, 0.52, 0.3]} width={0.1} height={0.25} glass="#526b7c" frame="#eee4d1" /><mesh position={[x, 0.65, 0.31]} castShadow receiveShadow><torusGeometry args={[0.052, 0.012, 6, 12, Math.PI]} /><meshToonMaterial color="#eee4d1" /></mesh></group>)}
  </group>
  if (catalogId === 'triumphal-arch') return <group><Pad />
    <Box size={[0.22, 0.76, 0.22]} position={[-0.26, PAD_HEIGHT + 0.38, 0]} color="#d5c4a3" />
    <Box size={[0.22, 0.76, 0.22]} position={[0.26, PAD_HEIGHT + 0.38, 0]} color="#d5c4a3" />
    <Box size={[0.78, 0.2, 0.24]} position={[0, PAD_HEIGHT + 0.86, 0]} color="#c6b28e" />
    <Box size={[0.34, 0.48, 0.08]} position={[0, PAD_HEIGHT + 0.39, 0.12]} color="#423d36" />
    <Box size={[0.68, 0.045, 0.28]} position={[0, PAD_HEIGHT + 0.99, 0]} color="#a58e68" />
  </group>
  return <SquareMesh />
}

export function NoPowerMarker() {
  const ref = useRef<THREE.Group>(null)
  const lightning = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0.06, 0.2)
    shape.lineTo(-0.08, 0.015)
    shape.lineTo(-0.005, 0.015)
    shape.lineTo(-0.06, -0.2)
    shape.lineTo(0.09, -0.005)
    shape.lineTo(0.015, -0.005)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 4) * 0.06
    }
  })
  return (
    <Billboard position={[0, 1.32, 0]} follow lockY={false} lockX={false} lockZ={false} userData={{ hideInPhoto: true }}>
      <group ref={ref}>
        <mesh renderOrder={20}><circleGeometry args={[0.19, 24]} /><meshBasicMaterial color="#fffaf0" transparent opacity={0.72} depthTest={false} /></mesh>
        <mesh geometry={lightning} position={[0, 0, 0.01]} renderOrder={21}>
          <meshBasicMaterial color="#eab308" transparent opacity={0.66} depthTest={false} />
        </mesh>
      </group>
    </Billboard>
  )
}

export function SmogMarker() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 1.3 + Math.cos(clock.elapsedTime * 3) * 0.05
    }
  })
  return (
    <group ref={ref} position={[0, 1.3, 0]} userData={{ hideInPhoto: true }}>
      <Billboard follow lockY={false} lockX={false} lockZ={false}>
        <mesh>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial color="#57534e"  depthTest={false} />
        </mesh>
      </Billboard>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Анимация постройки: пружинный pop-in (0 → 1.15 → 1.0) и облачко пыли        */
/* -------------------------------------------------------------------------- */

const POP_DURATION = 0.35
const POP_OVERSHOOT = 1.15
/** Доля анимации, за которую масштаб растёт от 0 до перелёта. */
const POP_RISE_PORTION = 0.6

function popScale(t: number): number {
  if (t >= 1) return 1
  if (t < POP_RISE_PORTION) {
    const u = t / POP_RISE_PORTION
    return POP_OVERSHOOT * (1 - Math.pow(1 - u, 3))
  }
  const v = (t - POP_RISE_PORTION) / (1 - POP_RISE_PORTION)
  return POP_OVERSHOOT - (POP_OVERSHOOT - 1) * (1 - Math.pow(1 - v, 2))
}

function PopIn({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const done = useRef(false)

  useFrame((_, delta) => {
    const target = group.current
    if (target === null || done.current) return
    elapsed.current += Math.min(delta, 0.05)
    const t = Math.min(elapsed.current / POP_DURATION, 1)
    const s = Math.max(popScale(t), 0.001)
    target.scale.setScalar(s)
    if (t >= 1) done.current = true
  })

  return (
    <group ref={group} scale={0.001}>
      {children}
    </group>
  )
}

function Scaffolding({ width, depth, height }: { width: number; depth: number; height: number }) {
  const beams = []
  const countX = Math.ceil(width / 0.2)
  const countZ = Math.ceil(depth / 0.2)
  const countY = Math.ceil(height / 0.25)

  // Вертикальные
  for (let x = 0; x <= countX; x++) {
    for (let z = 0; z <= countZ; z++) {
      beams.push(
        <Box key={`v${x}${z}`} size={[0.02, height, 0.02]} position={[-width/2 + x*(width/countX), height/2, -depth/2 + z*(depth/countZ)]} color="#a67c52" />
      )
    }
  }
  // Горизонтальные
  for (let y = 1; y <= countY; y++) {
    for (let z = 0; z <= countZ; z++) {
      beams.push(
        <Box key={`hz${y}${z}`} size={[width, 0.02, 0.02]} position={[0, y*0.25, -depth/2 + z*(depth/countZ)]} color="#a67c52" />
      )
    }
    for (let x = 0; x <= countX; x++) {
      beams.push(
        <Box key={`hx${y}${x}`} size={[0.02, 0.02, depth]} position={[-width/2 + x*(width/countX), y*0.25, 0]} color="#a67c52" />
      )
    }
  }

  return (
    <group>
      {/* Забор */}
      <Box size={[width + 0.1, 0.15, 0.02]} position={[0, 0.075, depth/2 + 0.05]} color="#d89f67" />
      <Box size={[width + 0.1, 0.15, 0.02]} position={[0, 0.075, -depth/2 - 0.05]} color="#d89f67" />
      <Box size={[0.02, 0.15, depth + 0.1]} position={[width/2 + 0.05, 0.075, 0]} color="#d89f67" />
      <Box size={[0.02, 0.15, depth + 0.1]} position={[-width/2 - 0.05, 0.075, 0]} color="#d89f67" />
      {beams}
    </group>
  )
}

function TowerCrane() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.5
    }
  })
  return (
    <group position={[0.4, 0, 0.4]}>
      {/* Мачта */}
      <Box size={[0.1, 1.5, 0.1]} position={[0, 0.75, 0]} color="#e63946" />
      <group position={[0, 1.5, 0]} ref={ref}>
        {/* Кабина */}
        <Box size={[0.15, 0.15, 0.15]} position={[0, 0.075, 0.05]} color="#1d3557" />
        {/* Стрела */}
        <Box size={[0.05, 0.05, 1.2]} position={[0, 0.15, -0.4]} color="#f1faee" />
        <Box size={[0.05, 0.05, 0.4]} position={[0, 0.15, 0.3]} color="#e63946" />
        {/* Противовес */}
        <Box size={[0.15, 0.1, 0.1]} position={[0, 0.2, 0.4]} color="#457b9d" />
        {/* Трос */}
        <Box size={[0.01, 0.8, 0.01]} position={[0, -0.25, -0.8]} color="#000" />
      </group>
    </group>
  )
}

const CONSTRUCTION_TIME = 4 // 4 секунды
function ConstructionWrapper({ children, w = 1, h = 1, type }: { children: ReactNode, w?: number, h?: number, type: TileType }) {
  const [constructed, setConstructed] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => setConstructed(true), CONSTRUCTION_TIME * 1000)
    return () => clearTimeout(timer)
  }, [])

  if (constructed) {
    return (
      <group>
        <PopIn>{children}</PopIn>
        <DustBurst count={15} />
      </group>
    )
  }

  const isLarge = w > 1 || h > 1 || type === TileType.COMMERCIAL || type === TileType.INDUSTRIAL

  return (
    <group>
      <PopIn>
        <Scaffolding width={w * 0.8} depth={h * 0.8} height={1.0} />
        {/* Бетонный монолит */}
        <Box size={[w * 0.7, 0.8, h * 0.7]} position={[0, 0.4, 0]} color="#9ca3af" />
        {isLarge && <TowerCrane />}
      </PopIn>
    </group>
  )
}

const DUST_DURATION = 0.8
const dustGeometry = new THREE.IcosahedronGeometry(1, 1)

/** Псевдослучайное число из индекса (детерминированно, без Math.random в рендере). */

interface DustParticle {
  dirX: number
  dirZ: number
  rise: number
  size: number
}

function DustBurst({ count = 10 }: { count?: number }) {
  const group = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const [finished, setFinished] = useState(false)

  const particles = useMemo<DustParticle[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + hash01(i) * 0.7
        const reach = 0.28 + hash01(i + 10) * 0.22
        return {
          dirX: Math.cos(angle) * reach,
          dirZ: Math.sin(angle) * reach,
          rise: 0.12 + hash01(i + 20) * 0.2,
          size: 0.04 + hash01(i + 30) * 0.035,
        }
      }),
    [count],
  )

  const materials = useMemo(
    () =>
      particles.map(
        () => new THREE.MeshBasicMaterial({ color: '#fbfaf5', transparent: true, depthWrite: false }),
      ),
    [particles],
  )

  useEffect(
    () => () => {
      for (const material of materials) material.dispose()
    },
    [materials],
  )

  useFrame((_, delta) => {
    const root = group.current
    if (root === null || finished) return
    elapsed.current += Math.min(delta, 0.05)
    const t = Math.min(elapsed.current / DUST_DURATION, 1)
    const out = 1 - Math.pow(1 - t, 3)
    root.children.forEach((child, i) => {
      const p = particles[i]
      child.position.set(p.dirX * (0.55 + out * 0.9), 0.07 + p.rise * out, p.dirZ * (0.55 + out * 0.9))
      child.scale.setScalar(p.size * (0.7 + out * 1.4) * (1 - t * 0.4))
      materials[i].opacity = (1 - t) * 0.9
    })
    if (t >= 1) setFinished(true)
  })

  if (finished) return null
  return (
    <group ref={group}>
      {particles.map((_, i) => (
        <mesh key={i} geometry={dustGeometry} material={materials[i]} scale={0.001} />
      ))}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Универсальный компонент тайла                                               */
/* -------------------------------------------------------------------------- */

interface TileModelProps extends RoadLinks {
  type: TileType
  catalogId?: string
  /** Вариант раскраски (цвет стен и крыши). */
  variant?: number
  /** Подключено ли здание к воде. Здания без воды получают парящий маркер. */
  hasWater?: boolean
  hasPower?: boolean
  smog?: boolean
  style?: string
  animate?: boolean
  hasSupplies?: boolean
  level?: number
}


function TileModelBase({ type, variant = 0, catalogId, hasWater = true, hasPower = true, hasSupplies = true, smog = false, level = 1, style, animate = true, north, south, east, west, junction }: TileModelProps) {
  let model: ReactNode = null
  let dust = 0
  let needsWater = false
  let needsPower = false
  let needsSupplies = false
  let w = 1, h = 1;
  let useConstruction = false;

  switch (type) {
    case TileType.ROAD:
      model = <Road north={north} south={south} east={east} west={west} junction={junction} variant={variant} />
      dust = 4
      break
    case TileType.WATER:
      model = <WaterTileMesh north={north} south={south} east={east} west={west} variant={variant} />
      dust = 0
      break
    case TileType.BRIDGE:
      model = <BridgeTileMesh catalogId={catalogId} north={north} south={south} east={east} west={west} />
      dust = 6
      break
    case TileType.RAIL:
      model = <RailTileMesh north={north} south={south} east={east} west={west} />
      dust = 4
      break
    case TileType.RAIL_BRIDGE:
      model = <RailTileMesh north={north} south={south} east={east} west={west} isBridge />
      dust = 6
      break
    case TileType.STATION:
      if (catalogId === 'civ_rail_stop') {
        model = <RailStopMesh />
        w = 1; h = 1
      } else if (catalogId === 'ind_freight_station') {
        model = <FreightStationMesh />
        w = 3; h = 1
      } else {
        model = <TrainStationMesh />
        w = 3; h = 1
      }
      dust = 12
      needsWater = true
      needsPower = true
      useConstruction = true
      break
    case TileType.FIELD_WHEAT:
      model = <CropField />
      break
    case TileType.FIELD_PLOW:
      model = <CropField plowed />
      break
    case TileType.RESIDENTIAL:
      if (catalogId === 'res_modern_glass_tower') {
        model = <ModernGlassTowerMesh />
        w = 2; h = 2
      } else if (catalogId === 'res_megapolis_complex') {
        model = <MegapolisComplexMesh />
        w = 4; h = 2
      } else if (catalogId === 'com_grid_tower') {
        model = <GridOfficeTowerMesh />
        w = 1; h = 1
      } else if (catalogId === 'com_glass_podium_tower') {
        model = <GlassPodiumTowerMesh />
        w = 2; h = 2
      } else if (catalogId === 'res_villa_conservatory') {
        model = <VillaConservatoryMesh />
      } else if (catalogId === 'res_balcony_block') {
        model = <BalconyBlockMesh />
      } else if (catalogId === 'res_brick_walkup') {
        model = <BrickWalkupMesh />
        w = 2; h = 1
      } else if (catalogId === 'res_stalinka_pink') {
        model = <StalinkaPinkMesh />
        w = 2; h = 2
      } else if (catalogId === 'res_streamline_curve') {
        model = <StreamlineCurveMesh />
        w = 2; h = 2
      } else if (catalogId === 'res_color_block') {
        model = <ColorBlockMesh />
        w = 2; h = 1
      } else if (catalogId === 'res_highrise_slab') {
        model = <HighriseSlabMesh />
        w = 2; h = 1
      } else if (catalogId === 'res_bay_towers') {
        model = <BayTowersMesh />
        w = 2; h = 2
      } else if (catalogId === 'res_modern_block') {
        model = <ModernBlockMesh />
      } else if (catalogId === 'res_brick_loft') {
        model = <BrickLoftMesh />
      } else if (catalogId === 'res_brownstone_us') {
        model = <Residential variant={variant} style="US" catalogId={catalogId} />
      } else if (catalogId === 'res_courtyard_east') {
        model = <Residential variant={variant} style="EAST" catalogId={catalogId} />
      } else if (catalogId === 'res_panel_block') {
        model = <group scale={[1.82, 1.35, 1.82]}><Residential variant={variant} catalogId="res_apartment" /></group>
        w = 2; h = 2
      } else if (catalogId === 'res_apartment') {
        model = <Residential variant={variant} catalogId="res_apartment" />
      } else if (catalogId === 'res_townhouse' || catalogId === 'res_half_timbered') {
        model = <Residential variant={catalogId === 'res_half_timbered' ? 2 : variant} catalogId={catalogId} />
      } else {
        model = <Residential variant={variant} catalogId={catalogId} />
      }
      dust = 10
      needsWater = true
      needsPower = true
      useConstruction = true
      break
    case TileType.COMMERCIAL:
      if (catalogId === 'com_cinema_cosmos') {
        model = <CinemaCosmosMesh />
        w = 3; h = 2
      } else if (catalogId === 'com_dept_store') {
        model = <DeptStoreMesh />
        w = 2; h = 1
      } else if (catalogId === 'com_grid_tower') {
        model = <GridOfficeTowerMesh />
        w = 1; h = 1
      } else if (catalogId === 'com_glass_podium_tower') {
        model = <GlassPodiumTowerMesh />
        w = 2; h = 2
      } else if (catalogId === 'com_diagrid_skyscraper') {
        model = <DiagridSkyscraperMesh />
        w = 2; h = 2
      } else if (catalogId === 'com_office_tower') {
        model = <OfficeTowerMesh />
        w = 2; h = 2
      } else if (catalogId === 'com_glass_skyscraper') {
        model = <GlassSkyscraperMesh />
        w = 2; h = 2
      } else if (catalogId === 'com_market_hall') {
        model = <MarketHallMesh />
        w = 2; h = 1
      } else {
        const isWide = catalogId === 'com_mall'
        model = <Commercial catalogId={catalogId} />
        if (isWide) w = 2
      }
      dust = 10
      needsWater = true
      needsPower = true
      needsSupplies = true
      useConstruction = true
      break
    case TileType.INDUSTRIAL:
      model = <Industrial catalogId={catalogId} />
      if (catalogId === 'ind_winery' || catalogId === 'ind_brickworks') { w = 2; h = 1 }
      if (catalogId === 'ind_concrete_plant' || catalogId === 'ind_steel_foundry') { w = 2; h = 2 }
      dust = 12
      needsWater = true
      needsPower = true
      useConstruction = true
      break
    case TileType.WATER_PUMP:
      if (catalogId === 'utl_water_intake') {
        model = <WaterIntakeMesh />
      } else {
        model = <WaterPump />
      }
      dust = 8
      break
    case TileType.CITY_HALL:
      model = <CityHallMesh onClick={() => window.dispatchEvent(new CustomEvent('OPEN_CITY_HALL'))} />
      dust = 20
      w = 2; h = 2;
      useConstruction = true;
      break
    case TileType.PARK:
      if (catalogId === 'lnd_cathedral') {
        model = <CathedralMesh />
        w = 2; h = 2
      } else if (catalogId === 'lnd_clock_tower') {
        model = <ClockTowerMesh />
      } else if (catalogId === 'park_waterfront') {
        model = <WaterfrontPromenadeMesh />
      } else if (catalogId === 'lnd_church') model = <CatalogLandmarkMesh catalogId={catalogId} />
      else if (catalogId === 'lnd_park') model = <FountainSquareMesh />
      else if (catalogId === 'park_rose_garden') model = <RoseGardenMesh />
      else if (catalogId === 'park_winter_tree') model = <ChristmasTreeMesh />
      else if (catalogId === 'park_plaza') model = <PlazaMesh />
      else if (catalogId === 'park_town_square') { model = <TownSquareMesh />; w = 2; h = 2 }
      else if (catalogId === 'lnd_parking') { model = <ParkingLotMesh variant={variant} />; w = 2; h = 1 }
      else if (style === 'PARK') { model = <ParkMesh />; w = 2; h = 2; }
      else if (style === 'LARGE_PARK') { model = <LargeParkMesh />; w = 3; h = 3; }
      else model = <SquareMesh />
      dust = 5
      break
    case TileType.WIND:
      model = <WindTurbine />
      dust = 5
      break
    case TileType.SOLAR_PANEL:
      model = <SolarPanelMesh />
      dust = 5
      break
    case TileType.COAL:
      model = <CoalPlant />
      dust = 15
      break
    case TileType.POLICE:
      model = <PoliceStationMesh />
      dust = 8
      break
    case TileType.FIRE_STATION:
      if (catalogId === 'civ_stadium') {
        model = <StadiumMesh />
        w = 3; h = 3
      } else if (catalogId === 'civ_diamond_arena') {
        model = <DiamondArenaMesh />
        w = 3; h = 3
      } else if (catalogId === 'civ_college_hall') {
        model = <CollegeHallMesh />
        w = 3; h = 2
      } else if (catalogId === 'civ_university') {
        model = <UniversityMesh />
        w = 3; h = 3
      } else model = <CatalogCivicMesh catalogId={catalogId} />
      dust = 8
      break
    default:
      return null
  }

  return (
    <>
      {useConstruction && animate ? (
        <ConstructionWrapper w={w} h={h} type={type}><group scale={[1, 1 + Math.max(0, level - 1) * 0.16, 1]}>{model}</group></ConstructionWrapper>
      ) : animate ? (
        <>
          <PopIn>{model}</PopIn>
          <DustBurst count={dust} />
        </>
      ) : <group scale={[1, 1 + Math.max(0, level - 1) * 0.16, 1]}>{model}</group>}
      {needsWater && !hasWater && <NoWaterMarker />}
      {needsPower && !hasPower && <NoPowerMarker />}
      {needsSupplies && !hasSupplies && <SupplyShortageMarker />}
      {smog && type === TileType.RESIDENTIAL && <Billboard position={[0.34, 1.18, 0]}>
        <group>
          <mesh position={[-0.045, 0, 0]}><circleGeometry args={[0.075, 12]} /><meshBasicMaterial color="#777d7e" transparent opacity={0.72} depthTest={false} /></mesh>
          <mesh position={[0.045, 0.015, 0]}><circleGeometry args={[0.09, 12]} /><meshBasicMaterial color="#8b9090" transparent opacity={0.7} depthTest={false} /></mesh>
          <mesh position={[0.12, -0.012, 0]}><circleGeometry args={[0.065, 12]} /><meshBasicMaterial color="#777d7e" transparent opacity={0.68} depthTest={false} /></mesh>
        </group>
      </Billboard>}
    </>
  )
}

export const TileModel = memo(TileModelBase)

export function SquareMesh() {
  return (
    <group>
      <Box size={[0.98, 0.04, 0.98]} position={[0, 0.02, 0]} color="#cdc4b5" />
      <Box size={[0.9, 0.04, 0.9]} position={[0, 0.06, 0]} color="#729148" />
      <SmallTree position={[0, 0.08, 0]} scale={0.62} />
    </group>
  )
}

export function FountainSquareMesh() {
  return <group>
    <Box size={[0.98, 0.04, 0.98]} position={[0, 0.02, 0]} color="#cdc4b5" />
    <Box size={[0.88, 0.04, 0.88]} position={[0, 0.06, 0]} color="#729148" />
    <Cylinder radius={0.22} height={0.08} segments={8} position={[0, 0.12, 0]} color="#c7bba5" />
    <Cylinder radius={0.17} height={0.035} segments={8} position={[0, 0.17, 0]} color="#548fa5" />
    <Cylinder radius={0.025} height={0.22} segments={8} position={[0, 0.28, 0]} color="#d9d0bf" />
    <FestivalProps position={[-0.25, 0.08, 0.29]} scale={0.56} />
    {[[0, -0.25, 0], [0, 0.25, 0], [-0.25, 0, Math.PI / 2], [0.25, 0, Math.PI / 2]].map(([x, z, angle], i) => <Box key={`path-${i}`} size={[0.1, 0.012, 0.24]} position={[x, 0.085, z]} rotation={[0, angle, 0]} color="#d0c3aa" />)}
    {[-1, 1].map((side) => <group key={side} position={[side * 0.32, 0.08, 0]}>
      <Box size={[0.28, 0.035, 0.08]} position={[0, 0.12, 0]} color="#79583a" />
      <Box size={[0.28, 0.09, 0.025]} position={[0, 0.19, -0.03]} color="#79583a" />
      {[-0.1, 0.1].map((x) => <Box key={x} size={[0.025, 0.1, 0.025]} position={[x, 0.05, 0]} color="#493629" />)}
    </group>)}
    {[-0.32, 0, 0.32].map((x) => <mesh key={`shrub-${x}`} position={[x, 0.17, -0.32]} geometry={bushGeometry} scale={0.09} castShadow receiveShadow material={getFoliageMaterial(x === 0 ? '#8f7255' : '#587c3b')}><lineSegments geometry={bushEdges} material={outlineMaterial} /></mesh>)}
    {[-0.34, 0.34].map((x) => <mesh key={`autumn-pumpkin-${x}`} position={[x, 0.1, 0.31]} scale={[0.08, 0.065, 0.07]}><sphereGeometry args={[1, 8, 6]} /><meshToonMaterial color="#ea580c" /></mesh>)}
  </group>
}

function FestivalProps({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return <group position={position} scale={scale}>
    {/* Striped harvest stall, tasting table, and oak casks. */}
    <Box size={[0.42, 0.06, 0.28]} position={[0, 0.32, 0]} color="#fff4e4" />
    {[-0.17, -0.06, 0.06, 0.17].map((x, i) => <Box key={`awning-${i}`} size={[0.11, 0.035, 0.3]} position={[x, 0.36, 0]} color={i % 2 ? '#c84935' : '#e87c32'} />)}
    {[-0.18, 0.18].map((x) => <Box key={`stall-post-${x}`} size={[0.025, 0.32, 0.025]} position={[x, 0.16, -0.1]} color="#76513a" />)}
    <Box size={[0.38, 0.08, 0.16]} position={[0, 0.15, 0.19]} color="#79583a" />
    {[-0.15, 0.15].map((x) => <Cylinder key={`cask-${x}`} radius={0.065} radiusTop={0.06} height={0.15} segments={10} position={[x, 0.12, -0.18]} color="#8b5b34" />)}
    {[-0.22, 0.22].map((x) => <mesh key={`pumpkin-${x}`} position={[x, 0.11, 0.23]} scale={[0.07, 0.055, 0.06]}><sphereGeometry args={[1, 8, 6]} /><meshToonMaterial color="#ea580c" /></mesh>)}
    <Box size={[0.12, 0.025, 0.035]} position={[0, 0.58, 0]} color="#c43f2e" />
  </group>
}

export function ParkMesh() {
  return (
    <group position={[0.5, 0, 0.5]} scale={2}>
      <Box size={[0.98, 0.04, 0.98]} position={[0, 0.02, 0]} color="#cdc4b5" />
      <Box size={[0.9, 0.04, 0.9]} position={[0, 0.06, 0]} color="#729148" />
      {[[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]].map(([x,z], i) => (
        <SmallTree key={i} position={[x, 0.08, z]} scale={0.62} />
      ))}
      {[[-0.3, -0.1], [0.3, 0.1]].map(([x, z], i) => (
        <group key={`bench-${i}`} position={[x, 0.08, z]} rotation={[0, i ? Math.PI / 2 : 0, 0]}>
          <Box size={[0.28, 0.035, 0.09]} position={[0, 0.12, 0]} color="#79583a" />
          <Box size={[0.28, 0.11, 0.025]} position={[0, 0.2, -0.035]} color="#79583a" />
          {[-0.1, 0.1].map((leg) => <Box key={leg} size={[0.025, 0.1, 0.025]} position={[leg, 0.05, 0]} color="#493629" />)}
        </group>
      ))}
    </group>
  )
}

export function LargeParkMesh() {
  return (
    <group position={[1, 0, 1]} scale={3}>
      <Box size={[0.98, 0.04, 0.98]} position={[0, 0.02, 0]} color="#cdc4b5" />
      <Box size={[0.9, 0.04, 0.9]} position={[0, 0.06, 0]} color="#6d8c46" />
      <Cylinder radiusTop={0.15} radius={0.15} height={0.05} segments={16} position={[0, PAD_HEIGHT+0.025, 0]} color="#d4d4d8" />
      <Cylinder radiusTop={0.1} radius={0.1} height={0.02} segments={16} position={[0, PAD_HEIGHT+0.06, 0]} color="#60a5fa" />
      <Cylinder radiusTop={0.02} radius={0.02} height={0.1} segments={8} position={[0, PAD_HEIGHT+0.1, 0]} color="#d4d4d8" />
      {[[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3], [-0.3,-0.3], [0.3,0.3]].map(([x,z], i) => (
        <SmallTree key={i} position={[x, 0.08, z]} scale={0.58} />
      ))}
    </group>
  )
}

function RoseGardenMesh() {
  return <group>
    <Box size={[0.98, 0.05, 0.98]} position={[0, 0.025, 0]} color="#b9aa8f" />
    <Box size={[0.86, 0.025, 0.86]} position={[0, 0.065, 0]} color="#82904f" />
    <Box size={[0.76, 0.018, 0.13]} position={[0, 0.09, 0]} color="#c8b99d" />
    <Box size={[0.13, 0.018, 0.76]} position={[0, 0.09, 0]} color="#c8b99d" />
    {[-0.32, 0.32].flatMap(x => [-0.32, 0.32].map(z => <Box key={`${x}:${z}`} size={[0.22, 0.19, 0.22]} position={[x, 0.17, z]} color="#526b37" />))}
    {[-0.34, 0.34].flatMap(x => [-0.34, 0.34].map(z => <mesh key={`rose-${x}:${z}`} position={[x, 0.29, z]}><icosahedronGeometry args={[0.09, 0]} /><meshToonMaterial color={x * z > 0 ? '#c02626' : '#ea580c'} /></mesh>))}
    {/* White iron gazebo in the garden center. */}
    <Cylinder radius={0.23} height={0.035} segments={12} position={[0, 0.12, 0]} color="#eee9dc" />
    {[0, 1, 2, 3].map(i => <Cylinder key={i} radius={0.018} height={0.5} segments={6} position={[Math.cos(i * Math.PI / 2) * 0.18, 0.38, Math.sin(i * Math.PI / 2) * 0.18]} color="#f5f1e8" />)}
    <Cone radius={0.26} height={0.22} segments={8} position={[0, 0.73, 0]} color="#f5f1e8" />
    {[-0.38, 0.38].map(x => <Box key={`bench-${x}`} size={[0.22, 0.045, 0.07]} position={[x, 0.12, 0.05]} color="#79583a" />)}
  </group>
}

export function CityHallMesh({ onClick }: { onClick?: () => void }) {
  return (
    <group onClick={onClick}>
      <Box size={[1.98, 0.04, 1.98]} position={[0, 0.02, 0]} color="#51483f" />
      <Box size={[1.96, 0.22, 1.96]} position={[0, 0.13, 0]} color="#c8bfb0" />
      <Box size={[1.78, 0.75, 1.78]} position={[0, 0.62, 0]} color="#d4a373" />
      {/* Front arcade: dark recesses framed by pale stone piers. */}
      {[-0.55, 0, 0.55].map((x) => (
        <group key={x} position={[x, 0.34, 0.895]}>
          <Box size={[0.28, 0.5, 0.035]} position={[0, 0, 0]} color="#343b45" />
          <Cylinder radius={0.14} radiusTop={0.14} height={0.04} segments={12} position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} color="#343b45" />
          <Box size={[0.06, 0.58, 0.08]} position={[-0.18, 0, 0]} color="#eee4d4" />
          <Box size={[0.06, 0.58, 0.08]} position={[0.18, 0, 0]} color="#eee4d4" />
        </group>
      ))}
      <Box size={[0.62, 1.8, 0.62]} position={[0, 1.9, 0]} color="#d4a373" />
      <Box size={[0.72, 0.13, 0.72]} position={[0, 2.83, 0]} color="#52796f" />
      <Box size={[0.78, 0.42, 0.78]} position={[0, 3.1, 0]} color="#c28f61" />
      {[-0.16, 0.16].map((x) => (
        <group key={`tower-window-${x}`} position={[x, 2.25, 0.315]}>
          <Box size={[0.1, 0.38, 0.025]} position={[0, 0, 0]} color="#343b45" />
          <Cylinder radius={0.05} height={0.025} segments={12} position={[0, 0.19, 0]} rotation={[Math.PI / 2, 0, 0]} color="#343b45" />
          <Box size={[0.025, 0.44, 0.04]} position={[-0.06, 0, 0.015]} color="#eee4d4" />
          <Box size={[0.025, 0.44, 0.04]} position={[0.06, 0, 0.015]} color="#eee4d4" />
        </group>
      ))}
      {/* Clock dial, rim and hands on the front of the tower. */}
      <Cylinder radius={0.21} height={0.04} segments={24} position={[0, 3.1, 0.405]} rotation={[Math.PI / 2, 0, 0]} color="#57483b" />
      <Cylinder radius={0.17} height={0.045} segments={24} position={[0, 3.1, 0.431]} rotation={[Math.PI / 2, 0, 0]} color="#f7f0df" material={townHallClockMaterial} />
      <Box size={[0.018, 0.11, 0.018]} position={[0, 3.13, 0.46]} color="#252a31" outline={false} />
      <Box size={[0.075, 0.018, 0.018]} position={[0.025, 3.085, 0.46]} rotation={[0, 0, -0.5]} color="#252a31" outline={false} />
      <Cone radius={0.49} height={0.98} segments={4} position={[0, 3.8, 0]} rotation={[0, Math.PI / 4, 0]} color="#52796f" />
      <Cylinder radius={0.025} radiusTop={0.005} height={0.44} segments={6} position={[0, 4.53, 0]} color="#52796f" />
      <Box size={[0.23, 0.025, 0.015]} position={[0.06, 4.58, 0]} color="#a0a0a0" />
    </group>
  )
}

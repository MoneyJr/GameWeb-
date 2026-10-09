import { Billboard } from '@react-three/drei'
import { Fragment, memo, useEffect, useMemo, useRef, useState, useContext, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TileType } from '../../types/city'
import { NoWaterMarker, SupplyShortageMarker } from './StatusMarkers'

/* -------------------------------------------------------------------------- */
/*  Общие ресурсы: геометрии, материалы и контуры кэшируются и переиспользуются  */
/* -------------------------------------------------------------------------- */

type Vec3 = [number, number, number]

type Shape =
  | { kind: 'box'; size: Vec3 }
  | { kind: 'cylinder'; radiusTop: number; radiusBottom: number; height: number; segments: number }
  | { kind: 'cone'; radius: number; height: number; segments: number }

const OUTLINE_COLOR = '#1a1816'

let gradientMap: THREE.DataTexture | null = null

/** 3-ступенчатая градиентная карта для "мультяшного" ступенчатого освещения. */
function getGradientMap(): THREE.DataTexture {
  if (gradientMap === null) {
    const texture = new THREE.DataTexture(new Uint8Array([105, 180, 255]), 3, 1, THREE.RedFormat)
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    gradientMap = texture
  }
  return gradientMap
}

const materialCache = new Map<string, THREE.MeshToonMaterial>()
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

function getToonMaterial(color: string): THREE.MeshToonMaterial {
  let material = materialCache.get(color)
  if (material === undefined) {
    material = new THREE.MeshToonMaterial({
      color,
      gradientMap: getGradientMap(),
      // Сдвигаем грани назад, чтобы линии контура не мерцали (z-fighting).
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    materialCache.set(color, material)
  }
  return material
}

const outlineMaterial = new THREE.LineBasicMaterial({ color: OUTLINE_COLOR })
const bushGeometry = new THREE.IcosahedronGeometry(1, 0)
const bushEdges = new THREE.EdgesGeometry(bushGeometry)

const geometryCache = new Map<string, THREE.BufferGeometry>()
const edgesCache = new Map<string, THREE.EdgesGeometry>()

function shapeKey(shape: Shape): string {
  return JSON.stringify(shape)
}

function getGeometry(shape: Shape): THREE.BufferGeometry {
  const key = shapeKey(shape)
  let geometry = geometryCache.get(key)
  if (geometry === undefined) {
    switch (shape.kind) {
      case 'box':
        geometry = new THREE.BoxGeometry(shape.size[0], shape.size[1], shape.size[2])
        break
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          shape.radiusTop,
          shape.radiusBottom,
          shape.height,
          shape.segments,
        )
        break
      case 'cone':
        geometry = new THREE.ConeGeometry(shape.radius, shape.height, shape.segments)
        break
    }
    geometryCache.set(key, geometry)
  }
  return geometry
}

function getEdges(shape: Shape): THREE.EdgesGeometry {
  const key = shapeKey(shape)
  let edges = edgesCache.get(key)
  if (edges === undefined) {
    // Для гладких тел (цилиндры, конусы) рисуем только обод, для граней — все рёбра.
    const smooth =
      shape.kind === 'cylinder' || (shape.kind === 'cone' && shape.segments > 4)
    edges = new THREE.EdgesGeometry(getGeometry(shape), smooth ? 35 : 15)
    edgesCache.set(key, edges)
  }
  return edges
}

/* -------------------------------------------------------------------------- */
/*  Примитив: Mesh + MeshToonMaterial + чёрный контур рёбер (EdgesGeometry)      */
/* -------------------------------------------------------------------------- */

interface PartProps {
  shape: Shape
  color: string
  position: Vec3
  rotation?: Vec3
  outline?: boolean
  castShadow?: boolean
  material?: THREE.Material
}

function Part({ shape, color, position, rotation, outline = true, castShadow = true, material }: PartProps) {
  return (
    <mesh
      geometry={getGeometry(shape)}
      material={material || getToonMaterial(color)}
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow
    >
      {outline && <lineSegments geometry={getEdges(shape)} material={outlineMaterial} />}
    </mesh>
  )
}

function Box({
  size,
  ...rest
}: { size: Vec3 } & Omit<PartProps, 'shape'>) {
  return <Part shape={{ kind: 'box', size }} {...rest} />
}

function Cylinder({
  radius,
  radiusTop,
  height,
  segments = 16,
  ...rest
}: { radius: number; radiusTop?: number; height: number; segments?: number } & Omit<PartProps, 'shape'>) {
  return (
    <Part
      shape={{ kind: 'cylinder', radiusTop: radiusTop ?? radius, radiusBottom: radius, height, segments }}
      {...rest}
    />
  )
}

function Cone({
  radius,
  height,
  segments = 16,
  ...rest
}: { radius: number; height: number; segments?: number } & Omit<PartProps, 'shape'>) {
  return <Part shape={{ kind: 'cone', radius, height, segments }} {...rest} />
}

/** Цоколь под зданием. */
const PAD_HEIGHT = 0.06

function Pad() {
  return <Box size={[0.94, PAD_HEIGHT, 0.94]} position={[0, PAD_HEIGHT / 2, 0]} color="#dcd5c3" />
}

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
}


/** Дорога: серый плоский тайл с пунктирной разметкой вдоль соседних дорог. */
export function Road({ north, south, east, west, variant = 0 }: RoadLinks & { variant?: number }) {
  const isIntersection = (north || south) && (east || west)
  const isStraightX = east || west || (!north && !south)
  const isStraightZ = north || south

  return (
    <group>
      {/* Asphalt */}
      <Box size={[1, 0.04, 1]} position={[0, 0.02, 0]} color="#3a3d45" />

      {/* Sidewalks (тротуары с бордюрами) */}
      {isStraightX && !isIntersection && (
        <group>
          <Box size={[1, 0.06, 0.2]} position={[0, 0.03, -0.4]} color="#dcd4c5" />
          <Box size={[1, 0.06, 0.2]} position={[0, 0.03, 0.4]} color="#dcd4c5" />
        </group>
      )}
      {isStraightZ && !isIntersection && (
        <group>
          <Box size={[0.2, 0.06, 1]} position={[-0.4, 0.03, 0]} color="#dcd4c5" />
          <Box size={[0.2, 0.06, 1]} position={[0.4, 0.03, 0]} color="#dcd4c5" />
        </group>
      )}
      {isIntersection && (
        <group>
          <Box size={[0.2, 0.06, 0.2]} position={[-0.4, 0.03, -0.4]} color="#dcd4c5" />
          <Box size={[0.2, 0.06, 0.2]} position={[0.4, 0.03, -0.4]} color="#dcd4c5" />
          <Box size={[0.2, 0.06, 0.2]} position={[-0.4, 0.03, 0.4]} color="#dcd4c5" />
          <Box size={[0.2, 0.06, 0.2]} position={[0.4, 0.03, 0.4]} color="#dcd4c5" />
        </group>
      )}

      {/* Road Markings */}
      {!isIntersection && isStraightX && (
        <Box size={[0.4, 0.01, 0.02]} position={[0, 0.045, 0]} color="#ffffff" outline={false} castShadow={false} />
      )}
      {!isIntersection && isStraightZ && (
        <Box size={[0.02, 0.01, 0.4]} position={[0, 0.045, 0]} color="#ffffff" outline={false} castShadow={false} />
      )}

      {/* Zebra Crossings at Intersections */}
      {isIntersection && (
        <group position={[0, 0.045, 0]}>
          {[-0.25, 0.25].map(x => (
            <group key={`zebra-x-${x}`} position={[x, 0, 0]}>
              {[-0.1, 0, 0.1].map(z => <Box key={z} size={[0.1, 0.01, 0.04]} position={[0, 0, z]} color="#ffffff" outline={false} castShadow={false} />)}
            </group>
          ))}
          {[-0.25, 0.25].map(z => (
            <group key={`zebra-z-${z}`} position={[0, 0, z]}>
              {[-0.1, 0, 0.1].map(x => <Box key={x} size={[0.04, 0.01, 0.1]} position={[x, 0, 0]} color="#ffffff" outline={false} castShadow={false} />)}
            </group>
          ))}
        </group>
      )}

      {/* Streetlights and Trees */}
      {isStraightX && !isIntersection && variant === 0 && (
        <group>
          <Streetlight position={[0, 0, -0.35]} />
          <Streetlight position={[0, 0, 0.35]} rotation={[0, Math.PI, 0]} />
        </group>
      )}
      {isStraightZ && !isIntersection && variant === 0 && (
        <group>
          <Streetlight position={[-0.35, 0, 0]} rotation={[0, Math.PI/2, 0]} />
          <Streetlight position={[0.35, 0, 0]} rotation={[0, -Math.PI/2, 0]} />
        </group>
      )}
    </group>
  )
}

function Streetlight({ position, rotation = [0, 0, 0] }: { position: Vec3, rotation?: Vec3 }) {
  return (
    <group position={position} rotation={rotation}>
      <Cylinder radius={0.01} height={0.4} segments={6} position={[0, 0.2, 0]} color="#333" />
      <Box size={[0.12, 0.02, 0.02]} position={[0, 0.4, 0.05]} color="#333" />
      <Box size={[0.04, 0.02, 0.04]} position={[0, 0.39, 0.08]} color="#ffffcc" outline={false} />
    </group>
  )
}

function SmallTree({ position, scale = 1 }: { position: Vec3, scale?: number }) {
  const foliage = ['#43662d', '#587c3b', '#859b4c']
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


type Facing = 'z' | 'x' | '-z' | '-x'

const FACING_ROTATION: Record<Facing, number> = { z: 0, x: Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 }

interface WindowProps {
  /** Точка на поверхности стены. */
  position: Vec3
  facing?: Facing
  width?: number
  height?: number
  glass?: string
  frame?: string
  cross?: boolean
  sill?: boolean
}

import { getGlassMaterial, WindowSeedContext, hash01 } from './primitives'

/** Окно: рама, стекло, переплёт-крест и подоконник. Смотрит по локальной оси +Z (поворачивается через facing). */
function Window({
  position,
  facing = 'z',
  width = 0.1,
  height = 0.12,
  glass = '#8fd3ff',
  frame = '#fff8ea',
  cross = true,
  sill = true,
}: WindowProps) {
  const seed = useContext(WindowSeedContext)
  const lit = hash01(seed * 3.17 + position[0] * 91.3 + position[1] * 57.9 + position[2] * 33.1) > 0.22

  return (
    <group position={position} rotation={[0, FACING_ROTATION[facing], 0]}>
      <Box size={[width + 0.04, height + 0.04, 0.012]} position={[0, 0, 0]} color={frame} />
      <mesh
        position={[0, 0, 0.005]}
        geometry={getGeometry({ kind: 'box', size: [width, height, 0.024] })}
        material={getGlassMaterial(glass, lit)}
        castShadow={false}
        receiveShadow
      />
      {cross && (
        <>
          <Box
            size={[0.012, height, 0.03]}
            position={[0, 0, 0.007]}
            color={frame}
            outline={false}
            castShadow={false}
          />
          <Box
            size={[width, 0.012, 0.03]}
            position={[0, 0, 0.007]}
            color={frame}
            outline={false}
            castShadow={false}
          />
        </>
      )}
      {sill && (
        <Box size={[width + 0.07, 0.02, 0.05]} position={[0, -height / 2 - 0.03, 0.016]} color="#c9b99a" />
      )}
    </group>
  )
}


const domeCache = new Map<number, { geometry: THREE.SphereGeometry; edges: THREE.EdgesGeometry }>()

/** Купол — полусфера радиуса radius, стоящая на плоскости y = 0. */
function Dome({ radius, color, position }: { radius: number; color: string; position: Vec3 }) {
  let entry = domeCache.get(radius)
  if (entry === undefined) {
    const geometry = new THREE.SphereGeometry(radius, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    entry = { geometry, edges: new THREE.EdgesGeometry(geometry, 35) }
    domeCache.set(radius, entry)
  }
  return (
    <mesh geometry={entry.geometry} material={getToonMaterial(color)} position={position} castShadow receiveShadow>
      <lineSegments geometry={entry.edges} material={outlineMaterial} />
    </mesh>
  )
}

/**
 * Жилой дом: трёхъярусная ступенчатая (черепичная) скатная крыша с контрастным цветом,
 * слуховое окно, труба с оголовком, окна с рамами и переплётами, дверь с крыльцом.
 */
export function Residential({ variant = 0, style = 'EU', catalogId }: { variant?: number, style?: string, catalogId?: string }) {
  const floors = catalogId === 'cottage' ? 1 : catalogId === 'townhouse' ? 2 : catalogId === 'apartment' ? 4 : 2 + (variant % 3)

  if (catalogId === 'cottage') {
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

  if (catalogId === 'apartment') {
    const base = 0.2
    const levelHeight = 0.42
    const bodyHeight = levelHeight * 4
    const roofBase = base + bodyHeight
    return <group>
      <ResidentialBase />
      <Box size={[0.95, base, 0.95]} position={[0, base / 2, 0]} color="#89857f" />
      {Array.from({ length: 4 }, (_, i) => <Box key={`stone-course-${i}`} size={[0.96, 0.018, 0.97]} position={[0, 0.04 + i * 0.05, 0]} color="#bbb4a8" />)}
      <Box size={[0.86, bodyHeight, 0.84]} position={[0, base + bodyHeight / 2, -0.02]} color="#c27c59" />
      <Box size={[0.96, 0.035, 0.06]} position={[0, base + 0.1, 0.45]} color="#e4c9aa" />
      {Array.from({ length: 4 }, (_, floor) => <group key={`apartment-floor-${floor}`} position={[0, base + floor * levelHeight, 0]}>
        <Box size={[0.97, 0.045, 0.08]} position={[0, levelHeight - 0.025, 0.44]} color="#e0b994" />
        {[-0.29, 0, 0.29].map((x) => <Window key={x} position={[x, 0.34, 0.43]} width={0.15} height={0.34} glass="#293643" frame="#efe2ce" sill />)}
      </group>)}
      <Box size={[1.02, 0.1, 1.02]} position={[0, roofBase + 0.03, 0]} color="#5f6267" />
      <Box size={[1.02, 0.18, 0.06]} position={[0, roofBase + 0.15, 0.48]} color="#89857f" />
      <Box size={[0.06, 0.18, 1.02]} position={[-0.48, roofBase + 0.15, 0]} color="#89857f" />
      <Box size={[0.06, 0.18, 1.02]} position={[0.48, roofBase + 0.15, 0]} color="#89857f" />
      {[-0.25, 0.25].map((x) => <Box key={x} size={[0.16, 0.12, 0.18]} position={[x, roofBase + 0.17, -0.2]} color="#767b81" />)}
      <Box size={[0.2, 0.35, 0.035]} position={[0, base + 0.18, 0.43]} color="#4e3328" />
    </group>
  }

  // Wall-to-wall European townhouse: one full tile with a deep, warm facade.
  const walls = ['#dfd7c5', '#d99f66', '#c4694b', '#e0ba72']
  const roofs = ['#a03b26', '#b84630', '#8e382b']
  const wallColor = catalogId === 'townhouse' ? '#eedec5' : walls[variant % walls.length]
  const roofColor = catalogId === 'apartment' ? '#3d4450' : roofs[variant % roofs.length]
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
export function Commercial({ catalogId }: { catalogId?: string }) {
  const stripes = [-0.275, -0.165, -0.055, 0.055, 0.165, 0.275]
  return (
    <group>
      <CommercialBase />
      <Box size={[0.82, 0.5, 0.72]} position={[0, PAD_HEIGHT + 0.25, -0.02]} color={catalogId === 'grocer' ? '#dfbd76' : catalogId === 'mall' ? '#c9c9bd' : '#f4d9a6'} />
      <Box size={[0.88, 0.05, 0.78]} position={[0, PAD_HEIGHT + 0.525, -0.02]} color={catalogId === 'mall' ? '#66727d' : '#c9784a'} />
      <Box size={[0.78, 0.03, 0.68]} position={[0, PAD_HEIGHT + 0.565, -0.02]} color="#e0b183" />

      {/* крыша: вывеска и кондиционер */}
      <Box size={[0.34, 0.1, 0.04]} position={[0, PAD_HEIGHT + 0.64, 0.12]} color="#5cb3e6" />
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
      {catalogId === 'mall' && <group>{[-0.31, -0.1, 0.11, 0.32].map((x) => <Box key={x} size={[0.035, 0.012, 0.22]} position={[x, 0.014, 0.61]} color="#f5f0df" />)}<Box size={[0.92, 0.025, 0.24]} position={[0, 0.012, 0.62]} color="#50545a" /></group>}
      {catalogId === 'bakery' && <group>
        <Box size={[0.72, 0.06, 0.1]} position={[0, 0.39, 0.37]} color="#fff5df" />
        <Box size={[0.72, 0.045, 0.1]} position={[0, 0.43, 0.37]} color="#b84832" />
        <Cylinder radius={0.075} height={0.025} segments={12} position={[0.39, 0.035, 0.4]} color="#79583a" />
        <Cylinder radius={0.018} height={0.1} segments={8} position={[0.39, 0.085, 0.4]} color="#493629" />
        <Cylinder radius={0.018} height={0.1} segments={8} position={[0.32, 0.085, 0.4]} color="#493629" />
        <Cylinder radius={0.018} height={0.1} segments={8} position={[0.46, 0.085, 0.4]} color="#493629" />
      </group>}
      {catalogId === 'grocer' && <group>
        <Box size={[0.72, 0.12, 0.05]} position={[0, 0.62, 0.34]} color="#355b58" />
        <Box size={[0.54, 0.17, 0.025]} position={[0, 0.31, 0.35]} color="#8cc5bf" />
        <Box size={[0.18, 0.08, 0.04]} position={[0.27, 0.1, 0.36]} color="#e5d1ab" />
      </group>}
      {catalogId === 'mall' && <group>
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
  return (
    <group>
      <IndustrialBase />
      <Box size={[catalogId === 'warehouse' ? 0.9 : 0.82, catalogId === 'warehouse' ? 0.32 : 0.36, catalogId === 'warehouse' ? 0.76 : 0.78]} position={[-0.04, PAD_HEIGHT + 0.18, 0]} color={catalogId === 'warehouse' ? '#aeb4b6' : catalogId === 'manufactory' ? '#8b3a2b' : '#b9b4a8'} />
      <Box size={[catalogId === 'warehouse' ? 0.94 : 0.66, 0.05, catalogId === 'warehouse' ? 0.8 : 0.66]} position={[-0.1, PAD_HEIGHT + 0.385, 0]} color={catalogId === 'warehouse' ? '#68747c' : '#7b7f86'} />
      <Box size={[0.2, 0.12, 0.2]} position={[0.02, PAD_HEIGHT + 0.47, 0.12]} color="#8a8e95" />
      {catalogId !== 'manufactory' && <><Cylinder radius={0.09} radiusTop={0.065} height={0.62} segments={14} position={[-0.28, PAD_HEIGHT + 0.31, -0.2]} color="#b4533a" /><Cylinder radius={0.085} height={0.05} segments={14} position={[-0.28, PAD_HEIGHT + 0.645, -0.2]} color="#4b2a22" /></>}
      <Cylinder
        radius={0.12}
        height={0.26}
        segments={16}
        position={[0.34, PAD_HEIGHT + 0.13, 0.14]}
        color="#dcd6c2"
      />
      <Box size={[0.22, 0.16, 0.02]} position={[-0.1, PAD_HEIGHT + 0.08, 0.315]} color="#4d5560" />
      {catalogId === 'warehouse' && <Box size={[0.54, 0.1, 0.12]} position={[0.05, 0.07, 0.39]} color="#828894" />}
      {catalogId === 'warehouse' && <group>{[-0.42, -0.22, 0, 0.22, 0.42].map((x, index) => <Box key={x} size={[0.035, 0.035, 0.72]} position={[x, PAD_HEIGHT + (index === 2 ? 0.59 : index % 2 ? 0.55 : 0.46), 0]} rotation={[0, 0, index < 2 ? 0.3 : index > 2 ? -0.3 : 0]} color="#c2c7c7" />)}</group>}
      {catalogId === 'manufactory' && <group><Cylinder radius={0.15} radiusTop={0.055} height={4} segments={8} position={[-0.28, PAD_HEIGHT + 2, -0.2]} color="#8b3a2b" /><Cylinder radius={0.16} height={0.06} segments={8} position={[-0.28, PAD_HEIGHT + 3.96, -0.2]} color="#eee2cc" /><Cylinder radius={0.09} height={0.06} segments={8} position={[-0.28, PAD_HEIGHT + 4.01, -0.2]} color="#8b3a2b" /><Box size={[0.14, 0.22, 0.12]} position={[0.39, PAD_HEIGHT + 0.33, -0.18]} color="#65737b" /><Cylinder radius={0.02} height={0.42} segments={8} position={[0.3, PAD_HEIGHT + 0.22, -0.18]} rotation={[0, 0, Math.PI / 2]} color="#737d80" /></group>}
      {catalogId === 'workshop' && <group>{[-0.25, 0, 0.25].map((x, index) => <group key={x}><Box size={[0.25, 0.13, 0.62]} position={[x, PAD_HEIGHT + 0.44, 0]} rotation={[0, 0, index % 2 === 0 ? 0.22 : -0.22]} color="#969ba0" /><Box size={[0.1, 0.04, 0.04]} position={[x, PAD_HEIGHT + 0.5, -0.19]} color="#9fc1c8" /></group>)}</group>}
      {catalogId === 'warehouse' && <group><Box size={[0.34, 0.19, 0.08]} position={[0.18, PAD_HEIGHT + 0.09, 0.39]} color="#66727d" /><Box size={[0.42, 0.08, 0.2]} position={[0.18, 0.04, 0.48]} color="#777f84" /></group>}
      {[-0.3, 0.1].map((x) => (
        <Window key={x} position={[x, 0.27, 0.314]} width={0.1} height={0.07} glass="#9fb8c8" cross={false} sill={false} />
      ))}
    </group>
  )
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

function CatalogCivicMesh({ catalogId }: { catalogId?: string }) {
  if (catalogId === 'school') return <group><Pad />
    <Box size={[0.68, 0.48, 0.6]} position={[0, PAD_HEIGHT + 0.24, 0]} color="#dfd2b7" />
    <Box size={[0.28, 0.38, 0.4]} position={[-0.3, PAD_HEIGHT + 0.19, -0.08]} color="#d2c4a6" />
    <Box size={[0.32, 0.035, 0.43]} position={[-0.3, PAD_HEIGHT + 0.4, -0.08]} color="#9a4934" />
    <Box size={[0.74, 0.08, 0.66]} position={[0, PAD_HEIGHT + 0.5, 0]} color="#a74e39" />
    <Box size={[0.54, 0.025, 0.24]} position={[0, 0.018, 0.56]} color="#6d8c46" />
    {[-0.16, 0, 0.16].map((x) => <Box key={x} size={[0.018, 0.012, 0.2]} position={[x, 0.034, 0.56]} color="#f5f0df" />)}
    <Box size={[0.28, 0.18, 0.03]} position={[0, PAD_HEIGHT + 0.13, 0.31]} color="#487a9b" />
    {[-1, 1].map((side) => <group key={`hoop-${side}`} position={[side * 0.2, 0.04, 0.68]}><Box size={[0.1, 0.01, 0.012]} position={[0, 0.13, 0]} color="#f5f0df" /><Box size={[0.012, 0.14, 0.012]} position={[0, 0.07, 0]} color="#f5f0df" /></group>)}
  </group>
  if (catalogId === 'hospital') return <group><Pad />
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
  if (catalogId === 'church') return <group><Pad />
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
    <Billboard position={[0, 1.32, 0]} follow lockY={false} lockX={false} lockZ={false}>
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
    <group ref={ref} position={[0, 1.3, 0]}>
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


function TileModelBase({ type, variant = 0, catalogId, hasWater = true, hasPower = true, hasSupplies = true, level = 1, style, animate = true, north, south, east, west }: TileModelProps) {
  let model: ReactNode = null
  let dust = 0
  let needsWater = false
  let needsPower = false
  let needsSupplies = false
  let w = 1, h = 1;
  let useConstruction = false;

  switch (type) {
    case TileType.ROAD:
      model = <Road north={north} south={south} east={east} west={west} variant={variant} />
      dust = 4
      break
    case TileType.RESIDENTIAL:
      model = <Residential variant={variant} style={style as any} catalogId={catalogId} />
      dust = 10
      needsWater = true
      needsPower = true
      useConstruction = true
      break
    case TileType.COMMERCIAL:
      model = catalogId === 'mall' ? <group scale={[1.8, 1, 1]}><Commercial catalogId={catalogId} /></group> : <Commercial catalogId={catalogId} />
      if (catalogId === 'mall') w = 2
      dust = 10
      needsWater = true
      needsPower = true
      needsSupplies = true
      useConstruction = true
      break
    case TileType.INDUSTRIAL:
      model = <Industrial catalogId={catalogId} />
      dust = 12
      needsWater = true
      needsPower = true
      useConstruction = true
      break
    case TileType.WATER_PUMP:
      model = <WaterPump />
      dust = 8
      break
    case TileType.CITY_HALL:
      model = <CityHallMesh onClick={() => window.dispatchEvent(new CustomEvent('OPEN_CITY_HALL'))} />
      dust = 20
      w = 2; h = 2;
      useConstruction = true;
      break
    case TileType.PARK:
      if (catalogId === 'church' || catalogId === 'triumphal-arch') model = <CatalogLandmarkMesh catalogId={catalogId} />
      else if (catalogId === 'fountain-square') model = <FountainSquareMesh />
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
      model = <CatalogCivicMesh catalogId={catalogId} />
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
    </>
  )
}

export const TileModel = memo(TileModelBase)


export function Smoke({ position, active = true }: { position: [number, number, number], active?: boolean }) {
  const ref = useRef<any>(null)
  useFrame(({ clock }) => {
    if (!ref.current || !active) return
    const t = clock.elapsedTime
    ref.current.children.forEach((child: any, i: number) => {
      const p = (t * 0.5 + i / 3) % 1
      child.position.y = p * 1.5
      child.scale.setScalar(1 + p * 1.5)
      child.material.opacity = (1 - p) * 0.5
    })
  })
  return (
    <group position={position} ref={ref}>
      {[0, 1, 2].map(i => (
        <mesh key={i}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}


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
    {[[0, -0.25, 0], [0, 0.25, 0], [-0.25, 0, Math.PI / 2], [0.25, 0, Math.PI / 2]].map(([x, z, angle], i) => <Box key={`path-${i}`} size={[0.1, 0.012, 0.24]} position={[x, 0.085, z]} rotation={[0, angle, 0]} color="#d0c3aa" />)}
    {[-1, 1].map((side) => <group key={side} position={[side * 0.32, 0.08, 0]}>
      <Box size={[0.28, 0.035, 0.08]} position={[0, 0.12, 0]} color="#79583a" />
      <Box size={[0.28, 0.09, 0.025]} position={[0, 0.19, -0.03]} color="#79583a" />
      {[-0.1, 0.1].map((x) => <Box key={x} size={[0.025, 0.1, 0.025]} position={[x, 0.05, 0]} color="#493629" />)}
    </group>)}
    {[-0.32, 0, 0.32].map((x) => <mesh key={`shrub-${x}`} position={[x, 0.17, -0.32]} geometry={bushGeometry} scale={0.09} castShadow receiveShadow material={getFoliageMaterial(x === 0 ? '#8f7255' : '#587c3b')}><lineSegments geometry={bushEdges} material={outlineMaterial} /></mesh>)}
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

export function CityHallMesh({ onClick }: { onClick?: () => void }) {
  return (
    <group position={[0.5, 0, 0.5]} onClick={onClick}>
      <Box size={[1.98, 0.04, 1.98]} position={[0, 0.02, 0]} color="#51483f" />
      <Box size={[1.96, 0.22, 1.96]} position={[0, 0.13, 0]} color="#c8bfb0" />
      <Box size={[1.78, 0.75, 1.78]} position={[0, 0.62, 0]} color="#dfd7c5" />
      {/* Front arcade: dark recesses framed by pale stone piers. */}
      {[-0.55, 0, 0.55].map((x) => (
        <group key={x} position={[x, 0.34, 0.895]}>
          <Box size={[0.28, 0.5, 0.035]} position={[0, 0, 0]} color="#343b45" />
          <Cylinder radius={0.14} radiusTop={0.14} height={0.04} segments={12} position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} color="#343b45" />
          <Box size={[0.06, 0.58, 0.08]} position={[-0.18, 0, 0]} color="#eee4d4" />
          <Box size={[0.06, 0.58, 0.08]} position={[0.18, 0, 0]} color="#eee4d4" />
        </group>
      ))}
      <Box size={[0.62, 1.8, 0.62]} position={[0, 1.9, 0]} color="#dfd7c5" />
      <Box size={[0.72, 0.13, 0.72]} position={[0, 2.83, 0]} color="#b9a991" />
      <Box size={[0.78, 0.42, 0.78]} position={[0, 3.1, 0]} color="#cbbca5" />
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
      <Cylinder radius={0.17} height={0.045} segments={24} position={[0, 3.1, 0.431]} rotation={[Math.PI / 2, 0, 0]} color="#f7f0df" />
      <Box size={[0.018, 0.11, 0.018]} position={[0, 3.13, 0.46]} color="#252a31" outline={false} />
      <Box size={[0.075, 0.018, 0.018]} position={[0.025, 3.085, 0.46]} rotation={[0, 0, -0.5]} color="#252a31" outline={false} />
      <Cone radius={0.49} height={0.98} segments={4} position={[0, 3.8, 0]} rotation={[0, Math.PI / 4, 0]} color="#343e4e" />
      <Cylinder radius={0.025} radiusTop={0.005} height={0.44} segments={6} position={[0, 4.53, 0]} color="#777c80" />
      <Box size={[0.23, 0.025, 0.015]} position={[0.06, 4.58, 0]} color="#a0a0a0" />
    </group>
  )
}

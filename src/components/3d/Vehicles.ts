import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { getGradientMap, getToonMaterial } from './primitives'

/* Машины в стиле иллюстрации: скруглённые кузова, тёмный контур, приглушённые цвета. Нос смотрит вдоль +Z. */

export type VehicleKind = 'sedan' | 'hatch' | 'suv' | 'van' | 'pickup'
export const VEHICLE_KINDS: readonly VehicleKind[] = ['sedan', 'hatch', 'suv', 'sedan', 'van', 'hatch', 'pickup', 'sedan']
/** Приглушённая палитра как в референсе: серо-голубые, бежевые, белые и пара ярких акцентов. */
export const VEHICLE_COLORS = ['#6f8196', '#c9c2b1', '#e8e4da', '#55697f', '#9e4b3d', '#3f4a52', '#c9a24e', '#7c8a6a', '#8c98a3', '#b05b46']

const inkLine = new THREE.LineBasicMaterial({ color: '#221c18', transparent: true, opacity: 0.9 })
const glassMaterial = getToonMaterial('#3f4e60')
const glassLight = getToonMaterial('#9fb7c9')
const tyreMaterial = getToonMaterial('#1c1c1e')
const hubMaterial = getToonMaterial('#c7ccd1')
const tailMaterial = getToonMaterial('#c2413a')
const geometryCache = new Map<string, THREE.BufferGeometry>()
const edgeCache = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>()

function rounded(width: number, height: number, depth: number, radius = 0.035) {
  const key = `${width}|${height}|${depth}|${radius}`
  let geometry = geometryCache.get(key)
  if (!geometry) {
    geometry = new RoundedBoxGeometry(width, height, depth, 2, radius)
    geometryCache.set(key, geometry)
  }
  return geometry
}

function part(geometry: THREE.BufferGeometry, material: THREE.Material, name: string, position: [number, number, number], outline = true) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (outline) {
    let edges = edgeCache.get(geometry)
    if (!edges) { edges = new THREE.EdgesGeometry(geometry, 40); edgeCache.set(geometry, edges) }
    mesh.add(new THREE.LineSegments(edges, inkLine))
  }
  return mesh
}

const wheelGeometry = new THREE.CylinderGeometry(0.068, 0.068, 0.05, 10)
const hubGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.052, 8)

function addWheels(car: THREE.Group, halfWidth: number, axles: number[]) {
  for (const x of [-halfWidth, halfWidth]) for (const z of axles) {
    const wheel = part(wheelGeometry, tyreMaterial, 'vehicle-wheel', [x, 0.068, z])
    wheel.rotation.z = Math.PI / 2
    car.add(wheel)
    const hub = new THREE.Mesh(hubGeometry, hubMaterial)
    hub.rotation.z = Math.PI / 2
    hub.position.set(x + Math.sign(x) * 0.004, 0.068, z)
    car.add(hub)
  }
}

function addLights(car: THREE.Group, front: number, back: number, y: number, spread: number) {
  const lamp = new THREE.MeshToonMaterial({ color: '#e9ecef', emissive: '#fef08a', emissiveIntensity: 0, gradientMap: getGradientMap() })
  for (const x of [-spread, spread]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.02), lamp)
    head.name = 'vehicle-headlight'
    head.position.set(x, y, front)
    head.userData.noInkOutline = true
    car.add(head)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), tailMaterial)
    tail.position.set(x, y, back)
    tail.userData.noInkOutline = true
    car.add(tail)
  }
}

/** Создаёт машину выбранного типа. Окрашиваемые детали называются 'vehicle-body'. */
export function createVehicleMesh(kind: VehicleKind, color: string): THREE.Group {
  const car = new THREE.Group()
  const paint = getToonMaterial(color)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.92), new THREE.MeshBasicMaterial({ color: '#111827', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.01
  shadow.userData.noInkOutline = true
  car.add(shadow)

  switch (kind) {
    case 'sedan':
      car.add(part(rounded(0.42, 0.13, 0.86, 0.05), paint, 'vehicle-body', [0, 0.125, 0]))
      car.add(part(rounded(0.37, 0.13, 0.44, 0.05), glassMaterial, 'vehicle-glasshouse', [0, 0.245, -0.04]))
      car.add(part(rounded(0.38, 0.03, 0.34, 0.012), paint, 'vehicle-body', [0, 0.315, -0.05]))
      car.add(part(rounded(0.33, 0.012, 0.06, 0.005), glassLight, 'vehicle-glare', [0, 0.3, 0.14], false))
      addWheels(car, 0.2, [-0.27, 0.27])
      addLights(car, 0.43, -0.43, 0.15, 0.13)
      break
    case 'hatch':
      car.add(part(rounded(0.4, 0.14, 0.72, 0.05), paint, 'vehicle-body', [0, 0.13, 0]))
      car.add(part(rounded(0.36, 0.15, 0.48, 0.05), glassMaterial, 'vehicle-glasshouse', [0, 0.26, -0.08]))
      car.add(part(rounded(0.37, 0.03, 0.42, 0.012), paint, 'vehicle-body', [0, 0.34, -0.09]))
      car.add(part(rounded(0.31, 0.012, 0.05, 0.005), glassLight, 'vehicle-glare', [0, 0.325, 0.12], false))
      addWheels(car, 0.19, [-0.22, 0.22])
      addLights(car, 0.36, -0.36, 0.16, 0.12)
      break
    case 'suv':
      car.add(part(rounded(0.44, 0.17, 0.9, 0.05), paint, 'vehicle-body', [0, 0.15, 0]))
      car.add(part(rounded(0.4, 0.16, 0.58, 0.04), glassMaterial, 'vehicle-glasshouse', [0, 0.3, -0.06]))
      car.add(part(rounded(0.41, 0.03, 0.52, 0.012), paint, 'vehicle-body', [0, 0.385, -0.07]))
      for (const x of [-0.15, 0.15]) car.add(part(rounded(0.02, 0.02, 0.44, 0.006), getToonMaterial('#2f3439'), 'vehicle-rail', [x, 0.41, -0.07], false))
      addWheels(car, 0.21, [-0.29, 0.29])
      addLights(car, 0.45, -0.45, 0.18, 0.14)
      break
    case 'van':
      car.add(part(rounded(0.44, 0.34, 0.92, 0.05), paint, 'vehicle-body', [0, 0.24, -0.01]))
      car.add(part(rounded(0.4, 0.12, 0.05, 0.015), glassMaterial, 'vehicle-glasshouse', [0, 0.32, 0.45], false))
      for (const x of [-0.222, 0.222]) car.add(part(rounded(0.01, 0.09, 0.6, 0.004), glassMaterial, 'vehicle-window', [x, 0.33, -0.08], false))
      addWheels(car, 0.21, [-0.3, 0.3])
      addLights(car, 0.465, -0.475, 0.14, 0.15)
      break
    case 'pickup':
      car.add(part(rounded(0.44, 0.15, 0.92, 0.05), paint, 'vehicle-body', [0, 0.14, 0]))
      car.add(part(rounded(0.4, 0.15, 0.34, 0.04), glassMaterial, 'vehicle-glasshouse', [0, 0.28, 0.08]))
      car.add(part(rounded(0.41, 0.03, 0.3, 0.012), paint, 'vehicle-body', [0, 0.36, 0.08]))
      // Открытый кузов: бортики вокруг грузовой площадки.
      car.add(part(rounded(0.4, 0.02, 0.4, 0.006), getToonMaterial('#2e3236'), 'vehicle-bed', [0, 0.225, -0.24], false))
      for (const x of [-0.205, 0.205]) car.add(part(rounded(0.03, 0.08, 0.4, 0.008), paint, 'vehicle-body', [x, 0.26, -0.24]))
      car.add(part(rounded(0.42, 0.08, 0.03, 0.008), paint, 'vehicle-body', [0, 0.26, -0.445]))
      addWheels(car, 0.21, [-0.29, 0.29])
      addLights(car, 0.465, -0.465, 0.16, 0.14)
      break
  }
  return car
}

/** Статичная припаркованная машина для парковок (детерминированный выбор по seed). */
export function createParkedVehicle(seed: number): THREE.Group {
  const kind = VEHICLE_KINDS[Math.abs(seed) % VEHICLE_KINDS.length]
  const color = VEHICLE_COLORS[Math.abs(seed * 7 + 3) % VEHICLE_COLORS.length]
  return createVehicleMesh(kind, color)
}

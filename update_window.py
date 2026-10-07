import re
with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    meshes = f.read()

window_code = """
export function Window({
  width = 0.1,
  height = 0.14,
  position = [0, 0, 0],
  glass = '#ffffff',
  facing = 'z',
  cross = false,
}: {
  width?: number
  height?: number
  position?: [number, number, number]
  glass?: string
  facing?: 'z' | '-z' | 'x' | '-x'
  cross?: boolean
}) {
  const rot = facing === 'x' ? Math.PI / 2 : facing === '-x' ? -Math.PI / 2 : facing === '-z' ? Math.PI : 0
  const ref = useRef<THREE.Mesh>(null)
  
  // Randomize light phase so they don't all turn on instantly at the exact same minute
  const phase = useRef(Math.random() * 60)
  
  useFrame(() => {
    if (!ref.current) return
    const state = (window as any).__SIM_STATE
    if (!state) return
    const m = state.minutes
    // Night is < 6:00 (360) or > 18:00 (1080)
    const isNight = m < 360 || m > 1080
    // Emissive yellow/orange if night
    const mat = ref.current.material as THREE.MeshBasicMaterial
    if (isNight && phase.current < 45) { // 75% of windows turn on
      mat.color.set('#ffcc55')
    } else {
      mat.color.set(glass)
    }
  })

  return (
    <group position={position} rotation={[0, rot, 0]}>
      {/* Стекло */}
      <mesh ref={ref} position={[0, 0, 0.01]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={glass} />
      </mesh>
      {/* Рама */}
      <Box size={[width + 0.02, 0.02, 0.03]} position={[0, height / 2, 0.015]} color="#4a3b2c" />
      <Box size={[width + 0.02, 0.02, 0.03]} position={[0, -height / 2, 0.015]} color="#4a3b2c" />
      <Box size={[0.02, height, 0.03]} position={[width / 2, 0, 0.015]} color="#4a3b2c" />
      <Box size={[0.02, height, 0.03]} position={[-width / 2, 0, 0.015]} color="#4a3b2c" />
      {cross && (
        <>
          <Box size={[width, 0.015, 0.02]} position={[0, 0, 0.01]} color="#4a3b2c" />
          <Box size={[0.015, height, 0.02]} position={[0, 0, 0.01]} color="#4a3b2c" />
        </>
      )}
    </group>
  )
}
"""

meshes = re.sub(r'export function Window\(.*?\}\s*\)\s*\}', window_code, meshes, flags=re.DOTALL)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(meshes)
print("Window updated.")

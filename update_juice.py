import re
with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    meshes = f.read()

# Add PopIn wiggle
pop_in_regex = r'export function PopIn\(.*?\}\s*\}'
pop_in_new = """export function PopIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime - delay
    if (t < 0) {
      ref.current.scale.setScalar(0)
    } else if (t < 0.4) {
      // Spring pop-in
      const progress = t / 0.4
      const scale = Math.min(1.15, 1 + Math.sin(progress * Math.PI) * 0.15)
      ref.current.scale.setScalar(scale)
      // Wiggle
      ref.current.rotation.z = Math.sin(progress * Math.PI * 4) * 0.05 * (1 - progress)
    } else {
      ref.current.scale.setScalar(1)
      ref.current.rotation.z = 0
    }
  })
  return <group ref={ref}>{children}</group>
}"""
meshes = re.sub(r'export function PopIn.*?return <group ref=\{ref\}>\{children\}</group>\n\}', pop_in_new, meshes, flags=re.DOTALL)

# Add Smoke component
if 'export function Smoke' not in meshes:
    smoke = """
export function Smoke({ position, active = true }: { position: [number, number, number], active?: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current || !active) return
    const t = clock.elapsedTime
    ref.current.children.forEach((child, i) => {
      const p = (t * 0.5 + i / 3) % 1
      child.position.y = p * 1.5
      child.scale.setScalar(1 + p * 1.5)
      ;(child as any).material.opacity = (1 - p) * 0.5
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
"""
    meshes = meshes.replace('export function Pad()', smoke + '\nexport function Pad()')

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(meshes)
print("PopIn and Smoke added.")

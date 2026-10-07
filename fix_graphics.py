import re

# 1. Update CityScene.tsx
with open('src/components/3d/CityScene.tsx', 'r') as f:
    text = f.read()

# Update background color
text = text.replace("const DAY_COLOR = new THREE.Color('#eae5d9')", "const DAY_COLOR = new THREE.Color('#eae4d5')")

# Add Fog
fog_str = "    <Canvas\n      shadows={{ type: THREE.PCFSoftShadowMap }}\n      onContextMenu={(e) => e.preventDefault()}\n      flat\n      dpr={[1, 2]}\n      gl={{ antialias: true }}\n      className=\"absolute inset-0\"\n    >\n      <fogExp2 attach=\"fog\" args={['#eae4d5', 0.018]} />"
text = re.sub(r'<Canvas[\s\S]*?className="absolute inset-0"\n\s*>', fog_str, text)

# Update ambientLight
text = re.sub(r'<ambientLight intensity=\{[0-9.]+\} color="[^"]+" />', '<ambientLight intensity={0.45} color="#3b4454" />', text)

# Update directionalLight
text = re.sub(r'<directionalLight[\s\S]*?shadow-radius=\{[0-9.]+\}\n\s*/>',
    """<directionalLight
        position={[18, 22, 14]}
        intensity={1.6}
        color="#fff6e5"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />""", text)

with open('src/components/3d/CityScene.tsx', 'w') as f:
    f.write(text)


# 2. Update BuildingMeshes.tsx
with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    mesh_text = f.read()

# Remove FacetedTree if it exists
mesh_text = re.sub(r'function FacetedTree\(\{.*?\}\) \{[\s\S]*?\}\n\n', '', mesh_text)

# Update SmallTree
new_tree = """function SmallTree({ position, scale = 1 }: { position: Vec3, scale?: number }) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <Cylinder radius={0.04} height={0.3} segments={5} position={[0, 0.15, 0]} color="#422f22" />
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow material={getToonMaterial('#476930')}>
        <icosahedronGeometry args={[0.22, 0]} />
      </mesh>
      <mesh position={[-0.05, 0.45, 0.05]} castShadow receiveShadow material={getToonMaterial('#5c7e3e')} rotation={[Math.PI/4, 0, 0]}>
        <icosahedronGeometry args={[0.15, 0]} />
      </mesh>
    </group>
  )
}"""
mesh_text = re.sub(r'function SmallTree\(\{ position \}: \{ position: Vec3 \}\) \{[\s\S]*?\}\n', new_tree + '\n', mesh_text)

# Update Park to use new grass color and scale the tree
new_park = """function Park() {
  return (
    <group>
      <Pad />
      <Box size={[0.8, 0.05, 0.8]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#6f8f47" />
      <SmallTree position={[0, PAD_HEIGHT + 0.05, 0]} scale={1.5} />
    </group>
  )
}"""
mesh_text = re.sub(r'function Park\(\) \{[\s\S]*?\}\n', new_park + '\n', mesh_text)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(mesh_text)

# 3. Set starting time to 14:00 (840) in useCitySimulation.ts
with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim_text = f.read()
sim_text = re.sub(r'minutes: \d+', 'minutes: 840', sim_text, count=1)
with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim_text)


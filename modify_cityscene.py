import re

with open('src/components/3d/CityScene.tsx', 'r') as f:
    text = f.read()

ground_slab = """function GroundSlab() {
  const gridLines = useMemo(() => {
    const helper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, '#808080', '#808080')
    if (helper.material instanceof THREE.Material) {
      helper.material.transparent = true
      helper.material.opacity = 0.25
    }
    return helper
  }, [])

  return (
    <group>
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[GRID_SIZE + 0.4, 0.6, GRID_SIZE + 0.4]} />
        <meshToonMaterial attach="material-0" color="#5c4033" />
        <meshToonMaterial attach="material-1" color="#5c4033" />
        <meshToonMaterial attach="material-2" color="#9bc472" />
        <meshToonMaterial attach="material-3" color="#5c4033" />
        <meshToonMaterial attach="material-4" color="#5c4033" />
        <meshToonMaterial attach="material-5" color="#5c4033" />
        <Edges color="#111111" />
      </mesh>
      <primitive object={gridLines} position={[0, 0.004, 0]} />
    </group>
  )
}"""

text = re.sub(r'function GroundSlab\(\) \{[\s\S]*?\n\}\)', ground_slab, text)

# Canvas shadows
text = text.replace('<Canvas', '<Canvas\n      shadows')
# If it already had shadows, we might end up with `shadows shadows="percentage"`. 
# Let's fix that.
text = text.replace('shadows shadows="percentage"', 'shadows')

# Lights
lights = """<ambientLight intensity={0.6} color="#fff9eb" />
      <directionalLight
        position={[20, 35, 15]}
        intensity={1.8}
        color="#fff5db"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />"""

text = re.sub(r'<ambientLight [\s\S]*?shadow-radius=\{4\}\n\s*/>', lights, text)

with open('src/components/3d/CityScene.tsx', 'w') as f:
    f.write(text)

import re

# 1. Update CityScene.tsx
with open('src/components/3d/CityScene.tsx', 'r') as f:
    text = f.read()

# Update background color
text = text.replace("const DAY_COLOR = new THREE.Color(BACKGROUND_COLOR)", "const DAY_COLOR = new THREE.Color('#eae5d9')")

# Update OrthographicCamera zoom
text = re.sub(r'<OrthographicCamera makeDefault position=\{CAMERA_POSITION\} zoom=\{\d+\}', '<OrthographicCamera makeDefault position={CAMERA_POSITION} zoom={85}', text)

# Update Canvas shadows prop
text = text.replace("<Canvas\n      shadows\n      onContextMenu", "<Canvas\n      shadows={{ type: THREE.PCFSoftShadowMap }}\n      onContextMenu")

# Update ambientLight
text = re.sub(r'<ambientLight intensity=\{[0-9.]+\} color="[^"]+" />', '<ambientLight intensity={0.9} color="#ffffff" />', text)

# Update directionalLight
text = re.sub(r'<directionalLight[\s\S]*?shadow-radius=\{4\}\n\s*/>',
    """<directionalLight
        position={[14, 20, 10]}
        intensity={1.4}
        color="#fff3d6"
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
      />""", text)

with open('src/components/3d/CityScene.tsx', 'w') as f:
    f.write(text)


# 2. Update BuildingMeshes.tsx European House
with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    mesh_text = f.read()

new_eu = """  // EU Style (Based on exact user template)
  return (
    <group>
      <Pad />
      <Box size={[1.6, 0.3, 1.6]} position={[0, 0.15, 0]} color="#d8cfc4" />
      <Box size={[1.5, 1.4, 1.5]} position={[0, 0.85, 0]} color="#f3ede2" />
      
      <Cone radius={1.3} height={1.1} segments={4} position={[0, 2.1, 0]} rotation={[0, Math.PI / 4, 0]} color="#b34a36" />
      
      <Box size={[0.2, 0.6, 0.2]} position={[0.4, 2.3, 0.2]} color="#6e3328" />
      
      {/* 2x2 Windows on the front */}
      {[-0.3, 0.3].map(x => 
        [0.6, 1.15].map(y => (
          <group key={`${x}-${y}`} position={[x, y, 0.76]}>
             <Box size={[0.26, 0.37, 0.05]} position={[0, 0, 0]} color="#ffffff" />
             <Box size={[0.24, 0.35, 0.06]} position={[0, 0, 0]} color="#2b303a" />
          </group>
        ))
      )}
      
      <Box size={[0.28, 0.5, 0.05]} position={[0, 0.4, 0.76]} color="#3b2820" />
    </group>
  )
}
"""

mesh_text = re.sub(r'  // EU Style \(Modular Recessed Facade\)[\s\S]*?\}\n(?=export)', new_eu, mesh_text)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(mesh_text)


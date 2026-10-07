import re

with open('src/components/3d/CityScene.tsx', 'r') as f:
    text = f.read()

# 1. Update BACKGROUND_COLOR
text = text.replace("const BACKGROUND_COLOR = '#f0ede6'", "const BACKGROUND_COLOR = '#f4efe6'")

# 2. Update GroundSlab colors and grid lines
text = text.replace("helper.material.opacity = 0.25", "helper.material.opacity = 0.15")
text = text.replace('<meshToonMaterial attach="material-2" color="#9bc472" />', '<meshToonMaterial attach="material-2" color="#b5be90" />')
# Update Edges color on GroundSlab
text = re.sub(r'<Edges color="#111111" />', '<Edges color="#1a1a1a" />', text)

# 3. Update Lighting
old_lights = re.search(r'<ambientLight [\s\S]*?shadow-radius=\{4\}\n\s*/>', text).group(0)
new_lights = """<ambientLight intensity={1.2} color="#5a6678" />
      <directionalLight
        position={[25, 35, 25]}
        intensity={1.8}
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
      />"""
text = text.replace(old_lights, new_lights)

with open('src/components/3d/CityScene.tsx', 'w') as f:
    f.write(text)


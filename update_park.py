import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    text = f.read()

new_park = """function Park() {
  return (
    <group>
      <Pad />
      <Box size={[0.8, 0.05, 0.8]} position={[0, PAD_HEIGHT + 0.025, 0]} color="#77a85d" />
      <SmallTree position={[0, PAD_HEIGHT + 0.05, 0]} />
    </group>
  )
}"""

text = re.sub(r'function Park\(\) \{[\s\S]*?\}\n\nexport function WindTurbine', new_park + '\n\nexport function WindTurbine', text)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(text)

import re

with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    text = f.read()

# 1. Update PartProps
text = text.replace("castShadow?: boolean\n}", "castShadow?: boolean\n  material?: THREE.Material\n}")

# 2. Update Part component
text = text.replace(
    "function Part({ shape, color, position, rotation, outline = true, castShadow = true }: PartProps) {",
    "function Part({ shape, color, position, rotation, outline = true, castShadow = true, material }: PartProps) {"
)
text = text.replace("material={getToonMaterial(color)}", "material={material || getToonMaterial(color)}")

# 3. Remove local hash01
text = re.sub(r'function hash01\(n: number\): number \{[\s\S]*?return s - Math\.floor\(s\)\n\}\n', '', text)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.write(text)


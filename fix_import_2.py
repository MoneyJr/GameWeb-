with open('src/components/3d/TrafficSystem.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { Grid, TileType } from '../../types/city'", "import { TileType } from '../../types/city'\nimport type { Grid } from '../../types/city'")

with open('src/components/3d/TrafficSystem.tsx', 'w') as f:
    f.write(content)
print("Fixed type import.")

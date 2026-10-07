with open('src/components/3d/TrafficSystem.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { cellToWorld } from '../../lib/utils'", "import { GRID_SIZE } from '../../types/city'\n\nfunction cellToWorld(x: number, y: number): [number, number, number] {\n  const offset = (GRID_SIZE - 1) / 2\n  return [x - offset, 0, y - offset]\n}")

with open('src/components/3d/TrafficSystem.tsx', 'w') as f:
    f.write(content)
print("Fixed cellToWorld.")

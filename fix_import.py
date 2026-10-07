with open('src/components/3d/CityScene.tsx', 'r') as f:
    content = f.read()

if 'import { TrafficSystem }' not in content:
    content = "import { TrafficSystem } from './TrafficSystem'\n" + content
    with open('src/components/3d/CityScene.tsx', 'w') as f:
        f.write(content)
print("Fixed import.")

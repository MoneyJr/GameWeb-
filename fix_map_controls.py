with open('src/components/3d/CityScene.tsx', 'r') as f:
    scene = f.read()

scene = scene.replace('MIDDLE: THREE.MOUSE.ROTATE', 'MIDDLE: THREE.MOUSE.PAN')

with open('src/components/3d/CityScene.tsx', 'w') as f:
    f.write(scene)

print("Fixed MapControls.")

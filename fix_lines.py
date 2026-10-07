with open('src/components/3d/BuildingMeshes.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    num = i + 1
    if num == 329:
        new_lines.append('}\n')
    elif 330 <= num <= 369:
        pass # skip
    else:
        new_lines.append(line)

with open('src/components/3d/BuildingMeshes.tsx', 'w') as f:
    f.writelines(new_lines)
print("Lines fixed.")

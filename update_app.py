with open('src/App.tsx', 'r') as f:
    content = f.read()

if 'demands={sim.demands}' not in content:
    content = content.replace('day={sim.day}', 'day={sim.day}\n        demands={sim.demands}')
    with open('src/App.tsx', 'w') as f:
        f.write(content)
print("App.tsx updated.")

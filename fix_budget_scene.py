with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

# Change START_BUDGET
sim = sim.replace('export const START_BUDGET = 5000', 'export const START_BUDGET = 2500')
sim = sim.replace('export const START_BUDGET = 500', 'export const START_BUDGET = 2500')

# Update upkeep
# Wait, let's see current computeNetIncome logic
if 'const upkeep = counts.roads * 1 + counts.pumps * 3' in sim:
    sim = sim.replace('const upkeep = counts.roads * 1 + counts.pumps * 3', 'const upkeep = counts.roads * 0.2 + counts.pumps * 1')

# Add explicit budget check on PLACE action if not already there
# The code already has: if (state.budget < definition.cost) return withNotice(...)

with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim)

with open('src/components/ui/TopBar.tsx', 'r') as f:
    tb = f.read()

# Make budget red if negative
# <div id="stat-budget" ...
if 'text-rose-600' not in tb or 'budget < 0' not in tb:
    # TopBar renders `budget` via `Stat`. Let's see how `Stat` handles colors or if we can pass a color.
    # We can change the label / value color if budget < 0.
    # Stat component has: className="animate-[stat-bump_380ms_ease-out] text-xl font-extrabold tabular-nums"
    # Let's pass `valueColor` prop to Stat.
    if 'valueColor?: string' not in tb:
        tb = tb.replace('bumpKey?: string | number\n}', 'bumpKey?: string | number\n  valueColor?: string\n}')
        tb = tb.replace('className="animate-[stat-bump_380ms_ease-out] text-xl font-extrabold tabular-nums"', 'className={cn("animate-[stat-bump_380ms_ease-out] text-xl font-extrabold tabular-nums", valueColor)}')
    
    # Update TopBar's budget stat
    if 'valueColor={budget < 0 ? "text-rose-600" : undefined}' not in tb:
        tb = tb.replace('bumpKey={budget}\n', 'bumpKey={budget}\n          valueColor={budget < 0 ? "text-rose-600" : undefined}\n')

with open('src/components/ui/TopBar.tsx', 'w') as f:
    f.write(tb)

with open('src/components/3d/CityScene.tsx', 'r') as f:
    scene = f.read()

if 'onContextMenu' not in scene:
    scene = scene.replace('<Canvas', '<Canvas\n      onContextMenu={(e) => e.preventDefault()}')

with open('src/components/3d/CityScene.tsx', 'w') as f:
    f.write(scene)

print("Applied economics and canvas context menu fixes.")

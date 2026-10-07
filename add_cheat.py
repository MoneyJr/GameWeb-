with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

if "type: 'CHEAT_BUDGET'" not in sim:
    sim = sim.replace('case \'TICK\': {', 'case \'CHEAT_BUDGET\': return { ...state, budget: (action as any).amount }\n    case \'TICK\': {')
    with open('src/hooks/useCitySimulation.ts', 'w') as f:
        f.write(sim)
print("Cheat added.")

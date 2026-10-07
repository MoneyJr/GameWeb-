with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

# Expose state to window for easy testing
if 'window.__SIM_DISPATCH' not in sim:
    sim = sim.replace('const [state, dispatch] = useReducer(reducer, undefined, createInitialState)', 'const [state, dispatch] = useReducer(reducer, undefined, createInitialState)\n  if (typeof window !== "undefined") { (window as any).__SIM_DISPATCH = dispatch; (window as any).__SIM_STATE = state; }')

with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim)
print("Exposed to window.")

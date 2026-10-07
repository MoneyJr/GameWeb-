with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

# Add style to PLACE action
sim = sim.replace("tool: ToolId", "tool: ToolId\n  style?: string")
sim = sim.replace("tool: activeTool", "tool: activeTool, style")
sim = sim.replace("placeTile = useCallback(\n    (x: number, y: number)", "placeTile = useCallback(\n    (x: number, y: number, style?: string)")
sim = sim.replace("function setTile(state: SimState, x: number, y: number, type: TileType, cost: number): SimState", "function setTile(state: SimState, x: number, y: number, type: TileType, cost: number, style?: string): SimState")
sim = sim.replace("{ ...cell, type, level: 1 }", "{ ...cell, type, level: 1, style, smog: false }")
sim = sim.replace("setTile(state, x, y, definition.tile, definition.cost)", "setTile(state, x, y, definition.tile, definition.cost, action.style)")

with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim)

with open('src/App.tsx', 'r') as f:
    app = f.read()
app = app.replace("onPlace={sim.placeTile}", "onPlace={(x,y) => sim.placeTile(x, y, resStyle)}")
with open('src/App.tsx', 'w') as f:
    f.write(app)

print("sim_update done.")

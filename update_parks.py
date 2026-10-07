import re
with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

count_logic = """
  let parkValue = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TileType.ROAD) counts.roads++
      else if (cell.type === TileType.RESIDENTIAL) {
"""

sim = sim.replace("""  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === TileType.ROAD) counts.roads++
      else if (cell.type === TileType.RESIDENTIAL) {""", count_logic)

park_val_logic = """      else if (cell.type === TileType.PARK) {
        counts.parks++
        if (cell.style === 'SQUARE') parkValue += 5
        else if (cell.style === 'PARK') parkValue += 10
        else if (cell.style === 'LARGE_PARK') parkValue += 20
        else parkValue += 5
      }
"""

sim = sim.replace('else if (cell.type === TileType.PARK) counts.parks++', park_val_logic)
sim = sim.replace('function countTiles', 'export let globalParkValue = 0;\nfunction countTiles')
sim = sim.replace('return counts', 'globalParkValue = parkValue;\n  return counts')

happiness_logic = """function targetHappiness(counts: CityCounts): number {
  if (counts.consumers === 0) return 100
  const dryShare = (counts.consumers - counts.wateredConsumers) / counts.consumers
  
  let h = 100 - dryShare * 70
  if (counts.houses > 0) {
    h -= (counts.smogHouses / counts.houses) * 20
  }
  h += globalParkValue;
  return Math.round(Math.min(100, Math.max(0, h)))
}
"""

sim = re.sub(r'function targetHappiness[\s\S]*?\}\n', happiness_logic + '\n', sim, count=1)

with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim)

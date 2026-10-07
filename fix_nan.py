import re
with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

# Fix CityCounts interface if missing
if 'parks: number' not in sim:
    sim = sim.replace('pumps: number', 'pumps: number\n  parks: number\n  wind: number\n  coal: number\n  poweredConsumers: number\n  parkedHouses: number\n  smogHouses: number')

# Fix CityCounts object
init = """    pumps: 0,
    parks: 0,
    wind: 0,
    coal: 0,
    poweredConsumers: 0,
    parkedHouses: 0,
    smogHouses: 0,"""
sim = re.sub(r'pumps:\s*0,', init, sim)

with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim)
print("NaN fixed")

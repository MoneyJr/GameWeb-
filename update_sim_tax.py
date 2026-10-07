with open('src/hooks/useCitySimulation.ts', 'r') as f:
    sim = f.read()

# Add taxRate to SimState
if 'taxRate: number' not in sim:
    sim = sim.replace('happiness: number', 'happiness: number\n  taxRate: number')
    sim = sim.replace('happiness: 100,', 'happiness: 100,\n    taxRate: 10,')

# Add set_tax action
if 'SET_TAX' not in sim:
    sim = sim.replace("case 'TICK':", "case 'SET_TAX': return { ...state, taxRate: (action as any).rate }\n    case 'TICK':")

# Income uses taxRate
# The old income logic: const taxedShare = ...
# The base tax rate was implied in the hardcoded values (like 8 for shops or whatever).
# For residents: const taxes = Math.floor(population * taxedShare * (1 + (counts.parkedHouses / Math.max(1, counts.houses)) * 0.1))
# We can change it to: const taxes = Math.floor(population * taxedShare * (taxRate / 10) * (1 + ...))
if '(state.taxRate / 10)' not in sim:
    # Need to replace computeNetIncome definition to accept taxRate
    sim = sim.replace('function computeNetIncome(counts: CityCounts, population: number): number', 'function computeNetIncome(counts: CityCounts, population: number, taxRate: number): number')
    sim = sim.replace('const taxes = Math.floor(population * taxedShare *', 'const taxes = Math.floor(population * taxedShare * (taxRate / 10) *')
    # Update call sites
    sim = sim.replace('lastNet: computeNetIncome(counts, state.population)', 'lastNet: computeNetIncome(counts, state.population, state.taxRate)')
    sim = sim.replace('lastNet: computeNetIncome(counts, newPop)', 'lastNet: computeNetIncome(counts, newPop, state.taxRate)')

# Population growth affected by taxRate
# newPop = ...
# Growth can be slowed by high tax, boosted by low tax
if 'taxModifier' not in sim:
    sim = sim.replace('const growth = Math.floor((maxPop - currentPop) * 0.05)', 'const taxModifier = 1 - (state.taxRate - 10) * 0.05\n        const growth = Math.floor((maxPop - currentPop) * 0.05 * taxModifier)')

with open('src/hooks/useCitySimulation.ts', 'w') as f:
    f.write(sim)

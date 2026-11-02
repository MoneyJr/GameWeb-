/**
 * Сезонные события города.
 *
 * Каждое событие решает, активно ли оно (по возрасту города или по реальному календарю),
 * и описывает модификаторы для симуляции. Чтобы проверить событие вне сезона,
 * откройте игру с параметром ?event=winter (или ?event=harvest).
 */
export type CityEventId = 'harvest' | 'winter'

export interface EventContext {
  /** Игровой день города. */
  day: number
  /** Реальное время (Date.now()). */
  now: number
}

export interface CityEventModifiers {
  /** Множитель налогового дохода по catalogId. */
  incomeMultiplier: Record<string, number>
  /** Прибавка к целевому счастью. */
  happinessBonus: number
  /** Множитель потребления электроэнергии (отопление зимой). */
  energyMultiplier: number
}

interface CityEventDefinition {
  id: CityEventId
  isActive: (context: EventContext) => boolean
  modifiers: Partial<CityEventModifiers>
}

/** Первые две недели нового города — осенний винный фестиваль. */
export const HARVEST_FAIR_END_DAY = 14

/** Зимний сезон: с 1 декабря по 7 января включительно. */
export function isWinterDate(now: number): boolean {
  const date = new Date(now)
  const month = date.getMonth()
  return month === 11 || (month === 0 && date.getDate() <= 7)
}

function forcedEvent(): CityEventId | null {
  try {
    const value = new URLSearchParams(window.location.search).get('event')
    return value === 'winter' || value === 'harvest' ? value : null
  } catch {
    return null
  }
}

const EVENTS: readonly CityEventDefinition[] = [
  {
    id: 'winter',
    isActive: ({ now }) => isWinterDate(now),
    modifiers: {
      energyMultiplier: 1.25,
      happinessBonus: 5,
      incomeMultiplier: { com_bakery: 1.15, com_grocery: 1.15, com_market_hall: 1.15, com_wine_tavern: 1.15 },
    },
  },
  {
    id: 'harvest',
    // Винный фестиваль не пересекается с зимой.
    isActive: ({ day, now }) => day <= HARVEST_FAIR_END_DAY && !isWinterDate(now),
    modifiers: {
      happinessBonus: 15,
      incomeMultiplier: { com_bakery: 1.2, com_grocery: 1.2 },
    },
  },
]

export function activeEvents(context: EventContext): CityEventId[] {
  const forced = forcedEvent()
  if (forced) return [forced]
  return EVENTS.filter((event) => event.isActive(context)).map((event) => event.id)
}

const NO_MODIFIERS: CityEventModifiers = { incomeMultiplier: {}, happinessBonus: 0, energyMultiplier: 1 }

export function eventModifiers(ids: readonly CityEventId[]): CityEventModifiers {
  if (ids.length === 0) return NO_MODIFIERS
  const result: CityEventModifiers = { incomeMultiplier: {}, happinessBonus: 0, energyMultiplier: 1 }
  for (const event of EVENTS) {
    if (!ids.includes(event.id)) continue
    const { incomeMultiplier = {}, happinessBonus = 0, energyMultiplier = 1 } = event.modifiers
    result.happinessBonus += happinessBonus
    result.energyMultiplier *= energyMultiplier
    for (const [id, multiplier] of Object.entries(incomeMultiplier)) {
      result.incomeMultiplier[id] = (result.incomeMultiplier[id] ?? 1) * multiplier
    }
  }
  return result
}

export const sameEvents = (a: readonly CityEventId[], b: readonly CityEventId[]) =>
  a.length === b.length && a.every((id) => b.includes(id))

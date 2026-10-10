import { describe, expect, it } from 'vitest'
import {
  ACTIVITIES,
  CONNECTIONS,
  DATA_PROVENANCE,
  DEMO_DATA,
  DatasetValidationError,
  INTEREST_IDS,
  LOCATIONS,
  MEALS,
  MEAL_SLOTS,
  PHOTO_CREDITS,
  POI_CATALOG,
  REFERENCE_DAY_ISO,
  REFERENCE_DAY_START_MS,
  SPOTS,
  at,
  loadTransportData,
  validateDataset,
  validatePoiCatalog,
} from '../src/data'
import type { ActivityDef, Connection, Location, MealDef, Mode, SpotDef } from '../src/data'

const baseLocations: Location[] = [
  { id: 'a', name: 'A', region: 'Kerala', tags: [], lat: 10.0, lon: 76.0 },
  { id: 'b', name: 'B', region: 'Kerala', tags: [], lat: 10.5, lon: 76.5 },
]

function conn(overrides: Partial<Connection> = {}): Connection {
  return {
    id: 'C1',
    from: 'a',
    to: 'b',
    mode: 'train',
    depart: at(10),
    arrive: at(11),
    costINR: 100,
    label: 'Test Service',
    ...overrides,
  }
}

describe('demo dataset', () => {
  it('loads clean — 18 locations, ≥ 40 connections, validated at load', () => {
    expect(() => loadTransportData(LOCATIONS, CONNECTIONS)).not.toThrow()
    expect(LOCATIONS).toHaveLength(18)
    expect(CONNECTIONS.length).toBeGreaterThanOrEqual(40)
    expect(DEMO_DATA.connections).toHaveLength(CONNECTIONS.length)
  })

  it('uses the spec reference day: Saturday 2026-10-17, Asia/Kolkata', () => {
    expect(REFERENCE_DAY_ISO).toBe('2026-10-17')
    expect(REFERENCE_DAY_START_MS).toBe(Date.UTC(2026, 9, 16, 18, 30, 0))
  })

  it('discloses its synthetic provenance with estimated fares', () => {
    expect(DATA_PROVENANCE).toMatch(/Synthetic/)
    expect(DATA_PROVENANCE).toMatch(REFERENCE_DAY_ISO)
    expect(DATA_PROVENANCE).toMatch(/estimates/)
  })

  it('indexes per-node departures sorted and binary-searched', () => {
    const kzhikodeMorning = DEMO_DATA.nextDepartures('kozhikode', at(12, 0))
    expect(kzhikodeMorning[0]!.id).toBe('TRN-16649-KZK-THR') // 12:35 is first ≥ 12:00
    for (let i = 1; i < kzhikodeMorning.length; i++) {
      expect(kzhikodeMorning[i]!.depart).toBeGreaterThanOrEqual(kzhikodeMorning[i - 1]!.depart)
    }
    expect(DEMO_DATA.nextDepartures('nowhere', at(12, 0))).toEqual([])
    expect(DEMO_DATA.connectionById('TRN-16658-KZK-MGL')?.label).toContain('Mangaluru Express')
  })

  it('every demo connection satisfies arrive > depart and cost ≥ 0', () => {
    for (const c of DEMO_DATA.connections) {
      expect(c.arrive).toBeGreaterThan(c.depart)
      expect(c.costINR).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('validateDataset', () => {
  it('accepts a consistent dataset', () => {
    expect(() => validateDataset(baseLocations, [conn()])).not.toThrow()
  })

  it('rejects depart >= arrive', () => {
    expect(() => validateDataset(baseLocations, [conn({ arrive: at(10) })])).toThrow(
      DatasetValidationError,
    )
    expect(() => validateDataset(baseLocations, [conn({ arrive: at(9, 30) })])).toThrow(
      /arrive > depart/,
    )
  })

  it('rejects negative costs', () => {
    expect(() => validateDataset(baseLocations, [conn({ costINR: -1 })])).toThrow(/negative cost/)
  })

  it('rejects duplicate connection ids', () => {
    expect(() =>
      validateDataset(baseLocations, [conn({ id: 'C1' }), conn({ id: 'C1', arrive: at(12) })]),
    ).toThrow(/duplicate connection id 'C1'/)
  })

  it('rejects duplicate location ids', () => {
    expect(() =>
      validateDataset([baseLocations[0]!, baseLocations[0]!], [conn()]),
    ).toThrow(/duplicate location id 'a'/)
  })

  it('rejects unknown nodes', () => {
    expect(() => validateDataset(baseLocations, [conn({ from: 'zzz' })])).toThrow(
      /unknown node 'zzz'/,
    )
    expect(() => validateDataset(baseLocations, [conn({ to: 'zzz' })])).toThrow(
      /unknown node 'zzz'/,
    )
  })

  it('rejects unknown modes', () => {
    expect(() => validateDataset(baseLocations, [conn({ mode: 'metro' as Mode })])).toThrow(
      /unknown mode/,
    )
  })

  it('lists every problem at once', () => {
    try {
      validateDataset(baseLocations, [conn({ costINR: -5, arrive: at(9) })])
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(DatasetValidationError)
      expect((err as DatasetValidationError).problems).toHaveLength(2)
    }
  })
})

describe('validateDataset coordinates', () => {
  const coordLoc = (overrides: Partial<Location> = {}): Location => ({
    ...baseLocations[0]!,
    ...overrides,
  })

  it('demo locations carry real South-India coordinates inside the bounding box', () => {
    for (const loc of LOCATIONS) {
      expect(loc.lat, loc.id).toBeGreaterThan(8)
      expect(loc.lat, loc.id).toBeLessThan(22)
      expect(loc.lon, loc.id).toBeGreaterThan(72)
      expect(loc.lon, loc.id).toBeLessThan(80)
    }
  })

  it('rejects latitude outside the bounding box', () => {
    expect(() => validateDataset([coordLoc({ lat: 25 })], [conn()])).toThrow(
      /latitude .* outside the dataset bounding box/,
    )
  })

  it('rejects longitude outside the bounding box', () => {
    expect(() => validateDataset([coordLoc({ lon: 70 })], [conn()])).toThrow(
      /longitude .* outside the dataset bounding box/,
    )
  })

  it('rejects non-finite coordinates and lists both problems at once', () => {
    try {
      validateDataset([coordLoc({ lat: Number.NaN, lon: Number.NaN }), baseLocations[1]!], [conn()])
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(DatasetValidationError)
      expect((err as DatasetValidationError).problems).toHaveLength(2)
    }
  })
})

describe('validatePoiCatalog', () => {
  const activity = (overrides: Partial<ActivityDef> = {}): ActivityDef => ({
    id: 'a-food-1',
    destinationId: 'a',
    title: 'Test activity',
    category: 'food',
    costINR: 50,
    durationMin: 60,
    blurb: 'One honest sentence.',
    ...overrides,
  })
  const meal = (overrides: Partial<MealDef> = {}): MealDef => ({
    id: 'a-meal-1',
    destinationId: 'a',
    name: 'Test meal',
    costINR: 80,
    slot: 'lunch',
    windowStartMin: 720,
    windowEndMin: 900,
    blurb: 'One honest sentence.',
    ...overrides,
  })
  const spot = (overrides: Partial<SpotDef> = {}): SpotDef => ({
    id: 'a-spot-1',
    destinationId: 'a',
    name: 'Test spot',
    blurb: 'One honest sentence.',
    distanceKm: 2,
    ...overrides,
  })
  /** Minimal valid catalog: food/heritage/nature activities, a meal, and a spot per location. */
  const validCatalog = () => ({
    activities: ['a', 'b'].flatMap((dest) => [
      activity({ id: `${dest}-food-1`, destinationId: dest }),
      activity({ id: `${dest}-heritage-1`, destinationId: dest, category: 'heritage' }),
      activity({ id: `${dest}-nature-1`, destinationId: dest, category: 'nature' }),
    ]),
    meals: ['a', 'b'].map((dest) => meal({ id: `${dest}-meal-1`, destinationId: dest })),
    spots: ['a', 'b'].map((dest) => spot({ id: `${dest}-spot-1`, destinationId: dest })),
  })

  it('accepts a consistent catalog', () => {
    expect(() => validatePoiCatalog(validCatalog(), baseLocations)).not.toThrow()
  })

  it('rejects duplicate ids across the catalog', () => {
    const catalog = validCatalog()
    catalog.activities.push(activity({ id: 'a-food-1', destinationId: 'b' }))
    expect(() => validatePoiCatalog(catalog, baseLocations)).toThrow(/duplicate activity id 'a-food-1'/)
  })

  it('rejects unknown destination ids', () => {
    const catalog = validCatalog()
    catalog.spots.push(spot({ id: 'zz-spot-1', destinationId: 'zzz' }))
    expect(() => validatePoiCatalog(catalog, baseLocations)).toThrow(/unknown destination 'zzz'/)
  })

  it('rejects negative activity costs', () => {
    expect(() =>
      validatePoiCatalog({ ...validCatalog(), activities: [activity({ costINR: -1 })] }, baseLocations),
    ).toThrow(/negative or non-finite cost/)
  })

  it('rejects durations outside 15–240 minutes', () => {
    expect(() =>
      validatePoiCatalog({ ...validCatalog(), activities: [activity({ durationMin: 10 })] }, baseLocations),
    ).toThrow(/duration 10 outside 15–240 min/)
    expect(() =>
      validatePoiCatalog({ ...validCatalog(), activities: [activity({ durationMin: 300 })] }, baseLocations),
    ).toThrow(/duration 300 outside 15–240 min/)
  })

  it('rejects unordered meal windows and unknown slots', () => {
    expect(() =>
      validatePoiCatalog(
        { ...validCatalog(), meals: [meal({ windowStartMin: 900, windowEndMin: 720 })] },
        baseLocations,
      ),
    ).toThrow(/unordered window/)
    expect(() =>
      validatePoiCatalog(
        { ...validCatalog(), meals: [meal({ slot: 'brunch' as MealDef['slot'] })] },
        baseLocations,
      ),
    ).toThrow(/unknown slot/)
  })

  it('rejects destinations without a food offering', () => {
    const catalog = validCatalog()
    catalog.meals = catalog.meals.filter((m) => m.destinationId !== 'a')
    const activities = catalog.activities.filter(
      (a) => !(a.destinationId === 'a' && a.category === 'food'),
    )
    expect(() => validatePoiCatalog({ ...catalog, activities }, baseLocations)).toThrow(
      /'a' has neither a food activity nor a meal/,
    )
  })

  it('rejects destinations covering fewer than three interest categories', () => {
    const catalog = validCatalog()
    const activities = catalog.activities.filter(
      (a) => a.destinationId !== 'b' || a.category === 'food',
    )
    expect(() => validatePoiCatalog({ ...catalog, activities }, baseLocations)).toThrow(
      /'b' covers only 1 interest categories \(need ≥ 3\)/,
    )
  })

  it('lists every problem at once', () => {
    try {
      validatePoiCatalog(
        {
          activities: [activity({ id: 'x-food-1', destinationId: 'zzz', costINR: -5 })],
          meals: [],
          spots: [],
        },
        baseLocations,
      )
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(DatasetValidationError)
      const { problems } = err as DatasetValidationError
      expect(problems).toHaveLength(4)
      expect(problems).toContain("x-food-1 references unknown destination 'zzz'")
      expect(problems).toContain('x-food-1 has negative or non-finite cost -5')
    }
  })
})

describe('demo POI catalog', () => {
  it('validates at load against every real destination', () => {
    expect(() => validatePoiCatalog(POI_CATALOG, LOCATIONS)).not.toThrow()
  })

  it('offers 4–8 activities, 2–4 meals, and 3–4 famous spots per destination', () => {
    for (const loc of LOCATIONS) {
      const activities = ACTIVITIES.filter((a) => a.destinationId === loc.id)
      const meals = MEALS.filter((m) => m.destinationId === loc.id)
      const spots = SPOTS.filter((s) => s.destinationId === loc.id)
      expect(activities.length, loc.id).toBeGreaterThanOrEqual(4)
      expect(activities.length, loc.id).toBeLessThanOrEqual(8)
      expect(meals.length, loc.id).toBeGreaterThanOrEqual(2)
      expect(meals.length, loc.id).toBeLessThanOrEqual(4)
      expect(spots.length, loc.id).toBeGreaterThanOrEqual(3)
      expect(spots.length, loc.id).toBeLessThanOrEqual(4)
    }
  })

  it('covers at least three interest categories and a food offering per destination', () => {
    for (const loc of LOCATIONS) {
      const categories = new Set(
        ACTIVITIES.filter((a) => a.destinationId === loc.id).map((a) => a.category),
      )
      if (MEALS.some((m) => m.destinationId === loc.id)) categories.add('food')
      expect(categories.size, loc.id).toBeGreaterThanOrEqual(3)
      const hasFood =
        categories.has('food') ||
        MEALS.some((m) => m.destinationId === loc.id)
      expect(hasFood, loc.id).toBe(true)
    }
  })

  it('tags activities with known categories and meals with valid ordered windows', () => {
    for (const activity of ACTIVITIES) {
      expect(INTEREST_IDS).toContain(activity.category)
      expect(activity.durationMin).toBeGreaterThanOrEqual(15)
      expect(activity.durationMin).toBeLessThanOrEqual(240)
      expect(activity.costINR).toBeGreaterThanOrEqual(0)
    }
    for (const meal of MEALS) {
      expect(MEAL_SLOTS).toContain(meal.slot)
      expect(meal.windowStartMin).toBeGreaterThanOrEqual(0)
      expect(meal.windowEndMin).toBeLessThanOrEqual(24 * 60)
      expect(meal.windowStartMin).toBeLessThan(meal.windowEndMin)
      expect(meal.costINR).toBeGreaterThanOrEqual(0)
    }
    for (const spot of SPOTS) {
      expect(spot.distanceKm).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('photo credits manifest', () => {
  it('has unique asset ids with complete attribution', () => {
    const assetIds = new Set(PHOTO_CREDITS.map((credit) => credit.assetId))
    expect(assetIds.size).toBe(PHOTO_CREDITS.length)
    for (const credit of PHOTO_CREDITS) {
      expect(credit.creator.length).toBeGreaterThan(0)
      expect(credit.license.length).toBeGreaterThan(0)
      expect(credit.licenseUrl).toMatch(/^https:/)
      expect(credit.sourcePage).toMatch(/^https:/)
    }
  })

  it('references only known location or spot ids — no orphans', () => {
    const bundleIds = new Set([
      ...LOCATIONS.map((loc) => loc.id),
      ...SPOTS.map((spot) => spot.id),
    ])
    for (const credit of PHOTO_CREDITS) {
      expect(bundleIds.has(credit.assetId), credit.assetId).toBe(true)
    }
  })
})

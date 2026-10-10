import { describe, expect, it } from 'vitest'
import {
  CONNECTIONS,
  DATA_PROVENANCE,
  DEMO_DATA,
  DatasetValidationError,
  LOCATIONS,
  REFERENCE_DAY_ISO,
  REFERENCE_DAY_START_MS,
  at,
  loadTransportData,
  validateDataset,
} from '../src/data'
import type { Connection, Location, Mode } from '../src/data'

const baseLocations: Location[] = [
  { id: 'a', name: 'A', region: 'Kerala', tags: [] },
  { id: 'b', name: 'B', region: 'Kerala', tags: [] },
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

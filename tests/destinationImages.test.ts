import { describe, expect, it } from 'vitest'
import { LOCATIONS } from '../src/data/locations'
import { DESTINATION_IMAGES, imageForLocation } from '../src/components/destinationImages'

describe('destination image manifest', () => {
  it('has a bundled entry for every dataset location id', () => {
    for (const loc of LOCATIONS) {
      expect(DESTINATION_IMAGES[loc.id], `missing thumbnail for ${loc.id}`).toBeTruthy()
    }
  })

  it('has no extra keys beyond the dataset location ids', () => {
    const ids = new Set(LOCATIONS.map((l) => l.id))
    for (const key of Object.keys(DESTINATION_IMAGES)) {
      expect(ids.has(key), `manifest key ${key} is not a dataset location id`).toBe(true)
    }
  })

  it('resolves every id through imageForLocation and falls back to empty for unknown ids', () => {
    for (const loc of LOCATIONS) {
      expect(imageForLocation(loc.id)).not.toBe('')
    }
    expect(imageForLocation('not-a-place')).toBe('')
  })
})

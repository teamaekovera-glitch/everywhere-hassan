import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DESTINATION_PHOTOS,
  SPOT_PHOTOS,
  photoForDestination,
  photoForSpot,
} from '../src/components/destinationPhotos'
import { imageForLocation } from '../src/components/destinationImages'
import { LOCATIONS } from '../src/data/locations'
import { SPOTS } from '../src/data/spots'
import { PHOTO_CREDITS } from '../src/data/photoCredits'

const PHOTO_ROOT = join(process.cwd(), 'src', 'assets', 'photos')
/** The spec's bundle budget: ~90 images, ≤ ~12 MB. */
const BUNDLE_BUDGET_BYTES = 12 * 1024 * 1024

/** File stems (asset ids) present in a bundled photo directory. */
function bundledIds(dir: 'destinations' | 'spots'): Set<string> {
  return new Set(
    readdirSync(join(PHOTO_ROOT, dir))
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => f.replace(/\.jpg$/, '')),
  )
}

function bundledBytes(dir: 'destinations' | 'spots'): number {
  return readdirSync(join(PHOTO_ROOT, dir)).reduce(
    (sum, f) => sum + statSync(join(PHOTO_ROOT, dir, f)).size,
    0,
  )
}

describe('bundled photo manifest', () => {
  it('resolves every dataset location id to a photo or the generated webp fallback', () => {
    for (const loc of LOCATIONS) {
      const photo = photoForDestination(loc.id)
      expect(photo, `no resolution for ${loc.id}`).toBeTruthy()
      // A destination without a bundled Commons photo still has its webp.
      if (!(loc.id in DESTINATION_PHOTOS)) {
        expect(imageForLocation(loc.id), `no webp fallback for ${loc.id}`).toBeTruthy()
      }
    }
  })

  it('resolves every dataset spot id to a bundled photo or the monogram fallback', () => {
    for (const spot of SPOTS) {
      // '' means the caller renders the monogram tile — still a resolution.
      expect(typeof photoForSpot(spot.id), `unresolved spot ${spot.id}`).toBe('string')
      if (photoForSpot(spot.id) !== '') {
        expect(spot.id in SPOT_PHOTOS, `${spot.id} not in the spot manifest`).toBe(true)
      }
    }
  })

  it('has no manifest keys beyond dataset ids — no orphans', () => {
    const locIds = new Set(LOCATIONS.map((l) => l.id))
    const spotIds = new Set(SPOTS.map((s) => s.id))
    for (const key of Object.keys(DESTINATION_PHOTOS)) {
      expect(locIds.has(key), `destination manifest key ${key} is not a dataset id`).toBe(true)
    }
    for (const key of Object.keys(SPOT_PHOTOS)) {
      expect(spotIds.has(key), `spot manifest key ${key} is not a dataset id`).toBe(true)
    }
  })

  it('has exactly one credit per bundled photo file — and every credit has a file', () => {
    const destIds = bundledIds('destinations')
    const spotIds = bundledIds('spots')
    const bundled = new Set([...destIds, ...spotIds])
    const credited = new Set(PHOTO_CREDITS.map((c) => c.assetId))

    for (const id of bundled) {
      expect(credited.has(id), `bundled photo ${id}.jpg has no credit record`).toBe(true)
    }
    for (const id of credited) {
      expect(bundled.has(id), `credit ${id} has no bundled photo file`).toBe(true)
    }
    expect(credited.size).toBe(PHOTO_CREDITS.length)
  })

  it('manifest keys match the bundled files exactly', () => {
    expect(new Set(Object.keys(DESTINATION_PHOTOS))).toEqual(bundledIds('destinations'))
    expect(new Set(Object.keys(SPOT_PHOTOS))).toEqual(bundledIds('spots'))
  })

  it('stays within the ~12 MB bundle budget', () => {
    const total = bundledBytes('destinations') + bundledBytes('spots')
    expect(total).toBeLessThanOrEqual(BUNDLE_BUDGET_BYTES)
  })

  it('credits only use the documented license allowlist', () => {
    // CC0, Public domain, CC BY, CC BY-SA (any version or port) — the
    // fetcher skips anything else, so the manifest can never carry one.
    const allowed = /^(CC0|Public domain|CC BY(-SA)? [0-9.]+( in)?)$/i
    for (const credit of PHOTO_CREDITS) {
      expect(credit.license, credit.assetId).toMatch(allowed)
      expect(credit.licenseUrl).toMatch(/^https:/)
      expect(credit.sourcePage).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
    }
  })
})

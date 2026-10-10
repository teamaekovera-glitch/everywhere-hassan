/**
 * Per-image attribution for bundled photography — creator, license, and
 * source page travel inseparably with every asset, so the in-app credits
 * panel can render offline. The manifest fills when the photo pipeline
 * (scripts/fetch-photos.mjs, Wikimedia Commons) runs in PR 3; until then
 * the bundled set is generated `.webp` thumbnails and monograms, which need
 * no credit records. Kept as a placeholder so tests and imports can land
 * before the photos do.
 */
export interface PhotoCredit {
  /** Bundle asset this credit covers — `<locationId>` or `<spotId>`. */
  assetId: string
  /** Creator name as Commons reports it. */
  creator: string
  /** License short name — 'CC BY-SA 4.0'. */
  license: string
  /** License text URL for the in-app link. */
  licenseUrl: string
  /** Commons source page for the in-app link. */
  sourcePage: string
}

/**
 * Empty until real Commons photos land in `src/assets/photos/` — every
 * bundled photo must carry exactly one record here (manifest invariant,
 * tests/dataset.test.ts). Generated fallbacks and monograms need none.
 */
export const PHOTO_CREDITS: readonly PhotoCredit[] = []

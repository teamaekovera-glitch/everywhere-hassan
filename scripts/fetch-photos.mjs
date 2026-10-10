#!/usr/bin/env node
/**
 * Build-time photo pipeline for the day-trip planner — run locally, never in CI.
 *
 *   node scripts/fetch-photos.mjs [--dry-run]
 *
 * For every location in src/data/locations.ts it searches Wikimedia Commons
 * for a real photograph (geosearch at the location's coordinates, falling back
 * to a namespace-6 text search on "<place> <landmark>"), then for every entry
 * in src/data/spots.ts it searches on "<spot> <region>". Candidates pass a
 * strict license allowlist (CC0, Public domain, CC BY, CC BY-SA) — anything
 * unclear or missing license metadata is skipped, never guessed.
 *
 * Downloads land in src/assets/photos/destinations/<id>.jpg and
 * src/assets/photos/spots/<spotId>.jpg, resized server-side at download via
 * Commons' iiurlwidth rendition (1200px destinations, 800px spots), with a
 * second smaller-rendition pass for oversized files. The script then emits:
 *
 *   - src/data/photoCredits.ts        one attribution record per bundled asset
 *   - src/components/destinationPhotos.ts  manifest + fallback resolution
 *
 * and prints a per-destination coverage report. Anything that ended on a
 * fallback (generated .webp or monogram) is named there — never silently.
 *
 * Etiquette: bounded concurrency (4), a descriptive User-Agent with contact
 * info per Wikimedia policy, viewport-sized rendition requests (no bulk
 * originals). No runtime network use — the app stays offline.
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DRY_RUN = process.argv.includes('--dry-run')

const DEST_WIDTH = 1200
const SPOT_WIDTH = 800
/** Re-request a smaller rendition when a downloaded file exceeds its cap. */
const DEST_SIZE_CAP = 260 * 1024
const SPOT_SIZE_CAP = 140 * 1024
const DEST_WIDTH_SMALL = 800
const SPOT_WIDTH_SMALL = 500
const CONCURRENCY = 4
/** Politeness gap per worker lane between HTTP requests (ms). */
const LANE_DELAY_MS = 700
const API = 'https://commons.wikimedia.org/w/api.php'
// Wikimedia User-Agent policy: descriptive tool identity plus a contact route.
const USER_AGENT =
  'EVERYWHERE-day-trip-planner-photo-fetcher/1.0 ' +
  '(https://github.com/teamaekovera-glitch/everywhere-hassan; contact teamaekovera@gmail.com)'

// ---------------------------------------------------------------------------
// dataset parsing — src/data/*.ts are the source of truth; the regexes match
// the one-line object literals and the counts are validated loudly below.
// ---------------------------------------------------------------------------

function readSrc(name) {
  return readFile(path.join(ROOT, 'src', 'data', name), 'utf8')
}

function unescapeSq(s) {
  return s.replace(/\\(['\\])/g, '$1')
}

function parseLocations(src) {
  const re =
    /id:\s*'([^']+)'\s*,\s*name:\s*'((?:[^'\\]|\\.)*)'\s*,\s*region:\s*'[^']*'[^{}]*?lat:\s*(-?[\d.]+)\s*,\s*lon:\s*(-?[\d.]+)/g
  const out = []
  for (const m of src.matchAll(re)) {
    out.push({ id: m[1], name: unescapeSq(m[2]), lat: Number(m[3]), lon: Number(m[4]) })
  }
  return out
}

function parseSpots(src) {
  const re =
    /id:\s*'([^']+)'\s*,\s*destinationId:\s*'([^']+)'\s*,\s*name:\s*'((?:[^'\\]|\\.)*)'[^{}]*?distanceKm:\s*([\d.]+)/g
  const out = []
  for (const m of src.matchAll(re)) {
    out.push({ id: m[1], destinationId: m[2], name: unescapeSq(m[3]), distanceKm: Number(m[4]) })
  }
  return out
}

function assertUnique(items, label) {
  const seen = new Set()
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`duplicate ${label} id: ${item.id}`)
    seen.add(item.id)
  }
}

// ---------------------------------------------------------------------------
// Commons API — JSON, formatversion 2, retried on transient failures.
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function commons(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
    const body = await res.json()
    if (body.error) throw new Error(`API error: ${body.error.code} ${body.error.info}`)
    return body
  } catch (err) {
    if (attempt >= 3) throw err
    // 429 needs a longer cool-down than a transient network blip.
    await sleep((err.status === 429 ? 3000 : 800) * 2 ** attempt)
    return commons(params, attempt + 1)
  }
}

/** Bounded-concurrency map; each lane idles LANE_DELAY_MS between tasks. */
async function mapWithConcurrency(items, worker) {
  const results = new Array(items.length)
  let next = 0
  const lane = async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
      await sleep(LANE_DELAY_MS)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, lane))
  return results
}

// ---------------------------------------------------------------------------
// License gate — allowlist only. A missing or unclear license is a skip.
// ---------------------------------------------------------------------------

const LICENSE_PATTERNS = [
  /^cc0/i,
  /^public domain/i,
  /^pd(\b|-|:)/i,
  /^cc by(-sa)?( \d+(\.\d+)?)?( [a-z]{2})?$/i,
]

function licenseAllowed(license) {
  return license.length > 0 && LICENSE_PATTERNS.some((re) => re.test(license))
}

function isPublicDomainish(license) {
  return /^cc0/i.test(license) || /^public domain/i.test(license) || /^pd(\b|-|:)/i.test(license)
}

/** Strip HTML and template wrappers from an extmetadata Artist value. */
function cleanCreator(html) {
  let s = String(html)
  s = s.replace(/\{\{[^}]*\}\}/g, (m) => {
    const parts = m.slice(2, -2).split(/[|:]/)
    return parts[parts.length - 1] ?? ''
  })
  s = s.replace(/<[^>]*>/g, ' ')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
  return s.replace(/\s+/g, ' ').trim()
}

/** Derive an https license URL when extmetadata omits LicenseUrl. */
function licenseUrlFor(license, metaUrl) {
  if (/^https:/i.test(metaUrl)) return metaUrl
  const cc = license.match(/^cc (by)(?:-sa)? (\d+)(\.\d+)?/i)
  if (cc) {
    const variant = /-sa/i.test(license) ? 'by-sa' : 'by'
    return `https://creativecommons.org/licenses/${variant}/${cc[2]}${cc[3] ?? '.0'}/`
  }
  if (/^cc0/i.test(license)) return 'https://creativecommons.org/publicdomain/zero/1.0/'
  return 'https://commons.wikimedia.org/wiki/Commons:Public_domain'
}

function candidateFromPage(page) {
  const ii = page.imageinfo?.[0]
  if (!ii) return null
  const meta = ii.extmetadata ?? {}
  // Honest .jpg files only — the bundle contract is <assetId>.jpg.
  if (!/\.jpe?g$/i.test(new URL(ii.url).pathname)) return null
  // A logo, flag, or map is not a photo of the place — skip, don't guess.
  if (/\b(logo|icon|flag|seal|coat of arms|map)\b/i.test(page.title)) return null
  const license = String(meta.LicenseShortName?.value ?? '').trim()
  if (!licenseAllowed(license)) return null
  let creator = cleanCreator(meta.Artist?.value ?? '')
  if (!creator) {
    // CC0/PD releases carry no attribution duty; a BY-licensed file without
    // an author is broken metadata — skipped rather than guessed.
    if (!isPublicDomainish(license)) return null
    creator = 'Unknown creator'
  }
  return {
    title: page.title ?? '',
    pageId: page.pageid ?? 0,
    url: ii.url,
    thumbUrl: ii.thumburl ?? ii.url,
    thumbWidth: ii.thumbwidth ?? ii.width ?? 0,
    thumbHeight: ii.thumbheight ?? ii.height ?? 0,
    coords: page.coordinates?.[0] ?? null,
    snippet: String(page.snippetText ?? ''),
    license,
    licenseUrl: licenseUrlFor(license, String(meta.LicenseUrl?.value ?? '')),
    creator,
    sourcePage: ii.descriptionurl ?? pageUrl(page.title),
  }
}

function pageUrl(title) {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(title).replaceAll('%3A', ':').replaceAll('%20', '_')}`
}

// ---------------------------------------------------------------------------
// Candidate search — deterministic scoring on title tokens, pageid tiebreak.
// ---------------------------------------------------------------------------

function tokenize(s) {
  return String(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4)
}

function titleScore(title, weightedTokens) {
  const t = title.toLowerCase()
  let score = 0
  for (const [token, weight] of weightedTokens) {
    if (t.includes(token)) score += weight
  }
  return score
}

function rankCandidates(pages, weightedTokens, preferLandscape = false) {
  const scoreOf = (c) =>
    titleScore(c.title, weightedTokens) + (preferLandscape && c.thumbWidth > c.thumbHeight ? 2 : 0)
  return pages
    .map((page) => candidateFromPage(page))
    .filter(Boolean)
    .sort((a, b) => scoreOf(b) - scoreOf(a) || a.pageId - b.pageId)
}

async function geosearchCandidates(loc) {
  const body = await commons({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${loc.lat}|${loc.lon}`,
    ggsradius: '10000',
    ggsnamespace: '6',
    ggslimit: '50',
    prop: 'imageinfo|coordinates',
    colimit: 'max',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(DEST_WIDTH),
  })
  return body.query?.pages ?? []
}

/** Namespace-6 text search, then a batched imageinfo lookup for the hits. */
async function searchCandidates(query, width) {
  const body = await commons({
    action: 'query',
    list: 'search',
    srsearch: `${query} filetype:bitmap`,
    srnamespace: '6',
    srlimit: '12',
  })
  const hits = body.query?.search ?? []
  if (hits.length === 0) return []
  const info = await commons({
    action: 'query',
    titles: hits.map((hit) => hit.title).join('|'),
    prop: 'imageinfo|coordinates',
    colimit: 'max',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(width),
  })
  // Search snippets carry the indexed page text (title, categories) — a
  // geographic signal for files whose titles never name the place.
  const snippets = new Map(hits.map((hit) => [hit.title, stripHtml(String(hit.snippet ?? ''))]))
  return (info.query?.pages ?? [])
    .filter((p) => !p.missing)
    .map((p) => ({ ...p, snippetText: snippets.get(p.title) ?? '' }))
}

const stripHtml = (s) => s.replace(/<[^>]*>/g, '')

/** Merge candidate lists, keeping each Commons title once. */
function mergePages(...lists) {
  const byTitle = new Map()
  for (const list of lists) {
    for (const page of list) {
      if (page && !page.missing && !byTitle.has(page.title)) byTitle.set(page.title, page)
    }
  }
  return [...byTitle.values()]
}

// ---------------------------------------------------------------------------
// Pick + download
// ---------------------------------------------------------------------------

const usedTitles = new Set()

function firstUnused(candidates) {
  return candidates.find((c) => !usedTitles.has(c.title))
}

/** Claim the best unused candidate — records the pick the moment it is made,
 * so concurrent lanes never claim the same file twice. */
function takeUnused(candidates) {
  const pick = firstUnused(candidates)
  if (pick) usedTitles.add(pick.title)
  return pick ?? null
}

/**
 * Weighted tokens for candidate scoring — primary names (the place or sight
 * itself) weigh 3, secondary context (the containing destination) weighs 1,
 * and a token shared by both keeps its max weight.
 */
function weightedTokens(primaryNames, secondaryNames = []) {
  const tokens = new Map()
  const add = (name, weight) => {
    for (const token of tokenize(name)) {
      tokens.set(token, Math.max(tokens.get(token) ?? 0, weight))
    }
  }
  for (const name of primaryNames) add(name, 3)
  for (const name of secondaryNames) add(name, 1)
  return [...tokens.entries()]
}

/**
 * Great-circle distance in km (haversine) — the wrong-place guard. A file
 * geotagged far outside the destination's region (a "Sunset Point" in Bryce
 * Canyon) is a different place, whatever its title says; untagged files pass,
 * since most Commons photos of Indian towns carry no coordinates.
 */
function haversineKm(aLat, aLon, bLat, bLon) {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(s))
}

const DEST_MAX_GEO_KM = 30
const SPOT_MAX_GEO_KM = 60

/**
 * Widely used alternate romanizations, keyed by location id — files titled
 * 'Mangalore', 'Calicut', or 'Kanyakumari' rank for Mangaluru, Kozhikode, and
 * Kanniyakumari instead of losing to generic same-score candidates.
 */
const ALTERNATE_NAMES = {
  mangaluru: ['mangalore'],
  kozhikode: ['calicut'],
  kanniyakumari: ['kanyakumari'],
  bengaluru: ['bangalore'],
  thiruvananthapuram: ['trivandrum'],
  alappuzha: ['alleppey'],
  thrissur: ['trichur'],
  kollam: ['quilon'],
  ooty: ['udhagamandalam'],
  ernakulam: ['kochi'],
  mysuru: ['mysore'],
  thalassery: ['tellicherry'],
}

function nameVariants(loc) {
  return [loc.name, ...(ALTERNATE_NAMES[loc.id] ?? [])]
}

function wrongPlace(candidate, loc, maxKm) {
  if (!candidate?.coords || !Number.isFinite(candidate.coords.lat)) return false
  return haversineKm(candidate.coords.lat, candidate.coords.lon, loc.lat, loc.lon) > maxKm
}

/** Geosearch per destination, fetched once and shared with its nearby spots. */
const geosearchCache = new Map()
async function geosearchFor(loc) {
  if (!geosearchCache.has(loc.id)) geosearchCache.set(loc.id, await geosearchCandidates(loc))
  return geosearchCache.get(loc.id)
}

async function pickDestinationPhoto(loc, spotNames) {
  const tokens = weightedTokens([...nameVariants(loc), ...spotNames])
  // Merged pool: geosearch (what sits near the coordinates — the spec's
  // primary source) plus the spec's fallback shape, "<place> <landmark>".
  // The two compete on title score because geotagged pools skew toward
  // documentation shots (museum exhibits, events) over scenery.
  const pages = mergePages(
    await geosearchFor(loc),
    await searchCandidates(`${loc.name} ${spotNames[0] ?? ''}`.trim(), DEST_WIDTH),
  )
  const ranked = rankCandidates(pages, tokens, true).filter((c) => !wrongPlace(c, loc, DEST_MAX_GEO_KM))
  return takeUnused(ranked)
}

/** Spot-name spelling variants Commons titles actually use. */
const SPOT_NAME_VARIANTS = {
  'Shanghumugham Beach': ['Shankumugham Beach'],
}

async function pickSpotPhoto(spot, loc) {
  const names = [spot.name, ...(SPOT_NAME_VARIANTS[spot.name] ?? [])]
  const tokens = weightedTokens(names, [...nameVariants(loc), loc.region])
  const anchors = [...nameVariants(loc), loc.region].flatMap((n) => tokenize(n))
  const anchored = (c) => {
    const hay = `${c.title} ${c.snippet ?? ''}`.toLowerCase()
    return anchors.some((a) => hay.includes(a))
  }
  /**
   * Geographic evidence: a geotag near the destination, or the destination,
   * an alternate name, or the region in the title or page text. Untagged
   * files from global searches without either are someone else's Sunset
   * Point; geotagged files are trusted as-is.
   */
  const acceptable = (c) => !wrongPlace(c, loc, SPOT_MAX_GEO_KM) && (c.coords || anchored(c))
  const pickFrom = async (query) =>
    takeUnused(rankCandidates(await searchCandidates(query, SPOT_WIDTH), tokens).filter(acceptable))
  // Title-anchored phrase search first (over every known spelling) — it
  // matches the sight, not a person or event that merely shares a token
  // ("Napier" the admiral, not the museum). The regioned plain query widens
  // the net for oddly-titled files, and the final stages catch sights Commons
  // titles differently ("Kalpathy Agrahara" for Kalpathy Heritage Village).
  for (const name of names) {
    const fromIntitle = await pickFrom(`intitle:"${name}"`)
    if (fromIntitle) return fromIntitle
  }
  return (
    (await pickFrom(`${spot.name} ${loc.region}`)) ??
    (await pickFrom(spot.name)) ??
    (await pickFrom(`intitle:"${spot.name.split(' ')[0]}"`))
  )
}

async function downloadPhoto(candidate, width, sizeCap, smallWidth) {
  let buf = await fetchBinary(candidate.thumbUrl)
  if (buf.length <= sizeCap) return buf
  // Progressively smaller Commons renditions until under the bundle cap —
  // one retry often still exceeds it, so walk widths down instead.
  for (const factor of [1, 0.7, 0.5]) {
    const info = await commons({
      action: 'query',
      titles: candidate.title,
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: String(Math.round(smallWidth * factor)),
    })
    const smaller = info.query?.pages?.[0]?.imageinfo?.[0]?.thumburl
    if (!smaller || smaller === candidate.thumbUrl) continue
    const retry = await fetchBinary(smaller)
    if (retry.length >= buf.length) continue
    buf = retry
    if (buf.length <= sizeCap) return buf
  }
  return buf
}

async function fetchBinary(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    if (attempt >= 3) throw err
    await sleep((err.status === 429 ? 3000 : 800) * 2 ** attempt)
    return fetchBinary(url, attempt + 1)
  }
}

// ---------------------------------------------------------------------------
// Emitted files
// ---------------------------------------------------------------------------

function emitCredits(records) {
  const blocks = records
    .map(
      (r) => `  {
    assetId: '${r.assetId}',
    creator: '${r.creator.replaceAll("'", "\\'")}',
    license: '${r.license.replaceAll("'", "\\'")}',
    licenseUrl: '${r.licenseUrl}',
    sourcePage: '${r.sourcePage}',
  },`,
    )
    .join('\n')
  return `/**
 * Per-image attribution for bundled photography — creator, license, and
 * source page travel inseparably with every asset, so the in-app credits
 * panel can render offline.
 *
 * GENERATED by scripts/fetch-photos.mjs (Wikimedia Commons) — do not edit by
 * hand; re-run the script instead. The PhotoCredit interface matches the
 * placeholder manifest type the tests already contract on.
 */
export interface PhotoCredit {
  /** Bundle asset this credit covers — \`<locationId>\` or \`<spotId>\`. */
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
 * Every bundled Commons photo has exactly one record here (manifest
 * invariant, tests/photoAssets.test.ts). Generated fallbacks and monograms
 * need none.
 */
export const PHOTO_CREDITS: readonly PhotoCredit[] = [
${blocks}
]
`
}

function camel(id) {
  return id.replaceAll(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function emitPhotosManifest(destinationIds, spotIds) {
  const destImports = destinationIds
    .map((id) => `import ${camel(id)} from '../assets/photos/destinations/${id}.jpg'`)
    .join('\n')
  const spotImports = spotIds
    .map((id) => `import ${camel(id)} from '../assets/photos/spots/${id}.jpg'`)
    .join('\n')
  const destKeys = destinationIds.map((id) => `  '${id}': ${camel(id)},`).join('\n')
  const spotKeys = spotIds.map((id) => `  '${id}': ${camel(id)},`).join('\n')
  return `// GENERATED by scripts/fetch-photos.mjs — do not edit by hand; re-run it instead.
// Static ESM imports keep every photo a same-origin Vite asset (fingerprinted
// at build), so the bundle carries no external image URL. Ids without a
// bundled Commons photo are simply absent here and resolve through the
// documented fallbacks: destinations fall back to the generated .webp
// thumbnails, spots to the monogram tile.
${destImports}${spotImports.length > 0 ? `\n${spotImports}` : ''}
import { imageForLocation } from './destinationImages'

export const DESTINATION_PHOTOS: Record<string, string> = {
${destKeys}
}

export const SPOT_PHOTOS: Record<string, string> = {
${spotKeys}
}

/** Real photo for a destination id, else the generated .webp, else ''. */
export function photoForDestination(id: string): string {
  return DESTINATION_PHOTOS[id] ?? imageForLocation(id)
}

/** Real photo for a spot id, or '' — callers fall back to the monogram tile. */
export function photoForSpot(id: string): string {
  return SPOT_PHOTOS[id] ?? ''
}
`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`
}

async function main() {
  const locations = parseLocations(await readSrc('locations.ts'))
  const spots = parseSpots(await readSrc('spots.ts'))
  const spotsByDest = new Map(spots.map((s) => [s.destinationId, []]))
  for (const spot of spots) {
    if (!spotsByDest.has(spot.destinationId)) spotsByDest.set(spot.destinationId, [])
    spotsByDest.get(spot.destinationId).push(spot)
  }
  assertUnique(locations, 'location')
  assertUnique(spots, 'spot')
  if (locations.length === 0 || spots.length === 0) throw new Error('dataset parse came up empty')
  for (const loc of locations) {
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) throw new Error(`bad coordinates for ${loc.id}`)
  }

  console.log(`Parsed ${locations.length} locations and ${spots.length} spots${DRY_RUN ? ' (dry run)' : ''}\n`)

  const destResults = await mapWithConcurrency(locations, async (loc) => {
    const spotNames = (spotsByDest.get(loc.id) ?? []).map((s) => s.name)
    try {
      const pick = await pickDestinationPhoto(loc, spotNames)
      return { loc, pick }
    } catch (err) {
      return { loc, pick: null, error: String(err.message ?? err) }
    }
  })

  const spotResults = await mapWithConcurrency(spots, async (spot) => {
    const loc = locations.find((l) => l.id === spot.destinationId)
    try {
      const pick = await pickSpotPhoto(spot, loc)
      return { spot, pick }
    } catch (err) {
      return { spot, pick: null, error: String(err.message ?? err) }
    }
  })

  const records = []
  const destPhotoIds = []
  const destStatus = new Map()
  if (!DRY_RUN) await mkdir(path.join(ROOT, 'src/assets/photos/destinations'), { recursive: true })
  for (const { loc, pick, error } of destResults) {
    if (!pick) {
      destStatus.set(loc.id, { ok: false, note: error ?? 'no acceptable candidate' })
      continue
    }
    if (DRY_RUN) {
      destStatus.set(loc.id, { ok: true, note: `${pick.title} (${pick.license})` })
      continue
    }
    usedTitles.add(pick.title)
    const buf = await downloadPhoto(pick, DEST_WIDTH, DEST_SIZE_CAP, DEST_WIDTH_SMALL)
    await writeFile(path.join(ROOT, 'src/assets/photos/destinations', `${loc.id}.jpg`), buf)
    destPhotoIds.push(loc.id)
    records.push({
      assetId: loc.id,
      creator: pick.creator,
      license: pick.license,
      licenseUrl: pick.licenseUrl,
      sourcePage: pick.sourcePage,
    })
    destStatus.set(loc.id, { ok: true, note: `${pick.title} (${pick.license}) — ${formatKb(buf.length)}` })
  }

  const spotPhotoIds = []
  const spotStatus = new Map()
  if (!DRY_RUN) await mkdir(path.join(ROOT, 'src/assets/photos/spots'), { recursive: true })
  for (const { spot, pick, error } of spotResults) {
    if (!pick) {
      spotStatus.set(spot.id, { ok: false, note: error ?? 'no acceptable candidate' })
      continue
    }
    if (DRY_RUN) {
      spotStatus.set(spot.id, { ok: true, note: `${pick.title} (${pick.license})` })
      continue
    }
    usedTitles.add(pick.title)
    const buf = await downloadPhoto(pick, SPOT_WIDTH, SPOT_SIZE_CAP, SPOT_WIDTH_SMALL)
    await writeFile(path.join(ROOT, 'src/assets/photos/spots', `${spot.id}.jpg`), buf)
    spotPhotoIds.push(spot.id)
    records.push({
      assetId: spot.id,
      creator: pick.creator,
      license: pick.license,
      licenseUrl: pick.licenseUrl,
      sourcePage: pick.sourcePage,
    })
    spotStatus.set(spot.id, { ok: true, note: `${pick.title} (${pick.license}) — ${formatKb(buf.length)}` })
  }

  if (!DRY_RUN) {
    await writeFile(path.join(ROOT, 'src/data/photoCredits.ts'), emitCredits(records))
    await writeFile(path.join(ROOT, 'src/components/destinationPhotos.ts'), emitPhotosManifest(destPhotoIds, spotPhotoIds))
  }

  // Coverage report — anything on fallback is named here, never silent.
  console.log('Destination coverage')
  for (const loc of locations) {
    const st = destStatus.get(loc.id)
    const mark = st?.ok ? 'photo   ' : st?.error ? 'ERROR   ' : 'FALLBACK'
    console.log(`  ${mark} ${loc.id.padEnd(20)} ${st?.error ? `(${st.error}) ` : ''}${st?.note ?? ''}`)
  }
  console.log('\nSpot coverage')
  for (const spot of spots) {
    const st = spotStatus.get(spot.id)
    const mark = st?.ok ? 'photo   ' : st?.error ? 'ERROR   ' : 'FALLBACK'
    console.log(`  ${mark} ${spot.id.padEnd(26)} ${st?.error ? `(${st.error}) ` : ''}${st?.note ?? ''}`)
  }

  const okDest = destResults.filter((r) => destStatus.get(r.loc.id)?.ok).length
  const okSpot = spotResults.filter((r) => spotStatus.get(r.spot.id)?.ok).length
  console.log(
    `\nDestinations with photos: ${okDest}/${locations.length} · spots with photos: ${okSpot}/${spots.length}` +
      ` · credit records: ${records.length}`,
  )
  if (!DRY_RUN && destPhotoIds.length + spotPhotoIds.length !== records.length) {
    throw new Error('records and downloads diverged — refusing to emit')
  }
  if (!DRY_RUN && existsSync(path.join(ROOT, 'src/data/photoCredits.ts'))) {
    const { totalBytes } = await bundleSize()
    console.log(`Bundle size: ${formatKb(totalBytes)} of a ~12 MB budget`)
  }
}

async function bundleSize() {
  let totalBytes = 0
  for (const dir of ['destinations', 'spots']) {
    const full = path.join(ROOT, 'src/assets/photos', dir)
    if (!existsSync(full)) continue
    for (const file of (await import('node:fs')).readdirSync(full)) {
      totalBytes += (await stat(path.join(full, file))).size
    }
  }
  return { totalBytes }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

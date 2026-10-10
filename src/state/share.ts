import { DEMO_DATA } from '../data'
import { formatIst } from '../sim/clock'
import { parseScenario, scenarioFromState } from './scenarios'
import type { SavedScenario, ScenarioSource } from './scenarios'

/**
 * Share links (spec): the current scenario serialized to a base64 URL
 * hash. One serializer, two sinks — the SAME SavedScenario schema the
 * localStorage persistence uses, validated by the SAME strict parser, so
 * a link can never express what a saved file couldn't.
 */

const HASH_PREFIX = 's='

/** UTF-8-safe base64url (no `+`, `/`, or `=` — safe in a URL hash). */
function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(encoded: string): string | null {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** Serialize a scenario into the value of a URL hash (no leading '#'). */
export function encodeScenarioHash(scenario: SavedScenario): string {
  return HASH_PREFIX + base64UrlEncode(JSON.stringify(scenario))
}

/**
 * Parse a URL hash (with or without the leading '#') into a scenario.
 * Anything malformed — wrong prefix, bad base64, bad JSON, failed
 * validation — returns null and the app silently keeps its current
 * state (spec: degrade, never crash).
 */
export function decodeScenarioHash(hash: string): SavedScenario | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw.startsWith(HASH_PREFIX)) return null
  const json = base64UrlDecode(raw.slice(HASH_PREFIX.length))
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  // The same strict parser localStorage goes through — one validator,
  // two sinks.
  return parseScenario(parsed)
}

/** Build a shareable absolute URL from the pieces of the current page URL. */
export function buildShareUrl(baseUrl: string, scenario: SavedScenario): string {
  const clean = baseUrl.replace(/#.*$/, '')
  return `${clean}#${encodeScenarioHash(scenario)}`
}

const SHARED_NAME_MAX = 40

/**
 * Snapshot the live state as a shareable scenario. The name is derived —
 * origin and simulated clock — so a link identifies itself in the list
 * without asking the sharer to type anything.
 */
export function sharedScenarioFromState(source: ScenarioSource): SavedScenario | null {
  const originName = DEMO_DATA.locationById.get(source.originId)?.name
  if (!originName) return null
  const base = `Shared · ${originName} · ${formatIst(source.clockNowMs)}`
  const name = base.length > SHARED_NAME_MAX ? base.slice(0, SHARED_NAME_MAX) : base
  return scenarioFromState(name, source)
}

/**
 * Copy text to the clipboard. Returns false when the platform refuses
 * (insecure context, no permissions) — the caller surfaces a visible
 * fallback instead of pretending it worked. Never throws.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

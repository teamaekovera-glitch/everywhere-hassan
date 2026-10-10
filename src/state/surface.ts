import { decodeScenarioHash } from './share'

/**
 * The three top-level surfaces (planner spec). No router — the shell owns
 * one `surface` state and conditionally renders, matching the repo's
 * conditional-overlay pattern. Explore is today's simulator, unchanged.
 */
export type Surface = 'home' | 'planner' | 'explore'

/**
 * Where an incoming page load lands. A valid `#s=` share link always
 * restores Explore — from any surface, including a fresh boot that would
 * otherwise show Home (spec: a shared link must never dead-end on Home).
 * Anything malformed or absent degrades to Home, the new default.
 */
export function surfaceForHash(hash: string): Surface {
  return decodeScenarioHash(hash) === null ? 'home' : 'explore'
}

// Bundled, offline destination thumbnails keyed by location id (spec).
// Every image is a same-origin Vite asset — no external URL, no fetch, ever.
// A missing entry degrades to the tag-colored monogram tile in the card, so
// the manifest test failing is the only way a monogram should ever appear.
import kasaragod from '../assets/destinations/kasaragod.webp'
import alappuzha from '../assets/destinations/alappuzha.webp'
import bengaluru from '../assets/destinations/bengaluru.webp'
import coimbatore from '../assets/destinations/coimbatore.webp'
import coorg from '../assets/destinations/coorg.webp'
import ernakulam from '../assets/destinations/ernakulam.webp'
import kanniyakumari from '../assets/destinations/kanniyakumari.webp'
import kannur from '../assets/destinations/kannur.webp'
import kollam from '../assets/destinations/kollam.webp'
import kozhikode from '../assets/destinations/kozhikode.webp'
import mangaluru from '../assets/destinations/mangaluru.webp'
import mysuru from '../assets/destinations/mysuru.webp'
import ooty from '../assets/destinations/ooty.webp'
import palakkad from '../assets/destinations/palakkad.webp'
import thalassery from '../assets/destinations/thalassery.webp'
import thiruvananthapuram from '../assets/destinations/thiruvananthapuram.webp'
import thrissur from '../assets/destinations/thrissur.webp'
import wayanad from '../assets/destinations/wayanad.webp'

export const DESTINATION_IMAGES: Record<string, string> = {
  kozhikode,
  thalassery,
  kannur,
  kasaragod,
  mangaluru,
  wayanad,
  mysuru,
  coorg,
  bengaluru,
  thrissur,
  palakkad,
  coimbatore,
  ooty,
  ernakulam,
  alappuzha,
  kollam,
  thiruvananthapuram,
  kanniyakumari,
}

/** Resolved image for a location id, or '' when the manifest lacks one. */
export function imageForLocation(id: string): string {
  return DESTINATION_IMAGES[id] ?? ''
}

// ---- destination tabs: pure view state over the engine's results ----------

export type TripTab = 'all' | 'short' | 'long'

/** Short trips are 4 hours and under; long trips are anything slower. */
export const SHORT_TRIP_MAX_MIN = 240

export function matchesTab(tab: TripTab, bestDurationMin: number): boolean {
  if (tab === 'all') return true
  return tab === 'short' ? bestDurationMin <= SHORT_TRIP_MAX_MIN : bestDurationMin > SHORT_TRIP_MAX_MIN
}

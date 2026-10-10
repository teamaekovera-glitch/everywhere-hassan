import type { SimCoreAction } from './store'
import { at } from '../data/referenceDay'
import { DEFAULT_AVAILABLE_HOURS, DEFAULT_BUDGET_INR, DEFAULT_ORIGIN_ID } from '../engine'

/**
 * The guided tour (spec): a scripted, auto-playing walk through the ten
 * demo beats the test suite asserts, in demo order. Each chapter sets the
 * snapshot state directly through the EXISTING store actions — story mode
 * is a mode flag over the live sim, never a parallel world. Ending or
 * exiting leaves the sim exactly where the last chapter left it.
 */

export interface StoryChapter {
  /** Stable id — tests and the playhead UI key on it. */
  id: string
  title: string
  caption: string
  /** Full-snapshot actions, folded through the core reducer in order. */
  enter: readonly SimCoreAction[]
  /**
   * Optional second beat: the unlock probe applied live (spec's closing
   * move). The chapter first shows the ghosted destination, then applies
   * the relaxation and the field blooms.
   */
  unlock?: readonly SimCoreAction[]
}

/** One full snapshot through the store's own actions. */
function snapshot(
  nowMs: number,
  budgetINR: number,
  availableHours: number,
  selectedId: string | null,
): readonly SimCoreAction[] {
  return [
    { type: 'pause' },
    { type: 'setNow', ms: nowMs },
    { type: 'setOrigin', id: DEFAULT_ORIGIN_ID },
    { type: 'setBudget', inr: budgetINR },
    { type: 'setAvailableHours', hours: availableHours },
    { type: 'select', id: selectedId },
  ]
}

/**
 * The unlock chapter's relaxation, computed by the shipped probe module
 * (src/engine/probe.ts): at the 12:30 snapshot Ooty's cheapest chain is
 * ₹2,120 against the ₹2,000 budget, so probe('ooty').minExtraBudget =
 * +₹120. The chapter applies it through the probe panel's own transient
 * preview lens — the field blooms while the baseline wallet stays ₹2,000
 * — the exact move the presenter would make tapping "Show it".
 */
const OOTY_UNLOCK_BUDGET_INR = 2_120

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  {
    id: 'dawn',
    title: 'Dawn — the whole field',
    caption: '06:00. Every departure of the day still lies ahead — fifteen of seventeen destinations answer.',
    enter: snapshot(at(6, 0), DEFAULT_BUDGET_INR, DEFAULT_AVAILABLE_HOURS, null),
  },
  {
    id: 'noon',
    title: 'The Bengaluru choice',
    caption: 'By noon the morning trains are gone. Bengaluru still answers — ₹1,520 over two trains and a bus, via Coimbatore.',
    enter: snapshot(at(12, 0), DEFAULT_BUDGET_INR, DEFAULT_AVAILABLE_HOURS, 'bengaluru'),
  },
  {
    id: 'reveal',
    title: 'The budget key',
    caption: 'Raise the wallet to ₹4,000 and the field blooms to thirteen — Ooty and Coorg step in.',
    enter: snapshot(at(12, 0), 4_000, DEFAULT_AVAILABLE_HOURS, 'ooty'),
  },
  {
    id: 'squeeze',
    title: 'The noon squeeze',
    caption: 'Tighten the wallet to ₹1,200 and Bengaluru slips out — it needs ₹1,520.',
    enter: snapshot(at(12, 0), 1_200, DEFAULT_AVAILABLE_HOURS, 'bengaluru'),
  },
  {
    id: 'shortday',
    title: 'The short day',
    caption: 'A twelve-hour deadline strands the overnight arrivals — midnight dims Bengaluru.',
    enter: snapshot(at(12, 0), DEFAULT_BUDGET_INR, 12, 'bengaluru'),
  },
  {
    id: 'expiry',
    title: '18:05 — the express expires',
    caption: 'Scrub past the 18:05 Mangaluru Express and the field collapses — by 18:25 every chain but one has expired.',
    enter: snapshot(at(18, 25), DEFAULT_BUDGET_INR, DEFAULT_AVAILABLE_HOURS, null),
  },
  {
    id: 'survivors',
    title: 'One survivor',
    caption: 'Bengaluru holds on the 20:30 overnight Volvo — the rest wait for tomorrow\u2019s first departures.',
    enter: snapshot(at(19, 0), DEFAULT_BUDGET_INR, DEFAULT_AVAILABLE_HOURS, 'bengaluru'),
  },
  {
    id: 'unlock',
    title: 'What it costs to come back',
    caption: 'Rewind to noon — a ghost money can still reach. The probe says: ₹120 more brings Ooty back.',
    enter: snapshot(at(12, 30), DEFAULT_BUDGET_INR, DEFAULT_AVAILABLE_HOURS, 'ooty'),
    unlock: [
      {
        type: 'applyProbePreview',
        preview: { budgetINR: OOTY_UNLOCK_BUDGET_INR, summary: '₹120 more unlocks Ooty — previewing the unlock' },
      },
    ],
  },
  {
    id: 'reverse',
    title: 'The day in reverse',
    caption: 'Scrub backwards and the field restores exactly — the engine recomputes from scratch, so nothing leaks.',
    enter: snapshot(at(6, 0), DEFAULT_BUDGET_INR, DEFAULT_AVAILABLE_HOURS, null),
  },
  {
    id: 'home',
    title: 'Where the day began',
    caption: 'Back to the morning state: 12:00, ₹2,000, twenty-four hours. The demo resets byte for byte.',
    enter: snapshot(at(12, 0), DEFAULT_BUDGET_INR, DEFAULT_AVAILABLE_HOURS, null),
  },
]

/** Chapter dwell before auto-advance, in real milliseconds. */
export const CHAPTER_DWELL_MS = 5_000
/** How long the applied unlock blooms before the tour moves on. */
export const UNLOCK_DWELL_MS = 3_000

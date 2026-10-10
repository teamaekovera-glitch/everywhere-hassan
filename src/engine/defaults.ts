import { DEFAULT_NOW_MS } from '../sim/clock'
import type { Constraints } from './types'

export const DEFAULT_ORIGIN_ID = 'kozhikode'
export const DEFAULT_BUDGET_INR = 2_000
export const DEFAULT_AVAILABLE_HOURS = 24
export const DEFAULT_MIN_TRANSFER_MIN = 20

/** The signature-demo scenario: Kozhikode, ₹2,000, 24 h, clock at 12:00 IST. */
export function makeDefaultConstraints(originId: string = DEFAULT_ORIGIN_ID): Constraints {
  return {
    originId,
    now: DEFAULT_NOW_MS,
    availableHours: DEFAULT_AVAILABLE_HOURS,
    budgetINR: DEFAULT_BUDGET_INR,
    minTransferMin: DEFAULT_MIN_TRANSFER_MIN,
  }
}

/** Constraint-panel slider bounds (spec): budget ₹200–₹10,000, time 2–48 h. */
export const BUDGET_MIN_INR = 200
export const BUDGET_MAX_INR = 10_000
export const HOURS_MIN = 2
export const HOURS_MAX = 48

export function clampBudgetINR(inr: number): number {
  return Math.min(BUDGET_MAX_INR, Math.max(BUDGET_MIN_INR, Math.round(inr)))
}

export function clampAvailableHours(hours: number): number {
  return Math.min(HOURS_MAX, Math.max(HOURS_MIN, Math.round(hours)))
}

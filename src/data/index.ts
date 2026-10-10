import { LOCATIONS } from './locations'
import { REFERENCE_DAY_ISO } from './referenceDay'
import { CONNECTIONS } from './timetable'
import { loadTransportData } from './validate'
import type { TransportData } from './validate'

export { DatasetValidationError, loadTransportData, validateDataset } from './validate'
export {
  at,
  ist,
  HOUR_MS,
  IST_OFFSET_MINUTES,
  MINUTE_MS,
  REFERENCE_DAY_ISO,
  REFERENCE_DAY_START_MS,
} from './referenceDay'
export type { Connection, Location, Mode, TransportData } from './validate'
export { LOCATIONS } from './locations'
export { CONNECTIONS } from './timetable'

/** Displayed by the interface at all times — the dataset is synthetic. */
export const DATA_PROVENANCE =
  `Synthetic demo timetable for ${REFERENCE_DAY_ISO} (Asia/Kolkata) — not a real schedule; ` +
  'fares are estimates. Shape mirrors real Kerala services and is swappable for verified open data.'

/**
 * The one demo dataset, validated at load: an inconsistent timetable refuses
 * to boot rather than render from bad data.
 */
export const DEMO_DATA: TransportData = loadTransportData(LOCATIONS, CONNECTIONS)

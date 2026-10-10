import { ACTIVITIES } from './activities'
import { LOCATIONS } from './locations'
import { MEALS } from './meals'
import { SPOTS } from './spots'
import { REFERENCE_DAY_ISO } from './referenceDay'
import { CONNECTIONS } from './timetable'
import { loadTransportData, validatePoiCatalog } from './validate'
import type { PoiCatalogInput, TransportData } from './validate'

export { DatasetValidationError, loadTransportData, validateDataset, validatePoiCatalog } from './validate'
export {
  at,
  ist,
  HOUR_MS,
  IST_OFFSET_MINUTES,
  MINUTE_MS,
  REFERENCE_DAY_ISO,
  REFERENCE_DAY_START_MS,
} from './referenceDay'
export type { Connection, Location, Mode, TransportData, ActivityDef, MealDef, SpotDef, PoiCatalogInput } from './validate'
export { LOCATIONS } from './locations'
export { CONNECTIONS } from './timetable'
export { ACTIVITIES } from './activities'
export { MEALS } from './meals'
export { SPOTS } from './spots'
export { PHOTO_CREDITS } from './photoCredits'
export type { PhotoCredit } from './photoCredits'

/** Displayed by the interface at all times — the dataset is synthetic. */
export const DATA_PROVENANCE =
  `Synthetic demo dataset for ${REFERENCE_DAY_ISO} (Asia/Kolkata) — the timetable is not a real schedule; ` +
  'fares, activities, meals, and famous spots are authored estimates. ' +
  'Shape mirrors real Kerala services and is swappable for verified open data.'

/**
 * The one demo dataset, validated at load: an inconsistent timetable refuses
 * to boot rather than render from bad data.
 */
export const DEMO_DATA: TransportData = loadTransportData(LOCATIONS, CONNECTIONS)

/**
 * The planner's POI catalog — activities, meals, famous spots — validated at
 * load with the same refuse-to-boot contract as the timetable.
 */
export const POI_CATALOG: PoiCatalogInput = {
  activities: ACTIVITIES,
  meals: MEALS,
  spots: SPOTS,
}
validatePoiCatalog(POI_CATALOG, LOCATIONS)

import type { Location } from './types'

/**
 * 18 demo locations: Kerala spine plus selected Karnataka and Tamil Nadu
 * destinations. Kozhikode is the demo origin. Order is the dataset order —
 * the engine returns results in this order, so it is part of determinism.
 *
 * lat/lon are real city-center coordinates (WGS84, decimal degrees) — factual
 * geography, distinct from the deliberately synthetic timetable. The
 * bounding-box validator (validate.ts) refuses typos at load.
 */
export const LOCATIONS: readonly Location[] = [
  { id: 'kozhikode', name: 'Kozhikode', region: 'Kerala', tags: ['Food', 'Beaches'], lat: 11.2588, lon: 75.7804 },
  { id: 'thalassery', name: 'Thalassery', region: 'Kerala', tags: ['History', 'Food'], lat: 11.7528, lon: 75.3703 },
  { id: 'kannur', name: 'Kannur', region: 'Kerala', tags: ['Beaches', 'History'], lat: 11.8689, lon: 75.3557 },
  { id: 'kasaragod', name: 'Kasaragod', region: 'Kerala', tags: ['Forts', 'Beaches'], lat: 12.4996, lon: 74.9909 },
  { id: 'mangaluru', name: 'Mangaluru', region: 'Karnataka', tags: ['Beaches', 'Food'], lat: 12.9141, lon: 74.856 },
  { id: 'wayanad', name: 'Wayanad (Kalpetta)', region: 'Kerala', tags: ['Hills', 'Nature'], lat: 11.6055, lon: 76.0834 },
  { id: 'mysuru', name: 'Mysuru', region: 'Karnataka', tags: ['Heritage', 'Palaces'], lat: 12.2958, lon: 76.6394 },
  { id: 'coorg', name: 'Coorg (Madikeri)', region: 'Karnataka', tags: ['Hills', 'Coffee'], lat: 12.4244, lon: 75.7382 },
  { id: 'bengaluru', name: 'Bengaluru', region: 'Karnataka', tags: ['City', 'Food'], lat: 12.9716, lon: 77.5946 },
  { id: 'thrissur', name: 'Thrissur', region: 'Kerala', tags: ['Culture', 'Temples'], lat: 10.5276, lon: 76.2144 },
  { id: 'palakkad', name: 'Palakkad', region: 'Kerala', tags: ['Forts', 'Nature'], lat: 10.7867, lon: 76.6548 },
  { id: 'coimbatore', name: 'Coimbatore', region: 'Tamil Nadu', tags: ['City', 'Temples'], lat: 11.0168, lon: 76.9558 },
  { id: 'ooty', name: 'Ooty', region: 'Tamil Nadu', tags: ['Hills', 'Tea'], lat: 11.4102, lon: 76.695 },
  { id: 'ernakulam', name: 'Ernakulam (Kochi)', region: 'Kerala', tags: ['City', 'Harbour'], lat: 9.9312, lon: 76.2673 },
  { id: 'alappuzha', name: 'Alappuzha', region: 'Kerala', tags: ['Backwaters', 'Beaches'], lat: 9.4981, lon: 76.3388 },
  { id: 'kollam', name: 'Kollam', region: 'Kerala', tags: ['Backwaters', 'History'], lat: 8.8932, lon: 76.6141 },
  { id: 'thiruvananthapuram', name: 'Thiruvananthapuram', region: 'Kerala', tags: ['Heritage', 'Beaches'], lat: 8.5241, lon: 76.9366 },
  { id: 'kanniyakumari', name: 'Kanniyakumari', region: 'Tamil Nadu', tags: ['Coast', 'Sunset'], lat: 8.0883, lon: 77.5468 },
]

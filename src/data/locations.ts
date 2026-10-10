import type { Location } from './types'

/**
 * 18 demo locations: Kerala spine plus selected Karnataka and Tamil Nadu
 * destinations. Kozhikode is the demo origin. Order is the dataset order —
 * the engine returns results in this order, so it is part of determinism.
 */
export const LOCATIONS: readonly Location[] = [
  { id: 'kozhikode', name: 'Kozhikode', region: 'Kerala', tags: ['Food', 'Beaches'] },
  { id: 'thalassery', name: 'Thalassery', region: 'Kerala', tags: ['History', 'Food'] },
  { id: 'kannur', name: 'Kannur', region: 'Kerala', tags: ['Beaches', 'History'] },
  { id: 'kasaragod', name: 'Kasaragod', region: 'Kerala', tags: ['Forts', 'Beaches'] },
  { id: 'mangaluru', name: 'Mangaluru', region: 'Karnataka', tags: ['Beaches', 'Food'] },
  { id: 'wayanad', name: 'Wayanad (Kalpetta)', region: 'Kerala', tags: ['Hills', 'Nature'] },
  { id: 'mysuru', name: 'Mysuru', region: 'Karnataka', tags: ['Heritage', 'Palaces'] },
  { id: 'coorg', name: 'Coorg (Madikeri)', region: 'Karnataka', tags: ['Hills', 'Coffee'] },
  { id: 'bengaluru', name: 'Bengaluru', region: 'Karnataka', tags: ['City', 'Food'] },
  { id: 'thrissur', name: 'Thrissur', region: 'Kerala', tags: ['Culture', 'Temples'] },
  { id: 'palakkad', name: 'Palakkad', region: 'Kerala', tags: ['Forts', 'Nature'] },
  { id: 'coimbatore', name: 'Coimbatore', region: 'Tamil Nadu', tags: ['City', 'Temples'] },
  { id: 'ooty', name: 'Ooty', region: 'Tamil Nadu', tags: ['Hills', 'Tea'] },
  { id: 'ernakulam', name: 'Ernakulam (Kochi)', region: 'Kerala', tags: ['City', 'Harbour'] },
  { id: 'alappuzha', name: 'Alappuzha', region: 'Kerala', tags: ['Backwaters', 'Beaches'] },
  { id: 'kollam', name: 'Kollam', region: 'Kerala', tags: ['Backwaters', 'History'] },
  { id: 'thiruvananthapuram', name: 'Thiruvananthapuram', region: 'Kerala', tags: ['Heritage', 'Beaches'] },
  { id: 'kanniyakumari', name: 'Kanniyakumari', region: 'Tamil Nadu', tags: ['Coast', 'Sunset'] },
]

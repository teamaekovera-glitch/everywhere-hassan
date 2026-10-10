import type { MealSlot } from './types'

/**
 * One meal opportunity at a destination, with the hours it is plausibly
 * served. Windows are minutes-of-day on the reference clock (see
 * referenceDay.ts) — the planner places a meal whose window covers the
 * dwell midpoint. Costs are synthetic per-person estimates, covered by
 * DATA_PROVENANCE.
 */
export interface MealDef {
  /** '<destinationId>-meal-<n>' — unique across the whole catalog. */
  id: string
  /** Location id from locations.ts. */
  destinationId: string
  /** Display name — 'Malabar biriyani at a city institution'. */
  name: string
  /** Per-person estimate in ₹. */
  costINR: number
  /** Which slot the window belongs to — planner display grouping. */
  slot: MealSlot
  /** Minutes-of-day the service starts — inclusive. */
  windowStartMin: number
  /** Minutes-of-day the service ends — exclusive; must be after the start. */
  windowEndMin: number
  /** One honest sentence. */
  blurb: string
}

/** Two to four meals per destination, grouped in dataset order. */
export const MEALS: readonly MealDef[] = [
  // Kozhikode
  { id: 'kozhikode-meal-1', destinationId: 'kozhikode', name: 'Malabar biriyani at a city institution', costINR: 180, slot: 'lunch', windowStartMin: 720, windowEndMin: 930, blurb: 'The dum-cooked, short-grain lunch Kozhikode runs on, at rooms that have served it for generations.' },
  { id: 'kozhikode-meal-2', destinationId: 'kozhikode', name: 'Kerala parotta with kadala curry', costINR: 90, slot: 'breakfast', windowStartMin: 450, windowEndMin: 630, blurb: 'Flaky layered bread and black-chickpea curry — the standard Malabar opening move.' },
  { id: 'kozhikode-meal-3', destinationId: 'kozhikode', name: 'Kozhikodan halwa and tea', costINR: 60, slot: 'evening', windowStartMin: 990, windowEndMin: 1200, blurb: 'Dark, elastic halwa cut fresh with strong Malabar tea as the sea breeze sets in.' },
  // Thalassery
  { id: 'thalassery-meal-1', destinationId: 'thalassery', name: 'Tellicherry biriyani lunch', costINR: 180, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'The town’s own biriyani — kaima rice, mild spice, a friend’s grandmother’s recipe argued over.' },
  { id: 'thalassery-meal-2', destinationId: 'thalassery', name: 'Malabar snacks and chai', costINR: 70, slot: 'evening', windowStartMin: 960, windowEndMin: 1170, blurb: 'Unnakaya and erachi pathiri — the Moplah snack shelf at its source.' },
  // Kannur
  { id: 'kannur-meal-1', destinationId: 'kannur', name: 'Malabar puttu and kadala breakfast', costINR: 80, slot: 'breakfast', windowStartMin: 450, windowEndMin: 600, blurb: 'Steamed rice-flour cylinders with black-chickpea curry, served before the heat.' },
  { id: 'kannur-meal-2', destinationId: 'kannur', name: 'Seafood thali by the shore', costINR: 190, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Rice plates with the morning’s catch — seer fish, sardines, coconut-chili gravies.' },
  // Kasaragod
  { id: 'kasaragod-meal-1', destinationId: 'kasaragod', name: 'Malabar coastal thali', costINR: 150, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'The district’s mix of Kerala and Tulu-Kannada cooking on one steel plate.' },
  { id: 'kasaragod-meal-2', destinationId: 'kasaragod', name: 'Banana fritters and chai', costINR: 50, slot: 'evening', windowStartMin: 960, windowEndMin: 1140, blurb: 'Pazham pori at a roadside stall as the fort road empties for the evening.' },
  // Mangaluru
  { id: 'mangaluru-meal-1', destinationId: 'mangaluru', name: 'Neer dosa and fish curry breakfast', costINR: 120, slot: 'breakfast', windowStartMin: 450, windowEndMin: 630, blurb: 'Lacy rice crepes with the city’s signature coconut-chili fish gravy.' },
  { id: 'mangaluru-meal-2', destinationId: 'mangaluru', name: 'Mangalorean thali lunch', costINR: 160, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Coast-city cooking at full stretch — kane fry, sambar, and red rice.' },
  // Wayanad (Kalpetta)
  { id: 'wayanad-meal-1', destinationId: 'wayanad', name: 'Kerala appam and stew', costINR: 90, slot: 'breakfast', windowStartMin: 450, windowEndMin: 600, blurb: 'Bowl-shaped pancakes with a gentle coconut-milk stew — hill-station comfort.' },
  { id: 'wayanad-meal-2', destinationId: 'wayanad', name: 'Hill-country vegetarian thali', costINR: 130, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Farm-plate lunch of the plateau’s millets, beans, and coconut sides.' },
  // Mysuru
  { id: 'mysuru-meal-1', destinationId: 'mysuru', name: 'Mysore masala dosa and filter coffee', costINR: 80, slot: 'breakfast', windowStartMin: 450, windowEndMin: 600, blurb: 'The city’s soft, red-chutney dosa with decoction coffee at an old tiffin room.' },
  { id: 'mysuru-meal-2', destinationId: 'mysuru', name: 'Ooru (local) thali lunch', costINR: 140, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Karnataka’s balanced thali — kosambari, palya, rasam, and generous refills.' },
  { id: 'mysuru-meal-3', destinationId: 'mysuru', name: 'Mysore pak tasting', costINR: 60, slot: 'evening', windowStartMin: 960, windowEndMin: 1170, blurb: 'The ghee-heavy sweet the city invented, cut warm from the tray.' },
  // Coorg (Madikeri)
  { id: 'coorg-meal-1', destinationId: 'coorg', name: 'Akki roti with wild honey', costINR: 100, slot: 'breakfast', windowStartMin: 480, windowEndMin: 630, blurb: 'Rice-flour flatbread with forest honey and a view of the coffee hills.' },
  { id: 'coorg-meal-2', destinationId: 'coorg', name: 'Coorgi pandi curry meal', costINR: 200, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'The Kodagu pork classic with kachampuli vinegar, served with akki roti or rice.' },
  // Bengaluru
  { id: 'bengaluru-meal-1', destinationId: 'bengaluru', name: 'Masala dosa at a heritage darshini', costINR: 80, slot: 'breakfast', windowStartMin: 450, windowEndMin: 630, blurb: 'Stand-up breakfast at a counter that has not changed its recipe since the 1970s.' },
  { id: 'bengaluru-meal-2', destinationId: 'bengaluru', name: 'Bisi bele bath thali lunch', costINR: 120, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'The city’s one-pot rice classic with a full Kannadiga thali around it.' },
  { id: 'bengaluru-meal-3', destinationId: 'bengaluru', name: 'Gully street-food crawl', costINR: 150, slot: 'evening', windowStartMin: 1140, windowEndMin: 1350, blurb: 'Chaat, gobi, and filter coffee down the food lanes that light up after work.' },
  // Thrissur
  { id: 'thrissur-meal-1', destinationId: 'thrissur', name: 'Puttu-kadala with kattan chai', costINR: 70, slot: 'breakfast', windowStartMin: 450, windowEndMin: 600, blurb: 'The cultural capital’s morning plate with strong black tea.' },
  { id: 'thrissur-meal-2', destinationId: 'thrissur', name: 'Sadya-style thali lunch', costINR: 130, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'The full Kerala feast layout — avial, thoran, sambar, payasam — on a banana leaf.' },
  { id: 'thrissur-meal-3', destinationId: 'thrissur', name: 'Thekke Gopura stall snacks', costINR: 60, slot: 'evening', windowStartMin: 990, windowEndMin: 1200, blurb: 'Temple-gate snack rows serving vada and coffee into the evening.' },
  // Palakkad
  { id: 'palakkad-meal-1', destinationId: 'palakkad', name: 'Palakkad ada and coffee', costINR: 60, slot: 'breakfast', windowStartMin: 450, windowEndMin: 600, blurb: 'Sweet steamed ada with the district’s famous filter coffee.' },
  { id: 'palakkad-meal-2', destinationId: 'palakkad', name: 'Agraharam sadya thali', costINR: 120, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Tamil-Kerala vegetarian cooking from the agraharam lanes, sadya-style.' },
  // Coimbatore
  { id: 'coimbatore-meal-1', destinationId: 'coimbatore', name: 'Ghee roast dosa and filter kaapi', costINR: 80, slot: 'breakfast', windowStartMin: 450, windowEndMin: 600, blurb: 'Crisp Kongunad ghee roast with the city’s serious coffee culture.' },
  { id: 'coimbatore-meal-2', destinationId: 'coimbatore', name: 'Kongunad non-veg thali', costINR: 200, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Military-hotel plates — pepper chicken, liver fry, and millet rice.' },
  { id: 'coimbatore-meal-3', destinationId: 'coimbatore', name: 'Street-side kothu parotta', costINR: 90, slot: 'evening', windowStartMin: 1080, windowEndMin: 1290, blurb: 'Shredded parotta hammered on the griddle with salna for dunking.' },
  // Ooty
  { id: 'ooty-meal-1', destinationId: 'ooty', name: 'Hill breakfast — toast, omelette, chai', costINR: 100, slot: 'breakfast', windowStartMin: 480, windowEndMin: 600, blurb: 'Cold-morning Anglo-Indian breakfast in an old hill bakery.' },
  { id: 'ooty-meal-2', destinationId: 'ooty', name: 'Anglo-Indian style lunch', costINR: 180, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'The Nilgiris’ colonial-kitchen classics — cutlets, pepper water, and rice plates.' },
  // Ernakulam (Kochi)
  { id: 'ernakulam-meal-1', destinationId: 'ernakulam', name: 'Beef ularthiyathu with parotta', costINR: 150, slot: 'breakfast', windowStartMin: 450, windowEndMin: 630, blurb: 'Kerala’s defiant staple — slow-fried beef with flaky parotta, any hour it opens.' },
  { id: 'ernakulam-meal-2', destinationId: 'ernakulam', name: 'Meen curry meals at a harbour canteen', costINR: 150, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Fish-curry rice plates where the dock crews eat, next to the ferries.' },
  { id: 'ernakulam-meal-3', destinationId: 'ernakulam', name: 'Pre-show snacks at Fort Kochi', costINR: 100, slot: 'evening', windowStartMin: 1050, windowEndMin: 1260, blurb: 'Banana fritters and ada before the Kathakali curtain at the fort-house venues.' },
  // Alappuzha
  { id: 'alappuzha-meal-1', destinationId: 'alappuzha', name: 'Appam and stew lakeside', costINR: 100, slot: 'breakfast', windowStartMin: 450, windowEndMin: 600, blurb: 'Lace-edge appam with coconut stew while the houseboats drift past.' },
  { id: 'alappuzha-meal-2', destinationId: 'alappuzha', name: 'Karimeen pearl-spot fry meals', costINR: 250, slot: 'lunch', windowStartMin: 720, windowEndMin: 930, blurb: 'The backwater’s signature fish, fried whole at lakeside kitchens.' },
  // Kollam
  { id: 'kollam-meal-1', destinationId: 'kollam', name: 'Backwater fish meals', costINR: 180, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Ashtamudi prawn and fish-curry rice plates at waterside hotels.' },
  { id: 'kollam-meal-2', destinationId: 'kollam', name: 'Cashew-crusted snacks and tea', costINR: 70, slot: 'evening', windowStartMin: 960, windowEndMin: 1140, blurb: 'The cashew capital’s roasted snacks with strong Kerala chai.' },
  // Thiruvananthapuram
  { id: 'thiruvananthapuram-meal-1', destinationId: 'thiruvananthapuram', name: 'Indian Coffee House cutlet and coffee', costINR: 90, slot: 'breakfast', windowStartMin: 450, windowEndMin: 600, blurb: 'The tower café’s cutlet with white sauce, a city institution since the 1950s.' },
  { id: 'thiruvananthapuram-meal-2', destinationId: 'thiruvananthapuram', name: 'Travancore thali lunch', costINR: 140, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Southern Kerala’s rice plates — fish moilee, avial, and red rice.' },
  { id: 'thiruvananthapuram-meal-3', destinationId: 'thiruvananthapuram', name: 'Shanghumugham beach snacks', costINR: 80, slot: 'evening', windowStartMin: 1020, windowEndMin: 1200, blurb: 'Fried snacks and tender coconut as the city’s family beach lights its lamps.' },
  // Kanniyakumari
  { id: 'kanniyakumari-meal-1', destinationId: 'kanniyakumari', name: 'South-Indian tiffin by the shore', costINR: 80, slot: 'breakfast', windowStartMin: 420, windowEndMin: 570, blurb: 'Idli, pongal, and vada at dawn before the ferries fill.' },
  { id: 'kanniyakumari-meal-2', destinationId: 'kanniyakumari', name: 'Coastal thali with fish fry', costINR: 160, slot: 'lunch', windowStartMin: 720, windowEndMin: 900, blurb: 'Tamil coastal thali with the day’s fried catch, confluence views included.' },
]

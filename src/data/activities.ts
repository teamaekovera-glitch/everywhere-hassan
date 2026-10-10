import type { InterestId } from './types'

/**
 * One place-based thing to do at a destination, packed into the planner's
 * dwell window. Costs are per-person estimates (0 for free sights) and
 * durations are dwell-minutes — synthetic estimates, covered by
 * DATA_PROVENANCE, never live availability.
 */
export interface ActivityDef {
  /** '<destinationId>-<category>-<n>' — unique across the whole catalog. */
  id: string
  /** Location id from locations.ts. */
  destinationId: string
  /** Short display title — 'Adiyogi Shiva statue viewpoint'. */
  title: string
  /** Which planner interest this satisfies. */
  category: InterestId
  /** Per-person estimate in ₹, 0 for free sights. */
  costINR: number
  /** Dwell minutes consumed — 15–240. */
  durationMin: number
  /** One honest sentence. */
  blurb: string
}

/**
 * Activities for all 18 destinations, 4–6 per place, grouped in dataset
 * order. Categories deliberately vary by destination — coastal towns skew
 * food/nature, hill towns adventure/nature — and honest gaps are the spec's
 * contract: the planner surfaces "no nightlife here" rather than inventing it.
 */
export const ACTIVITIES: readonly ActivityDef[] = [
  // Kozhikode
  { id: 'kozhikode-food-1', destinationId: 'kozhikode', title: 'Halwa and snack trail on SM Street', category: 'food', costINR: 100, durationMin: 60, blurb: 'A walk past the sweet shops that made Kozhikodan halwa famous, with tasting stops along the way.' },
  { id: 'kozhikode-heritage-1', destinationId: 'kozhikode', title: 'Kappad landing-place visit', category: 'heritage', costINR: 0, durationMin: 90, blurb: 'The beach where Vasco da Gama came ashore in 1498, marked by a small monument.' },
  { id: 'kozhikode-nature-1', destinationId: 'kozhikode', title: 'Kozhikode beach sunset stroll', category: 'nature', costINR: 0, durationMin: 60, blurb: 'A long arc of sand with a lighthouse, old pier remains, and the day ending over the Arabian Sea.' },
  { id: 'kozhikode-shopping-1', destinationId: 'kozhikode', title: 'Valiyangadi spice and banana-chip bazaar', category: 'shopping', costINR: 150, durationMin: 60, blurb: 'The old market quarter where pepper, banana chips, and halwa still change hands by the sack.' },
  { id: 'kozhikode-nightlife-1', destinationId: 'kozhikode', title: 'Beachside café evening', category: 'nightlife', costINR: 300, durationMin: 90, blurb: 'Live acoustic sets and sea air at the small café strip that has grown up near the beach road.' },
  { id: 'kozhikode-movies-1', destinationId: 'kozhikode', title: 'Matinee at a classic Kozhikode talkies', category: 'movies', costINR: 150, durationMin: 150, blurb: 'Catch a Malayalam screening at one of the single-screen theatres the city is fond of.' },
  // Thalassery
  { id: 'thalassery-heritage-1', destinationId: 'thalassery', title: 'Thalassery Fort ramparts walk', category: 'heritage', costINR: 0, durationMin: 45, blurb: 'A small 18th-century British fort with massive round walls looking over the town and harbour.' },
  { id: 'thalassery-food-1', destinationId: 'thalassery', title: 'Tellicherry biriyani kitchen lunch stop', category: 'food', costINR: 160, durationMin: 75, blurb: 'The fragrant, short-grain biriyani this coast argues is the original Malabar one.' },
  { id: 'thalassery-nature-1', destinationId: 'thalassery', title: 'Muzhappilangad drive-in beach hour', category: 'nature', costINR: 0, durationMin: 90, blurb: 'Kerala’s long drive-on beach, hard-packed sand edged by black rocks and casuarina.' },
  { id: 'thalassery-shopping-1', destinationId: 'thalassery', title: 'Pepper and spice market browse', category: 'shopping', costINR: 100, durationMin: 45, blurb: 'Thalassery pepper built a trade empire; the bazaar stalls still sell it by the pound.' },
  { id: 'thalassery-adventure-1', destinationId: 'thalassery', title: 'Dharmadam island sandbar walk', category: 'adventure', costINR: 50, durationMin: 60, blurb: 'At low tide a sand spit opens toward a wooded islet — timing and bare feet required.' },
  // Kannur
  { id: 'kannur-heritage-1', destinationId: 'kannur', title: 'St. Angelo Fort visit', category: 'heritage', costINR: 25, durationMin: 60, blurb: 'A 1505 Portuguese fort later held by the Dutch and British, with sea views from every bastion.' },
  { id: 'kannur-heritage-2', destinationId: 'kannur', title: 'Theyyam folklore walk', category: 'heritage', costINR: 150, durationMin: 90, blurb: 'An introduction to the ritual dance-art of North Malabar — its costumes, lore, and shrine season.' },
  { id: 'kannur-nature-1', destinationId: 'kannur', title: 'Payyambalam beach sunset', category: 'nature', costINR: 0, durationMin: 60, blurb: 'A quiet village beach with a famous sculpture garden and a wide, slow sunset.' },
  { id: 'kannur-food-1', destinationId: 'kannur', title: 'Beachfront seafood sampler', category: 'food', costINR: 200, durationMin: 75, blurb: 'Small kitchens near the shore grill the morning’s catch with Malabar spices.' },
  { id: 'kannur-shopping-1', destinationId: 'kannur', title: 'Handloom weavery outlet visit', category: 'shopping', costINR: 80, durationMin: 45, blurb: 'Kannur’s looms dress Kerala — the outlets sell the cloth straight off the shuttle.' },
  // Kasaragod
  { id: 'kasaragod-heritage-1', destinationId: 'kasaragod', title: 'Bekal Fort ramparts and viewpoints', category: 'heritage', costINR: 30, durationMin: 120, blurb: 'The largest fort on this coast — a laterite keyhole over the sea, built for watching, not fighting.' },
  { id: 'kasaragod-nature-1', destinationId: 'kasaragod', title: 'Kappil beach and lagoon walk', category: 'nature', costINR: 0, durationMin: 60, blurb: 'Where the backwater meets the surf — a short walk between still lagoon and open sea.' },
  { id: 'kasaragod-adventure-1', destinationId: 'kasaragod', title: 'Chandragiri backwater boat run', category: 'adventure', costINR: 250, durationMin: 60, blurb: 'Paddle or putter up the river to the old fort bridge, palms closing over the water.' },
  { id: 'kasaragod-shopping-1', destinationId: 'kasaragod', title: 'Coir and handicraft stalls', category: 'shopping', costINR: 80, durationMin: 45, blurb: 'Coconut fibre, bell metal, and small crafts from the district’s cottage workshops.' },
  // Mangaluru
  { id: 'mangaluru-food-1', destinationId: 'mangaluru', title: 'Hampankatta coastal cuisine walk', category: 'food', costINR: 150, durationMin: 75, blurb: 'The old food quarter where Coconut-Coast cooking — chili, coconut, curry leaf — is on every corner.' },
  { id: 'mangaluru-heritage-1', destinationId: 'mangaluru', title: 'Kadri Manjunatha temple and caves trail', category: 'heritage', costINR: 0, durationMin: 90, blurb: 'A temple that predates the city around it, with laterite caves and bronze work in its shrine.' },
  { id: 'mangaluru-nature-1', destinationId: 'mangaluru', title: 'Panambur beach evening', category: 'nature', costINR: 0, durationMin: 60, blurb: 'The city’s cleanest beach stretch — watch the harbour lights come on across the water.' },
  { id: 'mangaluru-adventure-1', destinationId: 'mangaluru', title: 'Surf session at Sasihithlu', category: 'adventure', costINR: 500, durationMin: 120, blurb: 'The sand-spit beach where Karnataka’s surf scene started, with boards and instruction on site.' },
  { id: 'mangaluru-shopping-1', destinationId: 'mangaluru', title: 'Central market spice browse', category: 'shopping', costINR: 100, durationMin: 45, blurb: 'Byadgi chili, pepper, and dried fish in a working market that feeds the whole coast.' },
  // Wayanad (Kalpetta)
  { id: 'wayanad-nature-1', destinationId: 'wayanad', title: 'Coffee-estate guided nature trail', category: 'nature', costINR: 0, durationMin: 90, blurb: 'Shade-grown coffee under forest canopy, with a planter calling out birds and spice trees.' },
  { id: 'wayanad-adventure-1', destinationId: 'wayanad', title: 'Banasura backwater bamboo rafting', category: 'adventure', costINR: 300, durationMin: 90, blurb: 'A bamboo raft drifting under the Western Ghats’ dam-lake hills — slow, silent, and low to the water.' },
  { id: 'wayanad-food-1', destinationId: 'wayanad', title: 'Hill-country breakfast trail', category: 'food', costINR: 120, durationMin: 60, blurb: 'Bamboo-shoot curries and millet dishes — the forest-plate cooking the hills keep to themselves.' },
  { id: 'wayanad-heritage-1', destinationId: 'wayanad', title: 'Wayanad Heritage Museum visit', category: 'heritage', costINR: 40, durationMin: 75, blurb: 'Stone age finds and tribal artifacts from the plateau, well labelled and small enough to finish.' },
  { id: 'wayanad-shopping-1', destinationId: 'wayanad', title: 'Pepper, coffee, and forest-honey outlet', category: 'shopping', costINR: 150, durationMin: 45, blurb: 'Estate-direct spices and the wild honey the district is known for — buy at the source.' },
  // Mysuru
  { id: 'mysuru-heritage-1', destinationId: 'mysuru', title: 'Mysore Palace guided visit', category: 'heritage', costINR: 100, durationMin: 120, blurb: 'The Wodeyar seat — painted durbar halls, a wooden door of the gods, and courtyards built for elephants.' },
  { id: 'mysuru-nature-1', destinationId: 'mysuru', title: 'Brindavan Gardens evening stroll', category: 'nature', costINR: 50, durationMin: 90, blurb: 'Terraced fountains below the KRS dam, lit up after dark when the water show runs.' },
  { id: 'mysuru-shopping-1', destinationId: 'mysuru', title: 'Devaraja Market and sandalwood bazaar', category: 'shopping', costINR: 100, durationMin: 75, blurb: 'Flower rows under a 19th-century atrium, then incense, sandal, and Mysore silk a street away.' },
  { id: 'mysuru-food-1', destinationId: 'mysuru', title: 'Mysore masala dosa tiffin trail', category: 'food', costINR: 90, durationMin: 60, blurb: 'The city’s own dosa — softer, sweeter, famously red — eaten standing up at old tiffin rooms.' },
  { id: 'mysuru-nightlife-1', destinationId: 'mysuru', title: 'Rooftop café evening overlooking the palace', category: 'nightlife', costINR: 250, durationMin: 75, blurb: 'A quiet drink above the old city with the illuminated palace domes in view.' },
  { id: 'mysuru-movies-1', destinationId: 'mysuru', title: 'Evening screening at a Mysuru multiplex', category: 'movies', costINR: 200, durationMin: 150, blurb: 'Kannada cinema plays to full houses here — book a balcony seat and join the crowd.' },
  // Coorg (Madikeri)
  { id: 'coorg-nature-1', destinationId: 'coorg', title: 'Coffee estate walk with a planter', category: 'nature', costINR: 150, durationMin: 90, blurb: 'From bean to cup on foot — shade trees, pepper vines, and the curing yards behind the house.' },
  { id: 'coorg-adventure-1', destinationId: 'coorg', title: 'Barapole white-water rafting taster', category: 'adventure', costINR: 450, durationMin: 120, blurb: 'A short, punchy river run through rainforest gorges when the monsoon swells it.' },
  { id: 'coorg-food-1', destinationId: 'coorg', title: 'Coorgi kitchen tasting lunch', category: 'food', costINR: 180, durationMin: 75, blurb: 'Akki roti, bamboo shoot, and the peppery pandi curry — Kodagu cooking at a homestyle table.' },
  { id: 'coorg-heritage-1', destinationId: 'coorg', title: 'Madikeri fort and Raja’s Seat history walk', category: 'heritage', costINR: 0, durationMin: 75, blurb: 'The hilltop seat where the Kodagu kings watched the sun go down over their hills.' },
  { id: 'coorg-shopping-1', destinationId: 'coorg', title: 'Estate coffee, honey, and spice outlet', category: 'shopping', costINR: 200, durationMin: 45, blurb: 'Roast-fresh estate coffee and wild-forest honey, sold where they are grown.' },
  // Bengaluru
  { id: 'bengaluru-heritage-1', destinationId: 'bengaluru', title: 'Bangalore Palace and grounds', category: 'heritage', costINR: 250, durationMin: 120, blurb: 'A Tudor-revival confection with wood-carved halls and the Wodeyars’ odd, charming tastes.' },
  { id: 'bengaluru-nature-1', destinationId: 'bengaluru', title: 'Lalbagh glasshouse and gardens walk', category: 'nature', costINR: 30, durationMin: 90, blurb: 'Two centuries of botanical collecting on a granite hill — the glasshouse is the postcard, the trees are the point.' },
  { id: 'bengaluru-food-1', destinationId: 'bengaluru', title: 'Heritage darshini breakfast trail', category: 'food', costINR: 100, durationMin: 60, blurb: 'Masala dosa eaten standing at a counter that has served it the same way for decades.' },
  { id: 'bengaluru-nightlife-1', destinationId: 'bengaluru', title: 'Microbrewery evening on Church Street', category: 'nightlife', costINR: 600, durationMin: 120, blurb: 'The city that reinvented the Indian pub — house-brewed beer, short menus, long conversations.' },
  { id: 'bengaluru-shopping-1', destinationId: 'bengaluru', title: 'Commercial Street boutiques browse', category: 'shopping', costINR: 150, durationMin: 90, blurb: 'From sari emporia to sneaker shops — the old retail spine of the city, walkable end to end.' },
  { id: 'bengaluru-movies-1', destinationId: 'bengaluru', title: 'Blockbuster evening at a luxury multiplex', category: 'movies', costINR: 350, durationMin: 150, blurb: 'Recliner seats and a full house — Bengaluru treats its cinema nights seriously.' },
  // Thrissur
  { id: 'thrissur-heritage-1', destinationId: 'thrissur', title: 'Vadakkumnathan temple circuit', category: 'heritage', costINR: 0, durationMin: 75, blurb: 'A Shiva shrine inside a walled teak grove at the exact centre of the town’s roundabout.' },
  { id: 'thrissur-nature-1', destinationId: 'thrissur', title: 'Riverside village walk at Enamavu', category: 'nature', costINR: 0, durationMin: 60, blurb: 'A slow hour on the Bharathappuzha bank among coconut shadiness and country boats.' },
  { id: 'thrissur-food-1', destinationId: 'thrissur', title: 'Naalumanikkaavu evening food trail', category: 'food', costINR: 100, durationMin: 60, blurb: 'A riverside food court the town treats as its evening living room — puttu, beef, and tea.' },
  { id: 'thrissur-shopping-1', destinationId: 'thrissur', title: 'Round East arcade handloom browse', category: 'shopping', costINR: 100, durationMin: 45, blurb: 'Bell metal, Kerala saris, and goldsmith lanes around the temple’s eastern gate.' },
  { id: 'thrissur-movies-1', destinationId: 'thrissur', title: 'Matinee at a heritage Thrissur talkies', category: 'movies', costINR: 150, durationMin: 150, blurb: 'The cultural capital watches films loudly — a matinee here is a communal event.' },
  // Palakkad
  { id: 'palakkad-heritage-1', destinationId: 'palakkad', title: 'Palakkad Fort and moat walk', category: 'heritage', costINR: 25, durationMin: 75, blurb: 'Hyder Ali’s 1766 fort, square, moated, and improbably intact in the middle of town.' },
  { id: 'palakkad-nature-1', destinationId: 'palakkad', title: 'Malampuzha gardens and dam stroll', category: 'nature', costINR: 40, durationMin: 90, blurb: 'A hill-backed dam with rock garden and ropeway — the town’s green evening escape.' },
  { id: 'palakkad-adventure-1', destinationId: 'palakkad', title: 'Dhoni hills forest trek', category: 'adventure', costINR: 100, durationMin: 150, blurb: 'A forest track to a waterfall through the Western Ghats’ westernmost foothills.' },
  { id: 'palakkad-shopping-1', destinationId: 'palakkad', title: 'Agraharam brass and grocery bazaar', category: 'shopping', costINR: 80, durationMin: 45, blurb: 'Old Brahmin lanes of brass ware, jaggery, and the town’s famous pappadam.' },
  { id: 'palakkad-food-1', destinationId: 'palakkad', title: 'Agraharam tiffin trail', category: 'food', costINR: 90, durationMin: 60, blurb: 'Vada, idli, and the district’s beloved ada — Tamil-inflected Kerala tiffin at its best.' },
  // Coimbatore
  { id: 'coimbatore-heritage-1', destinationId: 'coimbatore', title: 'Adiyogi Shiva statue viewpoint', category: 'heritage', costINR: 0, durationMin: 90, blurb: 'A 34-metre stone face in the Velliangiri foothills — arrive before the evening light show.' },
  { id: 'coimbatore-food-1', destinationId: 'coimbatore', title: 'Kongunad military-hotel lunch sampler', category: 'food', costINR: 180, durationMin: 75, blurb: 'The inland Tamil kitchen — ghee-roasted meats, millet plates, and pepper-heavy gravies.' },
  { id: 'coimbatore-nature-1', destinationId: 'coimbatore', title: 'Marudamalai hills sunset walk', category: 'nature', costINR: 0, durationMin: 75, blurb: 'A temple-crowned hillock on the city’s western edge with the whole Coimbatore basin below.' },
  { id: 'coimbatore-shopping-1', destinationId: 'coimbatore', title: 'Cross Cut Road textile outlets', category: 'shopping', costINR: 200, durationMin: 75, blurb: 'The mill city sells its own cloth — cotton by the metre at mill-gate prices.' },
  { id: 'coimbatore-nightlife-1', destinationId: 'coimbatore', title: 'RS Puram rooftop café evening', category: 'nightlife', costINR: 300, durationMin: 90, blurb: 'A young café row that stays up late under the wind that cools the city every night.' },
  { id: 'coimbatore-movies-1', destinationId: 'coimbatore', title: 'Evening show at a Brookefields-style multiplex', category: 'movies', costINR: 250, durationMin: 150, blurb: 'Tamil crowd-pleasers with intermission snacks — the full South Indian movie night.' },
  // Ooty
  { id: 'ooty-nature-1', destinationId: 'ooty', title: 'Government Botanical Gardens walk', category: 'nature', costINR: 30, durationMin: 90, blurb: 'Terraced beds on a hillside, a fossil trunk 20 million years old, and mountain weather.' },
  { id: 'ooty-adventure-1', destinationId: 'ooty', title: 'Doddabetta peak trail', category: 'adventure', costINR: 20, durationMin: 120, blurb: 'A short climb to the Nilgiris’ highest point, telescope house and all.' },
  { id: 'ooty-food-1', destinationId: 'ooty', title: 'Hill-town chocolate and bakery trail', category: 'food', costINR: 120, durationMin: 60, blurb: 'Homemade chocolate slabs and Anglo-Indian bakers — the taste every hill trip is remembered by.' },
  { id: 'ooty-heritage-1', destinationId: 'ooty', title: 'Nilgiri Mountain Railway heritage ride', category: 'heritage', costINR: 205, durationMin: 180, blurb: 'A UNESCO-listed metre-gauge toy train hauling through tea and tunnel since 1899.' },
  { id: 'ooty-shopping-1', destinationId: 'ooty', title: 'Tea and chocolate emporium browse', category: 'shopping', costINR: 150, durationMin: 45, blurb: 'High-grown Nilgiri tea and the town’s famous homemade chocolate, boxed to carry.' },
  // Ernakulam (Kochi)
  { id: 'ernakulam-heritage-1', destinationId: 'ernakulam', title: 'Fort Kochi heritage walk', category: 'heritage', costINR: 0, durationMin: 120, blurb: 'Chinese fishing nets, Dutch warehouses, and three colonial layers on one tidal strip.' },
  { id: 'ernakulam-heritage-2', destinationId: 'ernakulam', title: 'Kathakali evening performance', category: 'heritage', costINR: 300, durationMin: 90, blurb: 'Green-room makeup, then the dance-drama itself — Kerala’s classical theatre up close.' },
  { id: 'ernakulam-nature-1', destinationId: 'ernakulam', title: 'Marine Drive harbour sunset walk', category: 'nature', costINR: 0, durationMin: 60, blurb: 'The city’s waterfront promenade facing the backwaters and the ships going out.' },
  { id: 'ernakulam-food-1', destinationId: 'ernakulam', title: 'Syrian-Christian kitchen trail', category: 'food', costINR: 200, durationMin: 75, blurb: 'Beef ularthiyathu, appam, and the pepper-and-coconut cooking of old Kochi’s churches.' },
  { id: 'ernakulam-shopping-1', destinationId: 'ernakulam', title: 'Broadway and spice-market browse', category: 'shopping', costINR: 100, durationMin: 60, blurb: 'The island’s old trade rows — pepper, ginger, and everything a ship once carried away.' },
  // Alappuzha
  { id: 'alappuzha-nature-1', destinationId: 'alappuzha', title: 'Backwater shikara canal cruise', category: 'nature', costINR: 400, durationMin: 120, blurb: 'A low wooden boat threading the narrow canals where houseboats cannot follow.' },
  { id: 'alappuzha-food-1', destinationId: 'alappuzha', title: 'Toddy-shop lakeside lunch trail', category: 'food', costINR: 150, durationMin: 75, blurb: 'Karimeen and red curry by the water, the way the lake feeds its own shore.' },
  { id: 'alappuzha-adventure-1', destinationId: 'alappuzha', title: 'Narrow-canal kayaking run', category: 'adventure', costINR: 350, durationMin: 90, blurb: 'Paddle your own canoe under leaning coconut palms, children waving from the banks.' },
  { id: 'alappuzha-heritage-1', destinationId: 'alappuzha', title: 'Lighthouse and pier history walk', category: 'heritage', costINR: 20, durationMin: 60, blurb: 'The port that shipped coir to the world, remembered in its 1862 lighthouse and broken pier.' },
  { id: 'alappuzha-shopping-1', destinationId: 'alappuzha', title: 'Coir-craft and coconut-oil stalls', category: 'shopping', costINR: 80, durationMin: 45, blurb: 'Mats, rope, and oil from the district that industrialised coconut fibre.' },
  // Kollam
  { id: 'kollam-nature-1', destinationId: 'kollam', title: 'Ashtamudi lake cruise', category: 'nature', costINR: 250, durationMin: 120, blurb: 'An eight-armed estuary of palms and Chinese fishing nets — Kollam’s blue backyard.' },
  { id: 'kollam-heritage-1', destinationId: 'kollam', title: 'Thangassery lighthouse and fort ruins walk', category: 'heritage', costINR: 25, durationMin: 75, blurb: 'Portuguese, Dutch, and British factories by the sea; climb the red-and-white stripes for the coast.' },
  { id: 'kollam-food-1', destinationId: 'kollam', title: 'Ashtamudi seafood tasting stop', category: 'food', costINR: 180, durationMin: 75, blurb: 'The lake’s prawns and pearl spot cooked to order at waterside kitchens.' },
  { id: 'kollam-adventure-1', destinationId: 'kollam', title: 'Munroe Island canal canoe trip', category: 'adventure', costINR: 400, durationMin: 150, blurb: 'A village of islets where the canals are the streets — the classic Kerala canoe day.' },
  { id: 'kollam-shopping-1', destinationId: 'kollam', title: 'Cashew-capital outlet browse', category: 'shopping', costINR: 100, durationMin: 45, blurb: 'The port that shipped cashews worldwide sells them roasted at the source.' },
  // Thiruvananthapuram
  { id: 'thiruvananthapuram-heritage-1', destinationId: 'thiruvananthapuram', title: 'Sree Padmanabhaswamy temple precinct walk', category: 'heritage', costINR: 0, durationMin: 75, blurb: 'The 18th-century royal temple’s gopuram and corridors — dress code applies; darshan subject to queue.' },
  { id: 'thiruvananthapuram-heritage-2', destinationId: 'thiruvananthapuram', title: 'Napier Museum galleries', category: 'heritage', costINR: 40, durationMin: 75, blurb: 'An Indo-Saracenic art museum with a rare natural-lit gallery and a good bronze collection.' },
  { id: 'thiruvananthapuram-nature-1', destinationId: 'thiruvananthapuram', title: 'Kovalam lighthouse beach afternoon', category: 'nature', costINR: 0, durationMin: 150, blurb: 'A crescent of sand under a red-striped lighthouse — swim, then climb for the coast road home.' },
  { id: 'thiruvananthapuram-food-1', destinationId: 'thiruvananthapuram', title: 'Indian Coffee House tower breakfast', category: 'food', costINR: 90, durationMin: 60, blurb: 'Breakfast in the spiralling landmark café the city has kept since the 1950s.' },
  { id: 'thiruvananthapuram-shopping-1', destinationId: 'thiruvananthapuram', title: 'Chalai bazaar and handloom walk', category: 'shopping', costINR: 100, durationMin: 60, blurb: 'The capital’s oldest market street — spices, bronze, and the state’s own handlooms.' },
  { id: 'thiruvananthapuram-movies-1', destinationId: 'thiruvananthapuram', title: 'Matinee at a classic Trivandrum talkies', category: 'movies', costINR: 150, durationMin: 150, blurb: 'Single-screen Malayalam cinema with a full-throated fan section — an honest city evening.' },
  // Kanniyakumari
  { id: 'kanniyakumari-nature-1', destinationId: 'kanniyakumari', title: 'Tri-sea confluence sunset viewing', category: 'nature', costINR: 0, durationMin: 60, blurb: 'The subcontinent’s southern point, where three seas visibly argue at dusk.' },
  { id: 'kanniyakumari-heritage-1', destinationId: 'kanniyakumari', title: 'Vivekananda Rock Memorial ferry visit', category: 'heritage', costINR: 100, durationMin: 120, blurb: 'A short ferry to the rock where the swami meditated — temple, tower, and open sea.' },
  { id: 'kanniyakumari-food-1', destinationId: 'kanniyakumari', title: 'Coastal fish-curry meals trail', category: 'food', costINR: 150, durationMin: 75, blurb: 'Last-fish-market kitchens serving Tamil coastal curries with the tide in view.' },
  { id: 'kanniyakumari-adventure-1', destinationId: 'kanniyakumari', title: 'Sunrise coastal walk to the view tower', category: 'adventure', costINR: 40, durationMin: 75, blurb: 'Beating the crowds to the daybreak waterline and the old viewing tower above it.' },
  { id: 'kanniyakumari-shopping-1', destinationId: 'kanniyakumari', title: 'Seashell and handicraft stalls', category: 'shopping', costINR: 80, durationMin: 45, blurb: 'Shell curios and palm-leaf crafts from the southernmost bazaar in India.' },
]

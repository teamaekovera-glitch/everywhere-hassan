/**
 * One famous sight near a destination — the detail card's "famous spots"
 * grid. Distances are straight-line kilometres from the destination centre,
 * used for map pins; both are estimates, covered by DATA_PROVENANCE.
 */
export interface SpotDef {
  /** '<destinationId>-spot-<n>' — unique across the whole catalog. */
  id: string
  /** Location id from locations.ts. */
  destinationId: string
  /** Display name — 'Bekal Fort'. */
  name: string
  /** One honest sentence. */
  blurb: string
  /** Straight-line km from the destination centre — map pins, approximate. */
  distanceKm: number
}

/** Three to four famous sights per destination, grouped in dataset order. */
export const SPOTS: readonly SpotDef[] = [
  // Kozhikode
  { id: 'kozhikode-spot-1', destinationId: 'kozhikode', name: 'Kappad Beach', blurb: 'The 1498 landing place of Vasco da Gama, now a quiet beach with a memorial stone.', distanceKm: 18 },
  { id: 'kozhikode-spot-2', destinationId: 'kozhikode', name: 'Beypore Port', blurb: 'An ancient trading port where wooden cargo dhows are still built by hand.', distanceKm: 10 },
  { id: 'kozhikode-spot-3', destinationId: 'kozhikode', name: 'Kozhikode Beach and lighthouse', blurb: 'The city beach with its piers, parks, and sunset crowds.', distanceKm: 2 },
  // Thalassery
  { id: 'thalassery-spot-1', destinationId: 'thalassery', name: 'Thalassery Fort', blurb: 'An 18th-century British fort with massive round walls above the harbour.', distanceKm: 1 },
  { id: 'thalassery-spot-2', destinationId: 'thalassery', name: 'Muzhappilangad Beach', blurb: 'India’s longest drive-in beach — 4 km of hard-packed sand.', distanceKm: 7 },
  { id: 'thalassery-spot-3', destinationId: 'thalassery', name: 'Overbury’s Folly', blurb: 'A seaside park on a laterite hillock with views over the town’s rooftops.', distanceKm: 2 },
  // Kannur
  { id: 'kannur-spot-1', destinationId: 'kannur', name: 'St. Angelo Fort', blurb: 'A 1505 fort whose bastions watch the Mappila Bay harbour.', distanceKm: 3 },
  { id: 'kannur-spot-2', destinationId: 'kannur', name: 'Payyambalam Beach', blurb: 'A long village beach with a noted sculpture garden at its entrance.', distanceKm: 2 },
  { id: 'kannur-spot-3', destinationId: 'kannur', name: 'Arakkal Museum', blurb: 'The palace of Kerala’s only Muslim royal house, converted to a museum.', distanceKm: 3 },
  // Kasaragod
  { id: 'kasaragod-spot-1', destinationId: 'kasaragod', name: 'Bekal Fort', blurb: 'The district’s great laterite fort, shaped like a giant keyhole over the sea.', distanceKm: 15 },
  { id: 'kasaragod-spot-2', destinationId: 'kasaragod', name: 'Chandragiri Fort and bridge', blurb: 'A small hilltop fort at the river bridge, with backwater views.', distanceKm: 10 },
  { id: 'kasaragod-spot-3', destinationId: 'kasaragod', name: 'Ananthapura Lake Temple', blurb: 'A 9th-century temple alone in the middle of a small lake.', distanceKm: 30 },
  // Mangaluru
  { id: 'mangaluru-spot-1', destinationId: 'mangaluru', name: 'Kadri Manjunatha Temple', blurb: 'A temple of great antiquity with laterite caves behind its shrine.', distanceKm: 4 },
  { id: 'mangaluru-spot-2', destinationId: 'mangaluru', name: 'Panambur Beach', blurb: 'The city’s clean, lively beach facing the new harbour.', distanceKm: 10 },
  { id: 'mangaluru-spot-3', destinationId: 'mangaluru', name: 'St. Aloysius Chapel', blurb: 'A chapel whose interior is covered, wall to ceiling, in fresco paintings.', distanceKm: 1 },
  // Wayanad (Kalpetta)
  { id: 'wayanad-spot-1', destinationId: 'wayanad', name: 'Edakkal Caves', blurb: 'A rock shelter with petroglyphs carved across thousands of years.', distanceKm: 27 },
  { id: 'wayanad-spot-2', destinationId: 'wayanad', name: 'Banasura Sagar Dam', blurb: 'India’s largest earthen dam, set among drowned hill islands.', distanceKm: 22 },
  { id: 'wayanad-spot-3', destinationId: 'wayanad', name: 'Pookode Lake', blurb: 'A small, boomerang-shaped freshwater lake in forest.', distanceKm: 12 },
  // Mysuru
  { id: 'mysuru-spot-1', destinationId: 'mysuru', name: 'Mysore Palace', blurb: 'The city’s glittering centrepiece — a full working palace complex.', distanceKm: 1 },
  { id: 'mysuru-spot-2', destinationId: 'mysuru', name: 'Chamundi Hills', blurb: 'The hill of the city’s guardian goddess, climbed by a thousand steps.', distanceKm: 6 },
  { id: 'mysuru-spot-3', destinationId: 'mysuru', name: 'Devaraja Market', blurb: 'A 19th-century market hall of flowers, spices, and colour.', distanceKm: 1 },
  // Coorg (Madikeri)
  { id: 'coorg-spot-1', destinationId: 'coorg', name: 'Abbey Falls', blurb: 'A wide fall where the coffee estates drain into the Kaveri.', distanceKm: 8 },
  { id: 'coorg-spot-2', destinationId: 'coorg', name: 'Raja’s Seat', blurb: 'The kings’ evening viewpoint over the Western Ghats terraces.', distanceKm: 1 },
  { id: 'coorg-spot-3', destinationId: 'coorg', name: 'Talakaveri', blurb: 'The shrine at the Kaveri’s source, high on the Brahmagiri ridge.', distanceKm: 45 },
  // Bengaluru
  { id: 'bengaluru-spot-1', destinationId: 'bengaluru', name: 'Bangalore Palace', blurb: 'The Wodeyars’ Tudor-revival palace with its carved wood halls.', distanceKm: 4 },
  { id: 'bengaluru-spot-2', destinationId: 'bengaluru', name: 'Lalbagh Botanical Garden', blurb: 'Two centuries of botanical collections around a granite hill.', distanceKm: 3 },
  { id: 'bengaluru-spot-3', destinationId: 'bengaluru', name: 'Cubbon Park', blurb: 'The city’s 300-acre green lung of avenues and museums.', distanceKm: 2 },
  // Thrissur
  { id: 'thrissur-spot-1', destinationId: 'thrissur', name: 'Vadakkumnathan Temple', blurb: 'The ancient Shiva temple inside a walled teak grove on the town’s roundabout.', distanceKm: 1 },
  { id: 'thrissur-spot-2', destinationId: 'thrissur', name: 'Paramekkavu Bagavathi Temple', blurb: 'One of the two temples whose Pooram elephants meet in the town’s famous festival.', distanceKm: 1 },
  { id: 'thrissur-spot-3', destinationId: 'thrissur', name: 'Kerala Kalamandalam', blurb: 'The famed academy where Kathakali and Mohiniyattam are taught, at Cheruthuruthy.', distanceKm: 25 },
  // Palakkad
  { id: 'palakkad-spot-1', destinationId: 'palakkad', name: 'Palakkad Fort', blurb: 'Hyder Ali’s 1766 fort, square, moated, and still intact in town.', distanceKm: 1 },
  { id: 'palakkad-spot-2', destinationId: 'palakkad', name: 'Malampuzha Dam and gardens', blurb: 'The district’s hill-backed dam with rock garden and ropeway.', distanceKm: 8 },
  { id: 'palakkad-spot-3', destinationId: 'palakkad', name: 'Kalpathy Heritage Village', blurb: 'A river-bank agraharam of Tamil Brahmin lanes and its old stone chariot.', distanceKm: 3 },
  // Coimbatore
  { id: 'coimbatore-spot-1', destinationId: 'coimbatore', name: 'Adiyogi Shiva statue', blurb: 'A 34-metre stone Adiyogi in the Velliangiri foothills.', distanceKm: 30 },
  { id: 'coimbatore-spot-2', destinationId: 'coimbatore', name: 'Marudamalai Temple', blurb: 'The hilltop Murugan shrine on the city’s western edge.', distanceKm: 15 },
  { id: 'coimbatore-spot-3', destinationId: 'coimbatore', name: 'VOC Park and Zoo', blurb: 'The city’s central park with a small zoo and evening crowds.', distanceKm: 2 },
  // Ooty
  { id: 'ooty-spot-1', destinationId: 'ooty', name: 'Doddabetta Peak', blurb: 'The highest point of the Nilgiris, with a telescope house.', distanceKm: 8 },
  { id: 'ooty-spot-2', destinationId: 'ooty', name: 'Ooty Lake', blurb: 'The boat lake the town grew around, backed by eucalyptus.', distanceKm: 2 },
  { id: 'ooty-spot-3', destinationId: 'ooty', name: 'Government Rose Garden', blurb: 'Terraced rose beds holding thousands of varieties on a hill slope.', distanceKm: 2 },
  // Ernakulam (Kochi)
  { id: 'ernakulam-spot-1', destinationId: 'ernakulam', name: 'Fort Kochi Chinese fishing nets', blurb: 'The shore rigs that haul, creaking, at every tide — Kochi’s icon.', distanceKm: 10 },
  { id: 'ernakulam-spot-2', destinationId: 'ernakulam', name: 'Mattancherry Palace', blurb: 'The Portuguese-era palace with Kerala’s finest mural cycles.', distanceKm: 11 },
  { id: 'ernakulam-spot-3', destinationId: 'ernakulam', name: 'Marine Drive walkway', blurb: 'The city’s backwater promenade facing the ships and sunsets.', distanceKm: 1 },
  // Alappuzha
  { id: 'alappuzha-spot-1', destinationId: 'alappuzha', name: 'Alappuzha Beach and pier', blurb: 'The old port beach with its 1862 sea pier, half in the waves.', distanceKm: 2 },
  { id: 'alappuzha-spot-2', destinationId: 'alappuzha', name: 'Alappuzha Lighthouse', blurb: 'A 19th-century lighthouse over the canal town and its backwaters.', distanceKm: 2 },
  { id: 'alappuzha-spot-3', destinationId: 'alappuzha', name: 'Marari Beach', blurb: 'A fishing-village beach strip that has stayed stubbornly sleepy.', distanceKm: 12 },
  // Kollam
  { id: 'kollam-spot-1', destinationId: 'kollam', name: 'Thangassery Lighthouse', blurb: 'A 1902 red-and-white striped tower over the old fort quarter.', distanceKm: 5 },
  { id: 'kollam-spot-2', destinationId: 'kollam', name: 'Ashtamudi Lake waterfront', blurb: 'The eight-armed estuary the town is built around.', distanceKm: 2 },
  { id: 'kollam-spot-3', destinationId: 'kollam', name: 'Munroe Island', blurb: 'A village of islets where canal transport still outruns roads.', distanceKm: 25 },
  // Thiruvananthapuram
  { id: 'thiruvananthapuram-spot-1', destinationId: 'thiruvananthapuram', name: 'Sree Padmanabhaswamy Temple', blurb: 'The royal temple of the Travancore kings, whose deity reclines on a serpent.', distanceKm: 1 },
  { id: 'thiruvananthapuram-spot-2', destinationId: 'thiruvananthapuram', name: 'Napier Museum', blurb: 'An Indo-Saracenic art museum set in the city’s garden heart.', distanceKm: 3 },
  { id: 'thiruvananthapuram-spot-3', destinationId: 'thiruvananthapuram', name: 'Kovalam Beach', blurb: 'The crescent lighthouse beach south of the city.', distanceKm: 15 },
  { id: 'thiruvananthapuram-spot-4', destinationId: 'thiruvananthapuram', name: 'Shanghumugham Beach', blurb: 'The city’s own wide beach, famous for its sunset and giant sculpture.', distanceKm: 8 },
  // Kanniyakumari
  { id: 'kanniyakumari-spot-1', destinationId: 'kanniyakumari', name: 'Vivekananda Rock Memorial', blurb: 'The sea rock memorial where the swami meditated in 1892.', distanceKm: 2 },
  { id: 'kanniyakumari-spot-2', destinationId: 'kanniyakumari', name: 'Thiruvalluvar Statue', blurb: 'A 41-metre granite statue of the Tamil poet on its own sea rock.', distanceKm: 2 },
  { id: 'kanniyakumari-spot-3', destinationId: 'kanniyakumari', name: 'Sunset Point', blurb: 'The shore promenade where three seas meet the day’s end.', distanceKm: 1 },
]

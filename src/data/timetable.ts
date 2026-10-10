import { at } from './referenceDay'
import type { Connection } from './types'

/**
 * SYNTHETIC DEMO TIMETABLE — not a real schedule. Fares are estimated, the
 * service names echo real Kerala corridors (Shoranur–Mangaluru rail, KSRTC
 * buses, SWTD ferry) but every time and fare here is engineered so the ten
 * signature-demo beats fire deterministically. The UI must always disclose
 * this; see DATA_PROVENANCE in src/data/index.ts.
 *
 * Reference day: Saturday 2026-10-17, Asia/Kolkata. Times after 23:59 are
 * expressed as hours ≥ 24 (e.g. at(25, 30) = 01:30 next day).
 *
 * Dataset design (per the build spec):
 * - Kozhikode anchors two corridors: north rail (Kannur–Mangaluru) and east
 *   road (Wayanad–Mysuru–Coorg–Bengaluru), plus the south rail spine
 *   (Thrissur–Ernakulam–Alappuzha–Kollam).
 * - Mangaluru keeps exactly one late express (18:05) so its expiry is visible;
 *   its morning service has already left by the default 12:00 clock.
 * - Bengaluru has a direct overnight bus (20:30) and a transfer chain via
 *   Coimbatore with disjoint departure windows — losing either never blanks it.
 * - A cluster of affordable short hops (Kannur, Thrissur, Ernakulam) stays
 *   under every budget in the demo.
 * - Ooty (₹2,120 cheapest chain) and Coorg (₹2,150 direct) sit above the
 *   default ₹2,000 budget so the ₹4,000 beat has something to reveal.
 * - The 17:05 Kollam bus is a deliberate decoy: a 10-minute transfer from the
 *   Ernad chain, below the 20-minute minimum, while the 17:20 ferry fits.
 */
export const CONNECTIONS: readonly Connection[] = [
  // ---- Morning north rail: Malabar Passenger chain (Kozhikode → Mangaluru) ----
  { id: 'TRN-16650-KZK-TLY', label: 'Malabar Passenger (07:10)', mode: 'train', from: 'kozhikode', to: 'thalassery', depart: at(7, 10), arrive: at(8, 5), costINR: 45 },
  { id: 'TRN-16650-TLY-CAN', label: 'Malabar Passenger (08:15)', mode: 'train', from: 'thalassery', to: 'kannur', depart: at(8, 15), arrive: at(9, 5), costINR: 50 },
  { id: 'TRN-16650-CAN-KAS', label: 'Malabar Passenger (09:20)', mode: 'train', from: 'kannur', to: 'kasaragod', depart: at(9, 20), arrive: at(11, 10), costINR: 70 },
  { id: 'TRN-16650-KAS-MGL', label: 'Malabar Passenger (11:20)', mode: 'train', from: 'kasaragod', to: 'mangaluru', depart: at(11, 20), arrive: at(12, 30), costINR: 60 },

  // ---- Morning south rail + Kanniyakumari (alive when scrubbing backwards) ----
  { id: 'TRN-12623-KZK-TVM', label: 'Parasuraman Express (07:15)', mode: 'train', from: 'kozhikode', to: 'thiruvananthapuram', depart: at(7, 15), arrive: at(14, 5), costINR: 340 },
  { id: 'BUS-921-TVM-KNY', label: 'Kanniyakumari Bus (14:35)', mode: 'bus', from: 'thiruvananthapuram', to: 'kanniyakumari', depart: at(14, 35), arrive: at(16, 5), costINR: 220 },

  // ---- Morning east road: Wayanad → Mysuru → Coorg chain ----
  { id: 'BUS-511-KZK-WYN', label: 'Wayanad Ordinary (08:30)', mode: 'bus', from: 'kozhikode', to: 'wayanad', depart: at(8, 30), arrive: at(11, 30), costINR: 180 },
  { id: 'BUS-511-WYN-MYS', label: 'Mysuru Bus (11:50)', mode: 'bus', from: 'wayanad', to: 'mysuru', depart: at(11, 50), arrive: at(15, 5), costINR: 350 },
  { id: 'BUS-511-MYS-MDK', label: 'Coorg Bus (15:25)', mode: 'bus', from: 'mysuru', to: 'coorg', depart: at(15, 25), arrive: at(17, 10), costINR: 220 },

  // ---- Midday north ----
  { id: 'BUS-452-KZK-CAN', label: 'Kannur Volvo (13:02)', mode: 'bus', from: 'kozhikode', to: 'kannur', depart: at(13, 2), arrive: at(14, 10), costINR: 95 },
  { id: 'BUS-451-KZK-TLY', label: 'Thalassery Fast Bus (13:05)', mode: 'bus', from: 'kozhikode', to: 'thalassery', depart: at(13, 5), arrive: at(14, 5), costINR: 80 },
  { id: 'TRN-16647-KZK-CAN', label: 'Jan Shatabdi Express (13:10)', mode: 'train', from: 'kozhikode', to: 'kannur', depart: at(13, 10), arrive: at(14, 25), costINR: 70 },
  // Slow but cheap: keeps Thalassery's bus/train pair nondominated (Pareto).
  { id: 'TRN-16656-KZK-TLY', label: 'Kannur Passenger (14:35)', mode: 'train', from: 'kozhikode', to: 'thalassery', depart: at(14, 35), arrive: at(16, 0), costINR: 35 },

  // ---- Ernad Express spine (south rail) ----
  { id: 'TRN-16649-KZK-THR', label: 'Ernad Express (12:35)', mode: 'train', from: 'kozhikode', to: 'thrissur', depart: at(12, 35), arrive: at(13, 50), costINR: 90 },
  { id: 'TRN-16649-THR-ERN', label: 'Ernad Express (14:12)', mode: 'train', from: 'thrissur', to: 'ernakulam', depart: at(14, 12), arrive: at(15, 35), costINR: 110 },
  { id: 'TRN-16649-ERN-ALP', label: 'Ernad Express (15:57)', mode: 'train', from: 'ernakulam', to: 'alappuzha', depart: at(15, 57), arrive: at(16, 55), costINR: 95 },

  // ---- Short hops ----
  { id: 'BUS-470-KZK-THR', label: 'Thrissur Ordinary (12:50)', mode: 'bus', from: 'kozhikode', to: 'thrissur', depart: at(12, 50), arrive: at(14, 35), costINR: 65 },
  { id: 'BUS-480-KZK-PLK', label: 'Palakkad Volvo (13:45)', mode: 'bus', from: 'kozhikode', to: 'palakkad', depart: at(13, 45), arrive: at(15, 5), costINR: 210 },
  { id: 'BUS-481-KZK-PLK', label: 'Palakkad Ordinary (15:30)', mode: 'bus', from: 'kozhikode', to: 'palakkad', depart: at(15, 30), arrive: at(17, 50), costINR: 150 },
  { id: 'BUS-482-PLK-KZK', label: 'Palakkad Volvo Return (18:10)', mode: 'bus', from: 'palakkad', to: 'kozhikode', depart: at(18, 10), arrive: at(19, 45), costINR: 150 },

  // ---- Coimbatore / Ooty ----
  { id: 'BUS-490-KZK-CBE', label: 'Coimbatore Volvo (13:15)', mode: 'bus', from: 'kozhikode', to: 'coimbatore', depart: at(13, 15), arrive: at(16, 15), costINR: 520 },
  { id: 'TRN-12655-THR-CBE', label: 'Coimbatore Intercity (14:15)', mode: 'train', from: 'thrissur', to: 'coimbatore', depart: at(14, 15), arrive: at(16, 55), costINR: 180 },
  { id: 'BUS-495-CBE-OOT', label: 'Ooty Hill Bus (18:15)', mode: 'bus', from: 'coimbatore', to: 'ooty', depart: at(18, 15), arrive: at(21, 15), costINR: 1850 },
  { id: 'TRN-12656-CBE-KZK', label: 'Intercity Return (19:20)', mode: 'train', from: 'coimbatore', to: 'kozhikode', depart: at(19, 20), arrive: at(22, 10), costINR: 180 },

  // ---- Ernakulam / Alappuzha ----
  { id: 'TRN-12081-KZK-ERN', label: 'Ernakulam Jan Shatabdi (13:15)', mode: 'train', from: 'kozhikode', to: 'ernakulam', depart: at(13, 15), arrive: at(15, 10), costINR: 260 },
  { id: 'TRN-12082-ERN-KZK', label: 'Jan Shatabdi Return (17:55)', mode: 'train', from: 'ernakulam', to: 'kozhikode', depart: at(17, 55), arrive: at(19, 55), costINR: 260 },
  { id: 'BUS-478-KZK-ALP', label: 'Alappuzha Direct Volvo (14:15)', mode: 'bus', from: 'kozhikode', to: 'alappuzha', depart: at(14, 15), arrive: at(16, 45), costINR: 420 },
  { id: 'BUS-479-ALP-KZK', label: 'Alappuzha Return (18:40)', mode: 'bus', from: 'alappuzha', to: 'kozhikode', depart: at(18, 40), arrive: at(22, 10), costINR: 420 },

  // ---- Kollam: superfast direct, ferry from Alappuzha, TVM decoy ----
  { id: 'TRN-16603-KZK-KLM', label: 'Kollam Superfast (14:30)', mode: 'train', from: 'kozhikode', to: 'kollam', depart: at(14, 30), arrive: at(18, 20), costINR: 480 },
  { id: 'TRN-16604-KLM-KZK', label: 'Superfast Return (20:10)', mode: 'train', from: 'kollam', to: 'kozhikode', depart: at(20, 10), arrive: at(24, 5), costINR: 480 },
  { id: 'FRY-9001-ALP-KLM', label: 'SWTD Ferry (17:20)', mode: 'ferry', from: 'alappuzha', to: 'kollam', depart: at(17, 20), arrive: at(19, 5), costINR: 80 },
  { id: 'TRN-12624-KLM-TVM', label: 'Thiruvananthapuram Passenger (18:30)', mode: 'train', from: 'kollam', to: 'thiruvananthapuram', depart: at(18, 30), arrive: at(20, 15), costINR: 110 },

  // ---- Wayanad midday ----
  { id: 'BUS-505-KZK-WYN', label: 'Wayanad Premium Volvo (14:50)', mode: 'bus', from: 'kozhikode', to: 'wayanad', depart: at(14, 50), arrive: at(17, 20), costINR: 320 },
  { id: 'BUS-506-KZK-WYN', label: 'Wayanad Ordinary (15:30)', mode: 'bus', from: 'kozhikode', to: 'wayanad', depart: at(15, 30), arrive: at(18, 30), costINR: 180 },
  { id: 'BUS-507-WYN-KZK', label: 'Wayanad Return (19:00)', mode: 'bus', from: 'wayanad', to: 'kozhikode', depart: at(19, 0), arrive: at(22, 0), costINR: 180 },

  // ---- North evening: THE critical departure of the demo ----
  { id: 'TRN-16658-KZK-MGL', label: 'Mangaluru Express (18:05)', mode: 'train', from: 'kozhikode', to: 'mangaluru', depart: at(18, 5), arrive: at(22, 40), costINR: 190 },
  { id: 'TRN-16659-MGL-KZK', label: 'Mangaluru Express Return (23:15)', mode: 'train', from: 'mangaluru', to: 'kozhikode', depart: at(23, 15), arrive: at(27, 45), costINR: 190 },
  { id: 'TRN-16660-MGL-KZK', label: 'Mangaluru Morning Return (07:15 next day)', mode: 'train', from: 'mangaluru', to: 'kozhikode', depart: at(31, 15), arrive: at(35, 50), costINR: 160 },

  // ---- Return legs for day-trip honesty ----
  { id: 'TRN-16652-TLY-KZK', label: 'Malabar Return (18:45)', mode: 'train', from: 'thalassery', to: 'kozhikode', depart: at(18, 45), arrive: at(19, 45), costINR: 50 },
  { id: 'TRN-16648-CAN-KZK', label: 'Jan Shatabdi Return (18:30)', mode: 'train', from: 'kannur', to: 'kozhikode', depart: at(18, 30), arrive: at(19, 50), costINR: 70 },
  { id: 'TRN-16606-THR-KZK', label: 'Ernad Return (19:15)', mode: 'train', from: 'thrissur', to: 'kozhikode', depart: at(19, 15), arrive: at(20, 35), costINR: 90 },

  // ---- Bengaluru: direct overnight + Coimbatore chain (disjoint windows) ----
  { id: 'TRN-16545-CBE-BLR', label: 'Bengaluru Mail (17:30)', mode: 'train', from: 'coimbatore', to: 'bengaluru', depart: at(17, 30), arrive: at(25, 30), costINR: 1250 },
  { id: 'BUS-500-KZK-BLR', label: 'Bengaluru Overnight Volvo (20:30)', mode: 'bus', from: 'kozhikode', to: 'bengaluru', depart: at(20, 30), arrive: at(28, 45), costINR: 1600 },
  { id: 'BUS-501-BLR-KZK', label: 'Volvo Return (06:30 next day)', mode: 'bus', from: 'bengaluru', to: 'kozhikode', depart: at(30, 30), arrive: at(38, 30), costINR: 1600 },

  // ---- Coorg direct premium (budget-reveal destination) ----
  { id: 'BUS-497-KZK-MDK', label: 'Coorg Premium Volvo (16:00)', mode: 'bus', from: 'kozhikode', to: 'coorg', depart: at(16, 0), arrive: at(22, 30), costINR: 2150 },
]

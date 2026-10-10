/** '₹2,120' — comma grouping; demo fares never cross ₹99,999, so western grouping is fine. */
export function formatINR(amount: number): string {
  return `₹${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

import { LOCATIONS } from '../data'
import { imageForLocation } from './destinationImages'

interface HomeProps {
  onPlanDay: () => void
  onExplore: () => void
}

/**
 * The light landing surface (planner spec): a day-trip promise, a strip of
 * the bundled destination photos, one loud CTA into the planner and one
 * quiet secondary into Explore. The synthetic-data disclosure travels with
 * the promise — same honesty layer as Explore.
 */
export function Home({ onPlanDay, onExplore }: HomeProps) {
  return (
    <div className="light-page home">
      <header className="home-hero">
        <p className="home-kicker">EVERYWHERE</p>
        <h1 className="home-title">Plan the whole day, not just the ride.</h1>
        <p className="home-sub">
          Pick a budget and a time window — EVERYWHERE turns what's still reachable into full day
          trips: travel out, see the sights, eat well, and be home on time. Every leg, minute, and
          rupee accounted for.
        </p>
        <div className="home-ctas">
          <button type="button" className="cta-loud" onClick={onPlanDay}>
            Plan my day
          </button>
          <button type="button" className="cta-quiet" onClick={onExplore}>
            Explore the field
          </button>
        </div>
        <p className="home-disclosure">
          Timetables, fares, and activity ideas are synthetic estimates for demo purposes — the app
          itself runs offline.
        </p>
      </header>

      <div className="home-strip" aria-label="Destination photos">
        {LOCATIONS.map((loc) => {
          const src = imageForLocation(loc.id)
          return (
            <figure className="strip-card" key={loc.id}>
              {src ? (
                <img src={src} alt={loc.name} width={256} height={256} loading="lazy" />
              ) : (
                <span className="strip-monogram" aria-hidden="true">
                  {loc.name.charAt(0)}
                </span>
              )}
              <figcaption>{loc.name}</figcaption>
            </figure>
          )
        })}
      </div>
    </div>
  )
}

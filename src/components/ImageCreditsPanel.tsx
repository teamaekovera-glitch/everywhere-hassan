import { PHOTO_CREDITS } from '../data/photoCredits'
import type { PhotoCredit } from '../data/photoCredits'

interface ImageCreditsPanelProps {
  /** Defaults to the full bundled manifest when omitted. */
  credits?: readonly PhotoCredit[]
}

/**
 * Offline image attribution — every bundled Commons photo's creator, license,
 * and source page, rendered with no network access (CC BY-SA compliance is
 * not an afterthought). Rendered at the foot of the trip-detail surface,
 * filtered to the destination's own photos.
 */
export function ImageCreditsPanel({ credits = PHOTO_CREDITS }: ImageCreditsPanelProps) {
  return (
    <section className="card image-credits" aria-label="Image credits">
      <h2 className="card-kicker">Image credits</h2>
      <p className="image-credits-note">
        Photography courtesy of Wikimedia Commons contributors — {credits.length}{' '}
        {credits.length === 1 ? 'image' : 'images'}, attributed individually. This
        panel works offline.
      </p>
      <ul className="image-credits-list">
        {credits.map((credit) => (
          <li key={credit.assetId} className="image-credit" data-testid="image-credit">
            <span className="image-credit-asset">{credit.assetId}</span>
            <span className="image-credit-creator">© {credit.creator}</span>
            <a
              className="image-credit-license"
              href={credit.licenseUrl}
              target="_blank"
              rel="license noopener noreferrer"
            >
              {credit.license}
            </a>
            <a
              className="image-credit-source"
              href={credit.sourcePage}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

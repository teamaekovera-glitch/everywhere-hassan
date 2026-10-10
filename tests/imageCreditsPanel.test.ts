import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ImageCreditsPanel } from '../src/components/ImageCreditsPanel'
import { PHOTO_CREDITS } from '../src/data/photoCredits'

const render = (credits?: typeof PHOTO_CREDITS) =>
  renderToStaticMarkup(
    createElement(ImageCreditsPanel, credits === undefined ? {} : { credits }),
  )

describe('ImageCreditsPanel', () => {
  // The node-only test env has no DOM renderer — react-dom/server renders the
  // markup offline, which is exactly the claim this panel makes about itself.
  it('renders every bundled credit offline — creator, license, and source page', () => {
    const html = render()
    for (const credit of PHOTO_CREDITS) {
      expect(html).toContain(credit.assetId)
      expect(html).toContain(credit.creator)
      expect(html).toContain(credit.license)
      expect(html).toContain(`href="${credit.licenseUrl}"`)
      expect(html).toContain(`href="${credit.sourcePage}"`)
    }
  })

  it('renders one row per credit', () => {
    const html = render()
    const rows = html.match(/data-testid="image-credit"/g) ?? []
    expect(rows.length).toBe(PHOTO_CREDITS.length)
  })

  it('accepts a credit slice — the trip-detail surface renders per-destination subsets', () => {
    const slice = PHOTO_CREDITS.slice(0, 2)
    const html = render(slice)
    const rows = html.match(/data-testid="image-credit"/g) ?? []
    expect(rows.length).toBe(2)
    expect(html).toContain(slice[0].assetId)
    expect(html).not.toContain(PHOTO_CREDITS[PHOTO_CREDITS.length - 1].assetId)
  })

  it('links carry rel attributes guarding outbound navigation', () => {
    expect(render()).toContain('rel="license noopener noreferrer"')
  })
})

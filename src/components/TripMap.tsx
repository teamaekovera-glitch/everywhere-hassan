import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DEMO_DATA } from '../data'
import { formatIst } from '../sim/clock'
import { formatINR } from '../engine/format'
import { formatDuration } from '../viz/format'
import type { TripPlan } from '../engine/planner'
import { poiPin, schematicLegs, schematicProjection, scaleBarKmFor } from './tripPlan'
import type { SchematicLeg } from './tripPlan'
import { nextFailureCount, shouldShowSchematic } from './tripMapFallback'

/**
 * The route map (planner spec) — the app's ONE networked surface, lazy-loaded
 * so Leaflet never enters the main bundle. The route geometry (polylines,
 * markers, labels) renders from the TripPlan's own legs and the bundled
 * coordinates, never from the basemap: if tiles die, the plan stays fully
 * usable — the map area swaps to the inline SVG schematic with a Retry.
 *
 * OSM etiquette: viewport-only tile loading (Leaflet's default — no prefetch
 * beyond the buffer), attribution visible and linked, tiles best-effort.
 * POI pins are synthetic estimates placed near the destination centre; their
 * captions say so.
 */

interface TripMapProps {
  plan: TripPlan
  /** Deadline the plan was planned against — the arrival-back guarantee line. */
  deadlineMs: number
}

/** Pure-HTML pin head — Leaflet's default icons reference images we don't bundle. */
function pinIcon(kind: 'origin' | 'destination' | 'activity', caption: string): L.DivIcon {
  return L.divIcon({
    className: `trip-map-pin trip-map-pin-${kind}`,
    html: `<span class="trip-map-pin-head"></span>${caption ? `<span class="trip-map-pin-label">${caption}</span>` : ''}`,
    iconSize: [22, 30],
    iconAnchor: [11, 28],
  })
}

function popupHtml(line1: string, line2: string): string {
  return `<strong>${line1}</strong><br><span>${line2}</span>`
}

/** The activity pins: synthetic estimates a fixed hop from the destination centre. */
const ACTIVITY_PIN_KM = 2

export default function TripMap({ plan, deadlineMs }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Map teardown/recreate on Retry — a new key forces fresh tile requests.
  const [mapKey, setMapKey] = useState(0)
  const [schematic, setSchematic] = useState(false)
  const failureRef = useRef(0)

  const origin = DEMO_DATA.locationById.get(plan.outbound.legs[0]?.from ?? plan.destinationId)
  const destination = DEMO_DATA.locationById.get(plan.destinationId)

  const legs = useMemo(() => schematicLegs(plan, DEMO_DATA), [plan])
  const activityPins = useMemo(() => {
    if (!destination) return []
    return plan.activities.map((activity) => ({
      activity,
      point: poiPin({ lat: destination.lat, lon: destination.lon }, ACTIVITY_PIN_KM, activity.id),
    }))
  }, [plan.activities, destination])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !origin || !destination || schematic) return

    failureRef.current = 0
    const map = L.map(container, { scrollWheelZoom: false })

    const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      // Visible attribution (spec): linked to the OSM copyright page.
      attribution:
        '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    })
    tileLayer.on('tileerror', () => {
      failureRef.current = nextFailureCount(failureRef.current, 'error')
      if (shouldShowSchematic(failureRef.current)) setSchematic(true)
    })
    tileLayer.on('tileload', () => {
      failureRef.current = nextFailureCount(failureRef.current, 'load')
    })
    tileLayer.addTo(map)

    // Route geometry from OUR data: one polyline per phase over the bundled
    // coordinates — never derived from the basemap.
    for (const phase of ['outbound', 'return'] as const) {
      const phaseLegs = legs.filter((leg) => leg.phase === phase)
      if (phaseLegs.length === 0) continue
      const points: [number, number][] = [
        [phaseLegs[0].from.lat, phaseLegs[0].from.lon],
        ...phaseLegs.map((leg) => [leg.to.lat, leg.to.lon] as [number, number]),
      ]
      L.polyline(points, {
        color: phase === 'outbound' ? '#3459d6' : '#6f5ff0',
        weight: 4,
        opacity: 0.85,
        dashArray: phase === 'return' ? '8 8' : undefined,
      })
        .bindTooltip(phase === 'outbound' ? 'Outbound' : 'Return')
        .addTo(map)
    }

    L.marker([origin.lat, origin.lon], { icon: pinIcon('origin', origin.name) })
      .bindPopup(popupHtml(origin.name, 'Origin — you start here'))
      .addTo(map)
    L.marker([destination.lat, destination.lon], { icon: pinIcon('destination', destination.name) })
      .bindPopup(popupHtml(destination.name, `${formatDuration(plan.dwellMin)} stay · estimated times`))
      .addTo(map)
    for (const { activity, point } of activityPins) {
      L.marker([point.lat, point.lon], { icon: pinIcon('activity', '') })
        .bindPopup(popupHtml(activity.title, 'Estimated location — synthetic POI data'))
        .addTo(map)
    }

    map.fitBounds(
      L.latLngBounds([
        [origin.lat, origin.lon],
        [destination.lat, destination.lon],
      ]).pad(0.25),
    )

    return () => {
      map.remove()
    }
    // Recreated when Retry remounts the map (mapKey) or the schematic swaps in.
  }, [plan, legs, origin, destination, activityPins, schematic, mapKey])

  function retry() {
    failureRef.current = 0
    setSchematic(false)
    setMapKey((k) => k + 1)
  }

  if (!origin || !destination) {
    // Unknown ids cannot come from the validated dataset — render the honest
    // empty state rather than a fake map.
    return <div className="trip-map trip-map-empty">No route to map.</div>
  }

  if (schematic) {
    return (
      <div className="trip-map trip-map-schematic" data-testid="trip-schematic">
        <SchematicRoute legs={legs} originName={origin.name} destinationName={destination.name} />
        <div className="trip-map-note trip-map-note-error">
          Map tiles unavailable — showing the schematic route.
          <button type="button" className="cta-quiet trip-map-retry" onClick={retry}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="trip-map" data-testid="trip-map">
      <div ref={containerRef} className="trip-map-canvas" key={mapKey} />
      <div className="trip-map-note">
        Route from EVERYWHERE's timetable · back by {formatIst(plan.arriveBackAt)} — before your{' '}
        {formatIst(deadlineMs)} deadline · map data © OpenStreetMap contributors
      </div>
    </div>
  )
}

/** The offline schematic: straight-line route over the bundled coordinates. */
function SchematicRoute({
  legs,
  originName,
  destinationName,
}: {
  legs: SchematicLeg[]
  originName: string
  destinationName: string
}) {
  const width = 640
  const height = 360
  const project = schematicProjection(legs, width, height)
  const routeKm = legs.reduce((sum, leg) => sum + leg.distanceKm, 0)
  const scaleBarKm = scaleBarKmFor(routeKm)
  const scaleBarPx = (scaleBarKm / Math.max(1, routeKm)) * (width / 4)

  const drawn = legs.map((leg) => {
    const a = project(leg.from)
    const b = project(leg.to)
    return { leg, a, b }
  })
  // Round-trip geometry: the return leg ends back at the origin, so the
  // destination anchor is the outbound's far end — never `last.b`.
  const first = drawn[0]
  const last = drawn[drawn.length - 1]
  const destinationPoint = first.b

  return (
    <svg
      className="schematic-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Schematic route from ${originName} to ${destinationName}, approximately ${Math.round(routeKm)} km each way`}
      data-testid="schematic-svg"
    >
      {drawn.map(({ leg, a, b }, index) => (
        <g key={leg.id}>
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={leg.phase === 'outbound' ? '#3459d6' : '#6f5ff0'}
            strokeWidth={3}
            strokeDasharray={leg.phase === 'return' ? '7 7' : undefined}
            strokeLinecap="round"
          />
          {/* A round trip traces the same segment both ways, so both leg
              midpoints coincide — opposite offsets keep the labels apart. */}
          <text
            className="schematic-leg-label"
            x={(a.x + b.x) / 2}
            y={(a.y + b.y) / 2 + (index % 2 === 0 ? -20 : 26)}
            textAnchor="middle"
          >
            {leg.label} · {formatDuration((leg.arriveMs - leg.departMs) / 60_000)} · {formatINR(leg.costINR)}
          </text>
        </g>
      ))}
      {first && (
        <g>
          <circle cx={first.a.x} cy={first.a.y} r={7} fill="#3459d6" />
          <text className="schematic-stop-label" x={first.a.x} y={first.a.y - 14} textAnchor="middle">
            {originName}
          </text>
        </g>
      )}
      {last && (
        <g>
          <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#6f5ff0" />
          <text className="schematic-stop-label" x={destinationPoint.x} y={destinationPoint.y - 14} textAnchor="middle">
            {destinationName}
          </text>
        </g>
      )}
      <g data-testid="schematic-scale">
        <line x1={24} y1={height - 28} x2={24 + scaleBarPx} y2={height - 28} stroke="#576283" strokeWidth={3} />
        <text className="schematic-scale-label" x={24} y={height - 38}>
          ≈ {scaleBarKm} km
        </text>
      </g>
    </svg>
  )
}

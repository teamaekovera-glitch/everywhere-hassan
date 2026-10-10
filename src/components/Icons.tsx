import type { ReactNode } from 'react'

/**
 * The mockup's icon set, drawn inline — no icon dependency, nothing to load.
 * All icons are 24px-grid strokes that inherit `currentColor`.
 */

interface IconProps {
  size?: number
}

function Svg({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function PinIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 21s-6.2-5.3-6.2-10A6.2 6.2 0 0 1 12 4.8 6.2 6.2 0 0 1 18.2 11c0 4.7-6.2 10-6.2 10z" />
      <circle cx="12" cy="10.8" r="2.2" />
    </Svg>
  )
}

export function CardIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.6" />
      <path d="M3 10h18" />
      <path d="M15.5 14.5h2.5" />
    </Svg>
  )
}

export function ClockIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.6V12l3.1 1.9" />
    </Svg>
  )
}

export function RouteIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="6" cy="5.5" r="2.3" />
      <circle cx="18" cy="18.5" r="2.3" />
      <path d="M8.3 5.5H15a3.2 3.2 0 0 1 0 6.4H9a3.2 3.2 0 0 0 0 6.4h6.3" />
    </Svg>
  )
}

export function UsersIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="9.2" cy="8.2" r="3.1" />
      <path d="M3.8 19.2a5.4 5.4 0 0 1 10.8 0" />
      <path d="M15.6 5.6a3.1 3.1 0 0 1 0 5.3" />
      <path d="M17.4 13.9a5.4 5.4 0 0 1 2.8 4.7" />
    </Svg>
  )
}

export function BookIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 6.2C10.4 4.9 8.2 4.2 4 4.2v13.9c4.2 0 6.4.7 8 2 1.6-1.3 3.8-2 8-2V4.2c-4.2 0-6.4.7-8 2z" />
      <path d="M12 6.2v13.9" />
    </Svg>
  )
}

export function FastForwardIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 6.4 12.6 12 5 17.6z" />
      <path d="M13 6.4 20.6 12 13 17.6z" />
    </Svg>
  )
}

export function LinkIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M10.2 13.8a4.4 4.4 0 0 0 6.2.4l2.9-2.9a4.4 4.4 0 0 0-6.2-6.2l-1.5 1.5" />
      <path d="M13.8 10.2a4.4 4.4 0 0 0-6.2-.4l-2.9 2.9a4.4 4.4 0 0 0 6.2 6.2l1.5-1.5" />
    </Svg>
  )
}

export function ResetIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3.6 10.2A8.6 8.6 0 1 1 5 17.4" />
      <path d="M3.4 4.8v5.4h5.4" />
    </Svg>
  )
}

export function ChevronRightIcon({ size = 14 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M9.2 5.8 15.4 12l-6.2 6.2" />
    </Svg>
  )
}

export function WarnIcon({ size = 12 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 4 2.8 20h18.4z" />
      <path d="M12 10v4.2" />
      <path d="M12 17.2v.1" />
    </Svg>
  )
}

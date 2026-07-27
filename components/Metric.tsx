import type { ReactNode } from 'react'

export const TONES = {
  green:  { bg: '#ecfdf5', color: '#059669' },
  blue:   { bg: '#eff6ff', color: '#2563eb' },
  amber:  { bg: '#fffbeb', color: '#d97706' },
  red:    { bg: '#fef2f2', color: '#dc2626' },
  violet: { bg: '#f5f3ff', color: '#7c3aed' },
  slate:  { bg: '#f1f5f9', color: '#475569' },
  teal:   { bg: '#f0fdfa', color: '#0d9488' },
} as const

export type Tone = keyof typeof TONES

export function MetricCard({
  label, value, unit, sub, icon, tone = 'slate',
  valueColor, labelColor, cardBg, cardBorder, iconBg, iconColor,
}: {
  label: string
  value: ReactNode
  unit?: string
  sub?: string
  icon: ReactNode
  tone?: Tone
  /** Overrides for emphasis states (e.g. a profit card tinted green/red). */
  valueColor?: string
  labelColor?: string
  cardBg?: string
  cardBorder?: string
  iconBg?: string
  iconColor?: string
}) {
  const t = TONES[tone]
  return (
    <div className="metric-card" style={{
      ...(cardBg ? { background: cardBg } : null),
      ...(cardBorder ? { borderColor: cardBorder } : null),
    }}>
      <div style={{ minWidth: 0 }}>
        <div className="metric-label" style={labelColor ? { color: labelColor } : undefined}>{label}</div>
        <div className="metric-value" style={valueColor ? { color: valueColor } : undefined}>
          {value}
          {unit && <span className="metric-unit" style={{ marginInlineStart: 5 }}>{unit}</span>}
        </div>
        {sub && <div className="metric-sub" style={labelColor ? { color: labelColor } : undefined}>{sub}</div>}
      </div>
      <div className="metric-icon" style={{ background: iconBg ?? t.bg, color: iconColor ?? t.color }}>{icon}</div>
    </div>
  )
}

const svg = (children: ReactNode, size = 21) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)

export const Icons = {
  box:      svg(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>),
  wallet:   svg(<><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></>),
  alert:    svg(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  ban:      svg(<><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>),
  cart:     svg(<><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>),
  receipt:  svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>),
  tag:      svg(<><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>),
  truck:    svg(<><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>),
  layers:   svg(<><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>),
  users:    svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  shield:   svg(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>),
  clock:    svg(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  trendUp:  svg(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>),
  trendDown:svg(<><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>),
  percent:  svg(<><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>),
  factory:  svg(<><path d="M2 20h20"/><path d="M4 20V9l5 3V9l5 3V9l5 3v8"/><path d="M4 9V6l3-2v3"/></>),
  chef:     svg(<><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6z"/><line x1="6" y1="17" x2="18" y2="17"/></>),
  calendar: svg(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  info:     svg(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>),
  bell:     svg(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>),
  check:    svg(<><polyline points="20 6 9 17 4 12"/></>),
  sparkle:  svg(<><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z"/><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></>),
}

const iconSm = (children: ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)

export const EditIcon = () => iconSm(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></>)
export const TrashIcon = () => iconSm(<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>)

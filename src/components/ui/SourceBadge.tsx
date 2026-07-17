const KINDS = {
  real: {
    icon: '✓',
    label: 'Real match data',
    tooltip: 'From the public 2026 World Cup match records: result, goal minutes, lineups, possession and shot counts.',
    className: 'border-mexico/40 bg-mexico/10 text-mexico',
  },
  estimated: {
    icon: '≈',
    label: 'Estimated rating',
    tooltip:
      'Editorial estimate written for this app (no FC 26 match found for this player). Not an official stat; every number is inspectable.',
    className: 'border-card-yellow/40 bg-card-yellow/10 text-card-yellow',
  },
  fc26: {
    icon: '◆',
    label: 'FC 26 rating',
    tooltip:
      'EA SPORTS FC 26 attributes via an unofficial community dataset (Kaggle). A video game’s editorial view of ability — not official match statistics.',
    className: 'border-england/40 bg-england/10 text-england',
  },
} as const

export type SourceKind = keyof typeof KINDS

/**
 * Small provenance pill: real facts vs editorial estimates. Never lets an
 * estimate pass as official data.
 */
export function SourceBadge({ kind, short = false }: { kind: SourceKind; short?: boolean }) {
  const spec = KINDS[kind]
  return (
    <span
      title={spec.tooltip}
      className={`inline-flex cursor-help items-center gap-1 rounded-md border px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-widest ${spec.className}`}
    >
      <span aria-hidden="true">{spec.icon}</span>
      {short ? null : spec.label}
      <span className="sr-only">{spec.tooltip}</span>
    </span>
  )
}

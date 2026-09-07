import type { LucideIcon } from 'lucide-react'

type MetricCardProps = {
  label: string
  value: string
  detail: string

  tone:
    | 'teal'
    | 'red'
    | 'blue'
    | 'purple'

  icon: LucideIcon
}

/*
  Ce composant évite de recopier quatre fois
  la même structure pour les KPI.
*/
function MetricCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <span
        className={`metric-icon metric-icon-${tone}`}
      >
        <Icon aria-hidden="true" />
      </span>

      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  )
}

export default MetricCard
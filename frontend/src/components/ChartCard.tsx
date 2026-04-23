import { C } from "../theme"

interface Props {
  title: string; subtitle?: string
  fullWidth?: boolean; children: React.ReactNode
}

export default function ChartCard({ title, subtitle, fullWidth, children }: Props) {
  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: 20,
      border: `0.5px solid ${C.border}`,
      gridColumn: fullWidth ? "1 / -1" : undefined
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}
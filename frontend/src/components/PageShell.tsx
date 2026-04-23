import { C } from "../theme"

interface Props {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}

export default function PageShell({ title, subtitle, action, children }: Props) {
  return (
    <div style={{ padding: "28px 32px", animation: "fadeIn 0.25s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, marginBottom: 4, color: C.text }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  )
}
interface Props {
  label:    string
  value:    string | number
  unit?:    string
  color?:   string
  loading?: boolean
}

export default function MetricCard({ label, value, unit, color = "#378ADD", loading }: Props) {
  return (
    <div style={{
      background:    "var(--color-background-secondary, #f5f5f3)",
      borderRadius:  "8px",
      padding:       "1rem",
      minWidth:      "140px",
    }}>
      <p style={{
        fontSize:    "13px",
        color:       "var(--color-text-secondary, #888)",
        margin:      "0 0 6px",
        fontWeight:  400,
      }}>
        {label}
      </p>

      {loading ? (
        <div style={{
          height:        "28px",
          background:    "rgba(128,128,128,0.12)",
          borderRadius:  "4px",
          animation:     "pulse 1.5s ease-in-out infinite",
        }} />
      ) : (
        <p style={{
          fontSize:   "24px",
          fontWeight: 500,
          margin:     0,
          color:      color,
        }}>
          {typeof value === "number" ? value.toLocaleString() : value}
          {unit && (
            <span style={{ fontSize: "14px", marginLeft: "4px", color: "var(--color-text-secondary, #888)" }}>
              {unit}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
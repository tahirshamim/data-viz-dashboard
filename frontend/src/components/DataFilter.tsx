import { C } from "../theme"

interface Props {
  countries?:    string[]
  symbols?:      string[]
  selectedCat:   string
  onCatChange:   (v: string) => void
  startDate:     string
  onStartDate:   (v: string) => void
  endDate:       string
  onEndDate:     (v: string) => void
  limit:         number
  onLimit:       (v: number) => void
  catLabel?:     string
}

const LIMITS = [
  { label: "Top 50",    value: 50   },
  { label: "Top 100",   value: 100  },
  { label: "Top 500",   value: 500  },
  { label: "Top 1000",  value: 1000 },
  { label: "Top 2000",  value: 2000 },
  { label: "All",       value: 5000 },
]

export default function DataFilter({
  countries, symbols, selectedCat, onCatChange,
  startDate, onStartDate, endDate, onEndDate,
  limit, onLimit, catLabel = "Country"
}: Props) {

  const options = countries || symbols || []

  function resetAll() {
    onCatChange("")
    onStartDate("")
    onEndDate("")
    onLimit(200)
  }

  const hasFilter = selectedCat || startDate || endDate || limit !== 200

  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: "16px 20px",
      border: `0.5px solid ${C.border}`, marginBottom: 24,
      display: "flex", flexWrap: "wrap" as const, gap: 16, alignItems: "flex-end"
    }}>

      {/* category filter */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
          {catLabel}
        </div>
        <select
          value={selectedCat}
          onChange={e => onCatChange(e.target.value)}
          style={{
            padding: "7px 12px", borderRadius: 8,
            border: `0.5px solid ${selectedCat ? C.blue : C.border}`,
            background: C.surface, color: C.text, fontSize: 13,
            minWidth: 140
          }}
        >
          <option value="">All {catLabel}s</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* date range */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
          Start date
        </div>
        <input
          type="date"
          value={startDate}
          onChange={e => onStartDate(e.target.value)}
          style={{
            padding: "7px 12px", borderRadius: 8,
            border: `0.5px solid ${startDate ? C.blue : C.border}`,
            background: C.surface, color: C.text, fontSize: 13,
          }}
        />
      </div>

      <div>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
          End date
        </div>
        <input
          type="date"
          value={endDate}
          onChange={e => onEndDate(e.target.value)}
          style={{
            padding: "7px 12px", borderRadius: 8,
            border: `0.5px solid ${endDate ? C.blue : C.border}`,
            background: C.surface, color: C.text, fontSize: 13,
          }}
        />
      </div>

      {/* limit selector */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
          Entries
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {LIMITS.map(l => (
            <button
              key={l.value}
              onClick={() => onLimit(l.value)}
              style={{
                padding: "7px 12px", borderRadius: 8, fontSize: 12,
                border: `0.5px solid ${limit === l.value ? C.teal : C.border}`,
                background: limit === l.value ? C.teal + "18" : "transparent",
                color: limit === l.value ? C.teal : C.muted,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s"
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* reset */}
      {hasFilter && (
        <button
          onClick={resetAll}
          style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 12,
            border: `0.5px solid ${C.coral}44`,
            background: C.coral + "12", color: C.coral,
            cursor: "pointer", fontFamily: "inherit",
            alignSelf: "flex-end" as const
          }}
        >
          Reset filters
        </button>
      )}

    </div>
  )
}
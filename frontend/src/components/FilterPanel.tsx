import { useFilterStore } from "../store/useFilterStore"

export default function FilterPanel() {
  const { country, startDate, endDate, dataset, setCountry, setStartDate, setEndDate, setDataset, resetFilters } =
    useFilterStore()

  return (
    <div style={{
      display:        "flex",
      flexWrap:       "wrap",
      gap:            "12px",
      alignItems:     "center",
      padding:        "12px 0",
      borderBottom:   "0.5px solid rgba(128,128,128,0.2)",
      marginBottom:   "16px",
    }}>

      {/* Dataset selector */}
      <select
        value={dataset}
        onChange={(e) => setDataset(e.target.value as any)}
        style={{ minWidth: "120px" }}
      >
        <option value="climate">Climate</option>
        <option value="covid">COVID-19</option>
        <option value="finance">Finance</option>
      </select>

      {/* Country filter */}
      <input
        type="text"
        placeholder="Country..."
        value={country || ""}
        onChange={(e) => setCountry(e.target.value || null)}
        style={{ width: "140px" }}
      />

      {/* Date range */}
      <input
        type="date"
        value={startDate || ""}
        onChange={(e) => setStartDate(e.target.value || null)}
      />
      <span style={{ color: "var(--color-text-secondary, #888)", fontSize: "13px" }}>to</span>
      <input
        type="date"
        value={endDate || ""}
        onChange={(e) => setEndDate(e.target.value || null)}
      />

      {/* Reset */}
      <button
        onClick={resetFilters}
        style={{ marginLeft: "auto" }}
      >
        Reset filters
      </button>
    </div>
  )
}
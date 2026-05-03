import { useState, useCallback } from "react"
import * as d3 from "d3"
import PageShell      from "../components/PageShell"
import ChartCard      from "../components/ChartCard"
import StatCard       from "../components/StatCard"
import LineChart      from "../charts/LineChart"
import BarChart       from "../charts/BarChart"
import ScatterPlot    from "../charts/ScatterPlot"
import PieChart       from "../charts/PieChart"
import HistogramChart from "../charts/HistogramChart"
import { C, CHART_COLORS } from "../theme"

type ChartType = "bar" | "line" | "scatter" | "pie" | "histogram" | "bar-horizontal"

// ── parsers ────────────────────────────────────────────────────────────────
function parseCSV(text: string): { columns: string[]; rows: any[] } {
  const lines   = text.trim().split(/\r?\n/)
  const columns = lines[0].split(",").map(c => c.trim().replace(/^"|"$/g, ""))
  const rows    = lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""))
    const obj: any = {}
    columns.forEach((col, i) => {
      const num = parseFloat(vals[i])
      obj[col]  = isNaN(num) ? vals[i] : num
    })
    return obj
  }).filter(r => Object.values(r).some(v => v !== "" && v !== undefined))
  return { columns, rows }
}

async function parseExcel(buffer: ArrayBuffer): Promise<{ columns: string[]; rows: any[] }> {
  const XLSX    = await import("xlsx")
  const wb      = XLSX.read(buffer, { type: "array" })
  const ws      = wb.Sheets[wb.SheetNames[0]]
  const data    = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[]
  const columns = data.length > 0 ? Object.keys(data[0]) : []
  return { columns, rows: data }
}

// ── stats helpers ──────────────────────────────────────────────────────────
function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(2)
}

function mode(vals: number[]): number {
  const freq: Record<number, number> = {}
  vals.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
  return +Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
}

function stddev(vals: number[]): number {
  const m   = d3.mean(vals) || 0
  const sq  = vals.map(v => (v - m) ** 2)
  return +Math.sqrt(d3.mean(sq) || 0).toFixed(2)
}

function variance(vals: number[]): number {
  const m  = d3.mean(vals) || 0
  const sq = vals.map(v => (v - m) ** 2)
  return +(d3.mean(sq) || 0).toFixed(2)
}

function q1(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b)
  return s[Math.floor(s.length * 0.25)]
}

function q3(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b)
  return s[Math.floor(s.length * 0.75)]
}

// ── NumericStats panel ─────────────────────────────────────────────────────
function NumericStats({ col, vals }: { col: string; vals: number[] }) {
  const stats = [
    { label: "Count",    value: vals.length.toLocaleString() },
    { label: "Mean",     value: (d3.mean(vals) || 0).toFixed(3) },
    { label: "Median",   value: median(vals).toFixed(3) },
    { label: "Mode",     value: mode(vals).toFixed(3) },
    { label: "Std dev",  value: stddev(vals).toFixed(3) },
    { label: "Variance", value: variance(vals).toFixed(3) },
    { label: "Min",      value: (d3.min(vals) || 0).toFixed(3) },
    { label: "Max",      value: (d3.max(vals) || 0).toFixed(3) },
    { label: "Q1",       value: q1(vals).toFixed(3) },
    { label: "Q3",       value: q3(vals).toFixed(3) },
    { label: "IQR",      value: (q3(vals) - q1(vals)).toFixed(3) },
    { label: "Sum",      value: (d3.sum(vals) || 0).toLocaleString() },
  ]

  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: 20,
      border: `0.5px solid ${C.border}`, marginBottom: 16
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{col}</span>
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 4,
          background: C.teal + "18", color: C.teal,
          border: `0.5px solid ${C.teal}33`
        }}>numeric</span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: 10
      }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: C.surface, borderRadius: 8, padding: "10px 12px",
            border: `0.5px solid ${C.border}`
          }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.teal, fontVariantNumeric: "tabular-nums" }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CategoricalStats panel ─────────────────────────────────────────────────
function CategoricalStats({ col, vals }: { col: string; vals: string[] }) {
  const counts   = d3.rollup(vals, v => v.length, d => d)
  const sorted   = Array.from(counts, ([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)
  const total    = vals.length
  const unique   = sorted.length
  const topVal   = sorted[0]
  const missing  = vals.filter(v => v === "" || v === null || v === undefined).length

  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: 20,
      border: `0.5px solid ${C.border}`, marginBottom: 16
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.purple }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{col}</span>
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 4,
          background: C.purple + "18", color: C.purple,
          border: `0.5px solid ${C.purple}33`
        }}>categorical</span>
      </div>

      {/* summary row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: 10, marginBottom: 16
      }}>
        {[
          { label: "Total count",   value: total.toLocaleString(),  color: C.blue   },
          { label: "Unique values", value: unique.toLocaleString(),  color: C.purple },
          { label: "Most common",   value: topVal?.k || "—",        color: C.amber  },
          { label: "Top frequency", value: topVal?.v.toLocaleString() || "—", color: C.amber },
          { label: "Top %",         value: topVal ? `${((topVal.v / total) * 100).toFixed(1)}%` : "—", color: C.teal },
          { label: "Missing",       value: missing.toLocaleString(), color: missing > 0 ? C.coral : C.muted },
        ].map(s => (
          <div key={s.label} style={{
            background: C.surface, borderRadius: 8, padding: "10px 12px",
            border: `0.5px solid ${C.border}`
          }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* value frequency table */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
        Value distribution (top 10)
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
        {sorted.slice(0, 10).map(({ k, v }) => {
          const pct = (v / total) * 100
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 100, fontSize: 11, color: C.text, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                {k || "(empty)"}
              </div>
              <div style={{ flex: 1, background: C.surface, borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: C.purple, borderRadius: 4 }} />
              </div>
              <div style={{ width: 40, fontSize: 11, color: C.muted, textAlign: "right" as const }}>
                {v}
              </div>
              <div style={{ width: 40, fontSize: 11, color: C.dim, textAlign: "right" as const }}>
                {pct.toFixed(1)}%
              </div>
            </div>
          )
        })}
        {sorted.length > 10 && (
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
            +{sorted.length - 10} more unique values
          </div>
        )}
      </div>
    </div>
  )
}

// ── chart options ──────────────────────────────────────────────────────────
const CHART_OPTIONS: { key: ChartType; label: string; needs: string }[] = [
  { key: "bar",            label: "Bar chart",       needs: "x + y (numeric)" },
  { key: "bar-horizontal", label: "Horizontal bar",  needs: "x + y (numeric)" },
  { key: "line",           label: "Line chart",      needs: "x (date/num) + y" },
  { key: "scatter",        label: "Scatter plot",    needs: "x + y (both numeric)" },
  { key: "pie",            label: "Pie / donut",     needs: "label + value" },
  { key: "histogram",      label: "Histogram",       needs: "one numeric column" },
]

const ROW_OPTIONS = [10, 20, 50, 100, 200, 500]

// ── main component ─────────────────────────────────────────────────────────
export default function CustomPage() {
  const [columns,    setColumns]    = useState<string[]>([])
  const [rows,       setRows]       = useState<any[]>([])
  const [fileName,   setFileName]   = useState("")
  const [dragging,   setDragging]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")
  const [previewRows, setPreviewRows] = useState(20)
  const [activeTab,  setActiveTab]  = useState<"stats" | "chart" | "table">("stats")

  // chart config
  const [chartType,  setChartType]  = useState<ChartType>("bar")
  const [xCol,       setXCol]       = useState("")
  const [yCol,       setYCol]       = useState("")
  const [groupCol,   setGroupCol]   = useState("")
  const [showChart,  setShowChart]  = useState(false)

  const numericCols     = columns.filter(c =>
    rows.slice(0, 20).some(r => typeof r[c] === "number" && !isNaN(r[c]))
  )
  const categoricalCols = columns.filter(c => !numericCols.includes(c))

  async function loadFile(file: File) {
    setLoading(true); setError(""); setShowChart(false)
    try {
      let cols: string[], data: any[]
      if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
        const parsed = parseCSV(await file.text())
        cols = parsed.columns; data = parsed.rows
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const parsed = await parseExcel(await file.arrayBuffer())
        cols = parsed.columns; data = parsed.rows
      } else {
        setError("Please upload a .csv, .xlsx, or .xls file")
        setLoading(false)
        return
      }
      setColumns(cols); setRows(data); setFileName(file.name)
      setXCol(cols[0] || ""); setYCol(cols[1] || "")
      setActiveTab("stats")
    } catch (e: any) {
      setError("Failed to parse file: " + e.message)
    }
    setLoading(false)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }, [])

  function renderChart() {
    if (!rows.length || !xCol) return null

    if (chartType === "histogram") {
      const values = rows.map(r => +r[xCol]).filter(v => !isNaN(v))
      return <HistogramChart values={values} color={CHART_COLORS[0]} xLabel={xCol} height={320} />
    }
    if (chartType === "pie") {
      if (yCol && numericCols.includes(yCol)) {
        const grouped = d3.rollup(rows, v => d3.sum(v, r => +r[yCol]), r => String(r[xCol]))
        const data    = Array.from(grouped, ([key, value]) => ({ key, value: Math.round(value) }))
          .sort((a, b) => b.value - a.value).slice(0, 12)
        return <PieChart data={data} height={340} />
      }
      const counts = d3.rollup(rows, v => v.length, r => String(r[xCol]))
      const data   = Array.from(counts, ([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value).slice(0, 12)
      return <PieChart data={data} height={340} />
    }
    if (chartType === "scatter") {
      if (!yCol || !numericCols.includes(xCol) || !numericCols.includes(yCol))
        return <div style={{ color: C.muted, padding: 20, fontSize: 13 }}>Select two numeric columns</div>
      return <ScatterPlot data={rows} xKey={xCol} yKey={yCol} groupKey={groupCol || undefined} xLabel={xCol} yLabel={yCol} height={340} />
    }
    if (chartType === "line") {
      if (!yCol) return null
      return <LineChart data={rows} xKey={xCol} yKey={yCol} color={CHART_COLORS[0]} yLabel={yCol} height={320} />
    }
    if (yCol && numericCols.includes(yCol)) {
      const grouped = d3.rollup(rows, v => +(d3.mean(v, r => +r[yCol])!.toFixed(2)), r => String(r[xCol]))
      const entries = Array.from(grouped, ([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value).slice(0, 20)
      return <BarChart entries={entries} multiColor yLabel={yCol} height={320} horizontal={chartType === "bar-horizontal"} />
    }
    const counts  = d3.rollup(rows, v => v.length, r => String(r[xCol]))
    const entries = Array.from(counts, ([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value).slice(0, 20)
    return <BarChart entries={entries} multiColor yLabel="Count" height={320} horizontal={chartType === "bar-horizontal"} />
  }

  const tabs = [
    { key: "stats", label: `Statistics` },
    { key: "chart", label: "Chart builder" },
    { key: "table", label: "Data table" },
  ] as const

  return (
    <PageShell
      title="Custom dataset explorer"
      subtitle="Upload any CSV or Excel file — statistics, charts and data preview"
    >
      {/* ── drop zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById("file-input")?.click()}
        style={{
          border: `2px dashed ${dragging ? C.purple : C.border}`,
          borderRadius: 16, padding: "40px 32px", textAlign: "center",
          background: dragging ? C.purple + "08" : C.card,
          transition: "all 0.2s", marginBottom: 24, cursor: "pointer",
        }}
      >
        <input id="file-input" type="file" accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }}
        />
        {loading ? (
          <div style={{ color: C.muted, fontSize: 14 }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${C.purple}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            Parsing file...
          </div>
        ) : fileName ? (
          <div>
            <div style={{ fontSize: 28, marginBottom: 8, color: C.teal }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{fileName}</div>
            <div style={{ fontSize: 13, color: C.muted }}>
              {rows.length.toLocaleString()} rows · {columns.length} columns
              · {numericCols.length} numeric · {categoricalCols.length} categorical
              — click to replace
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 10, color: C.purple }}>⊕</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              Drop your CSV or Excel file here
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>
              Supports .csv, .xlsx, .xls · numeric + categorical columns
            </div>
          </div>
        )}
        {error && <div style={{ marginTop: 10, color: C.coral, fontSize: 13 }}>{error}</div>}
      </div>

      {rows.length > 0 && (
        <>
          {/* ── overview stat cards ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))",
            gap: 12, marginBottom: 24
          }}>
            <StatCard label="Total rows"    value={rows.length.toLocaleString()} color={C.blue} />
            <StatCard label="Total columns" value={columns.length}               color={C.purple} />
            <StatCard label="Numeric cols"  value={numericCols.length}           color={C.teal} />
            <StatCard label="Category cols" value={categoricalCols.length}       color={C.amber} />
          </div>

          {/* ── tabs ── */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{
                  padding: "9px 18px", borderRadius: 8, fontSize: 13, fontFamily: "inherit",
                  border: `0.5px solid ${activeTab === t.key ? C.blue : C.border}`,
                  background: activeTab === t.key ? C.blue + "18" : "transparent",
                  color: activeTab === t.key ? C.blue : C.muted,
                  cursor: "pointer", transition: "all 0.15s", fontWeight: activeTab === t.key ? 500 : 400
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ══ STATS TAB ══ */}
          {activeTab === "stats" && (
            <div>
              {/* numeric columns */}
              {numericCols.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                    Numeric columns — {numericCols.length}
                  </div>
                  {numericCols.map(col => {
                    const vals = rows.map(r => +r[col]).filter(v => !isNaN(v))
                    return <NumericStats key={col} col={col} vals={vals} />
                  })}
                </div>
              )}

              {/* categorical columns */}
              {categoricalCols.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                    Categorical columns — {categoricalCols.length}
                  </div>
                  {categoricalCols.map(col => {
                    const vals = rows.map(r => String(r[col] ?? ""))
                    return <CategoricalStats key={col} col={col} vals={vals} />
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ CHART TAB ══ */}
          {activeTab === "chart" && (
            <div>
              <div style={{ background: C.card, borderRadius: 12, padding: 24, border: `0.5px solid ${C.border}`, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 20 }}>
                  Build a chart
                </div>

                {/* chart type */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 10 }}>
                    Chart type
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                    {CHART_OPTIONS.map(opt => (
                      <button key={opt.key} onClick={() => { setChartType(opt.key); setShowChart(false) }}
                        style={{
                          padding: "8px 14px", borderRadius: 8,
                          border: `0.5px solid ${chartType === opt.key ? C.purple : C.border}`,
                          background: chartType === opt.key ? C.purple + "18" : "transparent",
                          color: chartType === opt.key ? C.purple : C.muted,
                          fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s"
                        }}>
                        {opt.label}
                        <span style={{ display: "block", fontSize: 9, color: C.dim, marginTop: 2 }}>{opt.needs}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* column selectors */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>
                      {chartType === "histogram" ? "Numeric column" : chartType === "pie" ? "Label column" : "X axis / Category"}
                    </div>
                    <select value={xCol} onChange={e => setXCol(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}>
                      {(chartType === "histogram" ? numericCols : columns).map(c => (
                        <option key={c} value={c}>
                          {numericCols.includes(c) ? "123" : "Abc"} {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {chartType !== "histogram" && (
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>
                        {chartType === "pie" ? "Value column (optional)" : "Y axis / Value"}
                      </div>
                      <select value={yCol} onChange={e => setYCol(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}>
                        <option value="">— count rows —</option>
                        {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  {(chartType === "scatter" || chartType === "bar") && (
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>
                        Group / colour by (optional)
                      </div>
                      <select value={groupCol} onChange={e => setGroupCol(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13 }}>
                        <option value="">— none —</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <button onClick={() => setShowChart(true)} style={{
                  padding: "10px 28px", borderRadius: 8, border: "none",
                  background: C.purple, color: "#fff", fontSize: 13,
                  fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
                }}>
                  Generate chart
                </button>
              </div>

              {showChart && (
                <div style={{ animation: "fadeIn 0.3s ease" }}>
                  <ChartCard
                    title={`${CHART_OPTIONS.find(o => o.key === chartType)?.label} — ${xCol}${yCol ? ` vs ${yCol}` : ""}`}
                    subtitle={`${rows.length.toLocaleString()} rows from ${fileName}`}
                    fullWidth
                  >
                    {renderChart()}
                  </ChartCard>
                </div>
              )}
            </div>
          )}

          {/* ══ TABLE TAB ══ */}
          {activeTab === "table" && (
            <div>
              {/* row count selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: C.muted }}>Show rows:</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {ROW_OPTIONS.map(n => (
                    <button key={n} onClick={() => setPreviewRows(n)}
                      style={{
                        padding: "6px 12px", borderRadius: 8, fontSize: 12,
                        border: `0.5px solid ${previewRows === n ? C.teal : C.border}`,
                        background: previewRows === n ? C.teal + "18" : "transparent",
                        color: previewRows === n ? C.teal : C.muted,
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s"
                      }}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setPreviewRows(rows.length)}
                    style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 12,
                      border: `0.5px solid ${previewRows === rows.length ? C.teal : C.border}`,
                      background: previewRows === rows.length ? C.teal + "18" : "transparent",
                      color: previewRows === rows.length ? C.teal : C.muted,
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s"
                    }}>
                    All ({rows.length.toLocaleString()})
                  </button>
                </div>
                <span style={{ fontSize: 12, color: C.dim, marginLeft: "auto" }}>
                  Showing {Math.min(previewRows, rows.length).toLocaleString()} of {rows.length.toLocaleString()} rows
                </span>
              </div>

              {/* table */}
              <div style={{ background: C.card, borderRadius: 12, border: `0.5px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", color: C.dim, fontWeight: 500, background: C.card, width: 40 }}>
                          #
                        </th>
                        {columns.map(c => (
                          <th key={c} style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontWeight: 500, whiteSpace: "nowrap", background: C.card }}>
                            {c}
                            <span style={{ marginLeft: 5, fontSize: 9, color: numericCols.includes(c) ? C.teal : C.purple }}>
                              {numericCols.includes(c) ? "123" : "abc"}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, previewRows).map((row, i) => (
                        <tr key={i} style={{
                          borderBottom: `0.5px solid ${C.border}`,
                          background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"
                        }}>
                          <td style={{ padding: "8px 14px", color: C.dim, fontSize: 11 }}>{i + 1}</td>
                          {columns.map(c => (
                            <td key={c} style={{
                              padding: "8px 14px",
                              color: typeof row[c] === "number" ? C.teal : C.text,
                              whiteSpace: "nowrap",
                              fontVariantNumeric: "tabular-nums"
                            }}>
                              {String(row[c] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  )
}
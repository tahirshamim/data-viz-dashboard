import { useState, useCallback } from "react"
import * as d3 from "d3"
import PageShell       from "../components/PageShell"
import ChartCard       from "../components/ChartCard"
import StatCard        from "../components/StatCard"
import LineChart       from "../charts/LineChart"
import BarChart        from "../charts/BarChart"
import ScatterPlot     from "../charts/ScatterPlot"
import PieChart        from "../charts/PieChart"
import HistogramChart  from "../charts/HistogramChart"
import { C, CHART_COLORS } from "../theme"

type ChartType = "bar" | "line" | "scatter" | "pie" | "histogram" | "bar-horizontal"

function parseCSV(text: string): { columns: string[]; rows: any[] } {
  const lines  = text.trim().split(/\r?\n/)
  const columns = lines[0].split(",").map(c => c.trim().replace(/^"|"$/g, ""))
  const rows   = lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""))
    const obj: any = {}
    columns.forEach((col, i) => {
      const num = parseFloat(vals[i])
      obj[col] = isNaN(num) ? vals[i] : num
    })
    return obj
  }).filter(r => Object.values(r).some(v => v !== "" && v !== undefined))
  return { columns, rows }
}

async function parseExcel(buffer: ArrayBuffer): Promise<{ columns: string[]; rows: any[] }> {
  // dynamic import — only loads if user uploads xlsx
  const XLSX = await import("xlsx")
  const wb   = XLSX.read(buffer, { type: "array" })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[]
  const columns = data.length > 0 ? Object.keys(data[0]) : []
  return { columns, rows: data }
}

const CHART_OPTIONS: { key: ChartType; label: string; needs: string }[] = [
  { key: "bar",            label: "Bar chart",            needs: "x + y (numeric)" },
  { key: "bar-horizontal", label: "Horizontal bar",       needs: "x + y (numeric)" },
  { key: "line",           label: "Line chart",           needs: "x (date/num) + y" },
  { key: "scatter",        label: "Scatter plot",         needs: "x + y (both numeric)" },
  { key: "pie",            label: "Pie / donut",          needs: "label + value" },
  { key: "histogram",      label: "Histogram",            needs: "one numeric column" },
]

export default function CustomPage() {
  const [columns, setColumns] = useState<string[]>([])
  const [rows,    setRows]    = useState<any[]>([])
  const [fileName, setFileName] = useState("")
  const [dragging, setDragging] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  // chart config
  const [chartType, setChartType] = useState<ChartType>("bar")
  const [xCol,      setXCol]      = useState("")
  const [yCol,      setYCol]      = useState("")
  const [groupCol,  setGroupCol]  = useState("")
  const [showChart, setShowChart] = useState(false)

  const numericCols = columns.filter(c => rows.slice(0, 20).some(r => typeof r[c] === "number" && !isNaN(r[c])))
  const allCols     = columns

  async function loadFile(file: File) {
    setLoading(true); setError(""); setShowChart(false)
    try {
      if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
        const text = await file.text()
        const { columns: cols, rows: data } = parseCSV(text)
        setColumns(cols); setRows(data); setFileName(file.name)
        setXCol(cols[0] || ""); setYCol(cols[1] || "")
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const buf = await file.arrayBuffer()
        const { columns: cols, rows: data } = await parseExcel(buf)
        setColumns(cols); setRows(data); setFileName(file.name)
        setXCol(cols[0] || ""); setYCol(cols[1] || "")
      } else {
        setError("Please upload a .csv, .xlsx, or .xls file")
      }
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

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  // build chart data
  function renderChart() {
    if (!rows.length || !xCol) return null

    if (chartType === "histogram") {
      const values = rows.map(r => +r[xCol]).filter(v => !isNaN(v))
      return <HistogramChart values={values} color={CHART_COLORS[0]} xLabel={xCol} height={320} />
    }

    if (chartType === "pie") {
      const grouped = d3.rollup(rows, v => v.length, r => String(r[xCol]))
      const data = Array.from(grouped, ([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value).slice(0, 12)
      if (yCol && numericCols.includes(yCol)) {
        const grouped2 = d3.rollup(rows, v => d3.sum(v, r => +r[yCol]), r => String(r[xCol]))
        const data2 = Array.from(grouped2, ([key, value]) => ({ key, value: Math.round(value) }))
          .sort((a, b) => b.value - a.value).slice(0, 12)
        return <PieChart data={data2} height={340} />
      }
      return <PieChart data={data} height={340} />
    }

    if (chartType === "scatter") {
      if (!yCol || !numericCols.includes(xCol) || !numericCols.includes(yCol)) {
        return <div style={{ color: C.muted, padding: 20, fontSize: 13 }}>Select two numeric columns for scatter plot</div>
      }
      return <ScatterPlot data={rows} xKey={xCol} yKey={yCol} groupKey={groupCol || undefined} xLabel={xCol} yLabel={yCol} height={340} />
    }

    if (chartType === "line") {
      if (!yCol) return null
      return <LineChart data={rows} xKey={xCol} yKey={yCol} color={CHART_COLORS[0]} yLabel={yCol} height={320} />
    }

    // bar / bar-horizontal
    if (yCol && numericCols.includes(yCol)) {
      const grouped = d3.rollup(rows, v => +d3.mean(v, r => +r[yCol])!.toFixed(2), r => String(r[xCol]))
      const entries = Array.from(grouped, ([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value).slice(0, 20)
      return <BarChart entries={entries} multiColor yLabel={yCol} height={320} horizontal={chartType === "bar-horizontal"} />
    }

    const counts = d3.rollup(rows, v => v.length, r => String(r[xCol]))
    const entries = Array.from(counts, ([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value).slice(0, 20)
    return <BarChart entries={entries} multiColor yLabel="Count" height={320} horizontal={chartType === "bar-horizontal"} />
  }

  // summary stats for numeric columns
  const numStats = numericCols.slice(0, 4).map(col => {
    const vals = rows.map(r => +r[col]).filter(v => !isNaN(v))
    return {
      col,
      mean: vals.length ? +(d3.mean(vals)!.toFixed(2)) : 0,
      min:  vals.length ? d3.min(vals)! : 0,
      max:  vals.length ? d3.max(vals)! : 0,
    }
  })

  return (
    <PageShell title="Custom dataset explorer" subtitle="Upload any CSV or Excel file and visualize it instantly">

      {/* drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? C.purple : C.border}`,
          borderRadius: 16, padding: "48px 32px", textAlign: "center",
          background: dragging ? "rgba(155,138,251,0.05)" : C.card,
          transition: "all 0.2s", marginBottom: 24, cursor: "pointer",
          position: "relative"
        }}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input id="file-input" type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={onFileInput} />

        {loading ? (
          <div style={{ color: C.muted, fontSize: 14 }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${C.purple}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            Parsing file...
          </div>
        ) : fileName ? (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{fileName}</div>
            <div style={{ fontSize: 13, color: C.muted }}>{rows.length.toLocaleString()} rows · {columns.length} columns — click to replace</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 40, marginBottom: 12, color: C.purple }}>⊕</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>Drop your CSV or Excel file here</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Supports .csv, .xlsx, .xls — any size</div>
            <div style={{ fontSize: 12, color: C.dim }}>Click to browse files</div>
          </div>
        )}
        {error && <div style={{ marginTop: 12, color: C.coral, fontSize: 13 }}>{error}</div>}
      </div>

      {/* only show rest if data loaded */}
      {rows.length > 0 && (
        <>
          {/* data summary stats */}
          {numStats.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 14, marginBottom: 24 }}>
              {numStats.map(s => (
                <StatCard key={s.col} label={s.col} value={s.mean.toLocaleString()} color={C.blue}
                  unit={`↕ ${s.min} – ${s.max}`} />
              ))}
              <StatCard label="Total rows"    value={rows.length.toLocaleString()} color={C.purple} />
              <StatCard label="Total columns" value={columns.length} color={C.teal} />
            </div>
          )}

          {/* chart builder */}
          <div style={{ background: C.card, borderRadius: 12, padding: 24, border: `0.5px solid ${C.border}`, marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 20 }}>Build a chart</div>

            {/* chart type picker */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 10 }}>Chart type</div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                {CHART_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => setChartType(opt.key)}
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: `0.5px solid ${chartType === opt.key ? C.purple : C.border}`,
                      background: chartType === opt.key ? "rgba(155,138,251,0.15)" : "transparent",
                      color: chartType === opt.key ? C.purple : C.muted,
                      fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s"
                    }}>
                    {opt.label}
                    <span style={{ display: "block", fontSize: 10, color: C.dim, marginTop: 2 }}>{opt.needs}</span>
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
                  {(chartType === "histogram" ? numericCols : allCols).map(c => <option key={c} value={c}>{c}</option>)}
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
                    {allCols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>

            <button onClick={() => setShowChart(true)}
              style={{
                padding: "10px 28px", borderRadius: 8, border: "none",
                background: C.purple, color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s"
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
              Generate chart
            </button>
          </div>

          {/* rendered chart */}
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

          {/* data preview table */}
          <div style={{ marginTop: 16, background: C.card, borderRadius: 12, border: `0.5px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `0.5px solid ${C.border}`, fontSize: 13, fontWeight: 500, color: C.muted }}>
              Data preview — first 20 rows of {rows.length.toLocaleString()}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
                    {columns.map(c => (
                      <th key={c} style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontWeight: 500, whiteSpace: "nowrap", background: C.card2 }}>
                        {c}
                        {numericCols.includes(c) && <span style={{ marginLeft: 6, fontSize: 10, color: C.purple }}>123</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} style={{ borderBottom: `0.5px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      {columns.map(c => (
                        <td key={c} style={{ padding: "8px 14px", color: typeof row[c] === "number" ? C.teal : C.text, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                          {String(row[c] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </PageShell>
  )
}
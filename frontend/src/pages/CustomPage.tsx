import { useState, useCallback } from "react"
import * as d3 from "d3"
import PageShell      from "../components/PageShell"
import ChartCard      from "../components/ChartCard"
import StatCard       from "../components/StatCard"
import BarChart       from "../charts/BarChart"
import ScatterPlot    from "../charts/ScatterPlot"
import PieChart       from "../charts/PieChart"
import HistogramChart from "../charts/HistogramChart"
import LineChart      from "../charts/LineChart"
import { C, CHART_COLORS } from "../theme"

type ChartType = "bar" | "bar-horizontal" | "line" | "scatter" | "pie" | "histogram" | "grouped-bar" | "heatmap"

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
  const XLSX = await import("xlsx")
  const wb   = XLSX.read(buffer, { type: "array" })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[]
  const columns = data.length > 0 ? Object.keys(data[0]) : []
  return { columns, rows: data }
}

const CHART_OPTIONS: { key: ChartType; label: string; needs: string; catOk: boolean }[] = [
  { key: "bar",           label: "Bar chart",         needs: "category + value",      catOk: true  },
  { key: "bar-horizontal",label: "Horizontal bar",     needs: "category + value",      catOk: true  },
  { key: "pie",           label: "Pie / donut",        needs: "category column",        catOk: true  },
  { key: "grouped-bar",   label: "Grouped bar",        needs: "category + 2 values",   catOk: true  },
  { key: "line",          label: "Line chart",         needs: "x (date/num) + y",      catOk: false },
  { key: "scatter",       label: "Scatter plot",       needs: "2 numeric columns",     catOk: false },
  { key: "histogram",     label: "Histogram",          needs: "one numeric column",    catOk: false },
  { key: "heatmap",       label: "Heatmap",            needs: "row + col + value",     catOk: true  },
]

// ── Grouped Bar Chart ──────────────────────────────────────────────────────
function GroupedBarChart({ data, catCol, valCols }: {
  data: any[]; catCol: string; valCols: string[]
}) {
  const ref = require("react").useRef<SVGSVGElement>(null)
  require("react").useEffect(() => {
    if (!ref.current || data.length === 0) return
    const m = { top: 16, right: 20, bottom: 64, left: 56 }
    const W = ref.current.clientWidth - m.left - m.right
    const H = 300 - m.top - m.bottom
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g").attr("transform", `translate(${m.left},${m.top})`)

    const cats    = [...new Set(data.map(d => String(d[catCol])))]
    const x0      = d3.scaleBand().domain(cats).range([0, W]).paddingInner(0.2)
    const x1      = d3.scaleBand().domain(valCols).range([0, x0.bandwidth()]).padding(0.05)
    const allVals = data.flatMap(d => valCols.map(v => +d[v] || 0))
    const y       = d3.scaleLinear().domain([0, d3.max(allVals)! * 1.1]).range([H, 0])
    const colour  = d3.scaleOrdinal(CHART_COLORS).domain(valCols)

    svg.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(x0))
      .call(g => { g.select(".domain").style("stroke", C.border); g.selectAll("text").style("fill", C.muted).style("font-size", "11px").attr("transform", "rotate(-25)").style("text-anchor", "end"); g.selectAll(".tick line").remove() })
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(-W))
      .call(g => { g.select(".domain").remove(); g.selectAll("line").style("stroke", "rgba(255,255,255,0.05)"); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })

    // aggregate by category
    const agg = cats.map(cat => {
      const rows = data.filter(d => String(d[catCol]) === cat)
      const obj: any = { cat }
      valCols.forEach(v => { obj[v] = d3.mean(rows, r => +r[v] || 0) ?? 0 })
      return obj
    })

    agg.forEach(d => {
      const g = svg.append("g").attr("transform", `translate(${x0(d.cat)},0)`)
      valCols.forEach(v => {
        g.append("rect")
          .attr("x", x1(v)!).attr("y", y(d[v]))
          .attr("width", x1.bandwidth()).attr("height", H - y(d[v]))
          .attr("rx", 3).attr("fill", colour(v)).attr("fill-opacity", 0.85)
      })
    })

    // legend
    const lg = svg.append("g").attr("transform", `translate(0, ${H + 46})`)
    valCols.forEach((v, i) => {
      lg.append("rect").attr("x", i * 120).attr("y", 0).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", colour(v))
      lg.append("text").attr("x", i * 120 + 14).attr("y", 9).style("fill", C.muted).style("font-size", "11px").text(v)
    })
  }, [data, catCol, valCols])
  return <svg ref={ref} style={{ width: "100%", height: 300, display: "block" }} />
}

// ── Heatmap ────────────────────────────────────────────────────────────────
function HeatmapChart({ data, rowCol, colCol, valCol }: {
  data: any[]; rowCol: string; colCol: string; valCol: string
}) {
  const ref = require("react").useRef<SVGSVGElement>(null)
  require("react").useEffect(() => {
    if (!ref.current || data.length === 0) return
    const rows = [...new Set(data.map(d => String(d[rowCol])))]
    const cols = [...new Set(data.map(d => String(d[colCol])))]
    const cellW = Math.min(60, Math.floor((ref.current.clientWidth - 80) / cols.length))
    const cellH = Math.min(40, Math.floor(280 / rows.length))
    const W = cols.length * cellW
    const H = rows.length * cellH
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g").attr("transform", "translate(80,20)")

    const vals = data.map(d => +d[valCol] || 0)
    const colour = d3.scaleSequential(d3.interpolateRgb("#1a1d27", "#2dd4a0"))
      .domain([d3.min(vals)!, d3.max(vals)!])

    // lookup map
    const lookup: Record<string, number> = {}
    data.forEach(d => { lookup[`${d[rowCol]}__${d[colCol]}`] = +d[valCol] || 0 })

    // cells
    rows.forEach((r, ri) => {
      cols.forEach((c, ci) => {
        const v = lookup[`${r}__${c}`] ?? 0
        svg.append("rect")
          .attr("x", ci * cellW).attr("y", ri * cellH)
          .attr("width", cellW - 2).attr("height", cellH - 2)
          .attr("rx", 3).attr("fill", colour(v))
        if (cellW > 30) {
          svg.append("text")
            .attr("x", ci * cellW + cellW / 2).attr("y", ri * cellH + cellH / 2)
            .attr("text-anchor", "middle").attr("dominant-baseline", "central")
            .style("fill", "#fff").style("font-size", "9px").text(v.toFixed(1))
        }
      })
    })

    // row labels
    rows.forEach((r, ri) => {
      svg.append("text").attr("x", -6).attr("y", ri * cellH + cellH / 2)
        .attr("text-anchor", "end").attr("dominant-baseline", "central")
        .style("fill", C.muted).style("font-size", "10px").text(r.length > 10 ? r.slice(0, 10) + "…" : r)
    })

    // col labels
    cols.forEach((c, ci) => {
      svg.append("text").attr("x", ci * cellW + cellW / 2).attr("y", -6)
        .attr("text-anchor", "middle").style("fill", C.muted).style("font-size", "10px")
        .text(c.length > 8 ? c.slice(0, 8) + "…" : c)
    })
  }, [data, rowCol, colCol, valCol])

  return (
    <svg ref={ref}
      style={{ width: "100%", height: Math.max(200, [...new Set(data.map(d => d[rowCol]))].length * 40 + 60), display: "block" }}
    />
  )
}

// ── Category summary cards ─────────────────────────────────────────────────
function CatSummary({ col, rows }: { col: string; rows: any[] }) {
  const counts = d3.rollup(rows, v => v.length, r => String(r[col]))
  const sorted = Array.from(counts, ([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)
  const top    = sorted[0]
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "16px 18px", border: `0.5px solid ${C.border}` }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>
        {col}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: C.purple, marginBottom: 4 }}>
        {sorted.length} <span style={{ fontSize: 12, color: C.muted }}>unique values</span>
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>
        Most common: <span style={{ color: C.text }}>{top?.k}</span>
        <span style={{ color: C.dim }}> ({top?.v} rows)</span>
      </div>
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
        {sorted.slice(0, 6).map(({ k, v }) => (
          <span key={k} style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 20,
            background: C.purple + "18", color: C.purple,
            border: `0.5px solid ${C.purple}33`
          }}>
            {k} ({v})
          </span>
        ))}
        {sorted.length > 6 && (
          <span style={{ fontSize: 10, color: C.dim }}>+{sorted.length - 6} more</span>
        )}
      </div>
    </div>
  )
}

// ── Main CustomPage ────────────────────────────────────────────────────────
export default function CustomPage() {
  const { useRef, useEffect, useState, useCallback } = require("react")

  const [columns,   setColumns]   = useState<string[]>([])
  const [rows,      setRows]      = useState<any[]>([])
  const [fileName,  setFileName]  = useState("")
  const [dragging,  setDragging]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [chartType, setChartType] = useState<ChartType>("bar")
  const [xCol,      setXCol]      = useState("")
  const [yCol,      setYCol]      = useState("")
  const [y2Col,     setY2Col]     = useState("")
  const [groupCol,  setGroupCol]  = useState("")
  const [showChart, setShowChart] = useState(false)

  // column type detection
  const numericCols     = columns.filter(c => rows.slice(0, 20).some(r => typeof r[c] === "number" && !isNaN(r[c])))
  const categoricalCols = columns.filter(c => {
    const vals    = rows.slice(0, 50).map(r => r[c])
    const unique  = new Set(vals).size
    const hasStr  = vals.some(v => typeof v === "string" && v !== "")
    return hasStr || (unique <= 30 && unique < rows.length * 0.5)
  })
  const dateCols = columns.filter(c => {
    const sample = rows.slice(0, 5).map(r => String(r[c]))
    return sample.some(v => !isNaN(Date.parse(v)))
  })
  const allCols = columns

  function getColType(col: string): "numeric" | "categorical" | "date" {
    if (dateCols.includes(col))     return "date"
    if (numericCols.includes(col))  return "numeric"
    return "categorical"
  }

  async function loadFile(file: File) {
    setLoading(true); setError(""); setShowChart(false)
    try {
      let parsed: { columns: string[]; rows: any[] }
      if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
        parsed = parseCSV(await file.text())
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        parsed = await parseExcel(await file.arrayBuffer())
      } else {
        setError("Please upload a .csv, .xlsx, or .xls file")
        setLoading(false)
        return
      }
      setColumns(parsed.columns)
      setRows(parsed.rows)
      setFileName(file.name)
      setXCol(parsed.columns[0] || "")
      setYCol(parsed.columns[1] || "")
      setY2Col(parsed.columns[2] || "")
    } catch (e: any) {
      setError("Failed to parse: " + e.message)
    }
    setLoading(false)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }, [])

  // ── render chart ──────────────────────────────────────────────────────
  function renderChart() {
    if (!rows.length || !xCol) return null

    if (chartType === "histogram") {
      const values = rows.map(r => +r[xCol]).filter(v => !isNaN(v))
      return <HistogramChart values={values} color={CHART_COLORS[0]} xLabel={xCol} height={320} />
    }

    if (chartType === "scatter") {
      if (!yCol || !numericCols.includes(xCol) || !numericCols.includes(yCol))
        return <Hint>Select two numeric columns for scatter plot</Hint>
      return <ScatterPlot data={rows} xKey={xCol} yKey={yCol} groupKey={groupCol || undefined} xLabel={xCol} yLabel={yCol} height={340} />
    }

    if (chartType === "line") {
      if (!yCol) return null
      return <LineChart data={rows} xKey={xCol} yKey={yCol} color={CHART_COLORS[0]} yLabel={yCol} height={320} />
    }

    if (chartType === "grouped-bar") {
      const valCols = [yCol, y2Col].filter(Boolean)
      if (valCols.length < 2) return <Hint>Select two value columns for grouped bar</Hint>
      return <GroupedBarChart data={rows} catCol={xCol} valCols={valCols} />
    }

    if (chartType === "heatmap") {
      if (!yCol || !groupCol) return <Hint>Select row column, column column, and value column</Hint>
      return <HeatmapChart data={rows} rowCol={xCol} colCol={yCol} valCol={groupCol} />
    }

    if (chartType === "pie") {
      // use category counts or sum of numeric col
      if (yCol && numericCols.includes(yCol)) {
        const grouped = d3.rollup(rows, v => d3.sum(v, r => +r[yCol] || 0), r => String(r[xCol]))
        const pieData = Array.from(grouped, ([key, value]) => ({ key, value: Math.round(value) }))
          .sort((a, b) => b.value - a.value).slice(0, 12)
        return <PieChart data={pieData} height={340} />
      }
      const counts  = d3.rollup(rows, v => v.length, r => String(r[xCol]))
      const pieData = Array.from(counts, ([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value).slice(0, 12)
      return <PieChart data={pieData} height={340} />
    }

    // bar / bar-horizontal — works with both numeric and categorical Y
    if (yCol && numericCols.includes(yCol)) {
      // numeric Y → aggregate mean per category
      const grouped = d3.rollup(rows, v => +(d3.mean(v, r => +r[yCol])!.toFixed(2)), r => String(r[xCol]))
      const entries = Array.from(grouped, ([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value).slice(0, 20)
      return <BarChart entries={entries} multiColor yLabel={yCol} height={320} horizontal={chartType === "bar-horizontal"} />
    }

    // no numeric Y → count rows per category
    const counts  = d3.rollup(rows, v => v.length, r => String(r[xCol]))
    const entries = Array.from(counts, ([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value).slice(0, 20)
    return <BarChart entries={entries} multiColor yLabel="Count" height={320} horizontal={chartType === "bar-horizontal"} />
  }

  // ── stats ──────────────────────────────────────────────────────────────
  const numStats = numericCols.slice(0, 3).map(col => {
    const vals = rows.map(r => +r[col]).filter(v => !isNaN(v))
    return { col, mean: +(d3.mean(vals)!.toFixed(2)), min: d3.min(vals)!, max: d3.max(vals)! }
  })

  return (
    <PageShell title="Custom dataset explorer" subtitle="Upload any CSV or Excel file — supports numeric and categorical data">

      {/* drop zone */}
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
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{fileName}</div>
            <div style={{ fontSize: 13, color: C.muted }}>{rows.length.toLocaleString()} rows · {columns.length} columns — click to replace</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 10, color: C.purple }}>⊕</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>Drop your CSV or Excel file here</div>
            <div style={{ fontSize: 13, color: C.muted }}>Supports numeric, categorical, and date columns</div>
          </div>
        )}
        {error && <div style={{ marginTop: 10, color: C.coral, fontSize: 13 }}>{error}</div>}
      </div>

      {rows.length > 0 && (
        <>
          {/* column type badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {columns.map(col => {
              const type  = getColType(col)
              const color = type === "numeric" ? C.teal : type === "date" ? C.amber : C.purple
              const label = type === "numeric" ? "123" : type === "date" ? "📅" : "Abc"
              return (
                <span key={col} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 20,
                  background: color + "15", color,
                  border: `0.5px solid ${color}33`
                }}>
                  {label} {col}
                </span>
              )
            })}
          </div>

          {/* stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
            {numStats.map(s => (
              <StatCard key={s.col} label={s.col} value={s.mean} color={C.teal}
                unit={`↕ ${s.min} – ${s.max}`} />
            ))}
            {categoricalCols.slice(0, 2).map(col => (
              <CatSummary key={col} col={col} rows={rows} />
            ))}
            <StatCard label="Total rows"    value={rows.length.toLocaleString()} color={C.purple} />
            <StatCard label="Total columns" value={columns.length}               color={C.blue}   />
          </div>

          {/* chart builder */}
          <div style={{ background: C.card, borderRadius: 12, padding: 24, border: `0.5px solid ${C.border}`, marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 20 }}>Build a chart</div>

            {/* chart type picker */}
            <div style={{ marginBottom: 20 }}>
              <Label>Chart type</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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

              {/* X / category column */}
              <div>
                <Label>
                  {chartType === "histogram"   ? "Numeric column" :
                   chartType === "heatmap"     ? "Row column" :
                   chartType === "scatter"     ? "X axis (numeric)" :
                   "X axis / Category"}
                </Label>
                <ColSelect
                  value={xCol}
                  onChange={setXCol}
                  options={chartType === "histogram" || chartType === "scatter" ? numericCols : allCols}
                  getType={getColType}
                />
              </div>

              {/* Y column */}
              {chartType !== "histogram" && (
                <div>
                  <Label>
                    {chartType === "heatmap"  ? "Column column" :
                     chartType === "scatter"  ? "Y axis (numeric)" :
                     chartType === "pie"      ? "Value (optional — counts if empty)" :
                     "Y axis / Value"}
                  </Label>
                  <ColSelect
                    value={yCol}
                    onChange={setYCol}
                    options={chartType === "scatter" || chartType === "heatmap" ? numericCols : allCols}
                    getType={getColType}
                    placeholder={chartType === "pie" ? "— count rows —" : undefined}
                  />
                </div>
              )}

              {/* Y2 for grouped bar */}
              {chartType === "grouped-bar" && (
                <div>
                  <Label>Second value column</Label>
                  <ColSelect value={y2Col} onChange={setY2Col} options={numericCols} getType={getColType} />
                </div>
              )}

              {/* group / color by */}
              {(chartType === "scatter" || chartType === "bar") && (
                <div>
                  <Label>Group / colour by (optional)</Label>
                  <ColSelect
                    value={groupCol} onChange={setGroupCol}
                    options={allCols} getType={getColType}
                    placeholder="— none —"
                  />
                </div>
              )}

              {/* heatmap value col */}
              {chartType === "heatmap" && (
                <div>
                  <Label>Value column (numeric)</Label>
                  <ColSelect value={groupCol} onChange={setGroupCol} options={numericCols} getType={getColType} />
                </div>
              )}
            </div>

            <button onClick={() => setShowChart(true)} style={{
              padding: "10px 28px", borderRadius: 8, border: "none",
              background: C.purple, color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit"
            }}>
              Generate chart
            </button>
          </div>

          {/* chart output */}
          {showChart && (
            <div style={{ animation: "fadeIn 0.3s ease", marginBottom: 24 }}>
              <ChartCard
                title={`${CHART_OPTIONS.find(o => o.key === chartType)?.label} — ${xCol}${yCol ? ` vs ${yCol}` : ""}`}
                subtitle={`${rows.length.toLocaleString()} rows from ${fileName}`}
                fullWidth
              >
                {renderChart()}
              </ChartCard>
            </div>
          )}

          {/* data preview */}
          <div style={{ background: C.card, borderRadius: 12, border: `0.5px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `0.5px solid ${C.border}`, fontSize: 13, fontWeight: 500, color: C.muted }}>
              Data preview — first 20 rows of {rows.length.toLocaleString()}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
                    {columns.map(c => {
                      const type  = getColType(c)
                      const color = type === "numeric" ? C.teal : type === "date" ? C.amber : C.purple
                      return (
                        <th key={c} style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontWeight: 500, whiteSpace: "nowrap", background: C.card }}>
                          {c}
                          <span style={{ marginLeft: 5, fontSize: 9, color, opacity: 0.8 }}>
                            {type === "numeric" ? "123" : type === "date" ? "date" : "abc"}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} style={{ borderBottom: `0.5px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      {columns.map(c => {
                        const type  = getColType(c)
                        const color = type === "numeric" ? C.teal : type === "date" ? C.amber : C.text
                        return (
                          <td key={c} style={{ padding: "8px 14px", color, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                            {String(row[c] ?? "—")}
                          </td>
                        )
                      })}
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

// ── small helpers ──────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: "#7a7d94", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#7a7d94", padding: 20, fontSize: 13 }}>{children}</div>
}

function ColSelect({ value, onChange, options, getType, placeholder }: {
  value: string; onChange: (v: string) => void
  options: string[]; getType: (c: string) => string; placeholder?: string
}) {
  const C_colors: any = { numeric: "#2dd4a0", date: "#f5a623", categorical: "#9b8afb" }
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      width: "100%", padding: "8px 12px", borderRadius: 8,
      border: "0.5px solid rgba(255,255,255,0.07)",
      background: "#1a1d27", color: "#e2e2ec", fontSize: 13
    }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(c => (
        <option key={c} value={c}>
          {getType(c) === "numeric" ? "123" : getType(c) === "date" ? "📅" : "Abc"} {c}
        </option>
      ))}
    </select>
  )
}
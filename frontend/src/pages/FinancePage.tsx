import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import PageShell  from "../components/PageShell"
import StatCard   from "../components/StatCard"
import ChartCard  from "../components/ChartCard"
import DataFilter from "../components/DataFilter"
import LineChart  from "../charts/LineChart"
import BarChart   from "../charts/BarChart"
import { C, CHART_COLORS } from "../theme"
import { get } from "../lib/api"

function CandlestickChart({ data }: { data: any[] }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const recent = [...data].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)).slice(-60)
    const m = { top: 12, right: 16, bottom: 36, left: 64 }
    const W = ref.current.clientWidth - m.left - m.right
    const H = 280 - m.top - m.bottom
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g").attr("transform", `translate(${m.left},${m.top})`)
    const x = d3.scaleBand().domain(recent.map((_, i) => String(i))).range([0, W]).padding(0.2)
    const y = d3.scaleLinear().domain([d3.min(recent, d => d.low)! * 0.99, d3.max(recent, d => d.high)! * 1.01]).range([H, 0])
    svg.append("g").attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 10 === 0)).tickFormat(i => d3.timeFormat("%b %d")(new Date(recent[+i].timestamp))))
      .call(g => { g.select(".domain").style("stroke", C.border); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })
    svg.append("g").call(d3.axisLeft(y).ticks(6).tickSize(-W))
      .call(g => { g.select(".domain").remove(); g.selectAll("line").style("stroke", "rgba(255,255,255,0.05)"); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })
    recent.forEach((d, i) => {
      const up = d.close >= d.open, col = up ? C.teal : C.coral
      const cx = x(String(i))! + x.bandwidth() / 2
      svg.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(d.high)).attr("y2", y(d.low)).style("stroke", col).style("stroke-width", 1)
      svg.append("rect").attr("x", x(String(i))!).attr("y", y(Math.max(d.open, d.close))).attr("width", x.bandwidth())
        .attr("height", Math.max(1, Math.abs(y(d.open) - y(d.close)))).attr("rx", 2).attr("fill", col).attr("fill-opacity", 0.85)
    })
  }, [data])
  return <svg ref={ref} style={{ width: "100%", height: 280, display: "block" }} />
}

function MultiLine({ data, symbols }: { data: any[]; symbols: string[] }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const m = { top: 12, right: 100, bottom: 36, left: 60 }
    const W = ref.current.clientWidth - m.left - m.right
    const H = 300 - m.top - m.bottom
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g").attr("transform", `translate(${m.left},${m.top})`)
    const x = d3.scaleTime().domain(d3.extent(data, d => new Date(d.timestamp)) as [Date, Date]).range([0, W])
    const y = d3.scaleLinear().domain([d3.min(data, d => d.low)! * 0.95, d3.max(data, d => d.high)! * 1.05]).range([H, 0])
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(-W)).call(g => { g.select(".domain").remove(); g.selectAll("line").style("stroke", "rgba(255,255,255,0.05)"); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })
    svg.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(x).ticks(8).tickFormat(d3.timeFormat("%b %Y") as any)).call(g => { g.select(".domain").style("stroke", C.border); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })
    symbols.forEach((sym, i) => {
      const sd = data.filter(d => d.symbol === sym).sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
      if (!sd.length) return
      const col = CHART_COLORS[i % CHART_COLORS.length]
      svg.append("path").datum(sd).attr("fill", "none").attr("stroke", col).attr("stroke-width", 1.5)
        .attr("d", d3.line<any>().x(d => x(new Date(d.timestamp))).y(d => y(d.close)).curve(d3.curveMonotoneX))
      const last = sd[sd.length - 1]
      svg.append("text").attr("x", x(new Date(last.timestamp)) + 6).attr("y", y(last.close)).attr("dominant-baseline", "central")
        .style("fill", col).style("font-size", "11px").style("font-weight", 500).text(sym)
    })
  }, [data, symbols])
  return <svg ref={ref} style={{ width: "100%", height: 300, display: "block" }} />
}

export default function FinancePage() {
  const [data,      setData]      = useState<any[]>([])
  const [summary,   setSummary]   = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [symbol,    setSymbol]    = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [limit,     setLimit]     = useState(200)

  useEffect(() => {
    get("/api/finance/summary").then(setSummary).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    p.set("limit", String(limit))
    if (symbol)    p.set("symbol",     symbol)
    if (startDate) p.set("start_date", startDate)
    if (endDate)   p.set("end_date",   endDate)
    get("/api/finance/prices?" + p.toString())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { console.error(e); setLoading(false) })
  }, [symbol, startDate, endDate, limit])

  const symbols    = [...new Set(data.map((r: any) => r.symbol))].sort()
  const volBySymbol = d3.rollup(data, v => d3.sum(v, (d: any) => d.volume), (d: any) => d.symbol)
  const volChart   = Array.from(volBySymbol, ([key, value]) => ({ key, value: Math.round(value / 1e6) })).sort((a, b) => b.value - a.value)
  const candleData = data.filter((d: any) => d.symbol === (symbol || "AAPL"))

  return (
    <PageShell
      title="Finance explorer"
      subtitle={`${summary?.symbols ?? "—"} stocks · ${data.length.toLocaleString()} records shown`}
    >
      <DataFilter
        symbols={symbols}
        selectedCat={symbol}
        onCatChange={setSymbol}
        startDate={startDate}
        onStartDate={setStartDate}
        endDate={endDate}
        onEndDate={setEndDate}
        limit={limit}
        onLimit={setLimit}
        catLabel="Symbol"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard label="Showing"      value={data.length.toLocaleString()} color={C.blue} />
        <StatCard label="Symbols"      value={summary?.symbols ?? 0}        color={C.purple} />
        <StatCard label="Avg close"    value={`$${(summary?.avg_close ?? 0).toFixed(2)}`} color={C.amber} />
        <StatCard label="Total volume" value={((summary?.total_volume ?? 0) / 1e9).toFixed(1)} unit="B" color={C.teal} />
      </div>

      {loading ? (
        <div style={{ height: 300, background: "#21253a", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#f5a623", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontSize: 13, color: "#7a7d94" }}>Loading data...</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <ChartCard title="All stocks — close price" subtitle="Select symbol to filter" fullWidth>
            <MultiLine data={data} symbols={symbols} />
          </ChartCard>
          <ChartCard title={`${symbol || "AAPL"} — candlestick`} subtitle="Last 60 entries · green up · red down">
            <CandlestickChart data={candleData} />
          </ChartCard>
          <ChartCard title="Volume by symbol" subtitle="Total shares (millions)">
            <BarChart entries={volChart} color={C.purple} multiColor yLabel="Volume (M)" />
          </ChartCard>
          <ChartCard title="Close price trend">
            <LineChart data={data} xKey="timestamp" yKey="close" color={C.amber} yLabel="USD" />
          </ChartCard>
        </div>
      )}
    </PageShell>
  )
}
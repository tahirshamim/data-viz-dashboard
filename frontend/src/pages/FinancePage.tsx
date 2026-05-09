import { useEffect, useRef, useState, useMemo } from "react"
import * as d3 from "d3"
import PageShell  from "../components/PageShell"
import StatCard   from "../components/StatCard"
import ChartCard  from "../components/ChartCard"
import LineChart  from "../charts/LineChart"
import BarChart   from "../charts/BarChart"
import { C, CHART_COLORS } from "../theme"
import { get } from "../lib/api"

// ── helpers ────────────────────────────────────────────────────────────────
function latestBySymbol(data: any[], symbol: string) {
  const filtered = data.filter(d => d.symbol === symbol)
  if (!filtered.length) return null
  return [...filtered].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0]
}

function avgOf(data: any[], key: string, days: number): number | null {
  if (!data.length) return null
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const filtered = data.filter(d => new Date(d.timestamp) >= cutoff)
  if (!filtered.length) return null
  return +(d3.mean(filtered, (d: any) => +d[key]) ?? 0).toFixed(2)
}

function trendArrow(current: number | null, prev: number | null) {
  if (current === null || prev === null) return { icon: "–", color: C.muted }
  if (current > prev * 1.005) return { icon: "▲", color: C.teal }
  if (current < prev * 0.995) return { icon: "▼", color: C.coral }
  return { icon: "→", color: C.amber }
}

function pctChange(current: number | null, prev: number | null): string {
  if (!current || !prev) return "—"
  const pct = ((current - prev) / prev) * 100
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
}

// ── LatestPriceCard ────────────────────────────────────────────────────────
function LatestPriceCard({ reading }: { reading: any }) {
  const ts = new Date(reading.timestamp)
  const timeStr = ts.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric"
  })
  const isUp = reading.close >= reading.open

  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: "18px 20px",
      border: `0.5px solid ${isUp ? C.teal : C.coral}44`,
      gridColumn: "1 / -1",
      display: "flex", flexWrap: "wrap" as const,
      gap: 24, alignItems: "center"
    }}>
      {/* symbol */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>
          Latest reading
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
          {reading.symbol}
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{timeStr}</div>
      </div>

      {/* close */}
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Close</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: isUp ? C.teal : C.coral, lineHeight: 1 }}>
          ${reading.close?.toFixed(2)}
        </div>
        <div style={{ fontSize: 11, color: isUp ? C.teal : C.coral, marginTop: 2 }}>
          {isUp ? "▲" : "▼"} {pctChange(reading.close, reading.open)} today
        </div>
      </div>

      {/* open */}
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Open</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: C.amber, lineHeight: 1 }}>
          ${reading.open?.toFixed(2)}
        </div>
      </div>

      {/* high */}
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>High</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: C.teal, lineHeight: 1 }}>
          ${reading.high?.toFixed(2)}
        </div>
      </div>

      {/* low */}
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Low</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: C.coral, lineHeight: 1 }}>
          ${reading.low?.toFixed(2)}
        </div>
      </div>

      {/* volume */}
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Volume</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: C.purple, lineHeight: 1 }}>
          {(reading.volume / 1e6).toFixed(1)}M
        </div>
      </div>

      {/* badge */}
      <div style={{ marginLeft: "auto" }}>
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: isUp ? C.teal : C.coral,
          padding: "6px 12px",
          background: (isUp ? C.teal : C.coral) + "15",
          borderRadius: 20,
          border: `0.5px solid ${(isUp ? C.teal : C.coral)}33`
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: isUp ? C.teal : C.coral,
            display: "inline-block"
          }} />
          {isUp ? "Bullish" : "Bearish"}
        </span>
      </div>
    </div>
  )
}

// ── AvgPriceCard ───────────────────────────────────────────────────────────
function AvgPriceCard({ label, avg, color, trend, change }: {
  label: string
  avg: number | null
  color: string
  trend?: { icon: string; color: string }
  change?: string
}) {
  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: "16px 18px",
      border: `0.5px solid ${color}33`
    }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 600, color }}>
          {avg !== null ? `$${avg}` : "—"}
        </span>
        {trend && (
          <span style={{ fontSize: 14, color: trend.color }}>{trend.icon}</span>
        )}
      </div>
      {change && (
        <div style={{ fontSize: 12, color: C.muted }}>
          vs prev: <span style={{
            color: change.startsWith("+") ? C.teal : change === "—" ? C.muted : C.coral,
            fontWeight: 500
          }}>{change}</span>
        </div>
      )}
    </div>
  )
}

// ── MinMaxCard ─────────────────────────────────────────────────────────────
function MinMaxCard({ data, days, label }: {
  data: any[]; days: number; label: string
}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const filtered = data.filter(d => new Date(d.timestamp) >= cutoff)

  const maxClose = filtered.length ? +(d3.max(filtered, (d: any) => +d.close) ?? 0).toFixed(2) : null
  const minClose = filtered.length ? +(d3.min(filtered, (d: any) => +d.close) ?? 0).toFixed(2) : null
  // const maxVol   = filtered.length ? d3.max(filtered, (d: any) => +d.volume) ?? 0 : null
  const avgVol   = filtered.length ? +(d3.mean(filtered, (d: any) => +d.volume) ?? 0 / 1e6).toFixed(1) : null

  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: "16px 18px",
      border: `0.5px solid ${C.border}`
    }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 10 }}>
        {label} — Price range
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>Close</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            <span style={{ color: C.coral }}>${minClose ?? "—"}</span>
            <span style={{ color: C.muted, margin: "0 4px" }}>/</span>
            <span style={{ color: C.teal }}>${maxClose ?? "—"}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>Avg volume</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.purple }}>
            {avgVol ? `${(+avgVol * 1e6 / 1e6).toFixed(1)}M` : "—"}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CandlestickChart ───────────────────────────────────────────────────────
function CandlestickChart({ data }: { data: any[] }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const recent = [...data].sort((a, b) =>
      +new Date(a.timestamp) - +new Date(b.timestamp)
    ).slice(-60)
    const m = { top: 12, right: 16, bottom: 36, left: 64 }
    const W = ref.current.clientWidth - m.left - m.right
    const H = 280 - m.top - m.bottom
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g")
      .attr("transform", `translate(${m.left},${m.top})`)
    const x = d3.scaleBand()
      .domain(recent.map((_, i) => String(i)))
      .range([0, W]).padding(0.2)
    const y = d3.scaleLinear()
      .domain([d3.min(recent, d => d.low)! * 0.99,
               d3.max(recent, d => d.high)! * 1.01])
      .range([H, 0])
    svg.append("g").attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(x)
        .tickValues(x.domain().filter((_, i) => i % 10 === 0))
        .tickFormat(i => d3.timeFormat("%b %d")(new Date(recent[+i].timestamp))))
      .call(g => {
        g.select(".domain").style("stroke", C.border)
        g.selectAll("text").style("fill", C.muted).style("font-size", "11px")
      })
    svg.append("g").call(d3.axisLeft(y).ticks(6).tickSize(-W))
      .call(g => {
        g.select(".domain").remove()
        g.selectAll("line").style("stroke", "rgba(255,255,255,0.05)")
        g.selectAll("text").style("fill", C.muted).style("font-size", "11px")
      })
    recent.forEach((d, i) => {
      const up  = d.close >= d.open
      const col = up ? C.teal : C.coral
      const cx  = x(String(i))! + x.bandwidth() / 2
      svg.append("line")
        .attr("x1", cx).attr("x2", cx)
        .attr("y1", y(d.high)).attr("y2", y(d.low))
        .style("stroke", col).style("stroke-width", 1)
      svg.append("rect")
        .attr("x", x(String(i))!)
        .attr("y", y(Math.max(d.open, d.close)))
        .attr("width", x.bandwidth())
        .attr("height", Math.max(1, Math.abs(y(d.open) - y(d.close))))
        .attr("rx", 2).attr("fill", col).attr("fill-opacity", 0.85)
    })
  }, [data])
  return <svg ref={ref} style={{ width: "100%", height: 280, display: "block" }} />
}

// ── MultiLine ──────────────────────────────────────────────────────────────
function MultiLine({ data, symbols }: { data: any[]; symbols: string[] }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const m = { top: 12, right: 100, bottom: 36, left: 60 }
    const W = ref.current.clientWidth - m.left - m.right
    const H = 300 - m.top - m.bottom
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g")
      .attr("transform", `translate(${m.left},${m.top})`)
    const x = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.timestamp)) as [Date, Date])
      .range([0, W])
    const y = d3.scaleLinear()
      .domain([d3.min(data, d => d.low)! * 0.95,
               d3.max(data, d => d.high)! * 1.05])
      .range([H, 0])
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(-W))
      .call(g => {
        g.select(".domain").remove()
        g.selectAll("line").style("stroke", "rgba(255,255,255,0.05)")
        g.selectAll("text").style("fill", C.muted).style("font-size", "11px")
      })
    svg.append("g").attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d3.timeFormat("%b %Y") as any))
      .call(g => {
        g.select(".domain").style("stroke", C.border)
        g.selectAll("text").style("fill", C.muted).style("font-size", "11px")
      })
    symbols.forEach((sym, i) => {
      const sd = data.filter(d => d.symbol === sym)
        .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
      if (!sd.length) return
      const col = CHART_COLORS[i % CHART_COLORS.length]
      svg.append("path").datum(sd)
        .attr("fill", "none").attr("stroke", col).attr("stroke-width", 1.5)
        .attr("d", d3.line<any>()
          .x(d => x(new Date(d.timestamp)))
          .y(d => y(d.close))
          .curve(d3.curveMonotoneX))
      const last = sd[sd.length - 1]
      svg.append("text")
        .attr("x", x(new Date(last.timestamp)) + 6)
        .attr("y", y(last.close))
        .attr("dominant-baseline", "central")
        .style("fill", col).style("font-size", "11px").style("font-weight", 500)
        .text(sym)
    })
  }, [data, symbols])
  return <svg ref={ref} style={{ width: "100%", height: 300, display: "block" }} />
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function FinancePage() {
  const [data,      setData]      = useState<any[]>([])
  const [summary,   setSummary]   = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [symbol,    setSymbol]    = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [limit,     setLimit]     = useState(500)

  const LIMITS = [50, 100, 200, 500, 1000, 2000]

  useEffect(() => {
    get("/api/finance/summary").then(setSummary).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    p.set("limit", "5000")  // high enough for all symbols × 90 days

    if (symbol)    p.set("symbol",     symbol)
    if (startDate) p.set("start_date", startDate)
    if (endDate)   p.set("end_date",   endDate)

    // if no date filter set — automatically fetch last 90 days
    if (!startDate && !endDate) {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      p.set("start_date", ninetyDaysAgo.toISOString().slice(0, 10))
    }

    get("/api/finance/prices?" + p.toString())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { console.error(e); setLoading(false) })
  }, [symbol, startDate, endDate, limit])

  const symbols    = [...new Set(data.map((r: any) => r.symbol))].sort()
  const activeSymbol = symbol || (symbols[0] ?? "AAPL")

  // ── computed stats ───────────────────────────────────────────────────
  const symbolData = useMemo(() =>
    data.filter(d => d.symbol === activeSymbol), [data, activeSymbol])

  const latest      = useMemo(() => latestBySymbol(data, activeSymbol), [data, activeSymbol])
  const avg7Close   = useMemo(() => avgOf(symbolData, "close", 7),  [symbolData])
  const avg30Close  = useMemo(() => avgOf(symbolData, "close", 30), [symbolData])
  const avg90Close  = useMemo(() => avgOf(symbolData, "close", 90), [symbolData])
  const trend7vs30  = trendArrow(avg7Close, avg30Close)
  const trend30vs90 = trendArrow(avg30Close, avg90Close)
  const change7     = pctChange(avg7Close, avg30Close)
  const change30    = pctChange(avg30Close, avg90Close)

  const volBySymbol = d3.rollup(
    data, v => d3.sum(v, (d: any) => d.volume), (d: any) => d.symbol
  )
  const volChart = Array.from(volBySymbol, ([key, value]) => ({
    key, value: Math.round(value / 1e6)
  })).sort((a, b) => b.value - a.value)

  const candleData = data.filter((d: any) => d.symbol === activeSymbol)

  const lastUpdated = latest
    ? new Date(latest.timestamp).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric"
      })
    : ""

  function resetFilters() {
    setSymbol(""); setStartDate(""); setEndDate(""); setLimit(500)
  }
  const hasFilter = symbol || startDate || endDate || limit !== 500

  return (
    <PageShell
      title="Finance explorer"
      subtitle={`${summary?.symbols ?? "—"} stocks · ${data.length.toLocaleString()} records`}
      action={lastUpdated ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.teal }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, display: "inline-block" }} />
          Last update: {lastUpdated}
        </div>
      ) : undefined}
    >

      {/* ── filter bar ── */}
      <div style={{
        background: C.card, borderRadius: 12, padding: "16px 20px",
        border: `0.5px solid ${C.border}`, marginBottom: 24,
        display: "flex", flexWrap: "wrap" as const, gap: 16, alignItems: "flex-end"
      }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
            Symbol
          </div>
          <select value={symbol} onChange={e => setSymbol(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, minWidth: 140, border: `0.5px solid ${symbol ? C.amber : C.border}`, background: C.surface, color: C.text, fontSize: 13 }}>
            <option value="">All symbols</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>Start date</div>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: `0.5px solid ${startDate ? C.blue : C.border}`, background: C.surface, color: C.text, fontSize: 13 }} />
        </div>

        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>End date</div>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: `0.5px solid ${endDate ? C.blue : C.border}`, background: C.surface, color: C.text, fontSize: 13 }} />
        </div>

        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>Entries</div>
          <div style={{ display: "flex", gap: 5 }}>
            {LIMITS.map(l => (
              <button key={l} onClick={() => setLimit(l)}
                style={{ padding: "7px 10px", borderRadius: 8, fontSize: 11, border: `0.5px solid ${limit === l ? C.amber : C.border}`, background: limit === l ? C.amber + "18" : "transparent", color: limit === l ? C.amber : C.muted, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                {l >= 1000 ? `${l / 1000}k` : l}
              </button>
            ))}
          </div>
        </div>

        {hasFilter && (
          <button onClick={resetFilters}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, border: `0.5px solid ${C.coral}44`, background: C.coral + "12", color: C.coral, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-end" as const }}>
            Reset
          </button>
        )}
      </div>

      {loading ? <Loader /> : data.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: C.card, borderRadius: 12, color: C.muted, border: `0.5px solid ${C.border}` }}>
          No data found — try resetting filters
        </div>
      ) : (
        <>
          {/* ── latest reading banner ── */}
          {latest && (
            <div style={{ marginBottom: 20 }}>
              <LatestPriceCard reading={latest} />
            </div>
          )}

          {/* ── average cards ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))",
            gap: 14, marginBottom: 24
          }}>
            <AvgPriceCard
              label="7-day avg close"
              avg={avg7Close}
              color={C.amber}
              trend={trend7vs30}
              change={change7}
            />
            <AvgPriceCard
              label="30-day avg close"
              avg={avg30Close}
              color={C.blue}
              trend={trend30vs90}
              change={change30}
            />
            <AvgPriceCard
              label="90-day avg close"
              avg={avg90Close}
              color={C.purple}
            />
            <MinMaxCard data={symbolData} days={7}  label="7 days" />
            <MinMaxCard data={symbolData} days={30} label="30 days" />
            <MinMaxCard data={symbolData} days={90} label="90 days" />
          </div>

          {/* ── summary stat cards ── */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)",
            gap: 14, marginBottom: 28
          }}>
            <StatCard label="Records shown" value={data.length.toLocaleString()} color={C.blue} />
            <StatCard label="Symbols"       value={summary?.symbols ?? 0}         color={C.purple} />
            <StatCard label="Avg close"     value={`$${(summary?.avg_close ?? 0).toFixed(2)}`} color={C.amber} />
            <StatCard label="Total volume"  value={`${((summary?.total_volume ?? 0) / 1e9).toFixed(1)}B`} color={C.teal} />
          </div>

          {/* ── charts ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ChartCard
              title="All stocks — close price"
              subtitle="Select symbol to highlight"
              fullWidth
            >
              <MultiLine data={data} symbols={symbols} />
            </ChartCard>
            <ChartCard
              title={`${activeSymbol} — candlestick`}
              subtitle="Last 60 days · green = up · red = down"
            >
              <CandlestickChart data={candleData} />
            </ChartCard>
            <ChartCard title="Volume by symbol" subtitle="Total shares traded (millions)">
              <BarChart entries={volChart} color={C.purple} multiColor yLabel="Volume (M)" />
            </ChartCard>
            <ChartCard title="Close price trend" subtitle="Selected symbol or all">
              <LineChart data={data} xKey="timestamp" yKey="close" color={C.amber} yLabel="USD" />
            </ChartCard>
          </div>
        </>
      )}
    </PageShell>
  )
}

function Loader() {
  return (
    <div style={{
      height: 300, background: C.card, borderRadius: 12,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 10,
      border: `0.5px solid ${C.border}`
    }}>
      <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.amber, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: C.muted }}>Loading stock data...</div>
    </div>
  )
}
import { useEffect, useState, useMemo } from "react"
import PageShell   from "../components/PageShell"
import StatCard    from "../components/StatCard"
import ChartCard   from "../components/ChartCard"
import LineChart   from "../charts/LineChart"
import BarChart    from "../charts/BarChart"
import ScatterPlot from "../charts/ScatterPlot"
import { C }       from "../theme"
import { get }     from "../lib/api"
import * as d3     from "d3"

// ── helpers ────────────────────────────────────────────────────────────────
function avgOf(data: any[], key: string, days: number): number | null {
  if (!data.length) return null
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const filtered = data.filter(d => new Date(d.timestamp) >= cutoff)
  if (!filtered.length) return null
  return +(d3.mean(filtered, (d: any) => +d[key]) ?? 0).toFixed(1)
}

function todayAvg(data: any[], key: string): number | null {
  if (!data.length) return null
  const today = new Date().toISOString().slice(0, 10)
  const filtered = data.filter(d => d.timestamp?.slice(0, 10) === today)
  if (!filtered.length) return null
  return +(d3.mean(filtered, (d: any) => +d[key]) ?? 0).toFixed(1)
}

function latestReading(data: any[]) {
  if (!data.length) return null
  return [...data].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0]
}

function trendArrow(current: number | null, prev: number | null) {
  if (current === null || prev === null) return { icon: "–", color: C.muted }
  if (current > prev + 0.5) return { icon: "▲", color: C.coral }
  if (current < prev - 0.5) return { icon: "▼", color: C.blue }
  return { icon: "→", color: C.teal }
}

// ── LatestCard ──────────────────────────────────────────────────────────────
function LatestCard({ reading }: { reading: any }) {
  const ts = new Date(reading.timestamp)
  const timeStr = ts.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  })

  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: "18px 20px",
      border: `0.5px solid ${C.teal}44`,
      gridColumn: "1 / -1",
      display: "flex", flexWrap: "wrap" as const, gap: 24, alignItems: "center"
    }}>
      {/* location */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>
          Latest reading
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>
          {reading.station}
          <span style={{ fontSize: 13, color: C.muted, marginLeft: 8 }}>
            {reading.country}
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{timeStr}</div>
      </div>

      {/* temp */}
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Temperature</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: C.coral, lineHeight: 1 }}>
          {reading.temp_c?.toFixed(1)}
          <span style={{ fontSize: 16, color: C.muted }}>°C</span>
        </div>
      </div>

      {/* humidity */}
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Humidity</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: C.blue, lineHeight: 1 }}>
          {reading.humidity?.toFixed(1)}
          <span style={{ fontSize: 16, color: C.muted }}>%</span>
        </div>
      </div>

      {/* co2 */}
      {reading.co2_ppm && (
        <div style={{ textAlign: "center" as const }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>CO₂</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.teal, lineHeight: 1 }}>
            {reading.co2_ppm?.toFixed(1)}
            <span style={{ fontSize: 16, color: C.muted }}>ppm</span>
          </div>
        </div>
      )}

      {/* live badge */}
      <div style={{ marginLeft: "auto" }}>
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: C.teal, padding: "6px 12px",
          background: C.teal + "15", borderRadius: 20,
          border: `0.5px solid ${C.teal}33`
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, display: "inline-block", animation: "pulse 2s infinite" }} />
          Live data
        </span>
      </div>
    </div>
  )
}

// ── AverageCard ─────────────────────────────────────────────────────────────
function AverageCard({ label, temp, humidity, color, trend }: {
  label: string
  temp: number | null
  humidity: number | null
  color: string
  trend?: { icon: string; color: string }
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
          {temp !== null ? temp : "—"}
        </span>
        <span style={{ fontSize: 13, color: C.muted }}>°C</span>
        {trend && (
          <span style={{ fontSize: 14, color: trend.color, marginLeft: 4 }}>
            {trend.icon}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: C.muted }}>
        Humidity: <span style={{ color: C.blue, fontWeight: 500 }}>
          {humidity !== null ? `${humidity}%` : "—"}
        </span>
      </div>
    </div>
  )
}

// ── MinMaxCard ──────────────────────────────────────────────────────────────
function MinMaxCard({ data, days, label }: { data: any[]; days: number; label: string }) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const filtered = data.filter(d => new Date(d.timestamp) >= cutoff)

  const maxTemp = filtered.length ? +(d3.max(filtered, (d: any) => +d.temp_c) ?? 0).toFixed(1) : null
  const minTemp = filtered.length ? +(d3.min(filtered, (d: any) => +d.temp_c) ?? 0).toFixed(1) : null
  const maxHum  = filtered.length ? +(d3.max(filtered, (d: any) => +d.humidity) ?? 0).toFixed(1) : null
  const minHum  = filtered.length ? +(d3.min(filtered, (d: any) => +d.humidity) ?? 0).toFixed(1) : null

  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: "16px 18px",
      border: `0.5px solid ${C.border}`
    }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 10 }}>
        {label} — Min / Max
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>Temp</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            <span style={{ color: C.blue }}>{minTemp ?? "—"}°</span>
            <span style={{ color: C.muted, margin: "0 4px" }}>/</span>
            <span style={{ color: C.coral }}>{maxTemp ?? "—"}°</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>Humidity</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            <span style={{ color: C.blue }}>{minHum ?? "—"}%</span>
            <span style={{ color: C.muted, margin: "0 4px" }}>/</span>
            <span style={{ color: C.blue }}>{maxHum ?? "—"}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ClimatePage() {
  const [data,      setData]      = useState<any[]>([])
  const [summary,   setSummary]   = useState<any>(null)
  const [stations,  setStations]  = useState<{ station: string; country: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [country,   setCountry]   = useState("")
  const [station,   setStation]   = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [limit,     setLimit]     = useState(500)

  const LIMITS = [50, 100, 200, 500, 1000, 2000]

  useEffect(() => {
    get("/api/climate/summary").then(setSummary).catch(console.error)
    get("/api/climate/stations").then(setStations).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    p.set("limit", "3000")

    if (country)   p.set("country",    country)
    if (station)   p.set("station",    station)
    if (startDate) p.set("start_date", startDate)
    if (endDate)   p.set("end_date",   endDate)

    // auto fetch last 30 days if no date filter
    if (!startDate && !endDate) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      p.set("start_date", thirtyDaysAgo.toISOString().slice(0, 10))
    }

    get("/api/climate/readings?" + p.toString())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { console.error(e); setLoading(false) })
  }, [country, station, startDate, endDate, limit])

  function handleCountryChange(c: string) {
    setCountry(c)
    setStation("")
  }

  const filteredStations = country
    ? stations.filter(s => s.country === country)
    : stations

  const countries = [...new Set(stations.map(s => s.country))].sort()

  // ── computed stats ─────────────────────────────────────────────────────
  const latest     = useMemo(() => latestReading(data), [data])
  const todayTemp  = useMemo(() => todayAvg(data, "temp_c"), [data])
  const todayHum   = useMemo(() => todayAvg(data, "humidity"), [data])
  const avg3Temp   = useMemo(() => avgOf(data, "temp_c", 3), [data])
  const avg3Hum    = useMemo(() => avgOf(data, "humidity", 3), [data])
  const avg7Temp   = useMemo(() => avgOf(data, "temp_c", 7), [data])
  const avg7Hum    = useMemo(() => avgOf(data, "humidity", 7), [data])
  const avg30Temp  = useMemo(() => avgOf(data, "temp_c", 30), [data])
  const avg30Hum   = useMemo(() => avgOf(data, "humidity", 30), [data])

  const trend3vs7  = trendArrow(avg3Temp, avg7Temp)
  const trend7vs30 = trendArrow(avg7Temp, avg30Temp)

  const byCountry = d3.rollup(data, v =>
    +(d3.mean(v, (d: any) => d.temp_c) ?? 0).toFixed(1),
    (d: any) => d.country
  )
  const tempByC = Array.from(byCountry, ([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)

  const temps = data.map((d: any) => d.temp_c).filter(Boolean).slice(-80)

  function resetFilters() {
    setCountry(""); setStation("")
    setStartDate(""); setEndDate("")
    setLimit(500)
  }

  const hasFilter = country || station || startDate || endDate || limit !== 500

  const lastUpdated = latest
    ? new Date(latest.timestamp).toLocaleString(undefined, {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : ""

  return (
    <PageShell
      title="Climate explorer"
      subtitle={`${(summary?.total_records ?? 0).toLocaleString()} readings · ${stations.length} cities`}
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
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>Country</div>
          <select value={country} onChange={e => handleCountryChange(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, minWidth: 140, border: `0.5px solid ${country ? C.blue : C.border}`, background: C.surface, color: C.text, fontSize: 13 }}>
            <option value="">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>City</div>
          <select value={station} onChange={e => setStation(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, minWidth: 140, border: `0.5px solid ${station ? C.teal : C.border}`, background: C.surface, color: C.text, fontSize: 13 }}>
            <option value="">All cities</option>
            {filteredStations.map(s => (
              <option key={s.station} value={s.station}>
                {s.station}{!country && ` (${s.country})`}
              </option>
            ))}
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
                style={{ padding: "7px 10px", borderRadius: 8, fontSize: 11, border: `0.5px solid ${limit === l ? C.teal : C.border}`, background: limit === l ? C.teal + "18" : "transparent", color: limit === l ? C.teal : C.muted, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
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
              <LatestCard reading={latest} />
            </div>
          )}

          {/* ── averages grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
            <AverageCard
              label="Today's avg"
              temp={todayTemp}
              humidity={todayHum}
              color={C.coral}
            />
            <AverageCard
              label="3-day avg"
              temp={avg3Temp}
              humidity={avg3Hum}
              color={C.amber}
              trend={trend3vs7}
            />
            <AverageCard
              label="7-day avg"
              temp={avg7Temp}
              humidity={avg7Hum}
              color={C.purple}
              trend={trend7vs30}
            />
            <AverageCard
              label="30-day avg"
              temp={avg30Temp}
              humidity={avg30Hum}
              color={C.blue}
            />
            <MinMaxCard data={data} days={1} label="Today" />
            <MinMaxCard data={data} days={7} label="7 days" />
          </div>

          {/* ── summary stat cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
            <StatCard label="Records shown"    value={data.length.toLocaleString()} color={C.blue} spark={temps.slice(0, 40)} />
            <StatCard label="Overall avg temp" value={(summary?.avg_temp ?? 0).toFixed(1)} unit="°C"  color={C.coral} spark={temps} />
            <StatCard label="Overall humidity" value={(summary?.avg_humidity ?? 0).toFixed(1)} unit="%" color={C.blue} />
            <StatCard label="Overall CO₂"      value={(summary?.avg_co2 ?? 0).toFixed(1)} unit="ppm"  color={C.teal} />
          </div>

          {/* ── charts ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ChartCard title="Temperature over time" subtitle="°C — hover for details">
              <LineChart data={data} xKey="timestamp" yKey="temp_c" color={C.coral} yLabel="°C" />
            </ChartCard>
            <ChartCard title="Humidity over time" subtitle="% relative humidity">
              <LineChart data={data} xKey="timestamp" yKey="humidity" color={C.blue} yLabel="%" />
            </ChartCard>
            <ChartCard title="Avg temperature by country">
              <BarChart entries={tempByC} color={C.coral} multiColor yLabel="°C" />
            </ChartCard>
            <ChartCard title="CO₂ over time" subtitle="Parts per million">
              <LineChart data={data.filter((d: any) => d.co2_ppm)} xKey="timestamp" yKey="co2_ppm" color={C.teal} yLabel="ppm" />
            </ChartCard>
            <ChartCard title="Temperature vs humidity" subtitle="Each dot = one reading" fullWidth>
              <ScatterPlot data={data} xKey="temp_c" yKey="humidity" groupKey="country" xLabel="Temperature (°C)" yLabel="Humidity (%)" height={320} />
            </ChartCard>
          </div>
        </>
      )}
    </PageShell>
  )
}

function Loader() {
  return (
    <div style={{ height: 300, background: C.card, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, border: `0.5px solid ${C.border}` }}>
      <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.coral, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: C.muted }}>Loading climate data...</div>
    </div>
  )
}
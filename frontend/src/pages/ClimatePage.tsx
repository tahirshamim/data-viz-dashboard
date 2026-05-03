import { useEffect, useState } from "react"
import PageShell   from "../components/PageShell"
import StatCard    from "../components/StatCard"
import ChartCard   from "../components/ChartCard"
import LineChart   from "../charts/LineChart"
import BarChart    from "../charts/BarChart"
import ScatterPlot from "../charts/ScatterPlot"
import { C }       from "../theme"
import { get }     from "../lib/api"
import * as d3     from "d3"

export default function ClimatePage() {
  const [data,      setData]      = useState<any[]>([])
  const [summary,   setSummary]   = useState<any>(null)
  const [stations,  setStations]  = useState<{ station: string; country: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [country,   setCountry]   = useState("")
  const [station,   setStation]   = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [limit,     setLimit]     = useState(200)
  const [lastUpdated, setLastUpdated] = useState("")

  const LIMITS = [50, 100, 200, 500, 1000, 2000]

  // fetch summary and stations once on mount
  useEffect(() => {
    get("/api/climate/summary").then(setSummary).catch(console.error)
    get("/api/climate/stations").then(setStations).catch(console.error)
  }, [])

  // re-fetch when any filter changes
  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    p.set("limit", String(limit))
    if (country)   p.set("country",    country)
    if (station)   p.set("station",    station)
    if (startDate) p.set("start_date", startDate)
    if (endDate)   p.set("end_date",   endDate)

    get("/api/climate/readings?" + p.toString())
      .then(d => {
        setData(d)
        setLoading(false)
        if (d.length > 0) {
          setLastUpdated(new Date(d[0].timestamp).toLocaleString())
        }
      })
      .catch(e => { console.error(e); setLoading(false) })
  }, [country, station, startDate, endDate, limit])

  // when country changes reset city
  function handleCountryChange(c: string) {
    setCountry(c)
    setStation("")   // reset city when country changes
  }

  // filtered stations based on selected country
  const filteredStations = country
    ? stations.filter(s => s.country === country)
    : stations

  const countries  = [...new Set(stations.map(s => s.country))].sort()
  const byCountry  = d3.rollup(data, v => +(d3.mean(v, (d: any) => d.temp_c) ?? 0).toFixed(1), (d: any) => d.country)
  const tempByC    = Array.from(byCountry, ([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)
  const temps      = data.map((d: any) => d.temp_c).filter(Boolean).slice(-80)

  function resetFilters() {
    setCountry("")
    setStation("")
    setStartDate("")
    setEndDate("")
    setLimit(200)
  }

  const hasFilter = country || station || startDate || endDate || limit !== 200

  return (
    <PageShell
      title="Climate explorer"
      subtitle={`${(summary?.total_records ?? 0).toLocaleString()} readings · ${stations.length} cities`}
      action={
        lastUpdated ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.teal }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, display: "inline-block" }} />
            Last update: {lastUpdated}
          </div>
        ) : undefined
      }
    >

      {/* ── filter bar ── */}
      <div style={{
        background: C.card, borderRadius: 12, padding: "16px 20px",
        border: `0.5px solid ${C.border}`, marginBottom: 24,
        display: "flex", flexWrap: "wrap" as const, gap: 16, alignItems: "flex-end"
      }}>

        {/* country */}
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
            Country
          </div>
          <select
            value={country}
            onChange={e => handleCountryChange(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8, minWidth: 140,
              border: `0.5px solid ${country ? C.blue : C.border}`,
              background: C.surface, color: C.text, fontSize: 13
            }}
          >
            <option value="">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* city */}
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
            City
          </div>
          <select
            value={station}
            onChange={e => setStation(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8, minWidth: 140,
              border: `0.5px solid ${station ? C.teal : C.border}`,
              background: C.surface, color: C.text, fontSize: 13
            }}
          >
            <option value="">All cities</option>
            {filteredStations.map(s => (
              <option key={s.station} value={s.station}>
                {s.station} {!country && `(${s.country})`}
              </option>
            ))}
          </select>
        </div>

        {/* start date */}
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
            Start date
          </div>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8,
              border: `0.5px solid ${startDate ? C.blue : C.border}`,
              background: C.surface, color: C.text, fontSize: 13
            }}
          />
        </div>

        {/* end date */}
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
            End date
          </div>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8,
              border: `0.5px solid ${endDate ? C.blue : C.border}`,
              background: C.surface, color: C.text, fontSize: 13
            }}
          />
        </div>

        {/* limit */}
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>
            Entries
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {LIMITS.map(l => (
              <button key={l} onClick={() => setLimit(l)}
                style={{
                  padding: "7px 10px", borderRadius: 8, fontSize: 11,
                  border: `0.5px solid ${limit === l ? C.teal : C.border}`,
                  background: limit === l ? C.teal + "18" : "transparent",
                  color: limit === l ? C.teal : C.muted,
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s"
                }}>
                {l >= 1000 ? `${l / 1000}k` : l}
              </button>
            ))}
          </div>
        </div>

        {/* reset */}
        {hasFilter && (
          <button onClick={resetFilters}
            style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12,
              border: `0.5px solid ${C.coral}44`,
              background: C.coral + "12", color: C.coral,
              cursor: "pointer", fontFamily: "inherit",
              alignSelf: "flex-end" as const
            }}>
            Reset
          </button>
        )}
      </div>

      {/* ── stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard label="Showing"         value={data.length.toLocaleString()} color={C.blue}  spark={temps.slice(0, 40)} />
        <StatCard label="Avg temperature" value={(summary?.avg_temp ?? 0).toFixed(1)} unit="°C"  color={C.coral} spark={temps} />
        <StatCard label="Avg humidity"    value={(summary?.avg_humidity ?? 0).toFixed(1)} unit="%" color={C.blue} />
        <StatCard label="Avg CO₂"         value={(summary?.avg_co2 ?? 0).toFixed(1)} unit="ppm"  color={C.teal} />
      </div>

      {/* ── charts ── */}
      {loading ? <Loader /> : data.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 48, background: C.card,
          borderRadius: 12, color: C.muted, border: `0.5px solid ${C.border}`
        }}>
          No data found for selected filters — try resetting
        </div>
      ) : (
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
      <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTopColor: C.coral, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: C.muted }}>Loading climate data...</div>
    </div>
  )
}
import { useEffect, useState } from "react"
import PageShell   from "../components/PageShell"
import StatCard    from "../components/StatCard"
import ChartCard   from "../components/ChartCard"
import DataFilter  from "../components/DataFilter"
import LineChart   from "../charts/LineChart"
import BarChart    from "../charts/BarChart"
import ScatterPlot from "../charts/ScatterPlot"
import { C }       from "../theme"
import { get }     from "../lib/api"
import * as d3     from "d3"

export default function ClimatePage() {
  const [data,      setData]      = useState<any[]>([])
  const [summary,   setSummary]   = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [country,   setCountry]   = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [limit,     setLimit]     = useState(200)

  useEffect(() => {
    get("/api/climate/summary").then(setSummary).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    p.set("limit", String(limit))
    if (country)   p.set("country",    country)
    if (startDate) p.set("start_date", startDate)
    if (endDate)   p.set("end_date",   endDate)
    get("/api/climate/readings?" + p.toString())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { console.error(e); setLoading(false) })
  }, [country, startDate, endDate, limit])

  const countries  = [...new Set(data.map((r: any) => r.country))].sort()
  const byCountry  = d3.rollup(data, v => +(d3.mean(v, (d: any) => d.temp_c) ?? 0).toFixed(1), (d: any) => d.country)
  const tempByC    = Array.from(byCountry, ([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)
  const temps      = data.map((d: any) => d.temp_c).filter(Boolean).slice(-80)

  return (
    <PageShell
      title="Climate explorer"
      subtitle={`${(summary?.total_records ?? 0).toLocaleString()} readings · ${countries.length} stations`}
    >
      <DataFilter
        countries={countries}
        selectedCat={country}
        onCatChange={setCountry}
        startDate={startDate}
        onStartDate={setStartDate}
        endDate={endDate}
        onEndDate={setEndDate}
        limit={limit}
        onLimit={setLimit}
        catLabel="Country"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard label="Showing"        value={data.length.toLocaleString()} color={C.blue} spark={temps.slice(0,40)} />
        <StatCard label="Avg temperature" value={(summary?.avg_temp ?? 0).toFixed(1)} unit="°C"  color={C.coral} spark={temps} />
        <StatCard label="Avg humidity"    value={(summary?.avg_humidity ?? 0).toFixed(1)} unit="%" color={C.blue} />
        <StatCard label="Avg CO₂"         value={(summary?.avg_co2 ?? 0).toFixed(1)} unit="ppm"  color={C.teal} />
      </div>

      {loading ? <Loader /> : (
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
    <div style={{ height: 300, background: "#21253a", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#4f8ef7", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: "#7a7d94" }}>Loading data...</div>
    </div>
  )
}
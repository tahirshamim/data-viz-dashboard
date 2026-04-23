import { useEffect, useState } from "react"
import PageShell       from "../components/PageShell"
import StatCard        from "../components/StatCard"
import ChartCard       from "../components/ChartCard"
import LineChart       from "../charts/LineChart"
import BarChart        from "../charts/BarChart"
import ScatterPlot     from "../charts/ScatterPlot"
import { C }           from "../theme"
import * as d3 from "d3"

const get = (url: string) => fetch("http://127.0.0.1:8000" + url).then(r => r.json())

export default function ClimatePage() {
  const [data,    setData]    = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [country, setCountry] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => { get("/api/climate/summary").then(setSummary).catch(console.error) }, [])
  useEffect(() => {
    setLoading(true)
    const p = country ? `?country=${encodeURIComponent(country)}&limit=600` : "?limit=600"
    get("/api/climate/readings" + p).then(d => { setData(d); setLoading(false) }).catch(console.error)
  }, [country])

  const countries  = [...new Set(data.map((r: any) => r.country))].sort()
  const byCountry  = d3.rollup(data, v => +(d3.mean(v, (d: any) => d.temp_c) ?? 0).toFixed(1), (d: any) => d.country)
  const tempByC    = Array.from(byCountry, ([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)
  const temps      = data.map((d: any) => d.temp_c).filter(Boolean).slice(-80)

  const filter = (
    <select value={country} onChange={e => setCountry(e.target.value)}
      style={{ padding: "7px 12px", borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13 }}>
      <option value="">All countries</option>
      {countries.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  )

  return (
    <PageShell title="Climate explorer" subtitle={`${(summary?.total_records ?? 0).toLocaleString()} readings · ${countries.length} stations`} action={filter}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard label="Total records"   value={(summary?.total_records ?? 0).toLocaleString()} color={C.blue}  spark={temps.slice(0, 40)} />
        <StatCard label="Avg temperature" value={(summary?.avg_temp ?? 0).toFixed(1)} unit="°C"  color={C.coral} spark={temps} />
        <StatCard label="Avg humidity"    value={(summary?.avg_humidity ?? 0).toFixed(1)} unit="%" color={C.blue} />
        <StatCard label="Avg CO₂"         value={(summary?.avg_co2 ?? 0).toFixed(1)} unit="ppm"  color={C.teal} />
      </div>

      {loading ? <Loader /> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <ChartCard title="Temperature over time" subtitle="°C — hover for date + value">
            <LineChart data={data} xKey="timestamp" yKey="temp_c" color={C.coral} yLabel="°C" />
          </ChartCard>
          <ChartCard title="Humidity over time" subtitle="% relative humidity">
            <LineChart data={data} xKey="timestamp" yKey="humidity" color={C.blue} yLabel="%" />
          </ChartCard>
          <ChartCard title="Avg temperature by country">
            <BarChart entries={tempByC} color={C.coral} multiColor yLabel="°C" />
          </ChartCard>
          <ChartCard title="CO₂ concentration over time" subtitle="Parts per million">
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
  return <div style={{ height: 300, background: C.card, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Loading...</div>
}
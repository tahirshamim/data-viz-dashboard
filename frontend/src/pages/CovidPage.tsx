import { useEffect, useState } from "react"
import PageShell   from "../components/PageShell"
import StatCard    from "../components/StatCard"
import ChartCard   from "../components/ChartCard"
import LineChart   from "../charts/LineChart"
import BarChart    from "../charts/BarChart"
import PieChart    from "../charts/PieChart"
import { C }       from "../theme"
import * as d3 from "d3"

const get = (url: string) => fetch("http://127.0.0.1:8000" + url).then(r => r.json())

export default function CovidPage() {
  const [data,    setData]    = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [country, setCountry] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => { get("/api/covid/summary").then(setSummary).catch(console.error) }, [])
  useEffect(() => {
    setLoading(true)
    const p = country ? `?country=${encodeURIComponent(country)}&limit=500` : "?limit=500"
    get("/api/covid/records" + p).then(d => { setData(d); setLoading(false) }).catch(console.error)
  }, [country])

  const countries  = [...new Set(data.map((r: any) => r.country))].sort()
  const byCases    = d3.rollup(data, v => d3.sum(v, (d: any) => d.new_cases), (d: any) => d.country)
  const casesChart = Array.from(byCases, ([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)
  const pieData    = casesChart.slice(0, 6)

  const filter = (
    <select value={country} onChange={e => setCountry(e.target.value)}
      style={{ padding: "7px 12px", borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13 }}>
      <option value="">All countries</option>
      {countries.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  )

  return (
    <PageShell title="COVID-19 explorer" subtitle={`${summary?.countries ?? "—"} countries · 180 days`} action={filter}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard label="Records"      value={(summary?.total_records ?? 0).toLocaleString()} color={C.blue} />
        <StatCard label="Total cases"  value={((summary?.total_cases ?? 0) / 1e6).toFixed(1)} unit="M" color={C.coral} />
        <StatCard label="Total deaths" value={((summary?.total_deaths ?? 0) / 1e3).toFixed(1)} unit="k" color={C.amber} />
        <StatCard label="Countries"    value={summary?.countries ?? 0} color={C.teal} />
      </div>

      {loading ? <div style={{ height: 300, background: C.card, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Loading...</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <ChartCard title="Daily new cases" subtitle="Hover for details">
            <LineChart data={data} xKey="date" yKey="new_cases" color={C.coral} yLabel="Cases" />
          </ChartCard>
          <ChartCard title="Daily deaths">
            <LineChart data={data} xKey="date" yKey="new_deaths" color={C.amber} yLabel="Deaths" />
          </ChartCard>
          <ChartCard title="Cases by country — bar">
            <BarChart entries={casesChart.slice(0, 8)} color={C.coral} multiColor yLabel="Total cases" />
          </ChartCard>
          <ChartCard title="Cases by country — pie">
            <PieChart data={pieData} />
          </ChartCard>
          <ChartCard title="Vaccination progress" fullWidth>
            <LineChart data={data} xKey="date" yKey="vaccinations" color={C.teal} yLabel="Vaccinations" height={220} />
          </ChartCard>
        </div>
      )}
    </PageShell>
  )
}
import { useEffect, useState } from "react"
import PageShell  from "../components/PageShell"
import StatCard   from "../components/StatCard"
import ChartCard  from "../components/ChartCard"
import DataFilter from "../components/DataFilter"
import LineChart  from "../charts/LineChart"
import BarChart   from "../charts/BarChart"
import PieChart   from "../charts/PieChart"
import { C }      from "../theme"
import { get }    from "../lib/api"
import * as d3    from "d3"

export default function CovidPage() {
  const [data,      setData]      = useState<any[]>([])
  const [summary,   setSummary]   = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [country,   setCountry]   = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [limit,     setLimit]     = useState(200)

  useEffect(() => {
    get("/api/covid/summary").then(setSummary).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    p.set("limit", String(limit))
    if (country)   p.set("country",    country)
    if (startDate) p.set("start_date", startDate)
    if (endDate)   p.set("end_date",   endDate)
    get("/api/covid/records?" + p.toString())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { console.error(e); setLoading(false) })
  }, [country, startDate, endDate, limit])

  const countries  = [...new Set(data.map((r: any) => r.country))].sort()
  const byCases    = d3.rollup(data, v => d3.sum(v, (d: any) => d.new_cases), (d: any) => d.country)
  const casesChart = Array.from(byCases, ([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)
  const pieData    = casesChart.slice(0, 6)

  return (
    <PageShell
      title="COVID-19 explorer"
      subtitle={`${summary?.countries ?? "—"} countries · ${data.length.toLocaleString()} records shown`}
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
        <StatCard label="Showing"      value={data.length.toLocaleString()} color={C.blue} />
        <StatCard label="Total cases"  value={((summary?.total_cases ?? 0) / 1e6).toFixed(1)} unit="M" color={C.coral} />
        <StatCard label="Total deaths" value={((summary?.total_deaths ?? 0) / 1e3).toFixed(1)} unit="k" color={C.amber} />
        <StatCard label="Countries"    value={summary?.countries ?? 0} color={C.teal} />
      </div>

      {loading ? <Loader /> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <ChartCard title="Daily new cases">
            <LineChart data={data} xKey="date" yKey="new_cases" color={C.coral} yLabel="Cases" />
          </ChartCard>
          <ChartCard title="Daily deaths">
            <LineChart data={data} xKey="date" yKey="new_deaths" color={C.amber} yLabel="Deaths" />
          </ChartCard>
          <ChartCard title="Cases by country">
            <BarChart entries={casesChart.slice(0, 8)} color={C.coral} multiColor yLabel="Cases" />
          </ChartCard>
          <ChartCard title="Cases distribution">
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

function Loader() {
  return (
    <div style={{ height: 300, background: "#21253a", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#f97066", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: "#7a7d94" }}>Loading data...</div>
    </div>
  )
}
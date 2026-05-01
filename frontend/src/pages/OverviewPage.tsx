import { useEffect, useState } from "react"
import PageShell  from "../components/PageShell"
import StatCard   from "../components/StatCard"
import ChartCard  from "../components/ChartCard"
import LineChart  from "../charts/LineChart"
import BarChart   from "../charts/BarChart"
import { C }      from "../theme"
import { useNavigate } from "react-router-dom"
import * as d3 from "d3"

import { get } from "../lib/api"

export default function OverviewPage() {
  const [climate, setClimate]   = useState<any>(null)
  const [covid,   setCovid]     = useState<any>(null)
  const [finance, setFinance]   = useState<any>(null)
  const [recentC, setRecentC]   = useState<any[]>([])
  const nav = useNavigate()

  useEffect(() => {
    get("/api/climate/summary").then(setClimate).catch(console.error)
    get("/api/covid/summary").then(setCovid).catch(console.error)
    get("/api/finance/summary").then(setFinance).catch(console.error)
    get("/api/climate/readings?limit=1000").then(setRecentC).catch(console.error)
  }, [])

  const byCountry = d3.rollup(recentC, v => +(d3.mean(v, (d: any) => d.temp_c) ?? 0).toFixed(1), (d: any) => d.country)
  const tempChart = Array.from(byCountry, ([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)

  const datasets = [
    { label: "Climate",  records: climate?.total_records, color: C.teal,  path: "/climate", desc: "Temperature, humidity, CO₂ across 10 cities" },
    { label: "COVID-19", records: covid?.total_records,   color: C.coral, path: "/covid",   desc: "Cases, deaths, vaccinations — 8 countries" },
    { label: "Finance",  records: finance?.total_records, color: C.amber, path: "/finance", desc: "OHLCV stock data — 6 major symbols" },
  ]

  return (
    <PageShell title="Overview" subtitle="All datasets at a glance">

      {/* dataset cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
        {datasets.map(d => (
          <div key={d.label} onClick={() => nav(d.path)}
            style={{ background: C.card, borderRadius: 12, padding: 20, border: `0.5px solid ${C.border}`, cursor: "pointer", transition: "border-color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = d.color)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: d.color, marginBottom: 6 }}>
              {(d.records ?? 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>{d.desc}</div>
            <div style={{ marginTop: 12, fontSize: 12, color: d.color }}>Explore →</div>
          </div>
        ))}
      </div>

      {/* summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard label="Avg global temp"   value={(climate?.avg_temp ?? 0).toFixed(1)} unit="°C"  color={C.coral} />
        <StatCard label="Avg CO₂"           value={(climate?.avg_co2 ?? 0).toFixed(1)}  unit="ppm" color={C.teal}  />
        <StatCard label="COVID total cases" value={((covid?.total_cases ?? 0) / 1e6).toFixed(1)} unit="M" color={C.coral} />
        <StatCard label="Stocks tracked"    value={finance?.symbols ?? 0} color={C.amber} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ChartCard title="Recent climate readings" subtitle="Temperature by station">
          <LineChart data={recentC} xKey="timestamp" yKey="temp_c" color={C.teal} yLabel="°C" />
        </ChartCard>
        <ChartCard title="Avg temp by country" subtitle="All-time mean">
          <BarChart entries={tempChart} color={C.coral} multiColor yLabel="°C" />
        </ChartCard>
      </div>

      {/* custom dataset CTA */}
      <div onClick={() => nav("/custom")} style={{
        marginTop: 16, background: "linear-gradient(135deg, rgba(155,138,251,0.15), rgba(79,142,247,0.1))",
        borderRadius: 12, padding: "20px 24px", border: `0.5px solid rgba(155,138,251,0.3)`,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>Upload your own dataset</div>
          <div style={{ fontSize: 13, color: C.muted }}>Drop any CSV or Excel file and instantly explore it with bar, line, scatter, pie, and histogram charts</div>
        </div>
        <div style={{ fontSize: 24, color: C.purple, marginLeft: 20 }}>→</div>
      </div>
    </PageShell>
  )
}

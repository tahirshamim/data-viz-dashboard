import FilterPanel from "../components/FilterPanel"
import MetricCard  from "../components/MetricCard"
import LineChart   from "../charts/LineChart"
import { useClimateData, useClimateSummary } from "../store/useDataQuery"

export default function Dashboard() {
  const { data: readings, isLoading: loadingReadings } = useClimateData()
  const { data: summary,  isLoading: loadingSummary  } = useClimateSummary()

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 20px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 500, marginBottom: "4px" }}>
          Data explorer
        </h1>
        <p style={{ fontSize: "13px", color: "#888" }}>
          Live climate, COVID, and finance datasets — updated hourly
        </p>
      </div>

      <FilterPanel />

      {/* KPI cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "12px",
        marginBottom: "24px"
      }}>
        <MetricCard
          label="Total records"
          value={summary?.total_records ?? 0}
          loading={loadingSummary}
        />
        <MetricCard
          label="Avg temperature"
          value={summary?.avg_temp ?? 0}
          unit="°C"
          color="#D85A30"
          loading={loadingSummary}
        />
        <MetricCard
          label="Avg CO₂"
          value={summary?.avg_co2 ?? 0}
          unit="ppm"
          color="#1D9E75"
          loading={loadingSummary}
        />
        <MetricCard
          label="Avg humidity"
          value={summary?.avg_humidity ?? 0}
          unit="%"
          color="#378ADD"
          loading={loadingSummary}
        />
      </div>

      {/* Charts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <ChartCard title="Temperature over time" loading={loadingReadings}>
          <LineChart data={readings ?? []} field="temp_c" color="#D85A30" />
        </ChartCard>
        <ChartCard title="Humidity over time" loading={loadingReadings}>
          <LineChart data={readings ?? []} field="humidity" color="#378ADD" />
        </ChartCard>
      </div>

      {/* Empty state when no data */}
      {!loadingReadings && (!readings || readings.length === 0) && (
        <div style={{
          textAlign: "center",
          padding: "48px",
          background: "#fff",
          borderRadius: "12px",
          border: "0.5px solid rgba(0,0,0,0.1)",
          color: "#888"
        }}>
          <p style={{ fontSize: "15px", marginBottom: "8px" }}>No data yet</p>
          <p style={{ fontSize: "13px" }}>
            Seed the database to see charts — run the command below in your backend terminal
          </p>
          <code style={{
            display: "inline-block",
            marginTop: "12px",
            padding: "8px 16px",
            background: "#f5f5f3",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#333"
          }}>
            python seed.py
          </code>
        </div>
      )}
    </div>
  )
}

// Small helper component used only in this file
function ChartCard({ title, loading, children }: {
  title: string
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: "#fff",
      border: "0.5px solid rgba(0,0,0,0.1)",
      borderRadius: "12px",
      padding: "16px"
    }}>
      <h3 style={{ fontSize: "14px", fontWeight: 500, marginBottom: "12px", color: "#333" }}>
        {title}
      </h3>
      {loading ? (
        <div style={{
          height: "300px",
          background: "rgba(0,0,0,0.05)",
          borderRadius: "8px",
          animation: "pulse 1.5s ease-in-out infinite"
        }} />
      ) : children}
    </div>
  )
}
import { Routes, Route, Navigate } from "react-router-dom"
import Sidebar      from "./components/Sidebar"
import ClimatePage  from "./pages/ClimatePage"
import CovidPage    from "./pages/CovidPage"
import FinancePage  from "./pages/FinancePage"
import CustomPage   from "./pages/CustomPage"
import OverviewPage from "./pages/OverviewPage"
import { C }        from "./theme"

export default function App() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, color: C.text }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: "auto" }}>
        <Routes>
          <Route path="/"         element={<OverviewPage />} />
          <Route path="/climate"  element={<ClimatePage  />} />
          <Route path="/covid"    element={<CovidPage    />} />
          <Route path="/finance"  element={<FinancePage  />} />
          <Route path="/custom"   element={<CustomPage   />} />
          <Route path="*"         element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  )
}
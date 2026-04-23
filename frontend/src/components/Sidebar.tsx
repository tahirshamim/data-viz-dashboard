import { NavLink, useLocation } from "react-router-dom"
import { C } from "../theme"

const nav = [
  { to: "/",        label: "Overview",       dot: C.blue,   icon: "▦" },
  { to: "/climate", label: "Climate",        dot: C.teal,   icon: "◈" },
  { to: "/covid",   label: "COVID-19",       dot: C.coral,  icon: "◉" },
  { to: "/finance", label: "Finance",        dot: C.amber,  icon: "◆" },
  { to: "/custom",  label: "Custom dataset", dot: C.purple, icon: "⊕" },
]

export default function Sidebar() {
  const loc = useLocation()
  return (
    <div style={{
      width: 230, background: C.surface, borderRight: `0.5px solid ${C.border}`,
      padding: "24px 0", display: "flex", flexDirection: "column", flexShrink: 0,
      position: "sticky", top: 0, height: "100vh"
    }}>
      {/* logo */}
      <div style={{ padding: "0 20px 24px", borderBottom: `0.5px solid ${C.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: "-0.3px" }}>
          <span style={{ color: C.blue }}>Data</span>Viz
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Public dataset explorer</div>
      </div>

      {/* nav */}
      <nav style={{ padding: "16px 12px", flex: 1 }}>
        <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 10px", marginBottom: 10 }}>
          Pages
        </div>
        {nav.map(n => {
          const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to)
          return (
            <NavLink key={n.to} to={n.to} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8, marginBottom: 2,
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
                color: active ? C.text : C.muted,
                fontSize: 13, fontWeight: active ? 500 : 400,
                transition: "all 0.15s", cursor: "pointer"
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: n.dot, flexShrink: 0 }} />
                {n.label}
                {n.to === "/custom" && (
                  <span style={{
                    marginLeft: "auto", fontSize: 9, padding: "2px 6px",
                    background: "rgba(155,138,251,0.2)", color: C.purple,
                    borderRadius: 4, fontWeight: 500
                  }}>NEW</span>
                )}
              </div>
            </NavLink>
          )
        })}
      </nav>

      {/* footer */}
      <div style={{ padding: "16px 20px", borderTop: `0.5px solid ${C.border}`, fontSize: 11, color: C.muted }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, display: "inline-block" }} />
          API connected
        </div>
        <div>v1.0.0 · Web Engineering</div>
      </div>
    </div>
  )
}
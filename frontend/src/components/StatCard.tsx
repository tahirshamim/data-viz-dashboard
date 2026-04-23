import { useRef, useEffect } from "react"
import * as d3 from "d3"
import { C } from "../theme"

function Spark({ data, color }: { data: number[]; color: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || data.length < 2) return
    const W = ref.current.clientWidth || 140, H = 36
    d3.select(ref.current).selectAll("*").remove()
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, W])
    const y = d3.scaleLinear().domain([d3.min(data)! * 0.95, d3.max(data)! * 1.05]).range([H, 0])
    const s = d3.select(ref.current)
    s.append("path").datum(data).attr("fill", color).attr("fill-opacity", 0.15)
      .attr("d", d3.area<number>().x((_, i) => x(i)).y0(H).y1(d => y(d)).curve(d3.curveMonotoneX))
    s.append("path").datum(data).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.5)
      .attr("d", d3.line<number>().x((_, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX))
  }, [data, color])
  return <svg ref={ref} style={{ width: "100%", height: 36, display: "block" }} />
}

interface Props {
  label: string; value: string | number; unit?: string
  color?: string; spark?: number[]; trend?: number
}

export default function StatCard({ label, value, unit, color = C.blue, spark, trend }: Props) {
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "18px 20px", border: `0.5px solid ${C.border}` }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: spark ? 10 : 0 }}>
        <span style={{ fontSize: 26, fontWeight: 600, color }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: C.muted }}>{unit}</span>}
        {trend !== undefined && (
          <span style={{ fontSize: 12, color: trend >= 0 ? C.teal : C.coral, marginLeft: "auto" }}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {spark && <Spark data={spark} color={color} />}
    </div>
  )
}
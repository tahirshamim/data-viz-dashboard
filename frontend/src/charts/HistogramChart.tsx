import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { C } from "../theme"

interface Props { values: number[]; color?: string; height?: number; xLabel?: string }

export default function HistogramChart({ values, color = C.blue, height = 260, xLabel }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || values.length === 0) return
    const m = { top: 12, right: 16, bottom: 40, left: 50 }
    const W = ref.current.clientWidth - m.left - m.right
    const H = height - m.top - m.bottom
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g").attr("transform", `translate(${m.left},${m.top})`)

    const x = d3.scaleLinear().domain(d3.extent(values) as [number, number]).nice().range([0, W])
    const bins = d3.bin().domain(x.domain() as [number, number]).thresholds(x.ticks(20))(values)
    const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)!]).range([H, 0])

    svg.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(x).ticks(8))
      .call(g => { g.select(".domain").style("stroke", C.border); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(-W))
      .call(g => { g.select(".domain").remove(); g.selectAll("line").style("stroke", "rgba(255,255,255,0.05)"); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })

    if (xLabel) svg.append("text").attr("x", W / 2).attr("y", H + 34).attr("text-anchor", "middle").style("fill", C.dim).style("font-size", "11px").text(xLabel)

    svg.selectAll("rect").data(bins).join("rect")
      .attr("x", d => x(d.x0!) + 1).attr("y", d => y(d.length))
      .attr("width", d => Math.max(0, x(d.x1!) - x(d.x0!) - 2))
      .attr("height", d => H - y(d.length)).attr("rx", 2)
      .attr("fill", color).attr("fill-opacity", 0.8)
  }, [values, color, height])
  return <svg ref={ref} style={{ width: "100%", height, display: "block" }} />
}
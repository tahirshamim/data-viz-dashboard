import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { C, CHART_COLORS } from "../theme"

interface Entry { key: string; value: number }
interface Props {
  entries: Entry[]; color?: string; height?: number
  yLabel?: string; multiColor?: boolean; horizontal?: boolean
}

export default function BarChart({ entries, color = C.blue, height = 280, yLabel, multiColor, horizontal }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || entries.length === 0) return
    const m = horizontal
      ? { top: 8, right: 60, bottom: 20, left: 90 }
      : { top: 12, right: 16, bottom: 64, left: 56 }
    const W = ref.current.clientWidth - m.left - m.right
    const H = height - m.top - m.bottom
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g").attr("transform", `translate(${m.left},${m.top})`)

    if (horizontal) {
      const y = d3.scaleBand().domain(entries.map(d => d.key)).range([0, H]).padding(0.25)
      const x = d3.scaleLinear().domain([0, d3.max(entries, d => d.value)! * 1.1]).range([0, W])
      svg.append("g").call(d3.axisLeft(y)).call(g => { g.select(".domain").remove(); g.selectAll("text").style("fill", C.muted).style("font-size", "11px"); g.selectAll(".tick line").remove() })
      svg.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(x).ticks(5))
        .call(g => { g.select(".domain").style("stroke", C.border); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })
      svg.selectAll("rect").data(entries).join("rect")
        .attr("y", d => y(d.key)!).attr("x", 0).attr("height", y.bandwidth())
        .attr("width", d => x(d.value)).attr("rx", 4)
        .attr("fill", (_, i) => multiColor ? CHART_COLORS[i % CHART_COLORS.length] : color)
      svg.selectAll(".lbl").data(entries).join("text").attr("class", "lbl")
        .attr("x", d => x(d.value) + 6).attr("y", d => y(d.key)! + y.bandwidth() / 2)
        .attr("dominant-baseline", "central").style("fill", C.muted).style("font-size", "11px")
        .text(d => d.value > 1e6 ? `${(d.value / 1e6).toFixed(1)}M` : d.value.toLocaleString())
    } else {
      const x = d3.scaleBand().domain(entries.map(d => d.key)).range([0, W]).padding(0.28)
      const y = d3.scaleLinear().domain([0, d3.max(entries, d => d.value)! * 1.12]).range([H, 0])
      svg.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(x))
        .call(g => { g.select(".domain").style("stroke", C.border); g.selectAll("text").style("fill", C.muted).style("font-size", "11px").attr("transform", "rotate(-30)").style("text-anchor", "end"); g.selectAll(".tick line").remove() })
      svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(-W))
        .call(g => { g.select(".domain").remove(); g.selectAll("line").style("stroke", "rgba(255,255,255,0.05)"); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })
      if (yLabel) svg.append("text").attr("transform", "rotate(-90)").attr("x", -H / 2).attr("y", -44)
        .attr("text-anchor", "middle").style("fill", C.dim).style("font-size", "10px").text(yLabel)
      svg.selectAll("rect").data(entries).join("rect")
        .attr("x", d => x(d.key)!).attr("y", d => y(d.value)).attr("width", x.bandwidth())
        .attr("height", d => H - y(d.value)).attr("rx", 4)
        .attr("fill", (_, i) => multiColor ? CHART_COLORS[i % CHART_COLORS.length] : color)
      svg.selectAll(".lbl").data(entries).join("text").attr("class", "lbl")
        .attr("x", d => x(d.key)! + x.bandwidth() / 2).attr("y", d => y(d.value) - 5)
        .attr("text-anchor", "middle").style("fill", C.dim).style("font-size", "10px")
        .text(d => d.value > 1e6 ? `${(d.value / 1e6).toFixed(1)}M` : d.value > 1e3 ? `${(d.value / 1e3).toFixed(0)}k` : String(d.value))
    }
  }, [entries, color, height, multiColor, horizontal])
  return <svg ref={ref} style={{ width: "100%", height, display: "block" }} />
}
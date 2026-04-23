import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { C, CHART_COLORS } from "../theme"

interface Props {
  data: any[]; xKey: string; yKey: string
  groupKey?: string; xLabel?: string; yLabel?: string; height?: number
}

export default function ScatterPlot({ data, xKey, yKey, groupKey, xLabel, yLabel, height = 300 }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const m = { top: 12, right: groupKey ? 120 : 20, bottom: 44, left: 56 }
    const W = ref.current.clientWidth - m.left - m.right
    const H = height - m.top - m.bottom
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g").attr("transform", `translate(${m.left},${m.top})`)

    const valid = data.filter(d => d[xKey] != null && d[yKey] != null && !isNaN(+d[xKey]) && !isNaN(+d[yKey]))
    const groups = groupKey ? [...new Set(valid.map(d => d[groupKey]))] : ["all"]
    const colour = d3.scaleOrdinal(CHART_COLORS).domain(groups)

    const x = d3.scaleLinear().domain(d3.extent(valid, d => +d[xKey]) as [number, number]).nice().range([0, W])
    const y = d3.scaleLinear().domain(d3.extent(valid, d => +d[yKey]) as [number, number]).nice().range([H, 0])

    svg.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(x).ticks(6).tickSize(-H))
      .call(g => { g.select(".domain").style("stroke", C.border); g.selectAll("line").style("stroke", "rgba(255,255,255,0.04)"); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(-W))
      .call(g => { g.select(".domain").remove(); g.selectAll("line").style("stroke", "rgba(255,255,255,0.04)"); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })

    if (xLabel) svg.append("text").attr("x", W / 2).attr("y", H + 36).attr("text-anchor", "middle").style("fill", C.dim).style("font-size", "11px").text(xLabel)
    if (yLabel) svg.append("text").attr("transform", "rotate(-90)").attr("x", -H / 2).attr("y", -42).attr("text-anchor", "middle").style("fill", C.dim).style("font-size", "11px").text(yLabel)

    svg.selectAll("circle").data(valid).join("circle")
      .attr("cx", d => x(+d[xKey])).attr("cy", d => y(+d[yKey])).attr("r", 4)
      .attr("fill", d => colour(groupKey ? d[groupKey] : "all")).attr("fill-opacity", 0.65).attr("stroke", "none")

    if (groupKey && groups.length <= 8) {
      const lg = svg.append("g").attr("transform", `translate(${W + 12}, 0)`)
      groups.forEach((g, i) => {
        lg.append("circle").attr("cx", 5).attr("cy", i * 18 + 5).attr("r", 4).attr("fill", colour(g))
        lg.append("text").attr("x", 14).attr("y", i * 18 + 9).style("fill", C.muted).style("font-size", "11px").text(String(g))
      })
    }
  }, [data, xKey, yKey, groupKey, height])
  return <svg ref={ref} style={{ width: "100%", height, display: "block" }} />
}
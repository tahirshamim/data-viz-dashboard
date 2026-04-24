import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { C, CHART_COLORS } from "../theme"

interface Props { data: { key: string; value: number }[]; height?: number }

export default function PieChart({ data, height = 280 }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const W = ref.current.clientWidth || 400
    const R = Math.min(W, height) / 2 - 40
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g").attr("transform", `translate(${W / 2},${height / 2})`)
    const colour = d3.scaleOrdinal(CHART_COLORS).domain(data.map(d => d.key))
    const pie = d3.pie<any>().value(d => d.value).sort(null)
    const arc = d3.arc<any>().innerRadius(R * 0.52).outerRadius(R)
    const arcHover = d3.arc<any>().innerRadius(R * 0.52).outerRadius(R + 6)

    svg.selectAll("path").data(pie(data)).join("path")
      .attr("d", arc).attr("fill", d => colour(d.data.key))
      .attr("stroke", C.card).attr("stroke-width", 2)
      .on("mouseover", function () { d3.select(this).attr("d", arcHover) })
      .on("mouseout",  function () { d3.select(this).attr("d", arc) })

    // centre label
    svg.append("text").attr("text-anchor", "middle").attr("dy", "-0.2em").style("fill", C.text).style("font-size", "18px").style("font-weight", "600")
      .text(d3.sum(data, d => d.value) > 1e6 ? `${(d3.sum(data, d => d.value) / 1e6).toFixed(1)}M` : d3.sum(data, d => d.value).toLocaleString())
    svg.append("text").attr("text-anchor", "middle").attr("dy", "1.2em").style("fill", C.muted).style("font-size", "11px").text("total")

    // legend
    const lg = svg.append("g").attr("transform", `translate(${R + 20}, ${-data.length * 9})`)
    data.slice(0, 8).forEach((d, i) => {
      lg.append("rect").attr("x", 0).attr("y", i * 20).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", colour(d.key))
      lg.append("text").attr("x", 14).attr("y", i * 20 + 9).style("fill", C.muted).style("font-size", "11px")
        .text(`${d.key} (${d.value > 1e6 ? (d.value / 1e6).toFixed(1) + "M" : d.value.toLocaleString()})`)
    })
  }, [data, height])
  return <svg ref={ref} style={{ width: "100%", height, display: "block" }} />
}
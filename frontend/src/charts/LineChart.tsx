import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { C } from "../theme"

interface Props {
  data: any[]; xKey: string; yKey: string
  color?: string; height?: number; yLabel?: string
}

export default function LineChart({ data, xKey, yKey, color = C.blue, height = 280, yLabel }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const m = { top: 12, right: 20, bottom: 36, left: 52 }
    const W = ref.current.clientWidth - m.left - m.right
    const H = height - m.top - m.bottom
    d3.select(ref.current).selectAll("*").remove()
    const svg = d3.select(ref.current).append("g").attr("transform", `translate(${m.left},${m.top})`)

    const parsed = data.map(d => ({ date: new Date(d[xKey]), v: +d[yKey] }))
      .filter(d => !isNaN(d.v) && !isNaN(d.date.getTime()))
      .sort((a, b) => +a.date - +b.date)
    if (parsed.length < 2) return

    const x = d3.scaleTime().domain(d3.extent(parsed, d => d.date) as [Date, Date]).range([0, W])
    const y = d3.scaleLinear().domain([d3.min(parsed, d => d.v)! * 0.94, d3.max(parsed, d => d.v)! * 1.06]).range([H, 0])

    svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(-W))
      .call(g => { g.select(".domain").remove(); g.selectAll("line").style("stroke", "rgba(255,255,255,0.05)"); g.selectAll("text").style("fill", C.muted).style("font-size", "11px") })
    svg.append("g").attr("transform", `translate(0,${H})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%b %d") as any))
      .call(g => { g.select(".domain").style("stroke", C.border); g.selectAll("text").style("fill", C.muted).style("font-size", "11px"); g.selectAll(".tick line").remove() })

    if (yLabel) svg.append("text").attr("transform", "rotate(-90)").attr("x", -H / 2).attr("y", -40)
      .attr("text-anchor", "middle").style("fill", C.dim).style("font-size", "10px").text(yLabel)

    svg.append("path").datum(parsed).attr("fill", color).attr("fill-opacity", 0.1)
      .attr("d", d3.area<any>().x(d => x(d.date)).y0(H).y1(d => y(d.v)).curve(d3.curveMonotoneX))
    svg.append("path").datum(parsed).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2)
      .attr("d", d3.line<any>().x(d => x(d.date)).y(d => y(d.v)).curve(d3.curveMonotoneX))

    const tip = d3.select("body").selectAll(".dvtip").data([null]).join("div").attr("class", "dvtip")
      .style("position", "absolute").style("background", C.surface).style("border", `0.5px solid ${C.border}`)
      .style("border-radius", "8px").style("padding", "8px 12px").style("font-size", "12px")
      .style("pointer-events", "none").style("opacity", 0).style("color", C.text).style("font-family", "inherit").style("z-index", "1000")
    const vl = svg.append("line").attr("y1", 0).attr("y2", H).style("stroke", "rgba(255,255,255,0.18)").style("stroke-width", 1).style("stroke-dasharray", "4,4").style("opacity", 0)

    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "transparent")
      .on("mousemove", (e) => {
        const d = x.invert(d3.pointer(e)[0])
        const c = parsed.reduce((a, b) => Math.abs(+b.date - +d) < Math.abs(+a.date - +d) ? b : a)
        vl.attr("x1", x(c.date)).attr("x2", x(c.date)).style("opacity", 1)
        tip.style("opacity", 1).style("left", `${e.pageX + 14}px`).style("top", `${e.pageY - 36}px`)
          .html(`<div style="color:${C.muted};margin-bottom:4px">${d3.timeFormat("%b %d, %Y")(c.date)}</div><div style="color:${color}">${yLabel ?? yKey}: <b>${c.v.toLocaleString()}</b></div>`)
      })
      .on("mouseleave", () => { vl.style("opacity", 0); tip.style("opacity", 0) })
  }, [data, xKey, yKey, color, height])
  return <svg ref={ref} style={{ width: "100%", height, display: "block" }} />
}
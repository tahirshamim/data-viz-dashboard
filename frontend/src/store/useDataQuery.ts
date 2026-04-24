import { useQuery } from "@tanstack/react-query"
import api from "../lib/api"
import { useFilterStore } from "./useFilterStore"

// Hook for climate readings — use this inside any chart component
export function useClimateData() {
  const { country, startDate, endDate, limit } = useFilterStore()

  return useQuery({
    queryKey: ["climate", country, startDate, endDate, limit],
    queryFn: async () => {
      const p = new URLSearchParams()
      p.set("limit", String(limit))
      if (country)   p.set("country", country)
      if (startDate) p.set("start_date", startDate)
      if (endDate)   p.set("end_date", endDate)

      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/climate/readings?${p}`)
      return res.json() as Promise<ClimateReading[]>
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}

export function useClimateSummary() {
  return useQuery({
    queryKey: ["climate-summary"],
    queryFn: async () => {
      const res = await api.get("/api/climate/summary")
      return res.data as ClimateSummary
    },
    staleTime: 5 * 60 * 1000,
  })
}

// TypeScript types matching the backend response shape
export interface ClimateReading {
  id:        number
  station:   string
  country:   string
  latitude:  number
  longitude: number
  temp_c:    number
  humidity:  number
  co2_ppm:   number | null
  timestamp: string
}

export interface ClimateSummary {
  total_records: number
  avg_temp:      number
  avg_co2:       number
  avg_humidity:  number
}
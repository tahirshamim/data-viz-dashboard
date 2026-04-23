import { useQuery } from "@tanstack/react-query"
import api from "../lib/api"
import { useFilterStore } from "./useFilterStore"

// Hook for climate readings — use this inside any chart component
export function useClimateData() {
  const { country, startDate, endDate, limit } = useFilterStore()

  return useQuery({
    queryKey: ["climate", country, startDate, endDate, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit }
      if (country)   params.country    = country
      if (startDate) params.start_date = startDate
      if (endDate)   params.end_date   = endDate

      const res = await api.get("/api/climate/readings", { params })
      return res.data as ClimateReading[]
    },
    staleTime: 5 * 60 * 1000,  // don't re-fetch for 5 minutes
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
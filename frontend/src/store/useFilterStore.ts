import { create } from "zustand"

interface FilterState {
  country:    string | null
  startDate:  string | null
  endDate:    string | null
  dataset:    "climate" | "covid" | "finance"
  limit:      number

  // Actions
  setCountry:    (c: string | null) => void
  setStartDate:  (d: string | null) => void
  setEndDate:    (d: string | null) => void
  setDataset:    (ds: FilterState["dataset"]) => void
  setLimit:      (n: number) => void
  resetFilters:  () => void
}

const defaultState = {
  country:   null,
  startDate: null,
  endDate:   null,
  dataset:   "climate" as const,
  limit:     1000,
}

export const useFilterStore = create<FilterState>((set) => ({
  ...defaultState,

  setCountry:   (country)   => set({ country }),
  setStartDate: (startDate) => set({ startDate }),
  setEndDate:   (endDate)   => set({ endDate }),
  setDataset:   (dataset)   => set({ dataset }),
  setLimit:     (limit)     => set({ limit }),
  resetFilters: ()          => set(defaultState),
}))
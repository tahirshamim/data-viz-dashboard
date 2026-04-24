export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export const get = (url: string) =>
  fetch(API_BASE + url)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })

export default { get }
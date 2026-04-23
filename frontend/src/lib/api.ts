import axios from "axios"

// In development this hits localhost:8000
// In production you'd replace this with your deployed URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 15000,
})

// Log errors in one place instead of in every component
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API error:", error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default api
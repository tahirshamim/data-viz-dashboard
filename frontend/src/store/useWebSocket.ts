import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { io, Socket } from "socket.io-client"

export function useWebSocket() {
  const queryClient = useQueryClient()
  const socketRef   = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL || "http://localhost:8000", {
      transports: ["websocket"],
    })

    socketRef.current = socket

    // When the server pushes new climate data, invalidate the query
    // so React Query automatically re-fetches it
    socket.on("climate_update", () => {
      queryClient.invalidateQueries({ queryKey: ["climate"] })
    })

    socket.on("connect",    () => console.log("WebSocket connected"))
    socket.on("disconnect", () => console.log("WebSocket disconnected"))

    // Clean up when component unmounts
    return () => {
      socket.disconnect()
    }
  }, [queryClient])

  return socketRef
}
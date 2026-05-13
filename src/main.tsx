import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./styles.css"
import { RouterProvider } from "@tanstack/react-router"
import { getRouter } from "./router"

const router = getRouter()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)

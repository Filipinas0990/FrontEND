import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import tsconfigPaths from "vite-tsconfig-paths"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"

// Espelha, no `vite dev`, o proxy que a Vercel faz em produção (api/[...path].ts):
// o front sempre chama /api/... na própria origem e nunca conhece o endereço do
// backend. Sem prefixo VITE_ de propósito — isto é config de servidor, não vai
// para o bundle.
const ALVO_API = process.env.API_BASE_URL ?? "http://localhost:8000"

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: "src/routes" }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    proxy: {
      "/api": {
        target: ALVO_API,
        changeOrigin: true,
      },
    },
  },
})

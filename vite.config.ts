import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: { allowedHosts: true, host: true, port: 3000 },
  server: {
    host: true,
    allowedHosts: true,
    port: 3000,
  },
})

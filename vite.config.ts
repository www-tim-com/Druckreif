import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // './' damit der Build auch aus einem Unterordner läuft (Demo-Versionen weitergeben)
  base: './',
  plugins: [react()],
  // Fester Port: die gemerkte Vault-Freigabe gilt pro Adresse (localhost:5173)
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})

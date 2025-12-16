import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Allow using Vercel-style NEXT_PUBLIC_* env vars in Vite builds (in addition to VITE_*)
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})

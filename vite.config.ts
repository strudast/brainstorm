import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from /brainstorm/ (set in the deploy workflow);
  // local dev, build and preview all stay at /.
  base: process.env.GITHUB_PAGES ? '/brainstorm/' : '/',
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: {
    proxy: {
      '/api': 'http://localhost:3002',
      '/uploads': 'http://localhost:3002'
    }
  }
})

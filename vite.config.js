import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'final01',

  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'final01/Index.html'),
        admin: resolve(__dirname, 'final01/Admin.html')
      }
    }
  },

  server: {
    port: 5500,
    host: true
  },

  esbuild: {
    drop: ['console', 'debugger']
  }
})
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'final01',
  server: {
    port: 5500,
    host: true
  }
  
})

// export default defineConfig({
//   build: {
//     minify: 'esbuild',
//   },
//   esbuild: {
//     // This drops all console.log calls during the production build
//     drop: ['console', 'debugger'], 
//   }
// })
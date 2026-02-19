import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  
  // Build optimizations
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['axios']
        }
      }
    }
  },
  
  // Server configuration
  server: {
    port: 5173,
    host: true,
    open: true
  },
  
  // Asset handling
  assetsInclude: ['**/*.svg', '**/*.png', '**/*.ico', '**/*.webmanifest', '**/*.xml'],
  
  // CSS optimization
  css: {
    devSourcemap: true
  },
  
  // Define global constants
  define: {
    __APP_NAME__: '"DOCCHAT"',
    __APP_VERSION__: '"1.0.0"'
  }
})

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production-ready configuration for Smart AI Schedule Builder.
// Optimized for mobile webview containers (Capacitor/Cordova) and external API integration.
export default defineConfig({
  plugins: [react()],
  // Relative paths for mobile webview compatibility (App Store / Google Play)
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // CORS proxy configuration for external LLM APIs and serverless backends.
    // During local development, frontend requests to /api/openai or /api/anthropic
    // are rewritten to the real provider endpoints, bypassing browser CORS blocks.
    proxy: {
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
        secure: true,
      },
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        secure: true,
      },
      '/api/proxy': {
        // This target is a placeholder. In production, point this at your
        // Vercel function, Supabase Edge Function, or custom backend URL.
        target: process.env.VITE_AI_PROXY_URL || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
        secure: false,
      },
    },
  },
});

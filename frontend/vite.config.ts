import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),   // TailwindCSS v4 Vite plugin (CSS-first, no config file needed)

    // Sentry source-map upload — only runs during `vite build` when
    // SENTRY_AUTH_TOKEN is present in the environment (CI / production builds).
    // In local dev this plugin is a no-op so it never slows the dev server.
    sentryVitePlugin({
      org:     process.env.SENTRY_ORG     ?? '',   // your Sentry org slug
      project: process.env.SENTRY_PROJECT ?? '',   // your Sentry project slug
      // SENTRY_AUTH_TOKEN is read automatically from the environment
      // (set it in CI secrets, never commit it)
      silent:  !process.env.SENTRY_AUTH_TOKEN,     // suppress warnings if token absent
      disable: !process.env.SENTRY_AUTH_TOKEN,     // skip upload if no token (local dev / PRs)
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});

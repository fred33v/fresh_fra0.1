import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Installable web app: home-screen icon, full-screen window, and the site's own files
    // cached so pages open quickly and the guide content still works without a connection.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script",
      includeAssets: ["favicon.ico", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Fraud Risk Assessment",
        short_name: "Fraud Risk",
        description:
          "Fraud risk assessment, staff training and compliance evidence for UK organisations (ECCTA 2023, GovS 013).",
        lang: "en-GB",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: "#1b2a4a",
        background_color: "#ffffff",
        categories: ["business", "education", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Only the site's own files are cached. API responses (personal and organisation
        // data, sign-in tokens) are never stored by the service worker.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// import legacy from '@vitejs/plugin-legacy'
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget =
    env.VITE_PROXY_TARGET?.trim() || "http://43.128.30.50:8080";
  const apiProxy = {
    "/api": {
      target: proxyTarget,
      changeOrigin: true,
    },
  };

  return {
  plugins: [
    react(),
    tailwindcss(),
    // legacy({
    //   targets: ['defaults', 'not IE 11'],
    // }),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      manifest: false,
      injectRegister: false,
      workbox: {
        navigateFallbackDenylist: [/^\/api\//, /^\/[\w-]+\.html/],
        globIgnores: ["**/share*", "airwallex.html"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        share: path.resolve(__dirname, "share.html"),
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    /**
     * 仅当未设置 `VITE_API_BASE_URL`、前端走相对路径 `/api` 时生效。
     * 若已在 `.env` 写死完整接口域名，可忽略此处或删掉 proxy。
     */
    proxy: apiProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    proxy: apiProxy,
  },
};
});

/// <reference types="vite/client" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isDevMode = env.DEV_MODE === "true";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/qubic-rpc": {
          target: isDevMode
            ? "http://103.179.44.202:41841"
            : "https://rpc.qubic.org",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/qubic-rpc/, ""),
        },
        "/qevent": {
          target: "https://dev01.qubic.org",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/qevent/, ""),
        },
      },
      host: true,
      port: 5173,
      open: true,
    },
    preview: {
      host: true,
      port: 4173,
    },
  };
});

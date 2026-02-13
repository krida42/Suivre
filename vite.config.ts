import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/rpc/sui/testnet": {
        target: "https://fullnode.testnet.sui.io",
        changeOrigin: true,
        secure: true,
        rewrite: () => "/",
      },
      "/rpc/sui/mainnet": {
        target: "https://fullnode.mainnet.sui.io",
        changeOrigin: true,
        secure: true,
        rewrite: () => "/",
      },
    },
  },
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "src/app"),
      "@features": path.resolve(__dirname, "src/features"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});

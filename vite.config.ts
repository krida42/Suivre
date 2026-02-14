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
      "@router": path.resolve(__dirname, "src/router"),
      "@providers": path.resolve(__dirname, "src/providers"),
      "@context": path.resolve(__dirname, "src/context"),
      "@pages": path.resolve(__dirname, "src/pages"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@services": path.resolve(__dirname, "src/services"),
      "@mappers": path.resolve(__dirname, "src/mappers"),
      "@models": path.resolve(__dirname, "src/types"),
      "@ui": path.resolve(__dirname, "src/ui"),
      "@config": path.resolve(__dirname, "src/config"),
      "@utils": path.resolve(__dirname, "src/utils"),
    },
  },
});

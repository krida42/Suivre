/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENOKI_PUBLIC_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_REDIRECT_URL?: string;
  readonly VITE_ENOKI_REDIRECT_URL?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_PACKAGE_ID?: string;
  readonly VITE_CONTENT_CREATOR_PACKAGE_ID?: string;
  readonly VITE_ALL_CREATOR_OBJECT_ID?: string;
  readonly VITE_SUI_NETWORK?: "mainnet" | "testnet" | "devnet";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

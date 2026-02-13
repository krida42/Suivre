/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTENT_CREATOR_PACKAGE_ID?: string;
  readonly VITE_ALL_CREATOR_OBJECT_ID?: string;
  readonly VITE_SUI_TESTNET_RPC_URL?: string;
  readonly VITE_SUI_MAINNET_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

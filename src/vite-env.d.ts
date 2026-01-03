/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_APP_ENV?: 'dev' | 'prod';
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};

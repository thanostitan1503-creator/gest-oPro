declare module '@vitejs/plugin-react' {
  import { Plugin } from 'vite';
  interface Options {
    // minimal plugin options supported by the app; keep open for unknown keys
    [key: string]: any;
  }
  export default function react(options?: Options): Plugin;
}

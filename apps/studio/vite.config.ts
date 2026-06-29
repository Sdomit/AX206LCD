import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@dash': r('../engine/src/dashboard/index.ts'),
      '@engine': r('../engine/src'),
    },
  },
  server: { port: 5173 },
});

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Off Vite's default 5173 to avoid clashing with other local frontends.
  // strictPort: fail loudly instead of silently hopping to another port.
  server: { port: 5317, strictPort: true },
  preview: { port: 5318, strictPort: true },
  test: {
    environment: 'node',
  },
});

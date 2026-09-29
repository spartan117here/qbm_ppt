import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-presentation-pdf',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/presentation/')) {
            const relativePath = decodeURIComponent(req.url.slice(1));
            const filePath = path.resolve(import.meta.dirname, relativePath);
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Access-Control-Allow-Origin', '*');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
});

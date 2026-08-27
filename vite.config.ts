import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'anthropic-proxy',
      configureServer(server) {
        server.middlewares.use('/api/anthropic', async (req, res) => {
          if (req.method === 'OPTIONS') {
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, x-bolt-target-provider',
            });
            res.end();
            return;
          }

          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(chunk as Buffer);
            }
            const body = Buffer.concat(chunks).toString();

            const url = 'http://localhost:9091/proxy/anthropic' + (req.url || '');

            const proxyRes = await fetch(url, {
              method: req.method || 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(
                  Object.entries(req.headers)
                    .filter(([k]) => !['host', 'connection', 'content-length'].includes(k))
                    .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || ''])
                ),
              },
              body: req.method === 'GET' ? undefined : body,
            });

            const respBody = await proxyRes.text();
            res.writeHead(proxyRes.status, {
              'Content-Type': proxyRes.headers.get('content-type') || 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(respBody);
          } catch (err: any) {
            console.error('[anthropic-proxy] error:', err.message);
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});

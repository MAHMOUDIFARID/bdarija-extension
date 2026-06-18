import 'dotenv/config';
import dns from 'node:dns';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { translateRouter } from './routes/translate.js';
import { providersRouter } from './routes/providers.js';

// Configure DNS settings to resolve standard 'fetch failed' TypeError issues.
// 1. Filter out broken link-local IPv6 DNS servers (like fe80::1) that timeout on some ISP/Windows routers.
try {
  const ipv4Servers = dns.getServers().filter(s => !s.includes(':'));
  if (ipv4Servers.length > 0) {
    dns.setServers(ipv4Servers);
  }
} catch (e) {
  console.warn('Failed to set custom DNS servers:', e);
}
// 2. Force Node.js to prefer IPv4 over IPv6 during DNS resolution.
dns.setDefaultResultOrder('ipv4first');

const app = new Hono();

// Enable CORS for development. In production, this can be restricted to specific browser extension IDs.
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'x-bdarija-provider', 'x-bdarija-model', 'x-bdarija-style'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

// Route registration
app.route('/translate', translateRouter);
app.route('/providers', providersRouter);

// Basic health check endpoint
app.get('/', (c) => {
  return c.text('Bdarija API is online. Send POST to /translate to translate webpage content.');
});

// Start Node server on specified port
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`[API] Bdarija server is running on http://localhost:${info.port}`);
});

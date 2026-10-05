import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Global CORS headers for cross-origin and iframe compatibility
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Determine primary static directory: prefer dist if present, fallback to current dir
const distDir = path.join(__dirname, 'dist');
const primaryDir = fs.existsSync(distDir) ? distDir : __dirname;

// Serve static assets
app.use(express.static(primaryDir));
if (primaryDir !== __dirname) {
  app.use(express.static(__dirname));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Jaya Agrofarm Nusantara',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Image proxy to safely bypass CORS restrictions for Supabase Storage and external crop photos
app.get('/api/image-proxy', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).send('Invalid protocol');
    }
    const headers = {
      'User-Agent': 'JayaAgrofarm/1.0'
    };
    if (parsed.hostname.includes('supabase.co')) {
      const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ODZg6NtJgUIErxs5gNXX1A_rTIiB0qA';
      headers['apikey'] = key;
    }
    let response = await fetch(imageUrl, { headers });
    // If request failed with apikey header on Supabase Storage public object, retry without custom header
    if (!response.ok && headers['apikey'] && parsed.hostname.includes('supabase.co')) {
      response = await fetch(imageUrl, { headers: { 'User-Agent': 'JayaAgrofarm/1.0' } });
    }
    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).send(`Image proxy error: ${err.message}`);
  }
});

// Helper to clean Supabase URL (strip /rest/v1, /auth/v1, or trailing slashes)
function cleanSupabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return 'https://ubyloojnmqmhhrdqzryt.supabase.co';
  const str = raw.trim();
  try {
    const parsed = new URL(str);
    return parsed.origin;
  } catch (e) {
    return str.replace(/\/rest\/v1\/?$/i, '').replace(/\/auth\/v1\/?$/i, '').replace(/\/+$/, '');
  }
}

// Runtime configuration endpoint for Supabase client
app.get('/api/config', (req, res) => {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ubyloojnmqmhhrdqzryt.supabase.co';
  const url = cleanSupabaseUrl(rawUrl);
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ODZg6NtJgUIErxs5gNXX1A_rTIiB0qA';
  res.json({
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: key
  });
});

app.get('/api/config.js', (req, res) => {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ubyloojnmqmhhrdqzryt.supabase.co';
  const url = cleanSupabaseUrl(rawUrl);
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ODZg6NtJgUIErxs5gNXX1A_rTIiB0qA';
  res.type('application/javascript');
  res.send(`window.__SUPABASE_CONFIG__ = { url: ${JSON.stringify(url)}, key: ${JSON.stringify(key)} };`);
});

// Single Page Application fallback to index.html
app.get('*', (req, res) => {
  const indexPath = fs.existsSync(path.join(primaryDir, 'index.html'))
    ? path.join(primaryDir, 'index.html')
    : path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[Jaya Agrofarm Nusantara] Server running on http://${HOST}:${PORT}`);
});

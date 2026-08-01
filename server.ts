import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '4.0.0',
    service: 'Nifty Planetary Matrix & Trading Terminal API',
    timestamp: new Date().toISOString()
  });
});

// Zerodha Kite / Custom API Proxy Endpoint
app.all('/api/proxy/kite', async (req, res) => {
  try {
    const { url, apiKey, accessToken, enctoken } = req.query;

    if (!url || typeof url !== 'string') {
      res.status(200).json({ status: 'error', message: 'Missing target url parameter' });
      return;
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Kite-Version': '3'
    };

    if (enctoken && typeof enctoken === 'string' && enctoken.trim().length > 0) {
      headers['Authorization'] = `enctoken ${enctoken.trim()}`;
    } else if (apiKey && accessToken && String(apiKey).trim().length > 0 && String(accessToken).trim().length > 0) {
      headers['Authorization'] = `token ${String(apiKey).trim()}:${String(accessToken).trim()}`;
    } else {
      res.status(200).json({
        status: 'error',
        requiresAuth: true,
        message: 'Zerodha Kite API requires an enctoken or API key + access token. Please enter your credentials in the panel.'
      });
      return;
    }

    console.log(`[Proxy Kite] Fetching from: ${url}`);
    const fetchRes = await fetch(url, { headers });
    const data = await fetchRes.json();

    if (!fetchRes.ok || data.status === 'error') {
      res.status(200).json({
        status: 'error',
        message: data.message || data.error_type || `Kite server responded with HTTP ${fetchRes.status}`
      });
      return;
    }

    res.status(200).json(data);
  } catch (err: any) {
    console.error('[Proxy Kite Error]', err);
    res.status(200).json({ status: 'error', message: err.message || 'Failed to proxy Kite request' });
  }
});

// Market presets endpoint
app.get('/api/market-presets', (req, res) => {
  res.json({
    presets: [
      { name: 'Nifty 50 Index', symbol: 'NIFTY', priceLo: 23000, priceHi: 26000, defaultRangeDays: 90 },
      { name: 'BankNifty Index', symbol: 'BANKNIFTY', priceLo: 48000, priceHi: 54000, defaultRangeDays: 90 },
      { name: 'Sensex Index', symbol: 'SENSEX', priceLo: 75000, priceHi: 85000, defaultRangeDays: 90 },
      { name: 'S&P 500 Index', symbol: 'SPX', priceLo: 5000, priceHi: 6200, defaultRangeDays: 90 },
      { name: 'Bitcoin USD', symbol: 'BTCUSD', priceLo: 80000, priceHi: 110000, defaultRangeDays: 90 }
    ]
  });
});

// Statistical Signals catalog endpoint
app.get('/api/signals-catalog', (req, res) => {
  res.json({
    description: "42 statistical breakout signals derived from 6,595-day Nifty analysis (2000-2026, 735 boxing episodes)",
    methods: ["Chi-Squared Test", "Fisher Exact Test", "Permutation Test", "Benjamini-Hochberg FDR", "Bootstrap Confidence Interval"],
    totalSignals: 42,
    tiers: {
      gold: "≥5 statistical methods agree, Bootstrap CI > 1.0 (Confirmed Breakout Signals)",
      silver: "3-4 statistical methods agree (High Probability Watch)",
      bronze: "1-2 statistical methods agree (Secondary Indicator)"
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Planetary Matrix engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

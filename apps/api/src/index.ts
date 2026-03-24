import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { loadEnv } from './config/env';
import agentsRouter from './routes/agents';
import marketplaceRouter from './routes/marketplace';
import transactionsRouter from './routes/transactions';
import leaderboardRouter from './routes/leaderboard';

// Load and validate environment variables first
loadEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────────
app.use(helmet());
// CORS_ORIGIN supports comma-separated list for multi-origin (e.g. Vercel preview + prod)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return cb(null, true);
    }
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'Arcane API',
    version:   '2.1.0',
    network:   process.env.HEDERA_NETWORK || 'testnet',
    timestamp: new Date().toISOString(),
  });
});

// ── Phase 5: API Routes ──────────────────────────────────────────
app.use('/api/agents',       agentsRouter);
app.use('/api/marketplace',  marketplaceRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/leaderboard',  leaderboardRouter);

// ── Analytics ─────────────────────────────────────────────────────
// GET /api/analytics/:agentId/performance
app.get('/api/analytics/:agentId/performance', async (req, res) => {
  try {
    const { getAgentPerformance } = await import('./analytics/performance');
    const perf = await getAgentPerformance(req.params.agentId);
    res.json(perf);
  } catch (err: any) {
    const status = err.message === 'Agent not found' ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── Backtesting ────────────────────────────────────────────────────
// POST /api/backtest  { strategyType, risk, asset, days }
app.post('/api/backtest', async (req, res) => {
  try {
    const { strategyType, risk, asset = 'HBAR/USDC', days = 90 } = req.body;
    if (!strategyType || !risk) {
      return res.status(400).json({ error: 'strategyType and risk are required' });
    }
    const { fetchHistoricalOHLCV, runBacktest } = await import('./backtesting/backtester');
    const ohlcv  = await fetchHistoricalOHLCV(asset, days);
    const result = await runBacktest({ strategyType, risk, asset }, ohlcv);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Root ─────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name:        'Arcane API',
    description: 'AI-Powered Trading Agent Platform on Hedera Blockchain',
    version:     '2.1.0',
    hackathon:   'Hedera APEX Hackathon 2026 — Track 1: AI & Agents',
    routes: {
      health:           'GET  /health',
      buildAgent:       'POST /api/agents/build',
      deployAgent:      'POST /api/agents/deploy',
      listAgents:       'GET  /api/agents',
      getAgent:         'GET  /api/agents/:id',
      agentHistory:     'GET  /api/agents/:id/history   ← Mirror Node source of truth',
      runAgent:         'POST /api/agents/:id/run',
      pauseAgent:       'PUT  /api/agents/:id/pause',
      marketplace:      'GET  /api/marketplace',
      listNFT:          'POST /api/marketplace/list',
      getListingDetail: 'GET  /api/marketplace/:id',
      delistNFT:        'DELETE /api/marketplace/:id',
      logTransaction:   'POST /api/transactions',
      getTransactions:  'GET  /api/transactions?ownerId=X',
      leaderboard:      'GET  /api/leaderboard?sortBy=winRate&limit=20',
      analytics:        'GET  /api/analytics/:agentId/performance',
      backtest:         'POST /api/backtest',
    },
  });
});

// ── 404 handler ──────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ─────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Arcane API Error]', err.message);
  res.status(500).json({
    error:   'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ── Start server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('   █████╗ ██████╗  ██████╗ █████╗ ███╗   ██╗███████╗');
  console.log('  ██╔══██╗██╔══██╗██╔════╝██╔══██╗████╗  ██║██╔════╝');
  console.log('  ███████║██████╔╝██║     ███████║██╔██╗ ██║█████╗  ');
  console.log('  ██╔══██║██╔══██╗██║     ██╔══██║██║╚██╗██║██╔══╝  ');
  console.log('  ██║  ██║██║  ██║╚██████╗██║  ██║██║ ╚████║███████╗');
  console.log('  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝');
  console.log('');
  console.log(`  Arcane API v2.1.0 — Hedera APEX Hackathon 2026`);
  console.log(`  Server:  http://localhost:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  Network: ${process.env.HEDERA_NETWORK || 'testnet'}`);
  console.log(`  Mode:    ${process.env.NODE_ENV || 'development'}`);
  console.log('');
});

export default app;

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient({ log: [] });

// POST /api/transactions
// Records a single HashPack-approved on-chain transaction.
router.post('/', async (req: Request, res: Response) => {
  const { ownerId, agentId, type, txId, status, details, hashscanUrl } = req.body;

  if (!ownerId || !type || !txId || !hashscanUrl) {
    res.status(400).json({ error: 'Missing required fields: ownerId, type, txId, hashscanUrl' });
    return;
  }

  const VALID_TYPES = ['DEPLOY_HFS', 'DEPLOY_HCS', 'DEPLOY_HSCS', 'TRADE_SWAP', 'TOKEN_ASSOCIATE'];
  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    return;
  }

  try {
    const tx = await prisma.transaction.create({
      data: {
        ownerId,
        agentId:    agentId   ?? null,
        type,
        txId,
        status:     status    ?? 'SUCCESS',
        details:    details   ?? null,
        hashscanUrl,
      },
    });

    res.status(201).json({
      id:        tx.id,
      txId:      tx.txId,
      type:      tx.type,
      createdAt: tx.createdAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[transactions] POST error:', msg);
    res.status(500).json({ error: 'Failed to record transaction', message: msg });
  }
});

// GET /api/transactions?ownerId=X&limit=50
// Returns all transactions for a wallet owner, newest first.
router.get('/', async (req: Request, res: Response) => {
  const { ownerId, limit } = req.query;

  if (!ownerId || typeof ownerId !== 'string') {
    res.status(400).json({ error: 'ownerId query param required' });
    return;
  }

  const take = Math.min(parseInt(String(limit ?? '50'), 10) || 50, 200);

  try {
    const txs = await prisma.transaction.findMany({
      where:   { ownerId },
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json({ transactions: txs, total: txs.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[transactions] GET error:', msg);
    res.status(500).json({ error: 'Failed to fetch transactions', message: msg });
  }
});

export default router;

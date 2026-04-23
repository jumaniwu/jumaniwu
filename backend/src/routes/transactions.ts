import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { type, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = { userId: req.userId };
  if (type && type !== 'all') {
    if (type === 'rental_distribution') {
      // Yield receipts are a separate table — merge below
    } else {
      where.type = type;
    }
  }

  const [transactions, yieldReceipts] = await Promise.all([
    type === 'rental_distribution' ? [] : prisma.transaction.findMany({
      where,
      include: { property: { select: { name: true, images: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    (!type || type === 'all' || type === 'rental_distribution') ? prisma.yieldReceipt.findMany({
      where: { userId: req.userId },
      include: { yieldDistribution: { include: { property: { select: { id: true, name: true, images: true } } } } },
      orderBy: { receivedAt: 'desc' },
      take: parseInt(limit),
    }) : [],
  ]);

  const txList = transactions.map((t: any) => ({
    id: t.id,
    type: t.type,
    propertyId: t.propertyId,
    property: t.property,
    tokenAmount: t.tokenAmount,
    totalAmountIdr: t.totalAmountIdr,
    status: t.status,
    createdAt: t.createdAt,
  }));

  const yieldList = yieldReceipts.map((r: any) => ({
    id: r.id,
    type: 'rental_distribution',
    propertyId: r.yieldDistribution.propertyId,
    property: r.yieldDistribution.property,
    tokenAmount: 0,
    totalAmountIdr: r.amountIdr,
    status: 'completed',
    createdAt: r.receivedAt,
  }));

  const combined = [...txList, ...yieldList].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json({ success: true, data: combined });
});

export default router;

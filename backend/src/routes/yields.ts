import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { propertyId, month, year } = req.query as Record<string, string>;

  const receipts = await prisma.yieldReceipt.findMany({
    where: {
      userId: req.userId,
      ...(propertyId ? { yieldDistribution: { propertyId } } : {}),
      ...(month ? { yieldDistribution: { month: parseInt(month) } } : {}),
      ...(year ? { yieldDistribution: { year: parseInt(year) } } : {}),
    },
    include: {
      yieldDistribution: { include: { property: { select: { name: true, images: true } } } },
    },
    orderBy: { receivedAt: 'desc' },
  });

  const data = receipts.map((r) => ({
    id: r.id,
    propertyId: r.yieldDistribution.propertyId,
    propertyName: r.yieldDistribution.property.name,
    propertyImage: r.yieldDistribution.property.images[0],
    transactionId: r.transactionId,
    amountIdr: r.amountIdr,
    month: r.yieldDistribution.month,
    year: r.yieldDistribution.year,
    receivedAt: r.receivedAt,
    status: 'received',
  }));

  res.json({ success: true, data });
});

router.get('/summary', async (req: AuthRequest, res: Response) => {
  const result = await prisma.yieldReceipt.aggregate({
    where: { userId: req.userId },
    _sum: { amountIdr: true },
    _count: true,
  });
  res.json({ success: true, data: { totalIdr: result._sum.amountIdr ?? 0, count: result._count } });
});

export default router;

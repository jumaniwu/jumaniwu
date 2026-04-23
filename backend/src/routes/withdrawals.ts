import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: req.userId },
    include: { bankAccount: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: withdrawals });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { bankAccountId, amountIdr } = z.object({
    bankAccountId: z.string(),
    amountIdr: z.number().positive().min(10000),
  }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || user.balanceIdr < amountIdr) {
    res.status(400).json({ success: false, message: 'Insufficient balance' }); return;
  }

  const account = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, userId: req.userId } });
  if (!account) { res.status(404).json({ success: false, message: 'Bank account not found' }); return; }

  const [withdrawal] = await prisma.$transaction([
    prisma.withdrawal.create({ data: { userId: req.userId!, bankAccountId, amountIdr, status: 'pending' } }),
    prisma.user.update({ where: { id: req.userId }, data: { balanceIdr: { decrement: amountIdr } } }),
  ]);

  res.status(201).json({ success: true, data: withdrawal });
});

router.get('/history', async (req: AuthRequest, res: Response) => {
  const history = await prisma.withdrawal.findMany({
    where: { userId: req.userId, status: { in: ['completed', 'failed'] } },
    include: { bankAccount: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: history });
});

export default router;

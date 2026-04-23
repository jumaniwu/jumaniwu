import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const accounts = await prisma.bankAccount.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: accounts });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { bankName, accountNumber, accountHolder } = z.object({
    bankName: z.string().min(2),
    accountNumber: z.string().min(8),
    accountHolder: z.string().min(3),
  }).parse(req.body);

  const account = await prisma.bankAccount.create({ data: { userId: req.userId!, bankName, accountNumber, accountHolder } });
  res.status(201).json({ success: true, data: account });
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const account = await prisma.bankAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!account) { res.status(404).json({ success: false, message: 'Bank account not found' }); return; }
  await prisma.bankAccount.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Bank account deleted' });
});

export default router;

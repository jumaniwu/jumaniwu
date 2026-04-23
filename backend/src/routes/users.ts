import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, username: true, email: true, name: true, phoneNumber: true, dateOfBirth: true, profileImage: true, referralCode: true, walletAddress: true, balanceIdr: true, isVerified: true, kycStatus: true, language: true, hideBalance: true, createdAt: true },
  });
  if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
  res.json({ success: true, data: user });
});

router.patch('/me/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    username: z.string().min(3).max(30).optional(),
    name: z.string().optional(),
    phoneNumber: z.string().optional(),
    dateOfBirth: z.string().optional(),
  });
  const data = schema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ success: true, data: user });
});

router.patch('/me/language', authenticate, async (req: AuthRequest, res: Response) => {
  const { lang } = z.object({ lang: z.enum(['id', 'en']) }).parse(req.body);
  await prisma.user.update({ where: { id: req.userId }, data: { language: lang } });
  res.json({ success: true });
});

router.patch('/me/hide-balance', authenticate, async (req: AuthRequest, res: Response) => {
  const { hide } = z.object({ hide: z.boolean() }).parse(req.body);
  await prisma.user.update({ where: { id: req.userId }, data: { hideBalance: hide } });
  res.json({ success: true });
});

router.delete('/me', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.user.delete({ where: { id: req.userId } });
  res.json({ success: true, message: 'Account deleted' });
});

export default router;

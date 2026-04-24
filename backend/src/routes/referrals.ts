import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/my-stats', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { referralCode: true } });
  const totalReferred = await prisma.user.count({ where: { referredById: req.userId } });

  // 1% cashback on first purchases by referred users
  const referredUsers = await prisma.user.findMany({ where: { referredById: req.userId }, select: { id: true } });
  const referredIds = referredUsers.map((u) => u.id);

  const firstPurchases = await prisma.transaction.findMany({
    where: { userId: { in: referredIds }, type: 'buy', status: 'completed' },
    distinct: ['userId'],
  });

  const totalCashbackIdr = firstPurchases.reduce((sum, tx) => sum + tx.totalAmountIdr * 0.01, 0);

  res.json({
    success: true,
    data: {
      referralCode: user?.referralCode,
      referralLink: `https://griyaku.app/invite/${user?.referralCode}`,
      totalReferred,
      totalCashbackIdr,
    },
  });
});

router.get('/leaderboard', async (req: AuthRequest, res: Response) => {
  const { period = 'all-time' } = req.query as { period: string };

  let sinceDate: Date | undefined;
  if (period === 'weekly') sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  else if (period === 'monthly') sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const allUsers = await prisma.user.findMany({
    select: { id: true, username: true, profileImage: true, isVerified: true },
    where: { referrals: { some: {} } },
    take: 200,
  });

  const counts = await Promise.all(
    allUsers.map(async (u) => {
      const count = await prisma.user.count({
        where: { referredById: u.id, ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}) },
      });
      return { ...u, invitedUsers: count };
    })
  );

  const sorted = counts
    .filter((u) => u.invitedUsers > 0)
    .sort((a, b) => b.invitedUsers - a.invitedUsers)
    .slice(0, 50)
    .map((u, i) => ({ rank: i + 1, userId: u.id, username: u.username, profileImage: u.profileImage, isVerified: u.isVerified, invitedUsers: u.invitedUsers }));

  res.json({ success: true, data: sorted });
});

export default router;

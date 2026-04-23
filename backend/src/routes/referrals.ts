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

  let dateFilter: Date | undefined;
  if (period === 'weekly') dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  else if (period === 'monthly') dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const referrers = await prisma.user.findMany({
    select: { id: true, username: true, profileImage: true, isVerified: true, _count: { select: { referrals: true } } },
    orderBy: { referrals: { _count: 'desc' } },
    take: 50,
  });

  const data = referrers.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    username: u.username,
    profileImage: u.profileImage,
    isVerified: u.isVerified,
    invitedUsers: u._count.referrals,
  }));

  res.json({ success: true, data });
});

export default router;

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  const { search, status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (status) where.status = status;

  const [properties, total] = await Promise.all([
    prisma.property.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.property.count({ where }),
  ]);

  res.json({ success: true, data: properties, total, page: parseInt(page), limit: parseInt(limit), hasMore: skip + properties.length < total });
});

router.get('/featured', async (_req: Request, res: Response) => {
  const properties = await prisma.property.findMany({ where: { isFeatured: true }, take: 10, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: properties });
});

router.get('/running-out-soon', async (_req: Request, res: Response) => {
  const properties = await prisma.property.findMany({
    where: { OR: [{ status: 'running_out' }, { tokensAvailable: { lte: 100 } }] },
    take: 10,
    orderBy: { tokensAvailable: 'asc' },
  });
  res.json({ success: true, data: properties });
});

router.get('/:id', async (req: Request, res: Response) => {
  const property = await prisma.property.findUnique({ where: { id: req.params.id }, include: { documents: true } });
  if (!property) { res.status(404).json({ success: false, message: 'Property not found' }); return; }
  res.json({ success: true, data: property });
});

router.get('/:id/top-holders', async (req: Request, res: Response) => {
  const holdings = await prisma.tokenHolding.findMany({
    where: { propertyId: req.params.id },
    include: { user: { select: { id: true, username: true, profileImage: true, isVerified: true } } },
    orderBy: { tokenAmount: 'desc' },
    take: 10,
  });

  const property = await prisma.property.findUnique({ where: { id: req.params.id }, select: { totalTokens: true } });
  const data = holdings.map((h, i) => ({
    rank: i + 1,
    userId: h.user.id,
    username: h.user.username,
    profileImage: h.user.profileImage,
    isVerified: h.user.isVerified,
    tokenAmount: h.tokenAmount,
    percentage: property ? (h.tokenAmount / property.totalTokens) * 100 : 0,
    isCurrentUser: false,
  }));

  res.json({ success: true, data });
});

router.get('/:id/yield-history', async (req: Request, res: Response) => {
  const distributions = await prisma.yieldDistribution.findMany({
    where: { propertyId: req.params.id },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    take: 24,
  });

  const data = distributions.map((d) => ({
    month: `${String(d.month).padStart(2, '0')}/${d.year}`,
    annualizedYield: d.amountPerToken * 12,
  }));

  res.json({ success: true, data });
});

router.get('/:id/timeline', async (req: Request, res: Response) => {
  const timeline = await prisma.propertyTimeline.findMany({
    where: { propertyId: req.params.id },
    orderBy: { order: 'asc' },
  });
  res.json({ success: true, data: timeline });
});

router.get('/:id/blockchain', async (req: Request, res: Response) => {
  const property = await prisma.property.findUnique({
    where: { id: req.params.id },
    select: { contractAddress: true, tokenId: true },
  });
  if (!property) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  res.json({ success: true, data: { contractAddress: property.contractAddress, tokenId: property.tokenId, network: 'Polygon PoS mainnet' } });
});

export default router;

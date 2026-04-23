import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { broadcastActivity } from '../app';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.post('/buy', async (req: AuthRequest, res: Response) => {
  const { propertyId, tokenAmount } = z.object({
    propertyId: z.string(),
    tokenAmount: z.number().int().positive(),
  }).parse(req.body);

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) { res.status(404).json({ success: false, message: 'Property not found' }); return; }
  if (property.tokensAvailable < tokenAmount) { res.status(400).json({ success: false, message: 'Not enough tokens available' }); return; }

  const totalAmountIdr = property.tokenPriceIdr * tokenAmount;
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || user.balanceIdr < totalAmountIdr) { res.status(400).json({ success: false, message: 'Insufficient balance' }); return; }

  const [tx] = await prisma.$transaction([
    prisma.transaction.create({
      data: { userId: req.userId!, propertyId, type: 'buy', tokenAmount, pricePerToken: property.tokenPriceIdr, totalAmountIdr, status: 'completed' },
    }),
    prisma.user.update({ where: { id: req.userId }, data: { balanceIdr: { decrement: totalAmountIdr } } }),
    prisma.property.update({ where: { id: propertyId }, data: { tokensAvailable: { decrement: tokenAmount } } }),
    prisma.tokenHolding.upsert({
      where: { userId_propertyId: { userId: req.userId!, propertyId } },
      create: { userId: req.userId!, propertyId, tokenAmount, avgCostIdr: property.tokenPriceIdr },
      update: { tokenAmount: { increment: tokenAmount } },
    }),
  ]);

  broadcastActivity(`A GROWER has just bought ${tokenAmount} tokens of`, property.name, propertyId);

  // Auto-update status
  if (property.tokensAvailable - tokenAmount <= 100) {
    await prisma.property.update({ where: { id: propertyId }, data: { status: property.tokensAvailable - tokenAmount === 0 ? 'fully_funded' : 'running_out' } });
  }

  res.status(201).json({ success: true, data: tx });
});

router.post('/sell', async (req: AuthRequest, res: Response) => {
  const { propertyId, tokenAmount } = z.object({
    propertyId: z.string(),
    tokenAmount: z.number().int().positive(),
  }).parse(req.body);

  const holding = await prisma.tokenHolding.findUnique({ where: { userId_propertyId: { userId: req.userId!, propertyId } } });
  if (!holding || holding.tokenAmount - holding.lockedTokens < tokenAmount) {
    res.status(400).json({ success: false, message: 'Insufficient tokens to sell' }); return;
  }

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) { res.status(404).json({ success: false, message: 'Property not found' }); return; }

  const totalAmountIdr = property.tokenPriceIdr * tokenAmount;

  await prisma.$transaction([
    prisma.transaction.create({
      data: { userId: req.userId!, propertyId, type: 'sell', tokenAmount, pricePerToken: property.tokenPriceIdr, totalAmountIdr, status: 'completed' },
    }),
    prisma.user.update({ where: { id: req.userId }, data: { balanceIdr: { increment: totalAmountIdr } } }),
    prisma.property.update({ where: { id: propertyId }, data: { tokensAvailable: { increment: tokenAmount } } }),
    prisma.tokenHolding.update({ where: { userId_propertyId: { userId: req.userId!, propertyId } }, data: { tokenAmount: { decrement: tokenAmount } } }),
  ]);

  res.json({ success: true, message: `Sold ${tokenAmount} tokens` });
});

router.post('/swap', async (req: AuthRequest, res: Response) => {
  const { fromPropertyId, toPropertyId, tokenAmount } = z.object({
    fromPropertyId: z.string(),
    toPropertyId: z.string(),
    tokenAmount: z.number().int().positive(),
  }).parse(req.body);

  const [fromProperty, toProperty] = await Promise.all([
    prisma.property.findUnique({ where: { id: fromPropertyId } }),
    prisma.property.findUnique({ where: { id: toPropertyId } }),
  ]);

  if (!fromProperty || !toProperty) { res.status(404).json({ success: false, message: 'Property not found' }); return; }
  if (toProperty.tokensAvailable < tokenAmount) { res.status(400).json({ success: false, message: 'Target property has insufficient tokens' }); return; }

  const holding = await prisma.tokenHolding.findUnique({ where: { userId_propertyId: { userId: req.userId!, propertyId: fromPropertyId } } });
  if (!holding || holding.tokenAmount < tokenAmount) { res.status(400).json({ success: false, message: 'Insufficient tokens to swap' }); return; }

  await prisma.$transaction([
    prisma.tokenHolding.update({ where: { userId_propertyId: { userId: req.userId!, propertyId: fromPropertyId } }, data: { tokenAmount: { decrement: tokenAmount } } }),
    prisma.tokenHolding.upsert({ where: { userId_propertyId: { userId: req.userId!, propertyId: toPropertyId } }, create: { userId: req.userId!, propertyId: toPropertyId, tokenAmount, avgCostIdr: toProperty.tokenPriceIdr }, update: { tokenAmount: { increment: tokenAmount } } }),
    prisma.property.update({ where: { id: fromPropertyId }, data: { tokensAvailable: { increment: tokenAmount } } }),
    prisma.property.update({ where: { id: toPropertyId }, data: { tokensAvailable: { decrement: tokenAmount } } }),
    prisma.transaction.create({ data: { userId: req.userId!, propertyId: fromPropertyId, type: 'swap', tokenAmount, pricePerToken: fromProperty.tokenPriceIdr, totalAmountIdr: 0, status: 'completed' } }),
  ]);

  res.json({ success: true, message: 'Swap completed' });
});

router.get('/portfolio', async (req: AuthRequest, res: Response) => {
  const holdings = await prisma.tokenHolding.findMany({
    where: { userId: req.userId },
    include: { property: true },
  });

  const enriched = await Promise.all(holdings.map(async (h) => {
    const lastDist = await prisma.yieldDistribution.findFirst({
      where: { propertyId: h.propertyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    const totalYield = await prisma.yieldReceipt.aggregate({ where: { userId: req.userId!, yieldDistribution: { propertyId: h.propertyId } }, _sum: { amountIdr: true } });

    return {
      ...h,
      currentValueIdr: h.tokenAmount * h.property.tokenPriceIdr,
      lastRentEarnedIdr: lastDist ? lastDist.amountPerToken * h.tokenAmount : 0,
      lastRentAnnualizedPct: lastDist ? (lastDist.amountPerToken * 12) / h.property.tokenPriceIdr * 100 : 0,
      totalRentEarnedIdr: totalYield._sum.amountIdr ?? 0,
      totalRentAnnualizedPct: h.property.eryAnnual,
    };
  }));

  res.json({ success: true, data: enriched });
});

export default router;

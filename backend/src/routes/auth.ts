import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';

const router = Router();
const prisma = new PrismaClient();

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function signTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8),
  referralCode: z.string().optional(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, referralCode } = registerSchema.parse(req.body);

    const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (exists) { res.status(400).json({ success: false, message: 'Email or username already in use' }); return; }

    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findFirst({ where: { referralCode } });
      if (referrer) referredById = referrer.id;
    }

    // Generate a Polygon wallet for this user
    const wallet = ethers.Wallet.createRandom();

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        referralCode: generateReferralCode(),
        walletAddress: wallet.address,
        referredById,
      },
    });

    const { accessToken, refreshToken } = signTokens(user.id);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({ success: true, data: { accessToken, refreshToken, user: safeUser } });
  } catch (err: any) {
    if (err.name === 'ZodError') { res.status(400).json({ success: false, message: err.errors[0].message }); return; }
    console.error(err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) { res.status(401).json({ success: false, message: 'Invalid credentials' }); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ success: false, message: 'Invalid credentials' }); return; }

    const { accessToken, refreshToken } = signTokens(user.id);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    const { passwordHash: _, ...safeUser } = user;
    res.json({ success: true, data: { accessToken, refreshToken, user: safeUser } });
  } catch (err: any) {
    if (err.name === 'ZodError') { res.status(400).json({ success: false, message: err.errors[0].message }); return; }
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ success: false, message: 'Refresh token required' }); return; }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ success: false, message: 'Invalid or expired refresh token' }); return;
    }

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    const { accessToken, refreshToken: newRefresh } = signTokens(payload.userId);

    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    await prisma.refreshToken.create({
      data: { token: newRefresh, userId: payload.userId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) await prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  res.json({ success: true, message: 'Logged out' });
});

export default router;

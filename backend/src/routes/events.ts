import { Router, Request, Response } from 'express';

const router = Router();

// Static event data — in production this would come from DB
const events = [
  {
    id: '1',
    title: 'LIGA CUAN Season 5',
    date: 'April 9 – May 8, 2026',
    description: 'Invest, top the leaderboard, and claim your prize! Top 10 investors win exclusive rewards.',
    imageUrl: null,
  },
  {
    id: '2',
    title: 'Halal Bihalal 2026: Maju Bersama GRIYAKU',
    date: 'May 2026',
    description: 'Kuatkan Silaturahmi, Optimalkan Investasi. Join our annual gathering for investors.',
    imageUrl: null,
  },
];

router.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: events });
});

export default router;

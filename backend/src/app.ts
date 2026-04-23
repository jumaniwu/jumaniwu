import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { rateLimit } from 'express-rate-limit';
import 'dotenv/config';

import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import propertiesRoutes from './routes/properties';
import investmentsRoutes from './routes/investments';
import yieldsRoutes from './routes/yields';
import bankAccountsRoutes from './routes/bankAccounts';
import withdrawalsRoutes from './routes/withdrawals';
import referralsRoutes from './routes/referrals';
import transactionsRoutes from './routes/transactions';
import eventsRoutes from './routes/events';

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/investments', investmentsRoutes);
app.use('/api/yields', yieldsRoutes);
app.use('/api/bank-accounts', bankAccountsRoutes);
app.use('/api/withdrawals', withdrawalsRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/events', eventsRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'GRIYAKU' }));

// Socket.io - real-time activity feed
io.on('connection', (socket) => {
  socket.join('activity-feed');
});

export function broadcastActivity(message: string, propertyName: string, propertyId: string) {
  io.to('activity-feed').emit('activity', { message, propertyName, propertyId, timestamp: new Date() });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🏠 GRIYAKU backend running on port ${PORT}`);
});

export default app;

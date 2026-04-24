# GRIYAKU — Blockchain Property Investment Platform

Investasi properti fraksional mulai IDR 10.000, powered by Polygon blockchain.

## Structure

```
jumaniwu/
├── mobile/       React Native + Expo (iOS & Android)
├── backend/      Node.js + Express + Prisma + PostgreSQL
└── contracts/    Solidity Smart Contracts (Polygon)
```

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env   # Fill in your credentials
npm install
npx prisma migrate dev
npx ts-node prisma/seed.ts
npm run dev
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

### Contracts
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network polygonMumbai
```

## Tech Stack
- **Mobile**: React Native + Expo Router + Zustand + TanStack Query
- **Backend**: Node.js + Express + Prisma ORM + PostgreSQL + Socket.io
- **Blockchain**: Solidity + Hardhat + OpenZeppelin + Polygon PoS
- **Auth**: JWT + OAuth (Google, Facebook, Apple)

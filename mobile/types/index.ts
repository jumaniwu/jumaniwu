export interface User {
  id: string;
  username: string;
  email: string;
  name?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  profileImage?: string;
  referralCode: string;
  walletAddress?: string;
  balanceIdr: number;
  isVerified: boolean;
  kycStatus: 'pending' | 'verified' | 'rejected';
  language: 'id' | 'en';
  hideBalance: boolean;
  createdAt: string;
}

export interface Property {
  id: string;
  name: string;
  location: string;
  city: string;
  description: string;
  totalTokens: number;
  tokensAvailable: number;
  tokensSold: number;
  tokenPriceIdr: number;
  currentValueIdr: number;
  propertyType: 'villa' | 'apartment' | 'shophouse' | 'house';
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  eryAnnual: number;
  ecaAnnual: number;
  aryAnnual?: number;
  status: 'available' | 'running_out' | 'fully_funded' | 'closed';
  contractAddress?: string;
  tokenId?: number;
  images: string[];
  airbnbUrl?: string;
  isFeatured: boolean;
  createdAt: string;
}

export interface TokenHolding {
  id: string;
  userId: string;
  propertyId: string;
  property: Property;
  tokenAmount: number;
  avgCostIdr: number;
  currentValueIdr: number;
  lastRentEarnedIdr: number;
  lastRentAnnualizedPct: number;
  totalRentEarnedIdr: number;
  totalRentAnnualizedPct: number;
  lockedTokens: number;
}

export interface Transaction {
  id: string;
  userId: string;
  propertyId: string;
  property: Property;
  type: 'buy' | 'sell' | 'swap' | 'rental_distribution';
  tokenAmount: number;
  pricePerToken: number;
  totalAmountIdr: number;
  blockchainTxHash?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface YieldReceipt {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyImage?: string;
  transactionId: string;
  amountIdr: number;
  month: number;
  year: number;
  receivedAt: string;
  status: 'received';
}

export interface BankAccount {
  id: string;
  userId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isVerified: boolean;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  bankAccountId: string;
  bankAccount: BankAccount;
  amountIdr: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface TopHolder {
  rank: number;
  userId: string;
  username: string;
  profileImage?: string;
  isVerified: boolean;
  tokenAmount: number;
  percentage: number;
  isCurrentUser: boolean;
}

export interface YieldChartData {
  month: string;
  annualizedYield: number;
}

export interface PropertyTimeline {
  id: string;
  date: string;
  title: string;
  description: string;
  order: number;
}

export interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferred: number;
  totalCashbackIdr: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  profileImage?: string;
  isVerified: boolean;
  invitedUsers: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

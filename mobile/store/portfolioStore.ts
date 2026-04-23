import { create } from 'zustand';
import { TokenHolding } from '../types';

interface PortfolioState {
  holdings: TokenHolding[];
  totalPropertyValueIdr: number;
  totalEarningsIdr: number;
  setHoldings: (holdings: TokenHolding[]) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  holdings: [],
  totalPropertyValueIdr: 0,
  totalEarningsIdr: 0,

  setHoldings: (holdings) => {
    const totalPropertyValueIdr = holdings.reduce((sum, h) => sum + h.currentValueIdr, 0);
    const totalEarningsIdr = holdings.reduce((sum, h) => sum + h.totalRentEarnedIdr, 0);
    set({ holdings, totalPropertyValueIdr, totalEarningsIdr });
  },
}));

import { Currency } from '../types';

export const USD_EXCHANGE_RATE = 300; // 1 USD = 300 LKR

export function formatPrice(lkrAmount: number, currency: Currency): string {
  if (currency === 'USD') {
    const usd = lkrAmount / USD_EXCHANGE_RATE;
    return `$${usd.toFixed(2)}`;
  }
  return `LKR ${lkrAmount.toLocaleString()}`;
}

export function formatDualPrice(lkrAmount: number): { lkr: string; usd: string } {
  return {
    lkr: `LKR ${lkrAmount.toLocaleString()}`,
    usd: `$${(lkrAmount / USD_EXCHANGE_RATE).toFixed(2)}`,
  };
}

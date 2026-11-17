import { INTEREST_CAP, INTEREST_RATE, SELL_REFUND } from './config.js';
export function waveClearBonus(wave) {
  return 15 + 4 * wave;
}
export function interest(coins, rate = INTEREST_RATE) {
  return Math.min(INTEREST_CAP, Math.floor(coins * rate));
}
export function sellValue(invested) {
  return Math.floor(invested * SELL_REFUND);
}

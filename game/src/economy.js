// The garden's economy: kill rewards come from the enemy, wave-clear bonuses and
// interest come from here, and selling a tower refunds part of what went into it.
import { INTEREST_CAP, INTEREST_RATE, SELL_REFUND } from './config.js';

/** Coins for clearing a wave: a flat purse that grows a little each wave. */
export function waveClearBonus(wave) {
  return 15 + 4 * wave;
}

/** Interest on banked coins at wave end: a rate (10% by default), capped so hoarding never wins alone. */
export function interest(coins, rate = INTEREST_RATE) {
  return Math.min(INTEREST_CAP, Math.floor(coins * rate));
}

/** What selling a tower pays back: 70% of everything invested in it. */
export function sellValue(invested) {
  return Math.floor(invested * SELL_REFUND);
}

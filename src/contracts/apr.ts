// Rates are percentage APR, not APY. Unknown is never represented as zero.
export type AprEvidence = { rewards?: number; fees?: number; window?: string };
export function totalApr(evidence: AprEvidence): number | undefined {
  const { rewards, fees } = evidence;
  return rewards !== undefined && fees !== undefined &&
    Number.isFinite(rewards) && Number.isFinite(fees) && rewards >= 0 && fees >= 0
    ? rewards + fees : undefined;
}
export function formatApr(value?: number) {
  return value === undefined || !Number.isFinite(value) ? "N/A" : `${value.toFixed(2)}%`;
}
// No trustworthy Sepolia prices, block-time annualization, or retained-fee history
// are configured. The live UI deliberately supplies no speculative APR evidence.
export const LIVE_APR: AprEvidence = {};

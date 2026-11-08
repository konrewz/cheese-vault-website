import { formatUnits, parseUnits } from "viem";

/** Reject excess precision before parseUnits (which otherwise rounds). No floating point enters a transaction. */
export function parseAmount(text: string, decimals: number): bigint {
  if (!/^\d+(\.\d*)?$/.test(text))
    throw new Error(
      "Enter a positive amount using numbers and a decimal point.",
    );
  if ((text.split(".")[1]?.length ?? 0) > decimals)
    throw new Error(`Use at most ${decimals} decimal places.`);
  const amount = parseUnits(text, decimals);
  if (amount <= 0n) throw new Error("Enter an amount greater than zero.");
  return amount;
}
export function fullAmount(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}
export function displayAmount(
  value: bigint | undefined,
  decimals = 18,
  places = 4,
): string {
  if (value === undefined) return "—";
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (!fraction) return grouped;
  const trimmed = fraction.slice(0, places).replace(/0+$/, "");
  if (value > 0n && whole === "0" && !trimmed)
    return `<0.${"0".repeat(places - 1)}1`;
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}
export function compactAmount(
  value: bigint | undefined,
  decimals = 18,
): string {
  if (value === undefined) return "—";
  const unit = 10n ** BigInt(decimals);
  for (const [divisor, suffix] of [
    [1_000_000_000n, "B"],
    [1_000_000n, "M"],
  ] as const) {
    if (value >= divisor * unit)
      return `${displayAmount(value / divisor, decimals, 2)}${suffix}`;
  }
  return displayAmount(value, decimals, 2);
}
export function sharesForAssets(
  assets: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return (assets * (totalShares + 1000n)) / (totalAssets + 1n);
}
export type WithdrawalQuote = {
  gross: bigint;
  paid: bigint;
  retained: bigint;
  treasury: bigint;
};
/** Exact source formula, used by tests. The live UI uses the contract's previewWithdraw instead. */
export function sourceWithdrawal(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): WithdrawalQuote {
  const assetsFor = (s: bigint) =>
    (s * (totalAssets + 1n)) / (totalShares + 1000n);
  const gross = assetsFor(shares);
  const fee = (gross * 1500n) / 10000n;
  const paid = gross - fee;
  const remaining = totalShares > shares ? totalShares - shares : 0n;
  let retained = (gross * 1400n) / 10000n;
  const cap = (assetsFor(remaining) * 1500n) / 8500n;
  if (retained > cap) retained = cap;
  if (shares >= totalShares)
    return { gross, paid, retained: 0n, treasury: totalAssets - paid };
  return { gross, paid, retained, treasury: fee - retained };
}
export function friendlyError(error: unknown): string {
  const e = error as {
    name?: string;
    code?: number;
    shortMessage?: string;
    message?: string;
    cause?: unknown;
  };
  const message =
    e?.shortMessage ?? e?.message ?? "The request could not be completed.";
  if (
    e?.code === 4001 ||
    /UserRejected|user rejected|user denied|rejected the request/i.test(message)
  )
    return "Request declined in your wallet. No new transaction was sent. You can try again.";
  if (/insufficient funds/i.test(message))
    return "Not enough Sepolia ETH for this amount and network gas. Lower the amount or add Sepolia ETH.";
  if (/SyncRequired/i.test(message))
    return "The farm is waiting for a Squeek checkpoint. Refresh and try again when the chain is synchronized.";
  if (/DepositsArePaused|EmissionsPausedDepositsClosed/i.test(message))
    return "Deposits are paused on-chain. Withdrawals remain available.";
  if (/AssetNotConfigured/i.test(message))
    return "The sIMD asset has not been configured. Deposits will open after setup.";
  if (
    /chain|network/i.test(message) &&
    /mismatch|switch|wrong|not match/i.test(message)
  )
    return "Switch your wallet to Ethereum Sepolia and try again.";
  return message.length > 240 ? `${message.slice(0, 237)}…` : message;
}

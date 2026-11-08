import { useSyncExternalStore } from "react";
import type { Address, Hash } from "viem";
import type { PoolId } from "./contracts/config";
import type { TransactionKind } from "./contracts/transactions";
export type HistoryEntry = {
  hash: Hash;
  account: Address;
  pool: PoolId;
  kind: TransactionKind;
  amount: string;
  symbol: string;
  status: "pending" | "confirmed" | "reverted" | "cancelled" | "replaced";
  createdAt: number;
  block?: string;
};
const KEY = "cheese-vault:sepolia:transactions:v1";
let entries: HistoryEntry[] = [];
try {
  const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  if (Array.isArray(saved))
    entries = saved
      .filter(
        (x): x is HistoryEntry =>
          !!x &&
          /^0x[0-9a-f]{64}$/i.test(x.hash) &&
          /^0x[0-9a-f]{40}$/i.test(x.account) &&
          ["cheese", "eth", "simd"].includes(x.pool) &&
          ["deposit", "withdraw", "claim", "approve"].includes(x.kind) &&
          [
            "pending",
            "confirmed",
            "reverted",
            "cancelled",
            "replaced",
          ].includes(x.status) &&
          typeof x.amount === "string" &&
          typeof x.symbol === "string" &&
          Number.isFinite(x.createdAt),
      )
      .slice(0, 100);
} catch {
  /* Private browsing may not allow storage; the session still works. */
}
const listeners = new Set<() => void>();
export function saveTransaction(entry: HistoryEntry, previousHash?: Hash) {
  entries = [
    entry,
    ...entries.filter((x) => x.hash !== entry.hash && x.hash !== previousHash),
  ].slice(0, 100);
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* Session memory is retained. */
  }
  listeners.forEach((fn) => fn());
}
export function useHistory(account?: Address) {
  const all = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => entries,
  );
  return all.filter(
    (x) => account && x.account.toLowerCase() === account.toLowerCase(),
  );
}

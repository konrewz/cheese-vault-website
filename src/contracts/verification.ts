import type { Address } from "viem";
import { CHAIN } from "./config";

// Sourcify's public, CORS-enabled API needs no key or signing wallet.
// https://docs.sourcify.dev/docs/api/ — Contract Lookup (v2)
export const sourceEvidenceUrl = (address: Address) =>
  `https://sourcify.dev/server/v2/contract/${CHAIN.id}/${address}`;

export type SourceVerification = {
  status: "verified" | "unavailable";
  detail: string;
  observedAt: string;
};

export async function loadSourceVerification(
  address: Address,
  signal?: AbortSignal,
): Promise<SourceVerification> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 8_000);
  const result = (
    status: SourceVerification["status"],
    detail: string,
  ): SourceVerification => ({
    status,
    detail,
    observedAt: new Date().toISOString(),
  });
  try {
    const response = await fetch(sourceEvidenceUrl(address), {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.status !== 200 && response.status !== 404)
      return result(
        "unavailable",
        `Sourcify lookup failed (HTTP ${response.status}).`,
      );

    const record: unknown = await response.json();
    if (
      !record ||
      typeof record !== "object" ||
      !("chainId" in record) ||
      record.chainId !== String(CHAIN.id) ||
      !("address" in record) ||
      typeof record.address !== "string" ||
      record.address.toLowerCase() !== address.toLowerCase() ||
      !("runtimeMatch" in record)
    )
      return result("unavailable", "Sourcify returned an unexpected record.");

    // A creation-only match or bytecode presence is not runtime source verification.
    if (response.status === 200 && record.runtimeMatch === "exact_match")
      return result("verified", "Exact runtime match.");
    if (response.status === 200 && record.runtimeMatch === "match")
      return result("verified", "Runtime match; metadata may differ.");
    return result("unavailable", "No runtime match on Sourcify. Check Etherscan.");
  } catch {
    return result(
      "unavailable",
      controller.signal.aborted
        ? "Sourcify lookup timed out or was cancelled. Retry with Refresh."
        : "Sourcify lookup failed. Retry with Refresh.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

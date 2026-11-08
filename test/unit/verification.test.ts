import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTROLLER, TOKEN } from "../../src/contracts/config";
import { loadSourceVerification, sourceEvidenceUrl } from "../../src/contracts/verification";

const record = {
  chainId: "11155111",
  address: TOKEN,
  match: "exact_match",
  creationMatch: "exact_match",
  runtimeMatch: "exact_match",
};
const respond = (body: unknown, status = 200) =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

afterEach(() => vi.useRealTimers());

describe("public source evidence (explicit HTTP fixtures, not live verification)", () => {
  it("links the actual Sepolia lookup and records the observation time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
    respond(record);
    expect(await loadSourceVerification(TOKEN)).toEqual({
      status: "verified", detail: "Exact runtime match.", observedAt: "2026-11-08T12:00:00.000Z",
    });
    expect(sourceEvidenceUrl(TOKEN)).toBe(`https://sourcify.dev/server/v2/contract/11155111/${TOKEN}`);
    expect(fetch).toHaveBeenCalledWith(sourceEvidenceUrl(TOKEN), expect.objectContaining({
      cache: "no-store", headers: { Accept: "application/json" }, signal: expect.any(AbortSignal),
    }));
  });
  it("distinguishes a runtime match with different metadata from an exact match", async () => {
    respond({ ...record, address: TOKEN.toUpperCase(), match: "match", runtimeMatch: "match" });
    expect(await loadSourceVerification(TOKEN)).toMatchObject({ status: "verified", detail: "Runtime match; metadata may differ." });
  });
  it.each([
    ["another chain", { ...record, chainId: "1" }],
    ["another address", { ...record, address: CONTROLLER }],
    ["a missing runtime field", { chainId: "11155111", address: TOKEN }],
    ["an invalid body", null],
  ])("rejects %s instead of asserting verification", async (_label, body) => {
    respond(body);
    expect(await loadSourceVerification(TOKEN)).toMatchObject({ status: "unavailable", detail: "Sourcify returned an unexpected record." });
  });
  it.each([200, 404])("does not interpret a missing runtime match (HTTP %i) as unverified everywhere", async (status) => {
    respond({ ...record, runtimeMatch: null }, status);
    expect(await loadSourceVerification(TOKEN)).toMatchObject({ status: "unavailable", detail: "No runtime match on Sourcify. Check Etherscan." });
  });
  it.each([429, 503])("reports HTTP %i as lookup failure", async (status) => {
    respond(record, status);
    expect(await loadSourceVerification(TOKEN)).toMatchObject({ status: "unavailable", detail: `Sourcify lookup failed (HTTP ${status}).` });
  });
  it("reports invalid JSON and network errors as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("not JSON")).mockRejectedValueOnce(new TypeError("offline")));
    for (let i = 0; i < 2; i++)
      expect(await loadSourceVerification(TOKEN)).toMatchObject({ status: "unavailable", detail: "Sourcify lookup failed. Retry with Refresh." });
  });
  it("aborts a stalled request after eight seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const pending = loadSourceVerification(TOKEN);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await pending).toMatchObject({ status: "unavailable", detail: "Sourcify lookup timed out or was cancelled. Retry with Refresh." });
    expect(vi.getTimerCount()).toBe(0);
  });
});

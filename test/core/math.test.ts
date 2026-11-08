import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAmount,
  displayAmount,
  compactAmount,
  sourceWithdrawal,
  sharesForAssets,
  friendlyError,
} from "../../src/contracts/math";
const unit = 10n ** 18n;
describe("precise amounts", () => {
  it("preserves wei and integers beyond Number.MAX_SAFE_INTEGER", () => {
    assert.equal(
      parseAmount("9007199254740993.000000000000000001", 18),
      9007199254740993n * unit + 1n,
    );
    assert.equal(parseAmount("0.000001", 6), 1n);
  });
  for (const value of [
    "1.0000001",
    "0",
    "-1",
    "1e6",
    "1,200",
    "NaN",
    "",
    ".5",
  ]) {
    it(`rejects malformed or excess precision: ${JSON.stringify(value)}`, () =>
      assert.throws(() => parseAmount(value, 6)));
  }
  it("accepts a trailing decimal point without rounding", () =>
    assert.equal(parseAmount("2.", 18), 2n * unit));
  it("distinguishes unavailable, zero and tiny positive values", () => {
    assert.equal(displayAmount(undefined), "—");
    assert.equal(displayAmount(0n), "0");
    assert.equal(displayAmount(1n), "<0.0001");
    assert.equal(compactAmount(210_000_000n * unit), "210M");
  });
});
describe("official share and fee rules", () => {
  it("uses both virtual offsets for an initial deposit", () =>
    assert.equal(sharesForAssets(unit, 0n, 0n), 1000n * unit));
  it("routes the normal split with integer rounding", () => {
    const q = sourceWithdrawal(100_000n, 1_000_000n, 1_000_000n);
    assert.equal(q.paid, q.gross - (q.gross * 1500n) / 10000n);
    assert.equal(q.retained, (q.gross * 1400n) / 10000n);
    assert.equal(q.retained + q.treasury, q.gross - q.paid);
  });
  it("caps retained fees on a dominant exit", () => {
    const q = sourceWithdrawal(999_000n, 1_000_000n, 1_000_000n);
    assert.ok(q.retained < (q.gross * 1400n) / 10000n);
    assert.equal(q.retained + q.treasury, q.gross - q.paid);
  });
  it("sends the final fee and residual dust to Treasury", () => {
    const q = sourceWithdrawal(1_000_000n, 1_000_000n, 1_000_000n);
    assert.equal(q.retained, 0n);
    assert.equal(q.paid + q.treasury, 1_000_000n);
    assert.ok(q.treasury >= q.gross - q.paid);
  });
  it("matches floor rounding for a tiny final withdrawal", () =>
    assert.deepEqual(sourceWithdrawal(1000n, 1n, 1000n), {
      gross: 1n,
      paid: 1n,
      retained: 0n,
      treasury: 0n,
    }));
  it("keeps payouts inside reserves for partial and full exits", () => {
    for (let i = 1n; i <= 100n; i++) {
      const q = sourceWithdrawal(i * 1000n, 100_000n, 100_000n);
      assert.ok(q.paid + q.treasury + q.retained <= 100_000n);
      assert.ok(q.paid <= q.gross);
      assert.ok(q.retained >= 0n);
    }
  });
});
describe("recoverable errors", () => {
  it("describes a rejected wallet request without claiming a broadcast", () =>
    assert.match(friendlyError({ code: 4001 }), /declined/));
  it("explains gas shortages and synchronization failures", () => {
    assert.match(
      friendlyError(new Error("insufficient funds for gas")),
      /Sepolia ETH/,
    );
    assert.match(friendlyError(new Error("SyncRequired")), /checkpoint/);
  });
});

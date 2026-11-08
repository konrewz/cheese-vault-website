import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TOKEN } from "../../src/contracts/config";
import {
  depositBlockReason,
  earnsRewards,
  type PoolState,
  type Protocol,
} from "../../src/contracts/read";
const state: PoolState = {
  id: "cheese",
  controllerValid: true,
  registered: false,
  depositsPaused: false,
  totalAssets: 0n,
  totalShares: 0n,
  asset: TOKEN,
  assetConfigured: true,
  decimals: 18,
  assetSymbol: "CHEESE",
  block: 1n,
};
const protocol = {
  authorityValid: true,
  tokenBound: false,
  activated: false,
  paused: false,
  completed: false,
  pending: [true, 0n, 0n],
} as unknown as Protocol;
describe("readiness matches contract preconditions", () => {
  it("permits unregistered CHEESE/ETH deposits before activation", () => {
    assert.equal(depositBlockReason(state, protocol), undefined);
    assert.equal(earnsRewards(state, protocol), false);
  });
  it("disables only an unconfigured sIMD deposit", () =>
    assert.match(
      depositBlockReason(
        { ...state, id: "simd", asset: undefined, assetConfigured: false },
        protocol,
      )!,
      /Coming soon/,
    ));
  it("blocks paused deposits and paused emissions", () => {
    assert.match(
      depositBlockReason({ ...state, depositsPaused: true }, protocol)!,
      /paused/,
    );
    assert.match(
      depositBlockReason(state, { ...protocol, paused: true })!,
      /paused/,
    );
  });
  it("requires synchronization only for registered pools", () => {
    const unavailable = { ...protocol, pending: [false, 0n, 0n] as const };
    assert.match(
      depositBlockReason({ ...state, registered: true }, unavailable)!,
      /synchronization/,
    );
    assert.equal(depositBlockReason(state, unavailable), undefined);
  });
  it("does not guess state or token decimals", () => {
    assert.match(depositBlockReason(undefined, protocol)!, /Waiting/);
    assert.match(
      depositBlockReason({ ...state, decimals: undefined }, protocol)!,
      /decimals/,
    );
  });
  it("requires the expected controller and CHEESE token", () => {
    assert.match(
      depositBlockReason({ ...state, controllerValid: false }, protocol)!,
      /bindings/,
    );
    assert.match(
      depositBlockReason(
        { ...state, asset: "0xd460157324fe20eeb83f8255aca5d2f09f387f21" },
        protocol,
      )!,
      /asset/,
    );
  });
  it("labels earning only when all reward prerequisites hold", () => {
    const ready = { ...state, registered: true, enabled: true, weight: 400 };
    const active = { ...protocol, tokenBound: true, activated: true };
    assert.equal(earnsRewards(ready, active), true);
    assert.equal(earnsRewards(ready, { ...active, completed: true }), false);
    assert.equal(earnsRewards({ ...ready, enabled: false }, active), false);
  });
});

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { POOLS, TOKEN, publicClient } from "../../src/contracts/config";
import {
  prepareTransaction,
  transactionCall,
} from "../../src/contracts/transactions";
import type { PoolState } from "../../src/contracts/read";
const account = "0xdea11b3a70b77134424d436f6eb455f1abbd4449"; // Public source address, fixture only; no key/signer.
const state = { asset: TOKEN, assetConfigured: true } as PoolState;
beforeEach(() => mock.restoreAll());
describe("calldata from the official ABIs", () => {
  it("approves exactly the entered amount to one farm", () => {
    const c = transactionCall(POOLS[0], state, "approve", 123n, account);
    assert.equal(c.address, TOKEN);
    assert.equal(c.functionName, "approve");
    assert.deepEqual(c.args, [POOLS[0].address, 123n]);
    assert.equal(c.value, undefined);
  });
  it("deposits native ETH with value and no argument", () => {
    const c = transactionCall(POOLS[1], state, "deposit", 456n, account);
    assert.equal(c.address, POOLS[1].address);
    assert.deepEqual(c.args, []);
    assert.equal(c.value, 456n);
  });
  it("uses token amounts, internal shares and the connected reward recipient", () => {
    assert.deepEqual(
      transactionCall(POOLS[0], state, "deposit", 789n, account).args,
      [789n],
    );
    assert.deepEqual(
      transactionCall(POOLS[0], state, "withdraw", 999n, account).args,
      [999n],
    );
    assert.deepEqual(
      transactionCall(POOLS[0], state, "claim", 0n, account).args,
      [account],
    );
  });
  it("refuses approval when no asset is configured", () =>
    assert.throws(() =>
      transactionCall(
        POOLS[2],
        { ...state, assetConfigured: false },
        "approve",
        1n,
        account,
      ),
    ));
});
describe("preflight simulation and gas, with explicit RPC fixtures", () => {
  it("simulates and returns a call fee ceiling with 20% gas padding", async () => {
    const simulated = mock.method(
      publicClient,
      "simulateContract",
      async () => ({}) as never,
    );
    mock.method(publicClient, "estimateContractGas", async () => 100_000n);
    mock.method(publicClient, "estimateFeesPerGas", async () => ({
      maxFeePerGas: 2_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
    }));
    const p = await prepareTransaction(
      transactionCall(POOLS[1], state, "deposit", 100n, account),
      account,
    );
    assert.equal(simulated.mock.callCount(), 1);
    assert.equal(p.gas, 120_000n);
    assert.equal(p.gasCeiling, 240_000_000_000_000n);
  });
  it("propagates a revert without continuing to gas estimation or a write", async () => {
    mock.method(publicClient, "simulateContract", async () => {
      throw new Error("DepositsArePaused");
    });
    const estimate = mock.method(
      publicClient,
      "estimateContractGas",
      async () => 100_000n,
    );
    await assert.rejects(
      prepareTransaction(
        transactionCall(POOLS[1], state, "deposit", 100n, account),
        account,
      ),
      /DepositsArePaused/,
    );
    assert.equal(estimate.mock.callCount(), 0);
  });
});

describe("nonstandard ERC20 refusal", () => {
  it("stops when approval simulation returns false", async () => {
    mock.method(
      publicClient,
      "simulateContract",
      async () => ({ result: false }) as never,
    );
    const estimate = mock.method(
      publicClient,
      "estimateContractGas",
      async () => 100_000n,
    );
    await assert.rejects(
      prepareTransaction(
        transactionCall(POOLS[0], state, "approve", 100n, account),
        account,
      ),
      /refused the approval/,
    );
    assert.equal(estimate.mock.callCount(), 0);
  });
});

import { erc20Abi, type Address, type Abi } from "viem";
import { publicClient, type Pool } from "./config";
import type { PoolState } from "./read";

export type Action = "deposit" | "withdraw" | "claim";
export type TransactionKind = Action | "approve";
export type TransactionCall = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
};
export function transactionCall(
  pool: Pool,
  state: PoolState,
  kind: TransactionKind,
  amount: bigint,
  account: Address,
): TransactionCall {
  if (kind === "approve") {
    if (!state.asset || !state.assetConfigured)
      throw new Error("The deposit asset is not configured.");
    return {
      address: state.asset,
      abi: erc20Abi,
      functionName: "approve",
      args: [pool.address, amount],
    };
  }
  if (kind === "deposit")
    return pool.id === "eth"
      ? {
          address: pool.address,
          abi: pool.abi,
          functionName: "deposit",
          args: [],
          value: amount,
        }
      : {
          address: pool.address,
          abi: pool.abi,
          functionName: "deposit",
          args: [amount],
        };
  if (kind === "withdraw")
    return {
      address: pool.address,
      abi: pool.abi,
      functionName: "withdraw",
      args: [amount],
    };
  return {
    address: pool.address,
    abi: pool.abi,
    functionName: "claim",
    args: [account],
  };
}
export async function prepareTransaction(
  call: TransactionCall,
  account: Address,
) {
  const request = { ...call, account };
  const simulation = await publicClient.simulateContract(request);
  if (call.functionName === "approve" && simulation.result === false)
    throw new Error(
      "This token refused the approval. No approval transaction was sent.",
    );
  const [estimate, fees] = await Promise.all([
    publicClient.estimateContractGas(request),
    publicClient.estimateFeesPerGas(),
  ]);
  const gas = (estimate * 120n) / 100n;
  return {
    call,
    account,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    gasCeiling: gas * fees.maxFeePerGas,
    preparedAt: Date.now(),
  };
}
export type Prepared = Awaited<ReturnType<typeof prepareTransaction>>;

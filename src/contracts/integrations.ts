import type { Address } from "viem";

// Verified against the official manifest and two Sepolia RPCs; see public/evidence/four-pools/.
export const SQK_TOKEN: Address = "0xd78a3956cf63164d1fa1c622ad3c66623162fa1e";
export const SQK_DECIMALS = 18;
export const SQK_FARM: Address | undefined = undefined;
export const CONVERSION = {
  ready: false,
  status: "Official Sepolia IMD/sIMD conversion contracts are unverified.",
  rate: undefined, minimumOutput: undefined, fee: undefined,
  depositForSupported: false,
} as const;

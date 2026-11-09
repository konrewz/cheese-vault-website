import type { Address } from "viem";
import manifest from './extensions.json';
export type ExtensionDeployment = { address: Address; runtimeHash: `0x${string}`; deploymentTx: `0x${string}`; blockNumber: string };
export const EXTENSIONS = manifest as {
  chainId: number; testnetOnly: boolean; imd: Address; imdRuntimeHash: `0x${string}`;
  wrapper: ExtensionDeployment | null; sqkFarm: ExtensionDeployment | null;
};
export const IMD_TOKEN = EXTENSIONS.imd;

// Verified against the official manifest and two Sepolia RPCs; see public/evidence/four-pools/.
export const SQK_TOKEN: Address = "0xd78a3956cf63164d1fa1c622ad3c66623162fa1e";
export const SQK_DECIMALS = 18;
export const SQK_FARM = EXTENSIONS.sqkFarm?.address;
export const CONVERSION = {
  ready: false,
  status: "The IMD token is verified. The CHEESE Sepolia test sIMD wrapper awaits deployment and verification; it is not official production sIMD.",
  rate: undefined, minimumOutput: undefined, fee: undefined,
  depositForSupported: false,
} as const;

import {
  createPublicClient,
  fallback,
  http,
  type Abi,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import tokenJson from "./abi/CheeseToken.json";
import controllerJson from "./abi/CheeseEmissionController.json";
import erc20Json from "./abi/CheeseFarmERC20.json";
import ethJson from "./abi/CheeseFarmETH.json";
import simdJson from "./abi/CheeseFarmSIMD.json";

export const CHAIN = sepolia;
export const SITE_NAME = "The Cheese Vault";
export const EXPLORER = "https://sepolia.etherscan.io";
export const SOURCE_URL =
  "https://github.com/identity-md-launches/launch-3140-cheese-v2-official";
export const JOB_URL =
  "https://explorer.imd.fun/jobs/3c7de646-4d13-45f5-ba32-3c57c559d8e8";
export const TOKEN: Address = "0x33a41a4093b1aadcce2f9e0dda53211ed91c3521";
export const CONTROLLER: Address = "0xe06748177ad22d422e49cdb0982a5f932e46ee7d";
export const tokenAbi = tokenJson as Abi;
export const controllerAbi = controllerJson as Abi;
export const farmAbi = erc20Json as Abi;
export type PoolId = "cheese" | "eth" | "simd";
export type Pool = {
  id: PoolId;
  name: string;
  symbol: string;
  address: Address;
  abi: Abi;
  initialPoints: number;
  description: string;
};
export const POOLS: readonly Pool[] = [
  {
    id: "cheese",
    name: "The Cheese Stash",
    symbol: "CHEESE",
    address: "0xd460157324fe20eeb83f8255aca5d2f09f387f21",
    abi: erc20Json as Abi,
    initialPoints: 400,
    description: "Put your cheese to work. Earn a little more.",
  },
  {
    id: "eth",
    name: "The Golden Burrow",
    symbol: "ETH",
    address: "0x8ab46e3c9d16c4ca3ee8a28648c5809142c48faa",
    abi: ethJson as Abi,
    initialPoints: 200,
    description: "A cozy home for your Sepolia ETH.",
  },
  {
    id: "simd",
    name: "The Swarm Nest",
    symbol: "sIMD",
    address: "0x222f1a83afc0e1abd9b37f004bed792e7c027d88",
    abi: simdJson as Abi,
    initialPoints: 200,
    description: "A little teamwork. A little more cheese.",
  },
];
export const RPC_URLS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
  "https://ethereum-sepolia.publicnode.com",
];
export const rpcTransport = () =>
  fallback(
    RPC_URLS.map((url) => http(url, { timeout: 7000, retryCount: 0 })),
    { retryCount: 0 },
  );
export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: rpcTransport(),
  batch: { multicall: { wait: 20 } },
});
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;
export const transactionUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

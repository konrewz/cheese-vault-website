import { erc20Abi, parseAbi, zeroAddress, type Abi, type Address } from "viem";
import {
  publicClient,
  TOKEN,
  CONTROLLER,
  POOLS,
  tokenAbi,
  controllerAbi,
  type Pool,
  type PoolId,
} from "./config";
import type { WithdrawalQuote } from "./math";

// Exact CoreState tuple from the official repository's src/interfaces/ISqueekCore.sol.
const coreAbi = parseAbi([
  "function state() view returns ((uint64 settledThroughRound,uint64 cumulativeWork,uint96 cumulativeBlockUnits,uint64 blockHeight,uint96 blockProgress,uint32 workPerThousandBlocks,uint256 authorizationNonce,bool paused) result)",
]);
export async function readValue<T>(
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
  blockNumber?: bigint,
): Promise<T> {
  return publicClient.readContract({
    address,
    abi,
    functionName,
    args,
    blockNumber,
  }) as Promise<T>;
}
export type Protocol = {
  block: bigint;
  timestamp: bigint;
  tokenBound: boolean;
  authorityValid: boolean;
  activated: boolean;
  paused: boolean;
  completed: boolean;
  coreAddress: Address;
  coreHeight?: bigint;
  corePaused?: boolean;
  coreError: boolean;
  fundedBlocks: bigint;
  minted: bigint;
  supply: bigint;
  maxSupply: bigint;
  premint: bigint;
  miningAllowance: bigint;
  allocation: readonly [number, number, number];
  totalPoints: number;
  pending: readonly [boolean, bigint, bigint];
  halvingBlocks: bigint;
  scheduleBlocks: bigint;
  nextEmission: bigint;
  treasury: Address;
  deployed: Record<string, boolean>;
  observedAt: number;
};
export async function loadProtocol(): Promise<Protocol> {
  const chain = await publicClient.getChainId();
  if (chain !== 11155111)
    throw new Error(
      "The RPC returned a different network. Sepolia data cannot be verified.",
    );
  const b = await publicClient.getBlock({ blockTag: "latest" });
  const at = b.number;
  const t = <T>(fn: string) => readValue<T>(TOKEN, tokenAbi, fn, [], at);
  const c = <T>(fn: string) =>
    readValue<T>(CONTROLLER, controllerAbi, fn, [], at);
  const [
    boundToken,
    authority,
    activated,
    paused,
    completed,
    coreAddress,
    fundedBlocks,
    minted,
    supply,
    maxSupply,
    premint,
    miningAllowance,
    allocation,
    totalPoints,
    pending,
    halvingBlocks,
    scheduleBlocks,
    treasury,
  ] = await Promise.all([
    c<Address>("token"),
    t<Address>("emissionAuthority"),
    c<boolean>("activated"),
    c<boolean>("emissionsPaused"),
    c<boolean>("completed"),
    c<Address>("squeekCore"),
    c<bigint>("fundedBlocks"),
    t<bigint>("totalMinted"),
    t<bigint>("totalSupply"),
    t<bigint>("MAX_SUPPLY"),
    t<bigint>("PREMINT"),
    t<bigint>("MINING_ALLOWANCE"),
    c<readonly [number, number, number]>("getAllocation"),
    c<number>("TOTAL_POINTS"),
    c<readonly [boolean, bigint, bigint]>("pendingCheckpoint"),
    c<bigint>("HALVING_BLOCKS"),
    c<bigint>("SCHEDULE_BLOCKS"),
    c<Address>("treasury"),
  ]);
  const issued = await Promise.all([
    readValue<bigint>(CONTROLLER, controllerAbi, "issued", [fundedBlocks], at),
    readValue<bigint>(
      CONTROLLER,
      controllerAbi,
      "issued",
      [fundedBlocks + 1n],
      at,
    ),
  ]);
  let coreHeight: bigint | undefined,
    corePaused: boolean | undefined,
    coreError = false;
  try {
    const core = await readValue<{ blockHeight: bigint; paused: boolean }>(
      coreAddress,
      coreAbi,
      "state",
      [],
      at,
    );
    coreHeight = core.blockHeight;
    corePaused = core.paused;
  } catch {
    coreError = true;
  }
  const code = await Promise.all(
    [TOKEN, CONTROLLER, ...POOLS.map((p) => p.address)].map(
      async (address) =>
        [
          address,
          ((await publicClient.getCode({ address, blockNumber: at })) ??
            "0x") !== "0x",
        ] as const,
    ),
  );
  return {
    block: at,
    timestamp: b.timestamp,
    tokenBound: boundToken.toLowerCase() === TOKEN,
    authorityValid: authority.toLowerCase() === CONTROLLER,
    activated,
    paused,
    completed,
    coreAddress,
    coreHeight,
    corePaused,
    coreError,
    fundedBlocks,
    minted,
    supply,
    maxSupply,
    premint,
    miningAllowance,
    allocation,
    totalPoints,
    pending,
    halvingBlocks,
    scheduleBlocks,
    nextEmission: issued[1] - issued[0],
    treasury,
    deployed: Object.fromEntries(code),
    observedAt: Date.now(),
  };
}
export type PoolState = {
  id: PoolId;
  controllerValid: boolean;
  registered: boolean;
  depositsPaused: boolean;
  totalAssets: bigint;
  totalShares: bigint;
  asset?: Address;
  assetConfigured: boolean;
  decimals?: number;
  assetSymbol: string;
  poolId?: bigint;
  weight?: number;
  enabled?: boolean;
  block: bigint;
};
export async function loadPool(pool: Pool): Promise<PoolState> {
  const block = await publicClient.getBlockNumber({ cacheTime: 0 });
  const read = <T>(fn: string) =>
    readValue<T>(pool.address, pool.abi, fn, [], block);
  const [
    controller,
    registered,
    depositsPaused,
    totalAssets,
    totalShares,
    asset,
  ] = await Promise.all([
    read<Address>("controller"),
    read<boolean>("registered"),
    read<boolean>("depositsPaused"),
    read<bigint>("totalAssets"),
    read<bigint>("totalShares"),
    pool.id === "eth" ? Promise.resolve(undefined) : read<Address>("asset"),
  ]);
  const assetConfigured =
    pool.id === "eth" || (asset !== undefined && asset !== zeroAddress);
  let decimals: number | undefined = pool.id === "eth" ? 18 : undefined;
  let assetSymbol = pool.symbol;
  if (assetConfigured && asset) {
    const metadata = await Promise.allSettled([
      readValue<number>(asset, erc20Abi, "decimals", [], block),
      readValue<string>(asset, erc20Abi, "symbol", [], block),
    ]);
    if (metadata[0].status === "fulfilled") decimals = metadata[0].value;
    if (metadata[1].status === "fulfilled") assetSymbol = metadata[1].value;
  }
  let poolId: bigint | undefined,
    weight: number | undefined,
    enabled: boolean | undefined;
  if (registered) {
    poolId = await read<bigint>("poolId");
    const allocation = await readValue<
      readonly [Address, number, boolean, bigint, bigint]
    >(CONTROLLER, controllerAbi, "getPoolAllocation", [poolId], block);
    if (allocation[0].toLowerCase() !== pool.address)
      throw new Error("The controller pool binding does not match this farm.");
    weight = allocation[1];
    enabled = allocation[2];
  }
  return {
    id: pool.id,
    controllerValid: controller.toLowerCase() === CONTROLLER,
    registered,
    depositsPaused,
    totalAssets,
    totalShares,
    asset,
    assetConfigured,
    decimals,
    assetSymbol,
    poolId,
    weight,
    enabled,
    block,
  };
}
export type Position = {
  balance?: bigint;
  allowance?: bigint;
  shares: bigint;
  assets: bigint;
  rewards: bigint;
  quote: WithdrawalQuote;
  block: bigint;
};
export async function loadPosition(
  pool: Pool,
  state: PoolState,
  account: Address,
): Promise<Position> {
  const block = await publicClient.getBlockNumber({ cacheTime: 0 });
  const read = <T>(fn: string, args: readonly unknown[]) =>
    readValue<T>(pool.address, pool.abi, fn, args, block);
  const [shares, assets, rewards, balance, allowance] = await Promise.all([
    read<bigint>("sharesOf", [account]),
    read<bigint>("assetsOf", [account]),
    read<bigint>("pendingRewards", [account]),
    pool.id === "eth"
      ? publicClient.getBalance({ address: account, blockNumber: block })
      : state.assetConfigured && state.asset
        ? readValue<bigint>(
            state.asset,
            erc20Abi,
            "balanceOf",
            [account],
            block,
          )
        : undefined,
    state.assetConfigured && state.asset
      ? readValue<bigint>(
          state.asset,
          erc20Abi,
          "allowance",
          [account, pool.address],
          block,
        )
      : undefined,
  ]);
  const q = await read<readonly [bigint, bigint, bigint, bigint]>(
    "previewWithdraw",
    [shares],
  );
  return {
    balance,
    allowance,
    shares,
    assets,
    rewards,
    quote: { gross: q[0], paid: q[1], retained: q[2], treasury: q[3] },
    block,
  };
}
export function depositBlockReason(
  state?: PoolState,
  protocol?: Protocol,
): string | undefined {
  if (!state || !protocol) return "Waiting for verified contract reads.";
  if (!state.controllerValid || !protocol.authorityValid)
    return "Contract bindings do not match the official deployment.";
  if (!state.assetConfigured)
    return "Coming soon: the real sIMD asset has not been configured.";
  if (state.id === "cheese" && state.asset?.toLowerCase() !== TOKEN)
    return "The CHEESE farm asset does not match the official token.";
  if (state.decimals === undefined)
    return "Asset decimals could not be read. Refresh before depositing.";
  if (state.depositsPaused) return "Deposits are paused for this pool.";
  if (protocol.paused)
    return "Emissions are paused. The contract currently blocks new deposits.";
  if (state.registered && !protocol.pending[0])
    return "Squeek synchronization is unavailable. The contract blocks new deposits.";
  return undefined;
}
export function earnsRewards(state?: PoolState, protocol?: Protocol): boolean {
  return !!(
    state?.registered &&
    state.enabled &&
    state.weight &&
    protocol?.tokenBound &&
    protocol.activated &&
    !protocol.paused &&
    !protocol.completed &&
    protocol.pending[0]
  );
}

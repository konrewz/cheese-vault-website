import { decodeEventLog, erc20Abi, keccak256, parseAbi, zeroAddress, type Address, type Hash } from 'viem';
import { CONTROLLER, ALL_POOLS as POOLS, TOKEN, controllerAbi, publicClient, tokenAbi } from './config';
import { SQK_TOKEN, EXTENSIONS } from './integrations';
import evidence from '../../public/evidence/treasury/deployment.json';

export const INTENDED_TREASURY: Address = '0xdea11b3a70b77134424d436f6eb455f1abbd4449';
export const DEPLOYMENT_BLOCK = BigInt(evidence.contracts.CheeseToken.blockNumber);
export const DEPLOYMENT_TX = evidence.contracts.CheeseToken.transactionHash as Hash;
// This is the CHEESE test wrapper, not canonical production sIMD. Identity requires the verified deployment record.
export const VERIFIED_SIMD: { address: Address; runtimeHash: Hash } | undefined = EXTENSIONS.wrapper ?? undefined;
const SQK_RUNTIME = '0x6d6ea1d4143a02637e905d4d923b48f78f81f46aa1169f5004f5a150a2433329';
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export type AssetBalance = { symbol: string; balance?: bigint; decimals?: number; status: string };
export type TreasurySnapshot = {
  block: bigint; blockHash: Hash; timestamp: bigint; actualTreasury: Address; matchesIntended: boolean;
  balances: AssetBalance[]; premintVerified: boolean; premintStatus: string;
};
type Client = typeof publicClient;
async function requireRuntime(client: Client, address: Address, expected: string, blockNumber: bigint) {
  const code = await client.getCode({ address, blockNumber });
  if (!code || keccak256(code) !== expected) throw Error('Contract identity could not be verified. No totals are inferred.');
}
export function verifyPremintLogs(logs: readonly { address: Address; data: `0x${string}`; topics: readonly `0x${string}`[] }[]): boolean {
  const events = logs.filter(l => same(l.address, TOKEN)).flatMap(l => {
    try { return [decodeEventLog({ abi: tokenAbi, data: l.data, topics: l.topics as [`0x${string}`, ...`0x${string}`[]] })]; } catch { return []; }
  });
  const premints = events.filter(e => e.eventName === 'Preminted');
  const mintTransfers = events.filter(e => e.eventName === 'Transfer' && same((e.args as unknown as { from: string }).from, zeroAddress));
  if (premints.length !== 1 || mintTransfers.length !== 3) return false;
  const recipients = premints[0].args as unknown as { teamRecipient: string; treasuryRecipient: string; liquidityRecipient: string };
  if (!Object.values(recipients).every(a => same(a, INTENDED_TREASURY))) return false;
  const amounts = [63_000_000n, 63_000_000n, 84_000_000n].map(n => n * 10n ** 18n);
  return mintTransfers.every((e, i) => { const a = e.args as unknown as { to: string; value: bigint }; return same(a.to, INTENDED_TREASURY) && a.value === amounts[i]; });
}
export async function loadTreasurySnapshot(client: Client = publicClient): Promise<TreasurySnapshot> {
  if (await client.getChainId() !== 11155111) throw Error('Wrong RPC network. Treasury reads require Ethereum Sepolia.');
  const latest = await client.getBlockNumber();
  const block = await client.getBlock({ blockNumber: latest - 2n });
  if (block.number < DEPLOYMENT_BLOCK) throw Error('RPC is behind the verified deployment.');
  const at = block.number;
  await Promise.all([
    requireRuntime(client, TOKEN, evidence.contracts.CheeseToken.runtimeHash, at),
    requireRuntime(client, CONTROLLER, evidence.contracts.CheeseEmissionController.runtimeHash, at),
  ]);
  const [actualTreasury, cheese, eth, simdAsset] = await Promise.all([
    client.readContract({ address: CONTROLLER, abi: controllerAbi, functionName: 'treasury', blockNumber: at }) as Promise<Address>,
    client.readContract({ address: TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [INTENDED_TREASURY], blockNumber: at }),
    client.getBalance({ address: INTENDED_TREASURY, blockNumber: at }),
    client.readContract({ address: POOLS[2].address, abi: POOLS[2].abi, functionName: 'asset', blockNumber: at }) as Promise<Address>,
  ]);
  const balances: AssetBalance[] = [
    { symbol: 'CHEESE', balance: cheese, decimals: 18, status: 'Verified token balance' },
    { symbol: 'ETH', balance: eth, decimals: 18, status: 'Native Sepolia ETH' },
  ];
  if (VERIFIED_SIMD && same(simdAsset, VERIFIED_SIMD.address)) {
    try {
      await requireRuntime(client, simdAsset, VERIFIED_SIMD.runtimeHash, at);
      const [balance, decimals] = await Promise.all([
        client.readContract({ address: simdAsset, abi: erc20Abi, functionName: 'balanceOf', args: [INTENDED_TREASURY], blockNumber: at }),
        client.readContract({ address: simdAsset, abi: erc20Abi, functionName: 'decimals', blockNumber: at }),
      ]);
      balances.push({ symbol: 'sIMD', balance, decimals, status: 'Verified asset balance' });
    } catch { balances.push({ symbol: 'sIMD', status: 'Verified asset read unavailable' }); }
  } else balances.push({ symbol: 'sIMD', status: same(simdAsset, zeroAddress) ? 'Asset not configured' : 'Configured asset is not independently verified' });
  try {
    await requireRuntime(client, SQK_TOKEN, SQK_RUNTIME, at);
    const [balance, decimals] = await Promise.all([
      client.readContract({ address: SQK_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [INTENDED_TREASURY], blockNumber: at }),
      client.readContract({ address: SQK_TOKEN, abi: erc20Abi, functionName: 'decimals', blockNumber: at }),
    ]);
    balances.push({ symbol: 'SQK', balance, decimals, status: EXTENSIONS.sqkFarm ? 'Official SQK token balance' : 'Official SQK · farm coming soon' });
  } catch { balances.push({ symbol: 'SQK', status: 'Official token read unavailable' }); }
  let premintVerified = false, premintStatus = 'Deployment receipt unavailable';
  try {
    const receipt = await client.getTransactionReceipt({ hash: DEPLOYMENT_TX });
    premintVerified = receipt.status === 'success' && receipt.blockNumber === DEPLOYMENT_BLOCK && same(receipt.blockHash, evidence.contracts.CheeseToken.blockHash) && verifyPremintLogs(receipt.logs);
    premintStatus = premintVerified ? 'Confirmed by the deployment receipt and token mint events' : 'Deployment allocation verification failed';
  } catch { /* Unavailable is distinct from a verified allocation. */ }
  if ((await client.getBlock({ blockNumber: at })).hash !== block.hash) throw Error('Chain changed during the read. Refresh to verify the new block.');
  return { block: at, blockHash: block.hash, timestamp: block.timestamp, actualTreasury, matchesIntended: same(actualTreasury, INTENDED_TREASURY), balances, premintVerified, premintStatus };
}

export const treasuryEventsAbi = parseAbi([
  'event TreasuryUpdated(address indexed previous,address indexed current)',
  'event Withdrawn(address indexed account,uint256 shares,uint256 grossAssets,uint256 paid,uint256 retained,uint256 toTreasury)',
  'event TreasuryPaymentDeferred(address indexed treasury,uint256 amount)',
  'event TreasuryPaid(address indexed treasury,uint256 amount)',
]);
export type FeeEvent = {
  address: Address; hash: Hash; block: bigint; logIndex: number;
  kind: 'TreasuryUpdated' | 'Withdrawn' | 'TreasuryPaymentDeferred' | 'TreasuryPaid';
  args: { current?: Address; treasury?: Address; toTreasury?: bigint; amount?: bigint };
};
export type FeeRow = { id: string; hash: Hash; block: bigint; pool: string; amount: bigint; status: 'Received' | 'Deferred' | 'Deferred fee paid'; timestamp?: bigint };
export type PoolFees = { pool: string; assigned: bigint; received: bigint; outstanding: bigint };
export type FeeSummary = { pools: PoolFees[]; rows: FeeRow[]; block: bigint };

// Ledger semantics: Withdrawn assigns a fee once. A failed push defers that fee;
// TreasuryPaid later changes cash received, never the assigned fee total.
export function reconcileFees(events: FeeEvent[], currentOwed: Record<string, bigint>, intended = INTENDED_TREASURY): Omit<FeeSummary, 'block'> {
  const pools = POOLS.map(p => ({ pool: p.symbol, assigned: 0n, received: 0n, outstanding: 0n }));
  const rows: FeeRow[] = [], dedup = new Set<string>();
  const recent = new Map<string, { row?: FeeRow; fee: bigint; recipient: Address; deferred: boolean }>();
  let treasury: Address | undefined;
  for (const e of [...events].sort((a,b) => a.block < b.block ? -1 : a.block > b.block ? 1 : a.logIndex - b.logIndex)) {
    const key = `${e.hash}:${e.logIndex}`;
    if (dedup.has(key)) continue; dedup.add(key);
    if (e.kind === 'TreasuryUpdated' && same(e.address, CONTROLLER)) { treasury = e.args.current; continue; }
    const index = POOLS.findIndex(p => same(p.address, e.address)); if (index < 0) continue;
    const pool = pools[index], recentKey = `${e.address.toLowerCase()}:${e.hash}`;
    if (e.kind === 'Withdrawn') {
      if (!treasury || e.args.toTreasury === undefined) throw Error('Incomplete Treasury address or withdrawal event history.');
      const fee = e.args.toTreasury; let row: FeeRow | undefined;
      if (same(treasury, intended)) {
        pool.assigned += fee; pool.received += fee;
        if (fee > 0n) { row = { id: key, hash: e.hash, block: e.block, pool: pool.pool, amount: fee, status: 'Received' }; rows.push(row); }
      }
      recent.set(recentKey, { row, fee, recipient: treasury, deferred: false });
    } else if (e.kind === 'TreasuryPaymentDeferred') {
      const w = recent.get(recentKey), amount = e.args.amount;
      if (!w || w.deferred || amount === undefined || amount !== w.fee || !e.args.treasury || !same(e.args.treasury, w.recipient)) throw Error('Deferred fee could not be reconciled with its withdrawal.');
      w.deferred = true; pool.outstanding += amount;
      if (same(w.recipient, intended)) { pool.received -= amount; if (w.row) w.row.status = 'Deferred'; }
    } else if (e.kind === 'TreasuryPaid') {
      const amount = e.args.amount; if (amount === undefined || amount > pool.outstanding) throw Error('Incomplete deferred payment history.');
      pool.outstanding -= amount;
      if (e.args.treasury && same(e.args.treasury, intended)) {
        pool.received += amount;
        if (amount > 0n) rows.push({ id: key, hash: e.hash, block: e.block, pool: pool.pool, amount, status: 'Deferred fee paid' });
      }
    }
  }
  if (!treasury) throw Error('Missing initial Treasury event. Cumulative totals are unavailable.');
  for (const pool of pools) if (currentOwed[pool.pool] === undefined || currentOwed[pool.pool] !== pool.outstanding) throw Error('Fee history does not reconcile with treasuryOwed(). Cumulative totals are unavailable.');
  return { pools, rows: rows.sort((a,b) => a.block < b.block ? 1 : a.block > b.block ? -1 : 0) };
}
export async function loadTreasuryFees(snapshot: TreasurySnapshot, signal?: AbortSignal, client: Client = publicClient): Promise<FeeSummary> {
  if (await client.getChainId() !== 11155111) throw Error('Wrong RPC network.');
  const at = snapshot.block;
  if (at - DEPLOYMENT_BLOCK > 200_000n) throw Error('Full-history scan exceeds the browser limit. A verified indexer is required; cumulative revenue is unavailable.');
  const farmNames = ['CheeseFarmERC20', 'CheeseFarmETH', 'CheeseFarmSIMD'] as const;
  await Promise.all(POOLS.map((pool,i) => requireRuntime(client, pool.address, pool.id === 'sqk' ? EXTENSIONS.sqkFarm!.runtimeHash : evidence.contracts[farmNames[i]].runtimeHash, at)));
  const events: FeeEvent[] = [];
  for (let from = DEPLOYMENT_BLOCK; from <= at; from += 5000n) {
    if (signal?.aborted) throw Error('History request cancelled.');
    const logs = await client.getLogs({ address: [CONTROLLER,...POOLS.map(p => p.address)], events: treasuryEventsAbi, fromBlock: from, toBlock: from + 4999n < at ? from + 4999n : at, strict: true });
    for (const l of logs) {
      if (l.removed || l.transactionHash === null || l.blockNumber === null || l.logIndex === null) throw Error('Unconfirmed history cannot be counted.');
      events.push({ address: l.address, hash: l.transactionHash, block: l.blockNumber, logIndex: l.logIndex, kind: l.eventName, args: l.args });
    }
  }
  const owed = await Promise.all(POOLS.map(p => client.readContract({ address: p.address, abi: p.abi, functionName: 'treasuryOwed', blockNumber: at }) as Promise<bigint>));
  const summary = reconcileFees(events, Object.fromEntries(POOLS.map((p,i) => [p.symbol,owed[i]])));
  // Bound the displayed list, but compute cumulative totals from the entire verified scan.
  const rows = summary.rows.slice(0,50);
  const timestamps = new Map<bigint,bigint>();
  for (const b of new Set(rows.map(x => x.block))) { if (signal?.aborted) throw Error('History request cancelled.'); timestamps.set(b, (await client.getBlock({ blockNumber: b })).timestamp); }
  if ((await client.getBlock({ blockNumber: at })).hash !== snapshot.blockHash) throw Error('History changed during verification. Refresh to try again.');
  return { pools: summary.pools, rows: rows.map(x => ({ ...x, timestamp: timestamps.get(x.block) })), block: at };
}

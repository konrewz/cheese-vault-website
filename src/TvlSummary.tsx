import { POOLS, addressUrl, type Pool } from "./contracts/config";
import { usePool, useProtocol } from "./hooks";
import { Amount, External } from "./components";

function PoolValue({ pool }: { pool: Pool }) {
  const q = usePool(pool);
  const protocol = useProtocol();
  const state = q.data;
  const verified = !!protocol.data && !!state?.controllerValid && state.assetConfigured && state.decimals !== undefined;
  return <div className="tvl-asset">
    <span>{pool.symbol} Pool</span>
    <strong>{verified ? <Amount value={state!.totalAssets} decimals={state!.decimals} symbol={pool.symbol} /> : "Unavailable"}</strong>
    <small>{state && !state.assetConfigured ? "Asset not configured" : q.isError || protocol.isError ? "Latest read failed" : !verified ? "Awaiting verified reads" : "Deposited assets"}</small>
    {verified && <External href={`https://sepolia.etherscan.io/block/${state!.block}`}>Read at block {state!.block.toString()}</External>}
    <External href={`${addressUrl(pool.address)}#readContract`}>Verify pool balance</External>
  </div>;
}

export function TvlSummary() {
  return <section className="tvl-section" aria-label="Total value locked">
    <div className="tvl-heading"><div><h2>Cheese tucked away.</h2><p>See what is deposited in each pool.</p></div>
      <div className="tvl-usd"><span>USD TVL</span><strong>Unavailable</strong><small>Reliable Sepolia asset prices are unavailable.</small></div></div>
    <div className="tvl-assets">{POOLS.map(pool => <PoolValue key={pool.id} pool={pool} />)}
      <div className="tvl-asset"><span>SQK Pool</span><strong>Unavailable</strong><small>Farm not deployed</small></div>
    </div>
    <p className="small muted">Balances are kept in their own asset units. These are on-chain deposited assets, excluding separate CHEESE rewards, unpaid Treasury fees and unassigned donations. They are not added together as a dollar total.</p>
  </section>;
}

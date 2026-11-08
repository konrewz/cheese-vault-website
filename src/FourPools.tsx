import { useId, useState } from "react";
import { Info, Sprout } from "lucide-react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { erc20Abi } from "viem";
import { Amount, Badge, External } from "./components";
import { addressUrl, publicClient } from "./contracts/config";
import { SQK_TOKEN, SQK_DECIMALS, CONVERSION } from "./contracts/integrations";
import { formatApr, totalApr, LIVE_APR } from "./contracts/apr";

export function AprBreakdown() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const visible = open || hover;
  return <div className="apr-control" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); setHover(false); } }}
    onKeyDown={e => { if (e.key === "Escape") { setOpen(false); setHover(false); } }}>
    <button type="button" className="apr-trigger" aria-expanded={visible} aria-controls={id}
      onClick={() => { setHover(false); setOpen(!open); }} onFocus={() => setHover(true)}>
      Total APR: <strong>{formatApr(totalApr(LIVE_APR))}</strong><Info size={16} aria-hidden="true" />
    </button>
    <div id={id} className="apr-tooltip" role="tooltip" hidden={!visible}>
      <dl><div><dt>CHEESE Rewards APR</dt><dd>{formatApr(LIVE_APR.rewards)}</dd></div>
        <div><dt>Withdrawal Fee APR</dt><dd>{formatApr(LIVE_APR.fees)}</dd></div>
        <div><dt>Total APR</dt><dd>{formatApr(totalApr(LIVE_APR))}</dd></div></dl>
      <p>Reliable token prices and an annualized emission model are unavailable. Historical fee observation window: unavailable.</p>
      <p>Fee yield counts only retained fees benefiting shares, excluding Treasury receipts and deposits. Historical APR is not guaranteed.</p>
    </div>
  </div>;
}

export function ConversionModes({ onModeChange }: { onModeChange?: (mode: "simd" | "imd") => void }) {
  const [mode, setMode] = useState<"simd" | "imd">("simd");
  const id = useId();
  return <section className="conversion-modes" aria-label="sIMD deposit mode">
    <div className="conversion-options" role="group" aria-label="Choose deposit asset">
      <button type="button" aria-pressed={mode === "simd"} onClick={() => { setMode("simd"); onModeChange?.("simd"); }}>Deposit sIMD</button>
      <button type="button" aria-pressed={mode === "imd"} onClick={() => { setMode("imd"); onModeChange?.("imd"); }}>Deposit IMD (Auto Convert)</button>
    </div>
    {mode === "imd" ? <div className="conversion-status">
      <Badge tone="warning">Conversion unavailable</Badge>
      <label htmlFor={id}>IMD amount</label><input id={id} inputMode="decimal" placeholder="Unavailable until verified" disabled />
      <dl><div><dt>Conversion rate</dt><dd>N/A</dd></div><div><dt>Minimum sIMD output</dt><dd>N/A</dd></div>
        <div><dt>Conversion fees</dt><dd>N/A</dd></div><div><dt>Transaction status</dt><dd>Not started</dd></div></dl>
      <p>{CONVERSION.status} No 1:1 rate is assumed.</p>
      <p>This farm credits the caller, so an adapter cannot deposit for your wallet. A verified converter would require wallet conversion, then a separate farm deposit, plus approvals when needed.</p>
      <button type="button" className="button button-quiet" disabled>Convert IMD and deposit</button>
      <External href="https://pool4.imd.fun/docs">Official conversion documentation</External>
    </div> : <p className="small muted">Deposit sIMD directly once the Owner configures the verified Sepolia asset. Withdrawals return sIMD.</p>}
  </section>;
}

export function SqkPoolCard({ compact = false }: { compact?: boolean }) {
  const { address } = useAccount();
  const balance = useQuery({ queryKey: ["sqk-wallet-balance", address], enabled: !!address,
    queryFn: async () => {
      if (await publicClient.getChainId() !== 11155111) throw new Error("Sepolia required");
      return publicClient.readContract({ address: SQK_TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [address!] });
    }, staleTime: 15000, refetchInterval: 30000, retry: false });
  return <article className="pool-card pool-sqk" aria-label="SQK Pool">
    <div className="pool-card-head"><span className="sqk-coin"><Sprout size={28} /></span><Badge>Coming Soon</Badge></div>
    <h3>SQK Pool</h3><p className="pool-description">A new burrow for Squeek. Farm deployment and registration pending.</p>
    <dl className="pool-allocation"><div><dt>Target allocation</dt><dd>20% · 200 points</dd></div>
      <div><dt>Current allocation</dt><dd>Not registered</dd></div></dl>
    <AprBreakdown />
    {!compact && <dl className="position-details">
      <div><dt>SQK wallet balance</dt><dd><Amount value={balance.data} decimals={SQK_DECIMALS} symbol="SQK" /></dd></div>
      {[["Deposited SQK", "SQK"], ["Share balance", "shares"], ["Withdrawable SQK", "SQK"], ["Claimable CHEESE", "CHEESE"]].map(([label]) =>
        <div key={label}><dt>{label}</dt><dd>N/A · Not deployed</dd></div>)}
    </dl>}
    {balance.isError && <p className="small error-text">SQK balance unavailable. RPC read failed.</p>}
    {!address && !compact && <p className="small muted">Connect a wallet to read your SQK balance.</p>}
    <div className="sqk-disabled-actions">
      <button type="button" className="button button-pool" disabled>Deposit</button>
      <button type="button" className="button button-quiet" disabled>Withdraw</button>
      <button type="button" className="button button-quiet" disabled>Claim</button>
      <button type="button" className="button button-quiet" disabled>MAX</button>
    </div>
    <p className="small muted">No SQK Farm address exists in this release. No transaction started.</p>
    <External href={addressUrl(SQK_TOKEN)}>Verified SQK token on Sepolia</External>
  </article>;
}

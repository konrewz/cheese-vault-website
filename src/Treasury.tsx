import { useQuery } from '@tanstack/react-query';
import { Landmark, LockKeyhole, RefreshCw, ReceiptText, ArrowDownLeft } from 'lucide-react';
import { Amount, CopyAddress, External, Hamster } from './components';
import { addressUrl, transactionUrl } from './contracts/config';
import { DEPLOYMENT_BLOCK, DEPLOYMENT_TX, INTENDED_TREASURY, loadTreasuryFees, loadTreasurySnapshot } from './contracts/treasury';

function readError(error: Error) {
  // RPC exceptions can contain raw calldata and transport details, which are not useful in the UI.
  return /https?:|Request body:|HTTP request|fetch|timeout/i.test(error.message)
    ? 'The Sepolia data provider could not complete the read. Please try again.'
    : error.message;
}

export function Treasury() {
  const snapshot = useQuery({ queryKey: ['treasury-snapshot'], queryFn: () => loadTreasurySnapshot(), staleTime: 30_000, refetchInterval: 60_000, retry: false });
  const state = snapshot.data;
  const history = useQuery({ queryKey: ['treasury-fees',state?.block.toString()], queryFn: ({ signal }) => loadTreasuryFees(state!,signal), enabled: !!state && !snapshot.isError, staleTime: 60_000, retry: false });
  const valid = !!state && !snapshot.isError;
  const totals = !history.isError && valid ? history.data : undefined;
  const refresh = () => { void snapshot.refetch(); if (state) void history.refetch(); };
  return <div className="content-width inner-page treasury-page">
    <section className="treasury-hero">
      <div><span className="eyebrow"><Landmark size={16} /> THE COMMUNITY CUPBOARD</span><h1>A little cheese.<br />Full transparency.</h1><p>Welcome to the Treasury. See what is here, where withdrawal fees go, and how the vault began.</p>
        <div className="treasury-tags"><span><LockKeyhole size={14} />Read-only · Ethereum Sepolia</span><span>No wallet connection needed</span></div>
      </div><div className="treasury-mascot"><Hamster /><span>Every crumb accounted for.</span></div>
    </section>
    <section className="treasury-account" aria-label="Treasury wallet">
      <div><h2>Treasury overview</h2><CopyAddress address={INTENDED_TREASURY} label="Treasury wallet" /><External href={addressUrl(INTENDED_TREASURY)}>View Treasury on Etherscan</External></div>
      <button className="button button-secondary" onClick={refresh} disabled={snapshot.isFetching || history.isFetching}><RefreshCw size={16} className={snapshot.isFetching ? 'spin' : ''} />Refresh reads</button>
    </section>
    {snapshot.isPending && <p role="status" className="treasury-notice">Reading verified Sepolia balances…</p>}
    {snapshot.isError && <p role="alert" className="treasury-notice treasury-error">Treasury reads unavailable. {readError(snapshot.error)} Refresh to try again. No cached balance is presented as current.</p>}
    {valid && <p className={`treasury-notice ${state.matchesIntended ? '' : 'treasury-error'}`} role={state.matchesIntended ? 'status' : 'alert'}>
      {state.matchesIntended ? 'Controller Treasury matches the intended wallet.' : <>Treasury mismatch: the Controller currently points to <code>{state.actualTreasury}</code>. Balances below belong to the intended wallet above; fee receipts are attributed to their actual historical recipient.</>}
      {' '}<External href={`https://sepolia.etherscan.io/block/${state.block}`}>Checked at block {state.block.toString()}</External>
    </p>}
    <div className="treasury-assets">{['CHEESE','ETH','sIMD','SQK'].map(symbol => { const asset = valid ? state.balances.find(x => x.symbol === symbol) : undefined; return <article className="treasury-asset" key={symbol}>
      <span className="treasury-asset-symbol">{symbol}<ArrowDownLeft size={17}/></span>
      <strong>{asset?.balance !== undefined ? <Amount value={asset.balance} decimals={asset.decimals} symbol={symbol} /> : snapshot.isPending ? 'Reading…' : 'Unavailable'}</strong>
      <small>{asset?.status ?? (snapshot.isError ? 'RPC read failed' : 'Waiting for verified data')}</small>
    </article>; })}</div>
    <p className="small muted">Wallet holdings are not fee revenue. Assets stay in their own units; reliable USD valuations are unavailable.</p>

    <section className="treasury-section" aria-labelledby="fee-heading"><div className="treasury-section-title"><div><span className="eyebrow">THE HAMSTER BITE</span><h2 id="fee-heading">Withdrawal fee revenue</h2></div><ReceiptText size={28}/></div>
      <div className="treasury-fee-split"><span><b>85%</b>You receive</span><span><b>14%</b>Stays in the farm</span><span><b>1%</b>Treasury</span></div>
      <p>The usual split of a 15% withdrawal fee. The final depositor sends the full fee and residual dust to Treasury. The deployed contract also caps retained fees when few shares remain, so Treasury can receive more than 1%.</p>
      <div className="treasury-fee-grid">{['CHEESE','ETH','sIMD','SQK'].map(symbol => {
        const p = totals?.pools.find(x => x.pool === symbol); const supported = symbol === 'CHEESE' || symbol === 'ETH';
        const status = symbol === 'SQK' ? 'Farm not deployed' : symbol === 'sIMD' ? 'Asset not verified' : history.isError ? 'History unavailable' : !valid ? 'Waiting for verified reads' : history.isPending ? 'Checking event history…' : 'Full event history reconciled';
        return <article key={symbol}><h3>{symbol} Pool</h3><dl><div><dt>Fees received</dt><dd>{supported && p ? <Amount value={p.received} decimals={18} symbol={symbol}/> : 'Unavailable'}</dd></div><div><dt>Fees assigned to this wallet</dt><dd>{supported && p ? <Amount value={p.assigned} decimals={18} symbol={symbol}/> : 'Unavailable'}</dd></div><div><dt>Farm fees still owed</dt><dd>{supported && p ? <Amount value={p.outstanding} decimals={18} symbol={symbol}/> : 'Unavailable'}</dd></div></dl><small>{status}</small></article>;
      })}</div>
      <p className="small muted">Only verified Withdrawn and Treasury payment events count. Deferred fees are received only when paid; donations, token premints and surplus transfers are excluded. “Still owed” is the farm’s global deferred balance, not an extra receipt or a balance assigned to one wallet.</p>
    </section>

    <section className="treasury-section treasury-premint" aria-labelledby="premint-heading"><div><span className="eyebrow">WHERE IT STARTED</span><h2 id="premint-heading">The initial cheese allocation</h2><p>One premint. Three purposes.</p></div>
      {valid && state.premintVerified ? <><div className="premint-bar" aria-label="Team 30%, Treasury 30%, Liquidity 40%"><span/><span/><span/></div><div className="premint-values"><div><span>Team</span><strong>63,000,000</strong></div><div><span>Treasury</span><strong>63,000,000</strong></div><div><span>Liquidity</span><strong>84,000,000</strong></div></div><p><b>Total premint: 210,000,000 CHEESE</b></p><p className="small muted">Confirmed initial allocations, not separate current wallet balances. All three were minted to the same intended Treasury wallet. Current holdings are shown above.</p><External href={transactionUrl(DEPLOYMENT_TX)}>Verify premint receipt</External></> : <p className="treasury-notice">{snapshot.isPending ? 'Verifying the original mint receipt…' : valid ? state.premintStatus : 'Premint verification unavailable. No allocation is marked confirmed.'}</p>}
    </section>

    <section className="treasury-section" aria-labelledby="history-heading"><div className="treasury-section-title"><div><span className="eyebrow">FOLLOW THE CRUMBS</span><h2 id="history-heading">Treasury history</h2></div><span className="small muted">Latest 50 fee-related events</span></div>
      {history.isError ? <p role="alert" className="treasury-notice treasury-error">Fee history unavailable. {readError(history.error)} No cumulative total is inferred from an incomplete scan.</p> : !totals ? <p role="status" className="treasury-notice">{snapshot.isError ? 'History is unavailable until Treasury reads succeed.' : 'Checking confirmed fee events…'}</p> : totals.rows.length === 0 ? <div className="treasury-empty"><ReceiptText size={30}/><h3>No withdrawal fee receipts yet.</h3><p>No fee-related events for this wallet were found in the complete checked range, blocks {DEPLOYMENT_BLOCK.toString()}–{totals.block.toString()}.</p></div> : <div className="treasury-history-list">{totals.rows.map(row => <article key={row.id}><div><strong>{row.pool} Pool</strong><small>{row.timestamp ? new Date(Number(row.timestamp)*1000).toLocaleString(undefined,{timeZone:'UTC'})+' UTC' : 'Date unavailable'}</small></div><div>{row.pool === "CHEESE" || row.pool === "ETH" ? <Amount value={row.amount} decimals={18} symbol={row.pool}/> : <span>{row.amount.toString()} raw units ? asset unverified</span>}<small>{row.status}</small></div><External href={transactionUrl(row.hash)}>Transaction</External></article>)}</div>}
      <p className="small muted">This page reads public blockchain data. It has no signing, spending, configuration or administrative controls.</p>
    </section>
  </div>;
}

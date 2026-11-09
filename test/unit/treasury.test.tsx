import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { encodeEventTopics, encodeAbiParameters, type Hash } from 'viem';
import { CONTROLLER, POOLS, TOKEN, tokenAbi } from '../../src/contracts/config';
import { INTENDED_TREASURY, reconcileFees, verifyPremintLogs, loadTreasurySnapshot, loadTreasuryFees, type FeeEvent, type TreasurySnapshot } from '../../src/contracts/treasury';
import { Treasury } from '../../src/Treasury';
import { FooterX, FloatingX, OFFICIAL_X } from '../../src/SocialLinks';
import * as treasuryModule from '../../src/contracts/treasury';

const hash = (n: number) => `0x${n.toString(16).padStart(64,'0')}` as Hash;
const other = '0x1111111111111111111111111111111111111111';
const start: FeeEvent = { address: CONTROLLER, hash: hash(1), block: 1n, logIndex: 0, kind: 'TreasuryUpdated', args: { current: INTENDED_TREASURY } };
const owed = (n=0n) => ({ CHEESE: n, ETH: 0n, sIMD: 0n });
const event = (kind: FeeEvent['kind'], args: FeeEvent['args'], index=1, tx=2): FeeEvent => ({ address: POOLS[0].address, hash: hash(tx), block: BigInt(tx), logIndex: index, kind, args });
describe('Treasury event accounting', () => {
  it('reports verified zero only from a complete initial Treasury history', () => {
    expect(reconcileFees([start],owed()).pools[0]).toEqual({ pool:'CHEESE',assigned:0n,received:0n,outstanding:0n });
    expect(() => reconcileFees([],owed())).toThrow('Missing initial');
  });
  it('counts the actual final-exit Treasury amount, not an assumed one percent', () => {
    const result=reconcileFees([start,event('Withdrawn',{toTreasury:171000000000000000n})],owed());
    expect(result.pools[0].received).toBe(171000000000000000n);
    expect(result.rows[0].status).toBe('Received');
  });
  it('does not count a deferred fee as cash, and does not double count its later payment', () => {
    const withdrawal=event('Withdrawn',{toTreasury:15n});const deferred=event('TreasuryPaymentDeferred',{treasury:INTENDED_TREASURY,amount:15n},2);
    expect(reconcileFees([start,withdrawal,deferred],owed(15n)).pools[0]).toMatchObject({ assigned:15n,received:0n,outstanding:15n });
    const paid=event('TreasuryPaid',{treasury:INTENDED_TREASURY,amount:15n},1,3);
    const r=reconcileFees([start,withdrawal,deferred,paid],owed());
    expect(r.pools[0]).toMatchObject({ assigned:15n,received:15n,outstanding:0n });
    expect(r.rows.map(x=>x.status)).toEqual(['Deferred fee paid','Deferred']);
  });
  it('deduplicates repeated logs and sorts out-of-order pages', () => {
    const w=event('Withdrawn',{toTreasury:10n});expect(reconcileFees([w,start,w],owed()).pools[0].received).toBe(10n);
  });
  it('ignores unrelated contracts and uses historical Treasury changes', () => {
    const change={...start,hash:hash(3),block:3n,args:{current:other}};
    const r=reconcileFees([start,event('Withdrawn',{toTreasury:10n}),change,event('Withdrawn',{toTreasury:20n},1,4),{...event('Withdrawn',{toTreasury:999n}),address:other}],owed());
    expect(r.pools[0].received).toBe(10n);
  });
  it('attributes a deferred payout to its actual new recipient without inventing assigned revenue', () => {
    const initial={...start,args:{current:other}};
    const r=reconcileFees([initial,event('Withdrawn',{toTreasury:15n}),event('TreasuryPaymentDeferred',{treasury:other,amount:15n},2),{...start,hash:hash(3),block:3n},event('TreasuryPaid',{treasury:INTENDED_TREASURY,amount:15n},1,4)],owed());
    expect(r.pools[0]).toMatchObject({ assigned:0n,received:15n });
  });
  it('rejects incomplete or inconsistent owed accounting', () => {
    expect(() => reconcileFees([start,event('TreasuryPaid',{treasury:INTENDED_TREASURY,amount:1n})],owed())).toThrow('Incomplete');
    expect(() => reconcileFees([start],owed(1n))).toThrow('reconcile');
    expect(() => reconcileFees([start,event('Withdrawn',{toTreasury:1n}),event('TreasuryPaymentDeferred',{treasury:INTENDED_TREASURY,amount:2n},2)],owed(2n))).toThrow('reconciled');
  });
  it('keeps all asset units separate', () => {
    const r=reconcileFees([start,event('Withdrawn',{toTreasury:10n}),{...event('Withdrawn',{toTreasury:20n},1,3),address:POOLS[1].address}],owed());
    expect(r.pools.map(p=>p.received)).toEqual([10n,20n,0n]);
  });
});

const mintLogs=() => [63_000_000n,63_000_000n,84_000_000n].map(n=>({address:TOKEN,topics:encodeEventTopics({abi:tokenAbi,eventName:'Transfer',args:{from:'0x0000000000000000000000000000000000000000',to:INTENDED_TREASURY}}),data:encodeAbiParameters([{type:'uint256'}],[n*10n**18n])}));
const premint=()=>({address:TOKEN,topics:encodeEventTopics({abi:tokenAbi,eventName:'Preminted',args:{teamRecipient:INTENDED_TREASURY,treasuryRecipient:INTENDED_TREASURY,liquidityRecipient:INTENDED_TREASURY}}),data:'0x' as const});
describe('Premint provenance and read safety',()=>{
  it('verifies all three actual mint transfers and the recipient event',()=>{expect(verifyPremintLogs([...mintLogs(),premint()])).toBe(true);});
  it('rejects an unrelated or incomplete allocation receipt',()=>{expect(verifyPremintLogs(mintLogs())).toBe(false);expect(verifyPremintLogs([...mintLogs().slice(1),premint()])).toBe(false);expect(verifyPremintLogs([...mintLogs().map(x=>({...x,address:other})),premint()])).toBe(false);});
  it('rejects wrong RPC network before issuing other reads',async()=>{
    const client={getChainId:vi.fn().mockResolvedValue(1),getBlock:vi.fn()};await expect(loadTreasurySnapshot(client as never)).rejects.toThrow('Wrong RPC');expect(client.getBlock).not.toHaveBeenCalled();
  });
  it('rejects unbounded history rather than publishing a partial cumulative total',async()=>{
    await expect(loadTreasuryFees({block:99999999n} as TreasurySnapshot,undefined,{getChainId:async()=>11155111} as never)).rejects.toThrow('verified indexer');
  });
});

const snapshot: TreasurySnapshot = {block:12091300n,blockHash:hash(3),timestamp:1794146400n,actualTreasury:INTENDED_TREASURY,matchesIntended:true,premintVerified:true,premintStatus:'Confirmed',balances:[{symbol:'CHEESE',balance:210000000n*10n**18n,decimals:18,status:'Verified token balance'},{symbol:'ETH',balance:1n,decimals:18,status:'Native Sepolia ETH'},{symbol:'sIMD',status:'Asset not configured'},{symbol:'SQK',balance:0n,decimals:18,status:'Official SQK'}]};
function renderTreasury() {return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Treasury/></QueryClientProvider>);}
describe('Treasury UI',()=>{
  it('shows balances, confirmed allocations and verified empty history without a connect or sign action',async()=>{
    vi.spyOn(treasuryModule,'loadTreasurySnapshot').mockResolvedValue(snapshot);
    vi.spyOn(treasuryModule,'loadTreasuryFees').mockResolvedValue({...reconcileFees([start],owed()),block:snapshot.block});
    renderTreasury();await screen.findByText('No withdrawal fee receipts yet.');
    expect(screen.getByText('Total premint: 210,000,000 CHEESE')).toBeVisible();
    expect(screen.getByText('Asset not configured')).toBeVisible();
    expect(screen.queryByRole('button',{name:/connect|approve|deposit|withdraw|claim|sign|activate/i})).not.toBeInTheDocument();
  });
  it('flags a Treasury mismatch and does not relabel intended-wallet holdings',async()=>{
    vi.spyOn(treasuryModule,'loadTreasurySnapshot').mockResolvedValue({...snapshot,matchesIntended:false,actualTreasury:other});
    vi.spyOn(treasuryModule,'loadTreasuryFees').mockResolvedValue({...reconcileFees([start],owed()),block:snapshot.block});
    renderTreasury();expect(await screen.findByRole('alert')).toHaveTextContent('Treasury mismatch');
  });
  it('marks failed receipts and fee scans unavailable rather than zero',async()=>{
    vi.spyOn(treasuryModule,'loadTreasurySnapshot').mockResolvedValue({...snapshot,premintVerified:false,premintStatus:'Deployment receipt unavailable'});
    vi.spyOn(treasuryModule,'loadTreasuryFees').mockRejectedValue(Error('RPC limit'));
    renderTreasury();await screen.findByText(/Fee history unavailable/);expect(screen.queryByText('Total premint: 210,000,000 CHEESE')).not.toBeInTheDocument();expect(screen.queryByText('No withdrawal fee receipts yet.')).not.toBeInTheDocument();
  });
  it('exposes loading and RPC error states',async()=>{
    vi.spyOn(treasuryModule,'loadTreasurySnapshot').mockRejectedValue(Error('Network offline'));renderTreasury();expect(screen.getByText('Reading verified Sepolia balances…')).toBeVisible();await screen.findByText(/Treasury reads unavailable/);
  });
});
describe('Official X links',()=>{
  it('uses only the official profile with a tooltip and safe new-tab attributes',()=>{
    render(<><FloatingX/><FooterX/></>);const links=screen.getAllByRole('link');expect(links).toHaveLength(2);for(const link of links){expect(link).toHaveAttribute('href',OFFICIAL_X);expect(link).toHaveAttribute('target','_blank');expect(link).toHaveAttribute('rel','noopener noreferrer');}expect(screen.getByRole('tooltip')).toHaveTextContent('Follow us on X');
  });
  it('hides the floating control while a wallet or transaction dialog is open',()=>{render(<FloatingX hidden/>);expect(screen.queryByRole('link')).not.toBeInTheDocument();});
});

// Explicit unconfigured-extension fixture: independent of future verified deployment addresses.
vi.mock("../../src/contracts/integrations", async (importOriginal) => { const actual = await importOriginal<typeof import("../../src/contracts/integrations")>(); return {...actual, SQK_FARM:undefined, EXTENSIONS:{...actual.EXTENSIONS,wrapper:null,sqkFarm:null}}; });

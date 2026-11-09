import { useEffect, useRef, useState } from 'react';
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { encodeFunctionData, formatUnits, type Hash } from 'viem';
import { Amount, External } from './components';
import { CHAIN, publicClient, transactionUrl } from './contracts/config';
import { conversionCall, loadConversion, verifyExtension } from './contracts/conversion';
import { prepareTransaction, type Prepared } from './contracts/transactions';
import { friendlyError, parseAmount } from './contracts/math';
import { saveTransaction, type HistoryEntry } from './history';

export function ConversionPanel({ onDeposit }: { onDeposit?: () => void }) {
  const {address,chainId}=useAccount();const {data:wallet}=useWalletClient();const {switchChainAsync}=useSwitchChain();const cache=useQueryClient();
  const q=useQuery({queryKey:['conversion',address],queryFn:()=>loadConversion(address),retry:false,refetchInterval:30000});
  const [mode,setMode]=useState<'wrap'|'redeem'>('wrap'),[amount,setAmount]=useState(''),[review,setReview]=useState<Prepared>(),[phase,setPhase]=useState('editing'),[error,setError]=useState(''),[hash,setHash]=useState<Hash>(),[pending,setPending]=useState<{entry:HistoryEntry;review:Prepared}>();
  const identity=useRef({address,chainId});identity.current={address,chainId};const busy=['preparing','wallet','pending'].includes(phase);
  useEffect(()=>{if(!busy){setReview(undefined);setAmount('');setPhase('editing');}},[address,chainId]);
  const state=!q.isError?q.data:undefined;const balance=mode==='wrap'?state?.imdBalance:state?.simdBalance;
  const disabled=!address||chainId!==CHAIN.id||!state||(mode==='wrap'&&!state.farmReady)||busy||!!pending;
  async function prepare(){setError('');setPhase('preparing');try{
    if(!address||chainId!==CHAIN.id)throw Error('Connect your wallet on Sepolia.');
    const fresh=await loadConversion(address);const call=conversionCall(fresh,mode,parseAmount(amount,fresh.decimals),address);
    const next=await prepareTransaction(call,address);
    if(identity.current.address!==address||identity.current.chainId!==chainId)throw Error('Wallet changed. Review again.');
    if(await publicClient.getBalance({address})<next.gasCeiling)throw Error('Insufficient Sepolia ETH for gas.');
    setReview(next);setPhase('review');
  }catch(e){setError(friendlyError(e));setPhase('editing');}}
  async function receipt(txHash:Hash,entry:HistoryEntry,prepared:Prepared){setPhase('pending');setError('');try{
    let replacement=false;
    const r=await publicClient.waitForTransactionReceipt({hash:txHash,timeout:120000,confirmations:1,onReplaced:x=>{replacement=x.reason!=='repriced';setHash(x.transaction.hash);}});
    const tx=await publicClient.getTransaction({hash:r.transactionHash});
    const expected=encodeFunctionData(prepared.call);
    const matches=!replacement&&tx.from.toLowerCase()===entry.account.toLowerCase()&&tx.to?.toLowerCase()===prepared.call.address.toLowerCase()&&tx.input===expected&&tx.value===0n;
    saveTransaction({...entry,hash:r.transactionHash,block:String(r.blockNumber),status:!matches?'replaced':r.status==='success'?'confirmed':'reverted'},entry.hash);
    setHash(r.transactionHash);setPending(undefined);setReview(undefined);await cache.invalidateQueries();
    if(!matches)throw Error('Transaction was replaced with different data; conversion is not confirmed.');
    if(r.status!=='success')throw Error('Transaction reverted. No conversion completed.');
    setPhase(entry.kind==='approve'?'approved':'success');
  }catch(e){setError(friendlyError(e));setPhase('error');}}
  async function confirm(){if(!review||!address||!wallet||pending)return;setError('');setPhase('wallet');try{
    if(await wallet.getChainId()!==CHAIN.id||identity.current.address!==review.account||identity.current.chainId!==CHAIN.id)throw Error('Wallet or network changed. Review again.');
    const fresh=await loadConversion(address);await verifyExtension(fresh.address);
    const call=conversionCall(fresh,mode,parseAmount(amount,fresh.decimals),address);
    if(encodeFunctionData(call)!==encodeFunctionData(review.call)||call.address!==review.call.address)throw Error('Allowance or quote changed. Review the next step.');
    const prepared=await prepareTransaction(call,address);
    if(await publicClient.getBalance({address})<prepared.gasCeiling)throw Error('Insufficient Sepolia ETH for gas.');
    if(await wallet.getChainId()!==CHAIN.id||identity.current.address!==address)throw Error('Wallet changed.');
    const txHash=await wallet.writeContract({...call,account:address,chain:CHAIN,gas:prepared.gas,maxFeePerGas:prepared.maxFeePerGas,maxPriorityFeePerGas:prepared.maxPriorityFeePerGas});
    const entry:HistoryEntry={hash:txHash,account:address,pool:'simd',kind:call.functionName==='approve'?'approve':mode,amount,symbol:mode==='wrap'?'IMD':'sIMD',status:'pending',createdAt:Date.now()};
    saveTransaction(entry);setHash(txHash);setPending({entry,review:prepared});await receipt(txHash,entry,prepared);
  }catch(e){setError(friendlyError(e));setPhase('error');}}
  return <section className="conversion-status" aria-label="Test sIMD conversion">
    <strong>Sepolia test wrapper · not official production sIMD</strong>
    <div className="conversion-options"><button disabled={busy||!!pending} aria-pressed={mode==='wrap'} onClick={()=>{setMode('wrap');setReview(undefined);setPhase('editing');}}>IMD → test sIMD</button><button disabled={busy||!!pending} aria-pressed={mode==='redeem'} onClick={()=>{setMode('redeem');setReview(undefined);setPhase('editing');}}>Redeem sIMD → IMD</button></div>
    <p>Wrap in your wallet, then deposit separately. Approvals may add transactions. No adapter takes custody or receives your farm shares.</p>
    <label>Amount ({mode==='wrap'?'IMD':'sIMD'})<input inputMode="decimal" value={amount} disabled={busy||!!pending} onChange={e=>{setAmount(e.target.value);setReview(undefined);setPhase('editing');}}/></label>
    <button className="inline-link" disabled={balance===undefined||busy||!!pending} onClick={()=>{setAmount(formatUnits(balance!,state!.decimals));setReview(undefined);}}>MAX</button>
    <dl><div><dt>Wallet balance</dt><dd><Amount value={balance} decimals={state?.decimals} symbol={mode==='wrap'?'IMD':'sIMD'}/></dd></div><div><dt>Conversion rate</dt><dd>{state?'1 IMD = 1 test sIMD':'Unavailable'}</dd></div><div><dt>Minimum output</dt><dd>{state&&/^\d+(\.\d+)?$/.test(amount)?`${amount} ${mode==='wrap'?'sIMD':'IMD'}`:'Unavailable'}</dd></div><div><dt>Conversion fee</dt><dd>{state?'0%; network gas applies':'Unavailable'}</dd></div><div><dt>Transaction status</dt><dd role="status">{phase}</dd></div></dl>
    {q.isError&&<p role="alert">Verification unavailable. Conversion is disabled.</p>}
    {state&&!state.farmReady&&<p>Farm configuration pending. Redemption of existing wallet sIMD remains available.</p>}
    {!address&&<p>Connect your wallet using the navigation to continue.</p>}
    {address&&chainId!==CHAIN.id&&<button className="button button-quiet" onClick={()=>{void switchChainAsync({chainId:CHAIN.id}).catch(e=>setError(friendlyError(e)));}}>Switch to Sepolia</button>}
    {error&&<p role="alert">{error}</p>}
    {hash&&<External href={transactionUrl(hash)}>View transaction on Sepolia</External>}
    {review&&phase==='review'?<><p>Next: {review.call.functionName==='approve'?(review.call.args[1]===0n?'Reset existing allowance':'Approve exact IMD amount'):mode==='wrap'?'Wrap IMD':'Redeem sIMD'}. Maximum estimated gas: {formatUnits(review.gasCeiling,18)} ETH.</p><button className="button button-pool" disabled={disabled} onClick={()=>void confirm()}>Confirm in wallet</button></>:<button className="button button-pool" disabled={disabled} onClick={()=>void prepare()}>Review next transaction</button>}
    {pending&&phase==='error'&&<button className="button button-quiet" onClick={()=>void receipt(pending.entry.hash,pending.entry,pending.review)}>Check existing receipt</button>}
    {phase==='success'&&mode==='wrap'&&onDeposit&&<button className="button button-pool" onClick={onDeposit}>Continue to sIMD farm deposit</button>}
    <p className="small muted">Farm withdrawals return sIMD after the Hamster Bite. Redeem that wallet balance here in a separate transaction.</p>
  </section>;
}

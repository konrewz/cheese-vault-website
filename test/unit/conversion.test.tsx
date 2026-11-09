import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {keccak256,parseAbi,encodeFunctionData,type Address,type Hash} from 'viem';
import {EXTENSIONS,IMD_TOKEN} from '../../src/contracts/integrations';
import {publicClient,POOLS} from '../../src/contracts/config';
import {conversionCall,loadConversion,verifyExtension,wrapperAbi,type ConversionState} from '../../src/contracts/conversion';
import {ConversionPanel} from '../../src/ConversionPanel';
const walletState=vi.hoisted(()=>({address:'0x0000000000000000000000000000000000000011' as Address,chainId:11155111,write:vi.fn(),switch:vi.fn()}));
vi.mock('wagmi',()=>({useAccount:()=>walletState,useWalletClient:()=>({data:{getChainId:async()=>walletState.chainId,writeContract:walletState.write}}),useSwitchChain:()=>({switchChainAsync:walletState.switch})}));
const wrapper='0x0000000000000000000000000000000000000022' as Address;
const original=EXTENSIONS.wrapper,originalIMD=EXTENSIONS.imdRuntimeHash;
const code='0x60006000' as const,hash=('0x'+'ab'.repeat(32)) as Hash;
const state:ConversionState={address:wrapper,decimals:18,reserve:100n,supply:100n,farmReady:true,imdBalance:10n**20n,simdBalance:10n**20n,allowance:0n};
let tokenAllowance=0n;
beforeEach(()=>{
 EXTENSIONS.wrapper={address:wrapper,runtimeHash:keccak256(code),deploymentTx:hash,blockNumber:'1'};EXTENSIONS.imdRuntimeHash=keccak256(code);walletState.chainId=11155111;tokenAllowance=0n;walletState.write.mockReset();
 vi.spyOn(publicClient,'getChainId').mockResolvedValue(11155111);vi.spyOn(publicClient,'getCode').mockResolvedValue(code);vi.spyOn(publicClient,'getBalance').mockResolvedValue(10n**18n);
 vi.spyOn(publicClient,'readContract').mockImplementation(async (args:any)=>{
  switch(args.functionName){case 'asset':return args.address===POOLS[2].address?wrapper:IMD_TOKEN;case 'decimals':return 18;case 'reserveAssets':return 100n;case 'totalSupply':return 100n;case 'registered':return true;case 'balanceOf':return 10n**20n;case 'allowance':return tokenAllowance;default:throw Error('Unexpected read');}
 });
 vi.spyOn(publicClient,'simulateContract').mockResolvedValue({result:true} as any);vi.spyOn(publicClient,'estimateContractGas').mockResolvedValue(100000n);vi.spyOn(publicClient,'estimateFeesPerGas').mockResolvedValue({maxFeePerGas:100n,maxPriorityFeePerGas:1n});
});
afterEach(()=>{EXTENSIONS.wrapper=original;EXTENSIONS.imdRuntimeHash=originalIMD;vi.restoreAllMocks();});
describe('test wrapper transaction safety',()=>{
 it('matches exact ABI and enforces minimum output and wallet receiver',()=>{const c=conversionCall({...state,allowance:100n},'wrap',100n,walletState.address);expect(c.functionName).toBe('deposit');expect(c.args).toEqual([100n,100n,walletState.address]);expect(encodeFunctionData(c)).toBe(encodeFunctionData({abi:parseAbi(['function deposit(uint256,uint256,address)']),functionName:'deposit',args:[100n,100n,walletState.address]}));const r=conversionCall(state,'redeem',100n,walletState.address);expect(r.functionName).toBe('redeem');expect(r.args).toEqual([100n,100n,walletState.address]);});
 it('approves exact amount and resets a partial allowance first',()=>{expect(conversionCall(state,'wrap',100n,walletState.address).args).toEqual([wrapper,100n]);expect(conversionCall({...state,allowance:1n},'wrap',100n,walletState.address).args).toEqual([wrapper,0n]);});
 it('rejects absent deployment, insufficient funds, zero and unconfigured farm',()=>{expect(()=>conversionCall(state,'wrap',0n,walletState.address)).toThrow();expect(()=>conversionCall(state,'wrap',10n**21n,walletState.address)).toThrow('balance');expect(()=>conversionCall({...state,farmReady:false},'wrap',1n,walletState.address)).toThrow('not configured');expect(conversionCall({...state,farmReady:false},'redeem',1n,walletState.address).functionName).toBe('redeem');EXTENSIONS.wrapper=null;expect(()=>conversionCall(state,'wrap',1n,walletState.address)).toThrow('unverified');});
 it('verifies runtime, asset, decimals and reserves before exposing 1:1',async()=>{await expect(loadConversion(walletState.address)).resolves.toMatchObject({decimals:18,farmReady:true,reserve:100n});});
 it('fails closed on wrong chain or runtime',async()=>{vi.mocked(publicClient.getChainId).mockResolvedValue(1);await expect(verifyExtension(wrapper)).rejects.toThrow('Sepolia');vi.mocked(publicClient.getChainId).mockResolvedValue(11155111);vi.mocked(publicClient.getCode).mockResolvedValue('0x00');await expect(verifyExtension(wrapper)).rejects.toThrow('runtime');});
 it('fails closed on a reserve deficit',async()=>{const originalRead=publicClient.readContract;vi.mocked(publicClient.readContract).mockImplementation(async(args:any)=>args.functionName==='reserveAssets'?99n:args.functionName==='asset'?(args.address===POOLS[2].address?wrapper:IMD_TOKEN):args.functionName==='decimals'?18:args.functionName==='registered'?true:100n);await expect(loadConversion()).rejects.toThrow('backing');void originalRead;});
 it('fails closed on decimal mismatch and wrong underlying',async()=>{vi.mocked(publicClient.readContract).mockResolvedValue('0x0000000000000000000000000000000000000033');await expect(verifyExtension(wrapper)).rejects.toThrow('asset mismatch');});
 it('shows readiness without signing automatically',async()=>{render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConversionPanel/></QueryClientProvider>);expect(await screen.findByText('1 IMD = 1 test sIMD')).toBeVisible();expect(walletState.write).not.toHaveBeenCalled();expect(screen.getByText(/not official production/)).toBeVisible();await userEvent.click(screen.getByRole('button',{name:'MAX'}));expect(screen.getByLabelText('Amount (IMD)')).toHaveValue('100');});
 it('approval requires review and wallet click; success requires a matching receipt',async()=>{
  walletState.write.mockResolvedValue(hash);vi.spyOn(publicClient,'waitForTransactionReceipt').mockResolvedValue({status:'success',transactionHash:hash,blockNumber:5n,logs:[]} as any);
  vi.spyOn(publicClient,'getTransaction').mockResolvedValue({from:walletState.address,to:IMD_TOKEN,input:encodeFunctionData(conversionCall(state,'wrap',10n**18n,walletState.address)),value:0n} as any);
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConversionPanel/></QueryClientProvider>);await screen.findByText('1 IMD = 1 test sIMD');await userEvent.type(screen.getByLabelText('Amount (IMD)'),'1');await userEvent.click(screen.getByRole('button',{name:'Review next transaction'}));expect(walletState.write).not.toHaveBeenCalled();await userEvent.click(await screen.findByRole('button',{name:'Confirm in wallet'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('approved'));expect(walletState.write).toHaveBeenCalledOnce();expect(screen.getByRole('link',{name:/View transaction/})).toHaveAttribute('href',`https://sepolia.etherscan.io/tx/${hash}`);
 });
 it('rejected wallet confirmation does not show success',async()=>{
  walletState.write.mockRejectedValue(Error('User rejected request'));render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConversionPanel/></QueryClientProvider>);await screen.findByText('1 IMD = 1 test sIMD');await userEvent.type(screen.getByLabelText('Amount (IMD)'),'1');await userEvent.click(screen.getByRole('button',{name:'Review next transaction'}));await userEvent.click(await screen.findByRole('button',{name:'Confirm in wallet'}));expect(await screen.findByRole('alert')).toBeVisible();expect(screen.getByRole('status')).toHaveTextContent('error');
 });
});

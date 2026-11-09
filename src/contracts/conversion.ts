import { erc20Abi, keccak256, parseAbi, type Address } from 'viem';
import { publicClient, POOLS } from './config';
import { EXTENSIONS, IMD_TOKEN, SQK_TOKEN } from './integrations';
import type { TransactionCall } from './transactions';

export const wrapperAbi = parseAbi([
  'function asset() view returns (address)', 'function decimals() view returns (uint8)',
  'function reserveAssets() view returns (uint256)', 'function totalSupply() view returns (uint256)',
  'function deposit(uint256 amount,uint256 minShares,address receiver) returns (uint256 shares)',
  'function redeem(uint256 shares,uint256 minAssets,address receiver) returns (uint256 assets)',
  'event Wrapped(address indexed sender,address indexed receiver,uint256 assets,uint256 shares)',
  'event Redeemed(address indexed sender,address indexed receiver,uint256 shares,uint256 assets)',
]);
export async function verifyExtension(address: Address) {
  if (await publicClient.getChainId() !== 11155111) throw Error('Ethereum Sepolia is required.');
  const ext = [EXTENSIONS.wrapper, EXTENSIONS.sqkFarm].find(x => x?.address.toLowerCase() === address.toLowerCase());
  if (!ext) throw Error('Deployment is not verified in this release.');
  const code = await publicClient.getCode({ address });
  if (!code || keccak256(code) !== ext.runtimeHash) throw Error('Extension runtime does not match the verified deployment.');
  const underlying = ext === EXTENSIONS.wrapper ? IMD_TOKEN : SQK_TOKEN;
  const actual = await publicClient.readContract({ address, abi: wrapperAbi, functionName: 'asset' });
  if (actual.toLowerCase() !== underlying.toLowerCase()) throw Error('Extension asset mismatch.');
  if (ext === EXTENSIONS.wrapper) {
    const imdCode = await publicClient.getCode({ address: IMD_TOKEN });
    if (!imdCode || keccak256(imdCode) !== EXTENSIONS.imdRuntimeHash) throw Error('IMD runtime mismatch.');
  }
}
export type ConversionState = { address: Address; decimals: number; imdBalance?: bigint; simdBalance?: bigint; allowance?: bigint; reserve: bigint; supply: bigint; farmReady: boolean };
export async function loadConversion(account?: Address): Promise<ConversionState> {
  const wrapper = EXTENSIONS.wrapper?.address;
  if (!wrapper) throw Error('Test sIMD wrapper not deployed and verified.');
  await verifyExtension(wrapper);
  const [decimals,imdDecimals,reserve,supply,asset,registered] = await Promise.all([
    publicClient.readContract({ address: wrapper, abi: wrapperAbi, functionName: 'decimals' }),
    publicClient.readContract({ address: IMD_TOKEN, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.readContract({ address: wrapper, abi: wrapperAbi, functionName: 'reserveAssets' }),
    publicClient.readContract({ address: wrapper, abi: wrapperAbi, functionName: 'totalSupply' }),
    publicClient.readContract({ address: POOLS[2].address, abi: POOLS[2].abi, functionName: 'asset' }) as Promise<Address>,
    publicClient.readContract({ address: POOLS[2].address, abi: POOLS[2].abi, functionName: 'registered' }) as Promise<boolean>,
  ]);
  if (decimals !== imdDecimals || decimals !== 18 || reserve < supply) throw Error('Wrapper decimals or reserve backing failed verification.');
  const balances = account ? await Promise.all([
    publicClient.readContract({address:IMD_TOKEN,abi:erc20Abi,functionName:'balanceOf',args:[account]}),
    publicClient.readContract({address:wrapper,abi:erc20Abi,functionName:'balanceOf',args:[account]}),
    publicClient.readContract({address:IMD_TOKEN,abi:erc20Abi,functionName:'allowance',args:[account,wrapper]}),
  ]) : [];
  return {address:wrapper,decimals,reserve,supply,imdBalance:balances[0],simdBalance:balances[1],allowance:balances[2],farmReady:registered && asset.toLowerCase()===wrapper.toLowerCase()};
}
export function conversionCall(state: ConversionState, mode: 'wrap'|'redeem', amount: bigint, account: Address): TransactionCall {
  if (amount <= 0n) throw Error('Enter an amount greater than zero.');
  if (!EXTENSIONS.wrapper || state.address.toLowerCase() !== EXTENSIONS.wrapper.address.toLowerCase()) throw Error('Wrapper deployment is unverified.');
  if (mode==='wrap' && !state.farmReady) throw Error('Test sIMD Farm is not configured and registered yet.');
  const balance = mode==='wrap'?state.imdBalance:state.simdBalance;
  if (balance===undefined || amount>balance) throw Error('Insufficient token balance.');
  if (mode==='wrap' && (state.allowance??0n)<amount) return {address:IMD_TOKEN,abi:erc20Abi,functionName:'approve',args:[state.address,state.allowance?0n:amount]};
  return {address:state.address,abi:wrapperAbi,functionName:mode==='wrap'?'deposit':'redeem',args:[amount,amount,account]};
}

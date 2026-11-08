import fs from 'node:fs';
import {createPublicClient,http,erc20Abi,parseAbi,keccak256} from 'viem';
const origin='https://docs.squeekchain.com';
const manifest=await (await fetch(`${origin}/assets/deployments/sepolia.json`)).json();
if(manifest.chainId!==11155111)throw Error('Manifest chain mismatch');
const token=manifest.contracts.SqueekToken;
const abi=await (await fetch(new URL(token.abi,origin))).json();
fs.mkdirSync('public/evidence/four-pools',{recursive:true});
fs.writeFileSync('public/evidence/four-pools/squeekchain-manifest.json',JSON.stringify(manifest,null,2));
fs.writeFileSync('public/evidence/four-pools/SqueekToken.json',JSON.stringify(abi,null,2));
const providers=['https://ethereum-sepolia-rpc.publicnode.com','https://rpc.sepolia.ethpandaops.io'];
const clients=providers.map(url=>createPublicClient({transport:http(url,{timeout:20000,retryCount:1})}));
const heads=await Promise.all(clients.map(async c=>{if(await c.getChainId()!==11155111)throw Error('Wrong chain');return c.getBlockNumber()}));
const blockNumber=heads.reduce((a,b)=>a<b?a:b)-1n;
const perProvider=await Promise.all(clients.map(async client=>{
 const code=await client.getCode({address:token.address,blockNumber});
 if(!code||code==='0x'||keccak256(code)!==token.runtimeHash)throw Error('SQK runtime differs from official manifest');
 const values={};for(const fn of ['name','symbol','decimals','totalSupply','totalMinted','mining']){try{values[fn]=await client.readContract({address:token.address,abi,functionName:fn,blockNumber})}catch{values[fn]='UNAVAILABLE'}}
 const mainnetCandidates={imd:'0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7',simd:'0x9efa934d9fad4ae28c998a40195646b965a97247'};
 const candidates={};for(const [name,address] of Object.entries(mainnetCandidates)){const runtime=await client.getCode({address,blockNumber});candidates[name]={address,hasSepoliaCode:!!runtime&&runtime!=='0x',status:'MAINNET_REFERENCE_NOT_APPROVED_FOR_SEPOLIA'}}
 const testImd='0x56bcf2a5f47710649a4091219ef0b56e2d1b58bf';
 const testMetadata=await Promise.all(['name','symbol','decimals'].map(functionName=>client.readContract({address:testImd,abi:erc20Abi,functionName,blockNumber})));
 const controllerAbi=JSON.parse(fs.readFileSync('src/contracts/abi/CheeseEmissionController.json','utf8'));
 const controllerAddress='0xe06748177ad22d422e49cdb0982a5f932e46ee7d';
 const controllerState={};
 for(const fn of ['owner','poolCount','totalWeight','activeWeight','getAllocation','activated']) controllerState[fn]=await client.readContract({address:controllerAddress,abi:controllerAbi,functionName:fn,blockNumber});
 const poolStates=[];
 for (const [name,address,abiName] of [
  ['CHEESE','0xd460157324fe20eeb83f8255aca5d2f09f387f21','CheeseFarmERC20'],
  ['ETH','0x8ab46e3c9d16c4ca3ee8a28648c5809142c48faa','CheeseFarmETH'],
  ['sIMD','0x222f1a83afc0e1abd9b37f004bed792e7c027d88','CheeseFarmSIMD']]) {
   const abi=JSON.parse(fs.readFileSync(`src/contracts/abi/${abiName}.json`,'utf8'));
   const read=functionName=>client.readContract({address,abi,functionName,blockNumber});
   poolStates.push({name,address,totalAssets:await read('totalAssets'),totalShares:await read('totalShares'),registered:await read('registered'),asset:name==='ETH'?null:await read('asset')});
 }
 const farmAbi=JSON.parse(fs.readFileSync('src/contracts/abi/CheeseFarmSIMD.json','utf8'));
 const simdAsset=await client.readContract({address:'0x222f1a83afc0e1abd9b37f004bed792e7c027d88',abi:farmAbi,functionName:'asset',blockNumber});
 // Read-only simulation from an arbitrary public zero-balance address; no signing.
 const zeroTransfer=await client.simulateContract({address:token.address,abi:erc20Abi,functionName:'transfer',args:['0x1111111111111111111111111111111111111111',0n],account:'0x2222222222222222222222222222222222222222',blockNumber});
 return {controllerState,poolStates,blockHash:(await client.getBlock({blockNumber})).hash,sqk:{address:token.address,runtimeHash:keccak256(code),...values,zeroTransferReturns:zeroTransfer.result},candidates,imdTest:{address:testImd,name:testMetadata[0],symbol:testMetadata[1],decimals:testMetadata[2],useForConversion:false},simdAsset,depositForAvailable:farmAbi.some(x=>x.type==='function'&&x.name==='depositFor')};
}));
const serialize=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v);
if(serialize(perProvider[0])!==serialize(perProvider[1]))throw Error('Independent providers disagree');
const report={checkedAt:new Date().toISOString(),chainId:11155111,blockNumber:String(blockNumber),providers,sourceCommit:'69602c52b5d2edc4681c807a5b04517214d90241',...perProvider[0],sqkFarm:{address:null,status:'NOT_DEPLOYED',targetPoints:200},conversion:{status:'BLOCKED_UNVERIFIED_SEPOLIA_VAULT',imd:null,simd:null,rate:null,fees:null,reverseSupported:null,atomicDepositFor:false,flow:'Two wallet-originated operations (conversion then farm deposit), plus ERC20 approvals when needed. Not enabled without verified Sepolia converter.'},sources:[`${origin}/assets/deployments/sepolia.json`,'https://pool4.imd.fun/docs','https://imd.fun/docs/'],transactionsSent:0};
fs.writeFileSync('public/evidence/four-pools/integrations.json',JSON.stringify(JSON.parse(serialize(report)),null,2));
console.log(JSON.stringify(JSON.parse(serialize(report)),null,2));

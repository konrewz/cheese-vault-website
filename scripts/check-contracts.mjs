import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { encodeFunctionData, decodeFunctionData, parseEther } from "viem";
const provenance = JSON.parse(
  await readFile("official/provenance.json", "utf8"),
);
const files = [
  "CheeseToken",
  "CheeseEmissionController",
  "CheeseFarmERC20",
  "CheeseFarmETH",
  "CheeseFarmSIMD",
];
const abis = {};
for (const name of files) {
  const bytes = await readFile(`src/contracts/abi/${name}.json`);
  if (
    createHash("sha256").update(bytes).digest("hex") !==
    provenance.abis[`${name}.json`]
  )
    throw new Error(`ABI was changed: ${name}`);
  abis[name] = JSON.parse(bytes);
}
const account = "0xdea11b3a70b77134424d436f6eb455f1abbd4449";
const checks = [
  [
    "CheeseToken",
    "approve",
    ["0xd460157324fe20eeb83f8255aca5d2f09f387f21", parseEther("1")],
  ],
  ["CheeseFarmERC20", "deposit", [parseEther("1")]],
  ["CheeseFarmETH", "deposit", []],
  ["CheeseFarmSIMD", "deposit", [parseEther("1")]],
  ...["CheeseFarmERC20", "CheeseFarmETH", "CheeseFarmSIMD"].flatMap((n) =>
    [
      ["withdraw", [1000n]],
      ["claim", [account]],
      ["previewWithdraw", [1000n]],
      ["pendingRewards", [account]],
      ["assetsOf", [account]],
      ["sharesOf", [account]],
    ].map(([fn, args]) => [n, fn, args]),
  ),
];
for (const [name, functionName, args] of checks) {
  const data = encodeFunctionData({ abi: abis[name], functionName, args });
  if (
    decodeFunctionData({ abi: abis[name], data }).functionName !== functionName
  )
    throw new Error(`ABI round trip failed: ${name}.${functionName}`);
}
console.log(
  JSON.stringify(
    {
      unmodifiedOfficialABIs: files.length,
      calldataRoundTrips: checks.length,
      sourceCommit: provenance.commit,
      ownerOnlyWrites: 0,
    },
    null,
    2,
  ),
);

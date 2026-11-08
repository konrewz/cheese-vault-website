import { createConfig } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { CHAIN, SITE_NAME, rpcTransport } from "./contracts/config";
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    coinbaseWallet({ appName: SITE_NAME, preference: { options: "all" } }),
  ],
  transports: { [CHAIN.id]: rpcTransport() },
});

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { CHAIN, shortAddress } from "./contracts/config";
import { friendlyError } from "./contracts/math";
import { Modal, Spinner, Notice, External } from "./components";

export const OPEN_IN = [
  {
    id: "metamask",
    name: "MetaMask",
    href: (url: string) =>
      `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, "")}`,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    href: (url: string) =>
      `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: "rabby",
    name: "Rabby",
    href: (url: string) =>
      `https://go.rabby.io/mobile/dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: "phantom",
    name: "Phantom",
    href: (url: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
];
export const isMobileBrowser = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
  !(window as Window & { ethereum?: unknown }).ethereum;
export function WalletControl({ openWallet }: { openWallet: () => void }) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const control = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
        control.current?.querySelector("button")?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!control.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [expanded]);
  if (isConnected && address && chainId !== CHAIN.id)
    return (
      <div className="wallet-control" ref={control}>
        <button
          className="button button-wallet"
          disabled={isPending}
          onClick={async () => {
            setError("");
            try {
              await switchChainAsync({ chainId: CHAIN.id });
            } catch (e) {
              setError(friendlyError(e));
            }
          }}
        >
          {isPending ? <Spinner label="Switching…" /> : "Switch to Sepolia"}
        </button>
        {error && (
          <div className="wallet-error" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  if (isConnected && address)
    return (
      <div className="wallet-control" ref={control}>
        <button
          className="button button-wallet"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="status-dot" />
          {shortAddress(address)}
          <ChevronDown size={15} />
        </button>
        {expanded && (
          <div className="wallet-popover">
            <External href={`https://sepolia.etherscan.io/address/${address}`}>
              View on Etherscan
            </External>
            <button
              className="text-button"
              onClick={() => {
                disconnect();
                setExpanded(false);
              }}
            >
              <LogOut size={16} />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  return (
    <button className="button button-wallet" onClick={openWallet}>
      <Wallet size={17} aria-hidden="true" />
      <span>Connect wallet</span>
    </button>
  );
}
export function WalletSheet({ onClose }: { onClose: () => void }) {
  const { connectors, connectAsync, isPending, variables } = useConnect();
  const [error, setError] = useState("");
  const mobile = isMobileBrowser();
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ]
    .filter((c) => !(c.id === "injected" && named))
    .filter((c) => !mobile || c.type !== "injected");
  const label = (c: Connector) =>
    c.id === "injected"
      ? "Browser wallet"
      : c.id === "coinbaseWalletSDK"
        ? mobile
          ? "Coinbase Smart Wallet"
          : "Coinbase Wallet"
        : c.name;
  return (
    <Modal title="Connect a wallet" onClose={onClose}>
      <p className="muted">Your little corner of the vault starts here.</p>
      <div className="wallet-list">
        {mobile &&
          OPEN_IN.map((w) => (
            <a className="wallet-row" key={w.id} href={w.href(location.href)}>
              <img
                src={`./wallets/${w.id}.svg`}
                alt=""
                width="28"
                height="28"
              />
              <span>Open in {w.name}</span>
            </a>
          ))}
        {listed.map((c) => (
          <button
            className="wallet-row"
            key={c.uid}
            disabled={isPending}
            onClick={async () => {
              setError("");
              try {
                await connectAsync({ connector: c, chainId: CHAIN.id });
                onClose();
              } catch (e) {
                setError(friendlyError(e));
              }
            }}
          >
            {c.icon ? (
              <img src={c.icon} alt="" width="28" height="28" />
            ) : c.id === "coinbaseWalletSDK" ? (
              <img src="./wallets/coinbase.svg" alt="" width="28" height="28" />
            ) : (
              <Wallet size={28} aria-hidden="true" />
            )}
            <span>
              {isPending && variables?.connector === c ? (
                <Spinner label={`Opening ${label(c)}…`} />
              ) : (
                label(c)
              )}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <div role="alert">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <p className="small muted">
        Ethereum Sepolia · Test assets only. Your wallet handles every
        signature. Never share a recovery phrase or private key.
      </p>
    </Modal>
  );
}

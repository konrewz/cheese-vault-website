import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  LoaderCircle,
  X,
  TriangleAlert,
  Info,
} from "lucide-react";
import { useState } from "react";
import { addressUrl, type PoolId } from "./contracts/config";
import { displayAmount, fullAmount } from "./contracts/math";

export function Coin({
  kind,
  size = 44,
}: {
  kind: PoolId | "vault";
  size?: number;
}) {
  if (kind === "eth")
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="31" fill="#eae5f3" />
        <path d="m32 9-14 24 14 8 14-8Z" fill="#8d7aab" />
        <path d="m32 9 14 24-14-6Z" fill="#b4a1cd" />
        <path d="m18 36 14 19 14-19-14 8Z" fill="#6e5b8c" />
        <path d="m18 33 14-6v14Z" fill="#a392bd" />
      </svg>
    );
  if (kind === "simd")
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="31" fill="#e5ead9" />
        <g
          fill="none"
          stroke="#5b7045"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m32 13 16 9v19l-16 9-16-9V22Z" />
          <path d="m16 22 16 10 16-10M32 32v18M24 18l16 9v10l-16 9" />
        </g>
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#ffedb5" />
      <path
        d="M12 32 44 18l10 13-32 16Z"
        fill="#ffe292"
        stroke="#b27920"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="m12 32 10 15v9L12 42Z" fill="#ecaf35" />
      <path d="m22 47 32-16v9L22 56Z" fill="#f3c04b" />
      <ellipse
        cx="29"
        cy="31"
        rx="4.5"
        ry="2.6"
        fill="#dc9c27"
        transform="rotate(-22 29 31)"
      />
      <ellipse cx="43" cy="28" rx="3" ry="1.8" fill="#dc9c27" />
      <ellipse
        cx="36"
        cy="39"
        rx="3.5"
        ry="2"
        fill="#dc9c27"
        transform="rotate(-22 36 39)"
      />
      <ellipse cx="35" cy="46" rx="2.5" ry="3" fill="#d9a23b" />
    </svg>
  );
}
export function Hamster({ bite = false }: { bite?: boolean }) {
  return (
    <svg
      className={bite ? "hamster bite-complete" : "hamster"}
      viewBox="0 0 240 190"
      aria-hidden="true"
    >
      <ellipse cx="121" cy="172" rx="82" ry="12" fill="#d9b477" opacity=".25" />
      <g className="hamster-body">
        <ellipse cx="120" cy="119" rx="64" ry="56" fill="#bd854b" />
        <circle cx="74" cy="48" r="27" fill="#c9955d" />
        <circle cx="74" cy="48" r="16" fill="#ecb9a4" />
        <circle cx="166" cy="48" r="27" fill="#c9955d" />
        <circle cx="166" cy="48" r="16" fill="#ecb9a4" />
        <path
          d="M57 96c0-41 29-62 63-62s63 21 63 62c0 44-23 70-63 70S57 140 57 96"
          fill="#d6a165"
        />
        <ellipse cx="120" cy="125" rx="52" ry="38" fill="#fff0cf" />
        <ellipse cx="87" cy="88" rx="9" ry="12" fill="#3f2c20" />
        <ellipse cx="153" cy="88" rx="9" ry="12" fill="#3f2c20" />
        <circle cx="90" cy="84" r="3" fill="#fff" />
        <circle cx="156" cy="84" r="3" fill="#fff" />
        <ellipse cx="75" cy="111" rx="15" ry="9" fill="#e8ac91" />
        <ellipse cx="165" cy="111" rx="15" ry="9" fill="#e8ac91" />
        <path d="M112 107q8-8 16 0-2 11-8 11t-8-11" fill="#b77265" />
        <path
          d="M111 124q9 9 18 0"
          fill="none"
          stroke="#6e4932"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <ellipse cx="83" cy="163" rx="22" ry="11" fill="#c18e60" />
        <ellipse cx="157" cy="163" rx="22" ry="11" fill="#c18e60" />
      </g>
      <g className="bite-cheese">
        <path
          d="m95 133 50-21 22 29-50 22-22-13Z"
          fill="#f2bb36"
          stroke="#a87527"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="m95 133 50-21 22 29-50 12Z" fill="#ffdb6b" />
        <ellipse cx="135" cy="131" rx="6" ry="4" fill="#d69a25" />
        <circle cx="147" cy="146" r="4" fill="#d69a25" />
        {bite && (
          <g fill="#fff5e2">
            <circle cx="103" cy="130" r="7" />
            <circle cx="112" cy="125" r="6" />
            <circle cx="100" cy="141" r="6" />
          </g>
        )}
      </g>
      <ellipse
        cx="93"
        cy="143"
        rx="13"
        ry="9"
        fill="#ddb082"
        transform="rotate(-25 93 143)"
      />
      <ellipse
        cx="166"
        cy="137"
        rx="13"
        ry="9"
        fill="#ddb082"
        transform="rotate(25 166 137)"
      />
    </svg>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "error";
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function External({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={`external ${className}`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
    </a>
  );
}
export function Amount({
  value,
  decimals = 18,
  symbol,
  places = 4,
  exact = false,
}: {
  value?: bigint;
  decimals?: number;
  symbol?: string;
  places?: number;
  exact?: boolean;
}) {
  return (
    <span
      className="amount"
      title={
        value !== undefined
          ? `${fullAmount(value, decimals)}${symbol ? ` ${symbol}` : ""}`
          : "Not available"
      }
    >
      {exact && value !== undefined
        ? fullAmount(value, decimals)
        : displayAmount(value, decimals, places)}
      {symbol && <span className="amount-unit"> {symbol}</span>}
    </span>
  );
}
export function CopyAddress({
  address,
  label,
}: {
  address: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className="copy-address">
      <a
        href={addressUrl(address)}
        target="_blank"
        rel="noreferrer"
        aria-label={`${label} on Sepolia Etherscan`}
      >
        <code>{address}</code>
      </a>
      <button
        className="icon-button"
        aria-label={`Copy ${label} address`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setError(false);
          } catch {
            setError(true);
          }
        }}
      >
        {copied ? <Check size={17} /> : <Copy size={17} />}
      </button>
      <span className="sr-only" role="status">
        {copied
          ? `${label} address copied`
          : error
            ? "Copy unavailable. Select the full address to copy it."
            : ""}
      </span>
    </div>
  );
}
export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="spinner-label">
      <LoaderCircle className="spin" size={17} aria-hidden="true" />
      {label}
    </span>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "error";
}) {
  return (
    <div className={`notice notice-${tone}`}>
      {tone === "info" ? (
        <Info size={18} aria-hidden="true" />
      ) : (
        <TriangleAlert size={18} aria-hidden="true" />
      )}
      <div>{children}</div>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    document.body.classList.add("modal-open");
    return () => {
      element.close();
      document.body.classList.remove("modal-open");
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className={`modal ${wide ? "modal-wide" : ""}`}
      ref={dialog}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !busy) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

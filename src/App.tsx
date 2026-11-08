import { TvlSummary } from "./TvlSummary";
import { Treasury } from "./Treasury";
import { FloatingX, FooterX } from "./SocialLinks";
import { AprBreakdown, ConversionModes, SqkPoolCard } from "./FourPools";
import { ThemeToggle } from "./ThemeToggle";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  ChevronRight,
  Clock3,
  Code2,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sprout,
  Wallet,
  Wheat,
} from "lucide-react";
import {
  Amount,
  Badge,
  Coin,
  CopyAddress,
  External,
  Hamster,
  Notice,
  Spinner,
} from "./components";
import { WalletControl, WalletSheet } from "./wallet";
import { TransactionModal } from "./TransactionModal";
import { useCheeseBalance, usePool, usePosition, useProtocol } from "./hooks";
import {
  CHAIN,
  CONTROLLER,
  JOB_URL,
  POOLS,
  publicClient,
  SOURCE_URL,
  TOKEN,
  addressUrl,
  transactionUrl,
  type Pool,
} from "./contracts/config";
import { compactAmount, displayAmount } from "./contracts/math";
import { depositBlockReason, earnsRewards } from "./contracts/read";
import {
  loadSourceVerification,
  sourceEvidenceUrl,
} from "./contracts/verification";
import { saveTransaction, useHistory, type HistoryEntry } from "./history";
import type { Action } from "./contracts/transactions";

type Route = "home" | "farm" | "portfolio" | "treasury" | "how-to-play" | "proof";
const nav = [
  { id: "home", name: "Home" },
  { id: "farm", name: "Cheese Farm" },
  { id: "portfolio", name: "My Portfolio" },
  { id: "treasury", name: "Treasury" },
  { id: "how-to-play", name: "How to Play" },
  { id: "proof", name: "Swarm Proof" },
] as const;
function getRoute(): Route {
  const hash = location.hash.replace(/^#\/?/, "").split("?")[0];
  return nav.some((x) => x.id === hash) ? (hash as Route) : "home";
}
type Manage = (pool: Pool, action: Action) => void;

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute);
  const [walletOpen, setWalletOpen] = useState(false);
  const [transaction, setTransaction] = useState<{
    pool: Pool;
    action: Action;
  }>();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const onHash = () => {
      setRoute(getRoute());
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.title = `${nav.find((x) => x.id === route)?.name} · The Cheese Vault`;
  }, [route]);
  const manage: Manage = (pool, action) => setTransaction({ pool, action });
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#/home" className="brand" aria-label="The Cheese Vault home">
            <Coin kind="vault" size={43} />
            <span>
              The Cheese
              <br />
              <strong>Vault</strong>
              <span className="brand-period">.</span>
            </span>
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            {nav.map((item) => (
              <a
                key={item.id}
                href={`#/${item.id}`}
                aria-current={route === item.id ? "page" : undefined}
              >
                {item.name}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            <span className="network-label">
              <span className="status-dot" />
              Sepolia
            </span>
            <WalletControl openWallet={() => setWalletOpen(true)} />
          </div>
        </div>
      </header>
      <main ref={main} id="main" tabIndex={-1}>
        {route === "home" && <Home manage={manage} />}
        {route === "farm" && <Farm manage={manage} />}
        {route === "portfolio" && (
          <Portfolio manage={manage} openWallet={() => setWalletOpen(true)} />
        )}
        {route === "how-to-play" && <HowToPlay />}
        {route === "treasury" && <Treasury />}
        {route === "proof" && <Proof />}
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <a className="footer-brand" href="#/home">
            <Coin kind="vault" size={30} />
            The Cheese Vault
          </a>
          <span className="small muted">
            A cozy corner of Ethereum Sepolia.
          </span>
          <div className="footer-links">
            <FooterX />
            <a href="#/how-to-play">How it works</a>
            <External href={SOURCE_URL}>GitHub</External>
            <a href="#/proof">
              Contract proof
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            Testnet only. No promised returns. Contract and network risks apply.
          </span>
          <span className="made-with">
            Made for tiny paws and big dreams <Leaf size={14} />
          </span>
        </div>
      </footer>
      <FloatingX hidden={walletOpen || !!transaction} />
      {transaction && !walletOpen && (
        <TransactionModal
          pool={transaction.pool}
          initialAction={transaction.action}
          onClose={() => setTransaction(undefined)}
          openWallet={() => setWalletOpen(true)}
        />
      )}
      {walletOpen && <WalletSheet onClose={() => setWalletOpen(false)} />}
    </>
  );
}
function ReadStatus({
  compact = false,
  verifySources = false,
}: {
  compact?: boolean;
  verifySources?: boolean;
}) {
  const q = useProtocol();
  const cache = useQueryClient();
  const sourceRequests = useIsFetching({ queryKey: ["source-verification"] });
  const refreshing = q.isFetching || (verifySources && sourceRequests > 0);
  return (
    <div className={`read-status ${compact ? "read-status-compact" : ""}`}>
      <span className="read-status-text">
        {q.data ? (
          <>
            <span className="status-dot good" />
            Read at Sepolia block{" "}
            <a
              href={`https://sepolia.etherscan.io/block/${q.data.block}`}
              target="_blank"
              rel="noreferrer"
            >
              {q.data.block.toLocaleString()}
            </a>
            {q.isError && <span> · Update failed; last read shown</span>}
          </>
        ) : q.isPending ? (
          <Spinner label="Reading Sepolia contracts…" />
        ) : (
          <>
            <span className="status-dot warning" />
            Chain data unavailable
          </>
        )}
      </span>
      {!compact && (
        <button
          className="text-button refresh"
          disabled={refreshing}
          onClick={() => {
            void q.refetch();
            if (verifySources)
              void cache.invalidateQueries({
                queryKey: ["source-verification"],
              });
          }}
          aria-label="Refresh Sepolia contract data"
        >
          <RefreshCw size={14} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      )}
    </div>
  );
}
function Home({ manage }: { manage: Manage }) {
  const q = useProtocol();
  const data = q.data;
  const emissionStatus = !data
    ? "Not verified"
    : data.completed
      ? "Complete"
      : data.paused
        ? "Paused"
        : data.activated
          ? "Activated"
          : "Not activated";
  return (
    <div className="page-home">
      <section className="hero content-width" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">
            Small paws.
            <br />
            Big{" "}
            <span className="cheese-word">
              cheese.
              <svg viewBox="0 0 310 20" aria-hidden="true">
                <path
                  d="M4 13Q155-5 305 10M19 18Q143 5 280 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="hero-tagline">
            Stake Your Cheese. Let the Hamsters Work.
          </p>
          <p className="hero-description">
            Deposit testnet assets on Ethereum Sepolia to earn CHEESE, with a
            15% withdrawal fee.
          </p>
          <div className="hero-buttons">
            <a className="button button-primary" href="#/farm">
              Explore Cheese Farm
              <ArrowRight size={19} />
            </a>
            <a className="hero-help" href="#/how-to-play">
              How to play
              <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
        <div className="hero-art">
          <img
            className="hero-image"
            src="./art/vault-hero.png"
            alt="A golden hamster holding Swiss cheese beside its open, cheese-filled vault"
            width="1536"
            height="1024"
            fetchPriority="high"
          />
          <span className="art-spark spark-one" aria-hidden="true">
            ✦
          </span>
          <span className="art-spark spark-two" aria-hidden="true">
            ✧
          </span>
          <div className="art-caption">
            <span className="caption-dot" />
            <span>The hamsters are getting cozy</span>
            <Leaf size={14} />
          </div>
        </div>
      </section>
      <section
        className="chain-section content-width"
        aria-label="On-chain farm overview"
      >
        <div className="section-topline">
          <span className="live-label">
            <Blocks size={16} />
            Straight from the chain
          </span>
          <ReadStatus />
        </div>
        <div className="stats-strip">
          <div className="stat">
            <span>Squeek Blocks</span>
            <strong>
              {data?.coreHeight !== undefined
                ? data.coreHeight.toLocaleString()
                : "—"}
              <Blocks size={21} />
            </strong>
            <small>Verified SqueekCore height</small>
          </div>
          <div className="stat">
            <span>CHEESE minted</span>
            <strong
              title={data ? displayAmount(data.minted, 18, 18) : "Unavailable"}
            >
              {compactAmount(data?.minted)}
              <Coin kind="cheese" size={24} />
            </strong>
            <small>
              {data
                ? `${compactAmount(data.maxSupply)} lifetime mint cap`
                : "Lifetime minted, not circulating supply"}
            </small>
          </div>
          <div className="stat">
            <span>CHEESE emission</span>
            <strong className="stat-status">
              {emissionStatus}
              <Sprout size={21} />
            </strong>
            <small>
              {data?.activated && !data.paused && !data.completed
                ? `${displayAmount(data.nextEmission, 18, 2)} scheduled / next farm Squeek Block`
                : "Rewards follow Squeek Blocks"}
            </small>
          </div>
          <div className="stat">
            <span>
              {data && data.fundedBlocks >= data.halvingBlocks * 2n
                ? "Emission ends in"
                : "Next halving"}
            </span>
            <strong>
              {data
                ? data.fundedBlocks >= data.scheduleBlocks
                  ? "Finished"
                  : (
                      data.halvingBlocks -
                      (data.fundedBlocks % data.halvingBlocks)
                    ).toLocaleString()
                : "—"}
              <Clock3 size={21} />
            </strong>
            <small>Farm Squeek Blocks remaining</small>
          </div>
        </div>
        {q.isError && (
          <p className="chain-note">
            {data
              ? "The latest refresh failed. Values above are from the linked block."
              : "Live values appear only after a successful contract read. No estimated yields or invented totals."}
          </p>
        )}
      </section>
      <div className="content-width"><TvlSummary /></div>
      <section className="home-farms content-width">
        <div className="section-heading">
          <div>
            <h2>Find your little goldmine.</h2>
            <p>CHEESE 40% ? ETH 20% ? sIMD 20% ? SQK 20% target. Current allocations appear below.</p>
          </div>
          <a className="text-link" href="#/farm">
            Meet the farms
            <ArrowRight size={17} />
          </a>
        </div>
        <div className="pool-grid">
          {POOLS.map((pool) => (
            <PoolCard key={pool.id} pool={pool} compact manage={manage} />
          ))}
          <SqkPoolCard compact />
        </div>
      </section>
      <section className="bite-banner content-width">
        <div className="bite-banner-art">
          <Hamster />
        </div>
        <div>
          <h2>The 15% withdrawal fee</h2>
          <p>
            Every withdrawal has a 15% Hamster Bite. Normally, 14% stays in the
            farm and 1% goes to Treasury. You keep 85%.
          </p>
          <a href="#/how-to-play" className="text-link">
            Get to know the bite
            <ArrowRight size={16} />
          </a>
        </div>
        <span className="bite-banner-number" aria-hidden="true">
          85<span>%</span>
          <small>all yours</small>
        </span>
      </section>
    </div>
  );
}
function PoolCard({
  pool,
  compact = false,
  manage,
}: {
  pool: Pool;
  compact?: boolean;
  manage: Manage;
}) {
  const [conversionMode, setConversionMode] = useState<"simd" | "imd">("simd");
  const protocol = useProtocol();
  const state = usePool(pool);
  const position = usePosition(pool);
  const { address } = useAccount();
  const data = state.data;
  const unavailable = state.isError || protocol.isError;
  const coming = !!data && !data.assetConfigured;
  const earning = earnsRewards(data, protocol.data);
  const reason = depositBlockReason(data, protocol.data);
  const status = coming
    ? "Coming soon"
    : unavailable
      ? "Read unavailable"
      : !data || !protocol.data
        ? "Checking status"
        : earning
          ? "Earning CHEESE"
          : data.depositsPaused || protocol.data.paused
            ? "Deposits paused"
            : "Not earning yet";
  const allocation =
    data?.registered && data.weight !== undefined && protocol.data
      ? `${(Number(data.weight) / protocol.data.totalPoints) * 100}%`
      : data
        ? "Unregistered"
        : "—";
  return (
    <article
      className={`pool-card pool-${pool.id} ${compact ? "pool-compact" : ""}`}
    >
      <div className="pool-card-head">
        <Coin kind={pool.id} size={50} />
        <Badge tone={earning ? "good" : "neutral"}>{status}</Badge>
      </div>
      <h3>{pool.name}</h3>
      <p className="pool-description">{pool.description}</p>
      <dl className="pool-allocation">
        <div>
          <dt>Deposit</dt>
          <dd>{data?.assetSymbol ?? pool.symbol}</dd>
        </div>
        <div>
          <dt>Current allocation</dt>
          <dd>{allocation}</dd>
        </div>
      </dl>
      <p className="small muted">Target allocation: {pool.initialPoints / 10}%</p>
      <AprBreakdown />
      {pool.id === "simd" && !compact && <ConversionModes onModeChange={setConversionMode} />}
      {!compact && (
        <>
          <div className="pool-divider" />
          <dl className="position-details">
            <div>
              <dt>Wallet balance</dt>
              <dd>
                <Amount
                  value={position.data?.balance}
                  decimals={data?.decimals}
                  symbol={pool.symbol}
                />
              </dd>
            </div>
            <div>
              <dt>Deposited assets (gross)</dt>
              <dd>
                <Amount
                  value={position.data?.assets}
                  decimals={data?.decimals}
                  symbol={pool.symbol}
                />
              </dd>
            </div>
            <div>
              <dt>Your shares</dt>
              <dd>
                <Amount value={position.data?.shares} symbol="shares" />
              </dd>
            </div>
            <div>
              <dt>Withdrawable after fee</dt>
              <dd>
                <Amount
                  value={position.data?.quote.paid}
                  decimals={data?.decimals}
                  symbol={pool.symbol}
                />
              </dd>
            </div>
            <div className="reward-row">
              <dt>Claimable CHEESE</dt>
              <dd>
                <Amount value={position.data?.rewards} />
              </dd>
            </div>
          </dl>
          {!address && (
            <p className="small muted">
              Connect a wallet to see your position.
            </p>
          )}
          {position.error && (
            <p className="small error-text">
              Position read failed. Refresh to try again.
            </p>
          )}
        </>
      )}
      <div className="pool-actions">
        <button
          className="button button-pool"
          disabled={conversionMode === "imd" || coming || (!!data && !!protocol.data && !!reason)}
          onClick={() => manage(pool, "deposit")}
        >
          {conversionMode === "imd" ? "Conversion unavailable" : coming ? "Coming soon" : compact ? "Explore pool" : "Deposit"}
          {!coming && <ArrowRight size={17} />}
        </button>
        {!compact && (
          <div className="secondary-pool-actions">
            <button
              className="button button-quiet"
              onClick={() => manage(pool, "withdraw")}
            >
              Withdraw
            </button>
            <button
              className="button button-quiet"
              onClick={() => manage(pool, "claim")}
            >
              Claim
            </button>
          </div>
        )}
      </div>
      {!compact && (
        <div className="pool-bottom">
          <External href={addressUrl(pool.address)}>Pool contract</External>
          {reason && <span className="small muted">{reason}</span>}
        </div>
      )}
    </article>
  );
}
function PageIntro({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      <div className="page-intro-icon" aria-hidden="true">
        {icon}
      </div>
    </div>
  );
}
function Farm({ manage }: { manage: Manage }) {
  const q = useProtocol();
  const cache = useQueryClient();
  return (
    <div className="content-width inner-page">
      <PageIntro title="A farm for every paw." icon={<Wheat size={43} />}>
        Choose a pool. Deposit a little. Let the hamsters take it from here.
      </PageIntro>
      <div className="farm-toolbar">
        <span className="network-detail">
          <span className="status-dot" />
          Ethereum Sepolia <span className="muted">· Test assets</span>
        </span>
        <ReadStatus />
      </div>
      {q.data && !q.data.activated && (
        <Notice tone="warning">
          Emissions have not been activated. CHEESE and ETH deposits may still
          succeed, but will not earn CHEESE until setup and activation are
          complete. sIMD deposits open only when the real asset is configured.
        </Notice>
      )}
      {q.isError && (
        <Notice tone="warning">
          Contract readiness could not be verified. Pool actions will check the
          chain again before you can sign.{" "}
          <button
            className="inline-link"
            onClick={() => cache.invalidateQueries()}
          >
            Retry all reads
          </button>
        </Notice>
      )}
      <TvlSummary />
      <div className="pool-grid farm-grid">
        {POOLS.map((pool) => (
          <PoolCard key={pool.id} pool={pool} manage={manage} />
        ))}
        <SqkPoolCard />
      </div>
      <div className="farm-facts">
        <div>
          <Sprout size={23} />
          <strong>0% deposit fee</strong>
          <span>
            Shares are minted at the contract’s current conversion rate.
          </span>
        </div>
        <div>
          <Clock3 size={23} />
          <strong>No withdrawal cooldown</strong>
          <span>Withdraw your assets when you choose, subject to the fee.</span>
        </div>
        <div>
          <Coin kind="cheese" size={26} />
          <strong>15% Hamster Bite</strong>
          <span>
            Every withdrawal is previewed in its actual asset before signing.
          </span>
        </div>
      </div>
      <Allocation />
    </div>
  );
}
function Allocation() {
  const protocol = useProtocol();
  const a = usePool(POOLS[0]);
  const b = usePool(POOLS[1]);
  const c = usePool(POOLS[2]);
  const p = protocol.data;
  const states = [a.data, b.data, c.data];
  return (
    <section className="allocation-section">
      <div>
        <h2>A slice for every burrow.</h2>
        <p className="muted">
          Target allocation: CHEESE 40%, ETH 20%, sIMD 20%, SQK 20%.
          SQK replaces the former reserve in the target plan. Current on-chain weights remain unchanged until Owner configuration.
        </p>
      </div>
      <div className="allocation-bars">
        {POOLS.map((pool, i) => (
          <div className={`allocation-row allocation-${pool.id}`} key={pool.id}>
            <Coin kind={pool.id} size={25} />
            <span>{pool.symbol}</span>
            <span className="allocation-track">
              <span
                style={{
                  width:
                    states[i]?.weight !== undefined && p
                      ? `${(states[i]!.weight! / p.totalPoints) * 100}%`
                      : "0%",
                }}
              />
            </span>
            <strong>
              {states[i]
                ? states[i]!.registered && p
                  ? `${(states[i]!.weight! / p.totalPoints) * 100}%`
                  : "0%"
                : "—"}
            </strong>
            <span className="small muted">
              {states[i]?.enabled
                ? "Enabled"
                : states[i]
                  ? "Inactive"
                  : "Unknown"}
            </span>
          </div>
        ))}
        <div className="allocation-row allocation-sqk">
          <Sprout size={22} /><span>SQK</span>
          <span className="allocation-track"><span style={{ width: "0%" }} /></span>
          <strong>Not registered</strong><span className="small muted">Target 20%</span>
        </div>
        <p className="small muted">Unassigned on-chain points: {p ? `${p.allocation[2]} / ${p.totalPoints}` : "Unavailable"}. These are not active SQK rewards.</p>
      </div>
    </section>
  );
}
function Portfolio({
  manage,
  openWallet,
}: {
  manage: Manage;
  openWallet: () => void;
}) {
  const { address, chainId } = useAccount();
  const balance = useCheeseBalance();
  return (
    <div className="content-width inner-page">
      <PageIntro title="Your corner of the vault." icon={<Wallet size={43} />}>
        Every deposit, every share, every little piece of cheese.
      </PageIntro>
      {!address ? (
        <>
        <section className="portfolio-empty">
          <Hamster />
          <h2>Your first cheese story starts here.</h2>
          <p>
            Connect a wallet to see balances, positions and transactions on
            Sepolia.
          </p>
          <button className="button button-primary" onClick={openWallet}>
            Connect wallet
            <ArrowRight size={17} />
          </button>
        </section>
        <div className="pool-grid farm-grid">{POOLS.map(pool => <PoolCard key={pool.id} pool={pool} manage={manage} />)}<SqkPoolCard /></div>
        </>
      ) : (
        <>
          <div className="portfolio-summary">
            <div>
              <span className="muted">Connected wallet</span>
              <CopyAddress label="Connected wallet" address={address} />
              <Badge tone={chainId === CHAIN.id ? "good" : "warning"}>
                {chainId === CHAIN.id
                  ? "Ethereum Sepolia"
                  : "Switch wallet to Sepolia"}
              </Badge>
            </div>
            <div className="cheese-balance">
              <Coin kind="cheese" size={55} />
              <div>
                <span className="muted">Wallet CHEESE</span>
                <strong>
                  <Amount value={balance.data} symbol="CHEESE" />
                </strong>
                {balance.error && (
                  <span className="small error-text">Balance unavailable</span>
                )}
              </div>
            </div>
          </div>
          <div className="section-heading">
            <div>
              <h2>All positions</h2>
              <p>
                Each asset stays in its own lane. No combined dollar estimates.
              </p>
            </div>
            <ReadStatus />
          </div>
          <div className="portfolio-positions">
            {POOLS.map((pool) => (
              <PortfolioPosition pool={pool} key={pool.id} manage={manage} />
            ))}
            <SqkPoolCard />
          </div>
          <TransactionHistory account={address} />
        </>
      )}
    </div>
  );
}
function PortfolioPosition({ pool, manage }: { pool: Pool; manage: Manage }) {
  const state = usePool(pool);
  const q = usePosition(pool);
  const p = q.data;
  const symbol = state.data?.assetSymbol ?? pool.symbol;
  return (
    <article className="portfolio-position">
      <AprBreakdown />
      <div className="position-title">
        <Coin kind={pool.id} />
        <div>
          <h3>{pool.name}</h3>
          <span className="small muted">
            {state.data && !state.data.assetConfigured
              ? "Coming soon"
              : q.isError
                ? "Position unavailable"
                : p?.shares === 0n
                  ? "No deposited assets"
                  : pool.symbol}
          </span>
        </div>
      </div>
      <dl className="position-details">
        <div>
          <dt>Deposited (gross)</dt>
          <dd>
            <Amount
              value={p?.assets}
              decimals={state.data?.decimals}
              symbol={symbol}
            />
          </dd>
        </div>
        <div>
          <dt>Internal shares</dt>
          <dd>
            <Amount value={p?.shares} symbol="shares" />
          </dd>
        </div>
        <div>
          <dt>Withdrawable (net)</dt>
          <dd>
            <Amount
              value={p?.quote.paid}
              decimals={state.data?.decimals}
              symbol={symbol}
            />
          </dd>
        </div>
        <div>
          <dt>Claimable rewards</dt>
          <dd>
            <Amount value={p?.rewards} symbol="CHEESE" />
          </dd>
        </div>
      </dl>
      <div className="position-actions">
        <button
          className="button button-pool"
          disabled={!!state.data && !state.data.assetConfigured}
          onClick={() => manage(pool, "deposit")}
        >
          Deposit
          <ArrowRight size={15} />
        </button>
        <button
          className="button button-quiet"
          onClick={() => manage(pool, "withdraw")}
        >
          Withdraw
        </button>
        <button
          className="button button-quiet"
          onClick={() => manage(pool, "claim")}
        >
          Claim
        </button>
      </div>
    </article>
  );
}
function TransactionHistory({ account }: { account: `0x${string}` }) {
  const history = useHistory(account);
  // On reload, reconcile pending locally submitted transactions with real receipts.
  useQuery({
    queryKey: [
      "receipts",
      account,
      history
        .filter((x) => x.status === "pending")
        .map((x) => x.hash)
        .join(","),
    ],
    enabled: history.some((x) => x.status === "pending"),
    retry: false,
    refetchInterval: 20_000,
    queryFn: async () => {
      const pending = history.filter((x) => x.status === "pending");
      await Promise.all(
        pending.map(async (entry) => {
          try {
            const receipt = await publicClient.getTransactionReceipt({
              hash: entry.hash,
            });
            saveTransaction({
              ...entry,
              status: receipt.status === "success" ? "confirmed" : "reverted",
              block: receipt.blockNumber.toString(),
            });
          } catch {
            /* Unmined/unavailable stays pending. */
          }
        }),
      );
      return Date.now();
    },
  });
  return (
    <section className="history-section">
      <div className="section-heading">
        <div>
          <h2>Little moves, on the record.</h2>
          <p>
            Transactions submitted here, saved on this device. Other activity
            lives on Etherscan.
          </p>
        </div>
        <External href={addressUrl(account)}>Full wallet history</External>
      </div>
      {history.length ? (
        <div className="history-list">
          {history.map((entry) => (
            <HistoryRow key={entry.hash} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="history-empty">
          <Clock3 size={25} />
          <p>No transactions submitted from this browser yet.</p>
          <a className="text-link" href="#/farm">
            Explore the pools
            <ArrowRight size={16} />
          </a>
        </div>
      )}
    </section>
  );
}
function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="history-row">
      <Coin kind={entry.pool} size={34} />
      <div>
        <strong>{entry.kind[0].toUpperCase() + entry.kind.slice(1)}</strong>
        <span className="small muted">
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      </div>
      <span className="history-amount">
        {entry.amount} {entry.symbol}
      </span>
      <Badge
        tone={
          entry.status === "confirmed"
            ? "good"
            : entry.status === "pending"
              ? "warning"
              : "error"
        }
      >
        {entry.status}
      </Badge>
      <External href={transactionUrl(entry.hash)}>View transaction</External>
    </div>
  );
}
function HowToPlay() {
  const steps = [
    { icon: <Wallet />, title: "Connect Your Wallet", text: "Connect your wallet to get started." },
    { icon: <Sprout />, title: "Choose a Pool", text: "Deposit CHEESE, ETH, sIMD or SQK." },
    { icon: <Blocks />, title: "Earn CHEESE", text: "Earn CHEESE as new Squeek Blocks are created." },
    { icon: <Coin kind="cheese" size={36} />, title: "Claim or Withdraw", text: "Claim rewards anytime, or withdraw with a 15% fee." },
  ];
  return <div className="content-width inner-page">
    <PageIntro title="A few steps. Lots of cheese." icon={<Sprout size={43} />}>
      Welcome to the vault. Here is how to put your cheese to work.
    </PageIntro>
    <div className="steps-grid">{steps.map((step, index) => <article className="step" key={step.title}>
      <div className="step-top"><span className="step-icon">{step.icon}</span><span className="step-number">0{index + 1}</span></div>
      <h2>{step.title}</h2><p>{step.text}</p>{index < 3 && <ChevronRight className="step-arrow" size={19} />}
    </article>)}</div>
    <p className="how-readiness">Use Ethereum Sepolia. Rewards start only when the pools are ready and emissions are active. SQK is Coming Soon; sIMD and IMD conversion are waiting for verified setup. Check Cheese Farm for each pool's current status.</p>
    <section className="how-earn">
      <h2>Two Ways to Earn</h2>
      <div className="how-earn-grid">
        <article><Coin kind="cheese" size={44} /><h3>CHEESE Rewards</h3><p>Earn CHEESE from new Squeek Blocks.</p><p className="small muted">Claim the rewards your deposit has earned when they are available.</p></article>
        <article><Sprout size={38} /><h3>Withdrawal Fee Rewards</h3><p>Benefit from fees retained when other users withdraw.</p><p className="small muted">Your share of the pool can become worth more of the deposited asset.</p></article>
      </div>
    </section>
    <div className="how-panels">
      <section className="how-bite"><Hamster /><div>
        <h2>When Someone Withdraws, Everyone Else Benefits.</h2>
        <p>A 15% withdrawal fee is applied when you take assets out of a pool. The usual split is:</p>
        <div className="fee-split"><div><strong>85%</strong><span>You Receive</span></div>
          <div><strong>14%</strong><span>Stays in the Pool</span></div><div><strong>1%</strong><span>Treasury</span></div></div>
        <p>The retained 14% increases the value of remaining depositors' shares. It stays in the pool; it is not directly transferred to their wallets.</p>
        <p className="small muted">Final depositor? The full 15% goes to Treasury because no depositors remain. When very little is left in a pool, more of the fee can also go to Treasury. Any leftover rounding dust goes to Treasury on the final exit. You always see the exact split before confirming.</p>
      </div></section>
      <section className="how-halving"><Blocks size={33} /><h2>A limited supply of cheese.</h2>
        <p>CHEESE rewards follow Squeek Blocks and become smaller over time. The supply has a fixed limit.</p>
        <div className="tokenomics"><div><strong>2.1B</strong><span>Max Supply</span></div>
          <div><strong>210M</strong><span>Preminted</span></div><div><strong>1.89B</strong><span>Mining Rewards</span></div></div>
        <p className="small muted">Pool targets: CHEESE 40%, ETH 20%, sIMD 20%, SQK 20%. The website shows actual allocations while setup is pending.</p>
      </section>
    </div>
    <section className="how-extra"><h2>A little help along the way.</h2>
      <p>Already have sIMD? Choose Deposit sIMD. Deposit IMD (Auto Convert) will stay unavailable until the official Sepolia conversion service is verified. No exchange rate is assumed.</p>
      <p>Hover over or tap Total APR to see the two ways to earn. N/A means there is not enough reliable information to show a rate. Returns are not guaranteed.</p>
    </section>
    <div className="how-cta"><h2>Your burrow is waiting.</h2><a className="button button-primary" href="#/farm">Explore Cheese Farm<ArrowRight size={16} /></a></div>
  </div>;
}
function Proof() {
  const q = useProtocol();
  const p = q.data;
  const a = usePool(POOLS[0]);
  const b = usePool(POOLS[1]);
  const c = usePool(POOLS[2]);
  const states = [a.data, b.data, c.data];
  const contracts = [
    {
      name: "CHEESE Token",
      address: TOKEN,
      configured: p ? p.authorityValid : undefined,
    },
    {
      name: "Emission Controller",
      address: CONTROLLER,
      configured: p ? p.tokenBound && p.authorityValid : undefined,
    },
    ...POOLS.map((pool, i) => ({
      name: `${pool.symbol} Pool`,
      address: pool.address,
      configured:
        states[i] && p
          ? states[i]!.controllerValid &&
            states[i]!.registered &&
            states[i]!.assetConfigured &&
            (pool.id !== "cheese" ||
              states[i]!.asset?.toLowerCase() === TOKEN) &&
            p.tokenBound
          : undefined,
    })),
  ];
  return (
    <div className="content-width inner-page">
      <PageIntro title="Built with IMD Swarm" icon={<Sparkles size={43} />}>
        Two builds. One cozy vault. Explore the original jobs and the code behind them.
      </PageIntro>
      <div className="swarm-proof-grid">
        <External className="swarm-proof-card" href={JOB_URL}>
          <span className="swarm-card-icon"><Blocks size={32} /></span>
          <span className="swarm-card-copy"><span className="swarm-eyebrow">THE ON-CHAIN FOUNDATION</span>
            <strong>Smart Contracts</strong><span>The contracts behind every deposit, reward and little nibble.</span>
            <span className="swarm-card-cta">View Swarm Proof</span>
          </span>
        </External>
        <External className="swarm-proof-card" href="https://explorer.imd.fun/jobs/8c2f3489-1625-4e4b-805e-66cabdde9fee">
          <span className="swarm-card-icon"><Code2 size={32} /></span>
          <span className="swarm-card-copy"><span className="swarm-eyebrow">THE HAMSTERS' FRONT DOOR</span>
            <strong>Website</strong><span>The original website build, from the welcome mat to Cheese Farm.</span>
            <span className="swarm-card-cta">View Swarm Proof</span>
          </span>
        </External>
      </div>
      <div className="swarm-source-links"><span>Prefer reading the code?</span>
        <External href={SOURCE_URL}>Contracts source</External>
        <External href="https://github.com/identity-md-launches/launch-3143-build-cheese-vault-complete">Website source</External>
      </div>
      <details className="contract-details">
        <summary><span><ShieldCheck size={21} /> Contract Details</span><ChevronRight size={20} /></summary>
        <div className="contract-details-content">
      <div className="section-heading">
        <div>
          <h2>The contracts behind the cozy.</h2>
          <p>Ethereum Sepolia · Chain ID 11155111</p>
        </div>
        <ReadStatus verifySources />
      </div>
      <Notice>
        Deployment, source verification, configuration and activation are
        separate facts. “Deployed” means bytecode is present. Source
        verification is checked independently on Sourcify, with the observation
        time below. An unavailable record does not mean unverified on Etherscan.
        Refresh retries both lookups. Verification is not an audit or
        certification.
      </Notice>
      <div className="contract-list">
        {contracts.map((contract, i) => (
          <article className="contract-row" key={contract.address}>
            <div className="contract-identity">
              <div className="contract-name">
                {i < 2 ? (
                  <Code2 size={23} />
                ) : (
                  <Coin kind={POOLS[i - 2].id} size={32} />
                )}
                <h3>{contract.name}</h3>
              </div>
              <CopyAddress address={contract.address} label={contract.name} />
              <External href={`${addressUrl(contract.address)}#code`}>
                Inspect source on Etherscan
              </External>
            </div>
            <dl className="contract-statuses">
              <StatusFact
                label="Deployed"
                value={p ? p.deployed[contract.address] : undefined}
              />
              <SourceVerificationFact address={contract.address} />
              <StatusFact label="Configured" value={contract.configured} />
              <StatusFact
                label="Activated"
                value={
                  p
                    ? i >= 2
                      ? p.activated &&
                        !!states[i - 2]?.assetConfigured &&
                        !!states[i - 2]?.enabled &&
                        !!states[i - 2]?.weight
                      : p.activated
                    : undefined
                }
              />
            </dl>
          </article>
        ))}
      </div>
      {p && (
        <section className="core-proof">
          <h2>Squeek connection</h2>
          <CopyAddress address={p.coreAddress} label="SqueekCore" />
          <p>
            Read from <code>controller.squeekCore()</code>.{" "}
            {p.coreHeight !== undefined
              ? `Certified height: ${p.coreHeight.toLocaleString()} Squeek Blocks.`
              : "Core height is currently unavailable."}
          </p>
          <p className="small muted">
            Farm synchronization: {p.pending[0] ? "Readable" : "Unavailable"} ·
            Emissions:{" "}
            {p.paused
              ? "Paused"
              : p.activated
                ? p.completed
                  ? "Completed"
                  : "Activated"
                : "Not activated"}
            .
          </p>
        </section>
      )}
      <Allocation />
        </div>
      </details>
    </div>
  );
}
function SourceVerificationFact({ address }: { address: Address }) {
  const q = useQuery({
    queryKey: ["source-verification", address],
    queryFn: ({ signal }) => loadSourceVerification(address, signal),
    staleTime: 300_000,
    retry: false,
  });
  const evidence = q.data;
  return (
    <div>
      <dt>Source verified</dt>
      <dd className="source-verification" aria-busy={q.isFetching}>
        <span
          role="status"
          className={evidence?.status === "verified" ? "good-text" : "muted"}
        >
          {q.isFetching
            ? "Checking…"
            : evidence?.status === "verified"
              ? "Verified"
              : "Unavailable"}
        </span>
        <External href={sourceEvidenceUrl(address)}>Sourcify evidence</External>
        {evidence && (
          <>
            <span className="muted">{evidence.detail}</span>
            <time className="muted" dateTime={evidence.observedAt}>
              Checked {evidence.observedAt.slice(0, 10)}{" "}
              {evidence.observedAt.slice(11, 19)} UTC
            </time>
          </>
        )}
      </dd>
    </div>
  );
}
function StatusFact({ label, value }: { label: string; value?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd
        className={
          value === true
            ? "good-text"
            : value === false
              ? "warning-text"
              : "muted"
        }
      >
        {value === true
          ? "Confirmed"
          : value === false
            ? label === "Deployed"
              ? "No bytecode"
              : label === "Activated"
                ? "Not activated"
                : "Incomplete"
            : "Not verified"}
      </dd>
    </div>
  );
}

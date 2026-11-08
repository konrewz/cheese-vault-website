import { useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { erc20Abi, parseEventLogs, type Hash, type Address } from "viem";
import {
  ArrowRight,
  Check,
  CircleCheck,
  Wallet,
  TriangleAlert,
} from "lucide-react";
import {
  Amount,
  Coin,
  External,
  Hamster,
  Modal,
  Notice,
  Spinner,
} from "./components";
import { usePool, usePosition, useProtocol } from "./hooks";
import {
  CHAIN,
  publicClient,
  transactionUrl,
  type Pool,
} from "./contracts/config";
import {
  depositBlockReason,
  earnsRewards,
  readValue,
  type Position,
} from "./contracts/read";
import {
  friendlyError,
  fullAmount,
  parseAmount,
  type WithdrawalQuote,
} from "./contracts/math";
import {
  prepareTransaction,
  transactionCall,
  type Action,
  type Prepared,
  type TransactionKind,
} from "./contracts/transactions";
import { saveTransaction, type HistoryEntry } from "./history";

type Review = Prepared & {
  kind: TransactionKind;
  amount: bigint;
  quote?: WithdrawalQuote;
  shares?: bigint;
};
export function TransactionModal({
  pool,
  initialAction,
  onClose,
  openWallet,
}: {
  pool: Pool;
  initialAction: Action;
  onClose: () => void;
  openWallet: () => void;
}) {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const cache = useQueryClient();
  const protocol = useProtocol();
  const state = usePool(pool);
  const position = usePosition(pool);
  const [action, setAction] = useState<Action>(initialAction);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<
    | "editing"
    | "preparing"
    | "review"
    | "wallet"
    | "pending"
    | "success"
    | "error"
  >("editing");
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review>();
  const [hash, setHash] = useState<Hash>();
  const [entry, setEntry] = useState<HistoryEntry>();
  const [confirmedQuote, setConfirmedQuote] = useState<WithdrawalQuote>();
  const identity = useRef({ address, chainId });
  const amountInput = useRef<HTMLInputElement>(null);
  identity.current = { address, chainId };
  const amountError =
    !!error && /amount|decimal|precision|shares|balance/i.test(error);
  useEffect(() => {
    if (amountError && phase === "editing") amountInput.current?.focus();
  }, [amountError, phase]);
  const busy = ["preparing", "wallet", "pending"].includes(phase);
  const symbol = state.data?.assetSymbol ?? pool.symbol;
  const decimals = state.data?.decimals;
  const connectedCorrectly = !!address && chainId === CHAIN.id;
  const blockReason =
    action === "deposit"
      ? depositBlockReason(state.data, protocol.data)
      : !state.data || !protocol.data
        ? "Waiting for verified contract reads."
        : !state.data.controllerValid
          ? "The farm controller does not match the official deployment."
          : action === "withdraw" && !state.data.assetConfigured
            ? "The withdrawal asset is not configured."
            : undefined;
  const earning = earnsRewards(state.data, protocol.data);
  const balance =
    action === "withdraw" ? position.data?.shares : position.data?.balance;
  // A changed account/network must never inherit a transaction review made for another signer.
  useEffect(() => {
    // An already submitted transaction keeps its original receipt watcher and signer.
    if (phase === "pending" || phase === "wallet") return;
    setReview(undefined);
    setAmount("");
    setError("");
    setHash(undefined);
    setEntry(undefined);
    setPhase("editing");
  }, [address, chainId]);
  const invalidate = () =>
    cache.invalidateQueries({
      predicate: (q) =>
        ["protocol", "pool", "position", "balance"].includes(
          String(q.queryKey[0]),
        ),
    });
  async function getQuote(shares: bigint): Promise<WithdrawalQuote> {
    const q = await readValue<readonly [bigint, bigint, bigint, bigint]>(
      pool.address,
      pool.abi,
      "previewWithdraw",
      [shares],
    );
    return { gross: q[0], paid: q[1], retained: q[2], treasury: q[3] };
  }
  async function makeReview() {
    setError("");
    if (
      !address ||
      !state.data ||
      (action !== "claim" && decimals === undefined) ||
      !connectedCorrectly
    )
      return;
    setPhase("preparing");
    try {
      // Refetch the position/allowance before constructing a transaction, rather than trusting a cached balance.
      const fresh = await position.refetch();
      if (fresh.error || !fresh.data)
        throw (
          fresh.error ??
          new Error("Balance unavailable. Refresh and try again.")
        );
      const p = fresh.data;
      const units =
        action === "claim"
          ? p.rewards
          : parseAmount(amount, action === "withdraw" ? 18 : decimals!);
      if (
        action === "deposit" &&
        (p.balance === undefined || units > p.balance)
      )
        throw new Error(
          "The amount exceeds your available balance. Lower it or use Max.",
        );
      if (action === "withdraw" && units > p.shares)
        throw new Error("The amount exceeds your shares. Lower it or use Max.");
      if (action === "claim" && units === 0n)
        throw new Error("There are no CHEESE rewards to claim yet.");
      let kind: TransactionKind = action;
      if (action === "deposit" && pool.id !== "eth") {
        const allowance = await readValue<bigint>(
          state.data.asset!,
          erc20Abi,
          "allowance",
          [address, pool.address],
        );
        if (allowance < units) kind = "approve";
      }
      const quote = action === "withdraw" ? await getQuote(units) : undefined;
      const shares =
        action === "deposit" && kind !== "approve"
          ? await readValue<bigint>(pool.address, pool.abi, "convertToShares", [
              units,
            ])
          : undefined;
      if (shares === 0n)
        throw new Error(
          "This amount rounds down to zero shares. Increase the deposit amount.",
        );
      if (quote?.paid === 0n)
        throw new Error(
          "This withdrawal rounds down to zero payout. Increase the number of shares.",
        );
      const prepared = await prepareTransaction(
        transactionCall(pool, state.data, kind, units, address),
        address,
      );
      if (
        pool.id === "eth" &&
        action === "deposit" &&
        units + prepared.gasCeiling > (p.balance ?? 0n)
      )
        throw new Error(
          "Leave enough Sepolia ETH for network gas. Lower the deposit amount.",
        );
      if (
        identity.current.address !== address ||
        identity.current.chainId !== chainId
      )
        throw new Error(
          "Your wallet changed. Review the amount for the current account and network.",
        );
      setReview({ ...prepared, kind, amount: units, quote, shares });
      setPhase("review");
    } catch (e) {
      setError(friendlyError(e));
      setPhase("editing");
    }
  }
  async function setMax() {
    setError("");
    if (balance === undefined || decimals === undefined) return;
    if (action !== "deposit" || pool.id !== "eth") {
      setAmount(fullAmount(balance, action === "withdraw" ? 18 : decimals));
      return;
    }
    // Estimate against a small deposit and reserve its padded gas cost, then verify the final amount during review.
    setPhase("preparing");
    try {
      const fees = await prepareTransaction(
        transactionCall(
          pool,
          state.data!,
          "deposit",
          balance / 100n || 1n,
          address!,
        ),
        address!,
      );
      if (balance <= fees.gasCeiling)
        throw new Error("The ETH balance is too small to cover network gas.");
      setAmount(fullAmount(balance - fees.gasCeiling, 18));
      setPhase("editing");
    } catch (e) {
      setError(friendlyError(e));
      setPhase("editing");
    }
  }
  async function watchReceipt(txHash: Hash, original: HistoryEntry) {
    setPhase("pending");
    let activeHash = txHash;
    let cancelled = false;
    let replaced = false;
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 120_000,
        onReplaced: (replacement) => {
          cancelled = replacement.reason === "cancelled";
          replaced = replacement.reason === "replaced";
          activeHash = replacement.transaction.hash;
          setHash(activeHash);
          saveTransaction(
            {
              ...original,
              hash: activeHash,
              status: cancelled
                ? "cancelled"
                : replaced
                  ? "replaced"
                  : "pending",
            },
            txHash,
          );
        },
      });
      activeHash = receipt.transactionHash;
      setHash(activeHash);
      const updated = {
        ...original,
        hash: activeHash,
        status: cancelled
          ? ("cancelled" as const)
          : replaced
            ? ("replaced" as const)
            : receipt.status === "success"
              ? ("confirmed" as const)
              : ("reverted" as const),
        block: receipt.blockNumber.toString(),
      };
      saveTransaction(updated, txHash);
      setEntry(updated);
      await invalidate();
      if (replaced)
        throw new Error(
          "This transaction was replaced with different data. Check the replacement on Etherscan; the original farm action was not confirmed.",
        );
      if (cancelled)
        throw new Error(
          "The transaction was cancelled in your wallet. No farm action was completed.",
        );
      if (receipt.status !== "success")
        throw new Error(
          "The transaction reverted on-chain. No farm action was completed. Network gas may still have been spent.",
        );
      if (original.kind === "withdraw") {
        const logs = parseEventLogs({
          abi: pool.abi,
          eventName: "Withdrawn",
          logs: receipt.logs.filter(
            (l) => l.address.toLowerCase() === pool.address,
          ),
          strict: false,
        });
        const event = logs.find(
          (l) =>
            (
              (l.args as unknown as { account?: string }).account ?? ""
            ).toLowerCase() === original.account.toLowerCase(),
        );
        if (event) {
          const args = event.args as unknown as {
            grossAssets: bigint;
            paid: bigint;
            retained: bigint;
            toTreasury: bigint;
          };
          setConfirmedQuote({
            gross: args.grossAssets,
            paid: args.paid,
            retained: args.retained,
            treasury: args.toTreasury,
          });
        }
      }
      setPhase("success");
    } catch (e) {
      setError(
        `Check Etherscan before submitting another transaction. ${friendlyError(e)}`,
      );
      setPhase("error");
    }
  }
  async function send() {
    if (!review || !walletClient || !address || !state.data) return;
    setError("");
    setPhase("wallet");
    try {
      if (
        review.account !== address ||
        (await walletClient.getChainId()) !== CHAIN.id ||
        !(await walletClient.getAddresses()).some(
          (a) => a.toLowerCase() === address.toLowerCase(),
        )
      )
        throw new Error(
          "The wallet account or network changed. Review this transaction again.",
        );
      if (Date.now() - review.preparedAt > 60_000)
        throw new Error(
          "This gas and amount preview has expired. Review the transaction again.",
        );
      if (review.quote) {
        const fresh = await getQuote(review.amount);
        if (
          Object.keys(fresh).some(
            (k) =>
              fresh[k as keyof WithdrawalQuote] !==
              review.quote![k as keyof WithdrawalQuote],
          )
        )
          throw new Error(
            "The withdrawal quote changed on-chain. Review the updated amounts again.",
          );
      }
      await publicClient.simulateContract({ ...review.call, account: address });
      const txHash = await walletClient.writeContract({
        ...review.call,
        account: address,
        chain: CHAIN,
        gas: review.gas,
        maxFeePerGas: review.maxFeePerGas,
        maxPriorityFeePerGas: review.maxPriorityFeePerGas,
      });
      setHash(txHash);
      const tx: HistoryEntry = {
        hash: txHash,
        account: address as Address,
        pool: pool.id,
        kind: review.kind,
        amount: fullAmount(
          review.amount,
          review.kind === "withdraw" || review.kind === "claim"
            ? 18
            : decimals!,
        ),
        symbol:
          review.kind === "withdraw"
            ? "shares"
            : review.kind === "claim"
              ? "CHEESE"
              : symbol,
        status: "pending",
        createdAt: Date.now(),
      };
      setEntry(tx);
      saveTransaction(tx);
      await watchReceipt(txHash, tx);
    } catch (e) {
      setError(friendlyError(e));
      setPhase("editing");
    }
  }
  const approval = review?.kind === "approve";
  return (
    <Modal
      title={`${pool.symbol} pool`}
      onClose={onClose}
      busy={phase === "wallet" || phase === "pending"}
    >
      <div className="transaction-pool">
        <Coin kind={pool.id} />
        <div>
          <strong>{pool.name}</strong>
          <span className="small muted">Ethereum Sepolia</span>
        </div>
      </div>
      {phase === "success" ? (
        <div className="transaction-success" role="status">
          {entry?.kind === "withdraw" && confirmedQuote ? (
            <Hamster bite />
          ) : (
            <CircleCheck size={52} className="success-icon" />
          )}
          <h3>
            {entry?.kind === "approve"
              ? "Approval confirmed"
              : entry?.kind === "withdraw"
                ? confirmedQuote
                  ? "A little nibble. All settled."
                  : "Withdrawal confirmed"
                : entry?.kind === "claim"
                  ? "Claim confirmed"
                  : "Safely in the burrow"}
          </h3>
          <p>
            {entry?.kind === "approve"
              ? "The approval transaction is confirmed. Review the deposit to check your allowance and continue."
              : "Your transaction is confirmed on Sepolia. Check the farm for your latest balances."}
          </p>
          {confirmedQuote && (
            <FeeBreakdown
              quote={confirmedQuote}
              decimals={decimals!}
              symbol={symbol}
            />
          )}
          {hash && (
            <External href={transactionUrl(hash)}>
              View confirmed transaction
            </External>
          )}
          <button
            className="button button-primary full"
            onClick={() => {
              if (entry?.kind === "approve") {
                setReview(undefined);
                setHash(undefined);
                setPhase("editing");
              } else onClose();
            }}
          >
            {entry?.kind === "approve"
              ? "Continue to deposit"
              : "Back to the farm"}
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="segmented" aria-label="Pool action">
            {(["deposit", "withdraw", "claim"] as const).map((a) => (
              <button
                key={a}
                aria-pressed={action === a}
                disabled={busy}
                onClick={() => {
                  setAction(a);
                  setAmount("");
                  setReview(undefined);
                  setError("");
                  setHash(undefined);
                  setPhase("editing");
                }}
              >
                {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
          {!address ? (
            <div className="connect-message">
              <Wallet size={32} />
              <h3>Meet your farm</h3>
              <p>Connect a wallet to view your balance and manage this pool.</p>
              <button
                className="button button-primary full"
                onClick={openWallet}
              >
                Connect wallet
              </button>
            </div>
          ) : chainId !== CHAIN.id ? (
            <>
              <Notice tone="warning">
                Switch to Ethereum Sepolia before reviewing a transaction.
              </Notice>
              <button
                className="button button-primary full"
                onClick={async () => {
                  try {
                    await switchChainAsync({ chainId: CHAIN.id });
                  } catch (e) {
                    setError(friendlyError(e));
                  }
                }}
              >
                Switch to Sepolia
              </button>
            </>
          ) : (
            <>
              {blockReason && (
                <Notice tone="warning">
                  {blockReason} Withdrawals and claims use their own
                  availability checks.
                </Notice>
              )}
              {action === "deposit" && !earning && !blockReason && (
                <Notice tone="warning">
                  This pool is not earning CHEESE yet. Deposits may succeed, but
                  rewards will only start after the required on-chain setup and
                  activation.
                </Notice>
              )}
              {action !== "claim" ? (
                <div className="amount-field">
                  <div className="field-label">
                    <label htmlFor="tx-amount">
                      {action === "withdraw"
                        ? "Shares to withdraw"
                        : `Amount to deposit (${symbol})`}
                    </label>
                    <button
                      className="text-button"
                      disabled={
                        busy || phase === "review" || balance === undefined
                      }
                      onClick={setMax}
                    >
                      Max
                    </button>
                  </div>
                  <div className="amount-input">
                    <input
                      id="tx-amount"
                      ref={amountInput}
                      name="amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.0"
                      value={amount}
                      disabled={busy || phase === "review"}
                      aria-invalid={amountError}
                      aria-describedby={
                        error ? "tx-error" : "available-balance"
                      }
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setReview(undefined);
                        setError("");
                      }}
                    />
                    <span>{action === "withdraw" ? "shares" : symbol}</span>
                  </div>
                  <p className="small muted" id="available-balance">
                    Available:{" "}
                    <Amount
                      value={balance}
                      decimals={action === "withdraw" ? 18 : decimals}
                      symbol={action === "withdraw" ? "shares" : symbol}
                    />
                    {action === "withdraw" && (
                      <span>
                        {" "}
                        · Net assets:{" "}
                        <Amount
                          value={position.data?.quote.paid}
                          decimals={decimals}
                          symbol={symbol}
                        />
                      </span>
                    )}
                  </p>
                </div>
              ) : (
                <div className="claim-amount">
                  <span className="muted">Claimable rewards</span>
                  <strong>
                    <Amount value={position.data?.rewards} symbol="CHEESE" />
                  </strong>
                  <p className="small muted">
                    Rewards are separate from your deposit. Claiming has no
                    withdrawal fee.
                  </p>
                </div>
              )}
              {action === "withdraw" && !review && (
                <p className="small muted">
                  Withdrawals burn internal shares. The next screen shows the
                  exact asset payout and the 15% Hamster Bite before you sign.
                </p>
              )}
              {review &&
                ["review", "wallet", "pending", "error"].includes(phase) && (
                  <div className="transaction-review">
                    <h3>
                      {approval
                        ? "1. Approve the exact amount"
                        : action === "withdraw"
                          ? "The Hamster Bite"
                          : action === "claim"
                            ? "Review your claim"
                            : "Review your deposit"}
                    </h3>
                    {review.quote && (
                      <>
                        <div className="bite-preview">
                          <Hamster />
                          <div>
                            <strong>A 15% nibble</strong>
                            <p className="small muted">
                              Your payout stays yours. The hamster only
                              celebrates after confirmation.
                            </p>
                          </div>
                        </div>
                        <FeeBreakdown
                          quote={review.quote}
                          decimals={decimals!}
                          symbol={symbol}
                        />
                      </>
                    )}
                    {approval && (
                      <p className="small">
                        Approve{" "}
                        <Amount
                          value={review.amount}
                          decimals={decimals}
                          symbol={symbol}
                          exact
                        />{" "}
                        for this pool only. The deposit is a separate
                        transaction.
                      </p>
                    )}
                    {review.shares !== undefined && (
                      <p className="small">
                        Estimated shares received:{" "}
                        <Amount value={review.shares} symbol="shares" />. Asset
                        transfers and chain changes may affect this estimate.
                      </p>
                    )}
                    <dl className="review-details">
                      <div>
                        <dt>Estimated call gas ceiling</dt>
                        <dd>
                          <Amount
                            value={review.gasCeiling}
                            symbol="ETH"
                            exact
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Network</dt>
                        <dd>Sepolia · 11155111</dd>
                      </div>
                    </dl>
                    <p className="small muted">
                      Gas is paid in Sepolia ETH. Your wallet shows the final
                      estimate, including any smart wallet overhead. Amounts can
                      change until the transaction is mined.
                    </p>
                  </div>
                )}
              {phase === "pending" || phase === "wallet" ? (
                <div className="pending-message" role="status">
                  <Spinner
                    label={
                      phase === "wallet"
                        ? "Confirm in your wallet…"
                        : "Waiting for a confirmed receipt…"
                    }
                  />
                  {hash && (
                    <External href={transactionUrl(hash)}>
                      Track on Etherscan
                    </External>
                  )}
                  <p className="small muted">
                    {action === "withdraw"
                      ? "The Hamster Bite has not completed yet."
                      : "This action has not been confirmed yet."}
                  </p>
                </div>
              ) : phase === "error" && hash && entry?.status === "pending" ? (
                <button
                  className="button button-primary full"
                  onClick={() => watchReceipt(hash, entry)}
                >
                  <Check size={17} />
                  Check receipt again
                </button>
              ) : phase === "review" ? (
                <>
                  <button
                    className="button button-primary full"
                    disabled={!walletClient}
                    onClick={send}
                  >
                    {approval ? "Approve" : `Confirm ${action}`}
                    <ArrowRight size={17} />
                  </button>
                  <button
                    className="text-button centered"
                    onClick={() => {
                      setPhase("editing");
                      setReview(undefined);
                    }}
                  >
                    Edit amount
                  </button>
                </>
              ) : (
                <button
                  className="button button-primary full"
                  disabled={
                    busy ||
                    !!blockReason ||
                    position.isPending ||
                    !!position.error ||
                    (action === "claim" && !position.data?.rewards)
                  }
                  onClick={makeReview}
                >
                  {phase === "preparing" ? (
                    <Spinner label="Simulating and estimating gas…" />
                  ) : (
                    `Review ${action}`
                  )}
                  <ArrowRight size={17} />
                </button>
              )}
            </>
          )}
          {error && (
            <div className="inline-error" id="tx-error" role="alert">
              <TriangleAlert size={18} />
              <span>{error}</span>
            </div>
          )}
          {hash && phase !== "pending" && (
            <External href={transactionUrl(hash)}>
              View transaction on Etherscan
            </External>
          )}
          {(state.error || position.error || protocol.error) && (
            <>
              <Notice tone="error">
                Contract data could not be verified. Refresh the chain reads to
                continue.
              </Notice>
              <button
                className="text-button"
                onClick={() => {
                  state.refetch();
                  protocol.refetch();
                  position.refetch();
                }}
              >
                Retry chain reads
              </button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
export function FeeBreakdown({
  quote,
  decimals,
  symbol,
}: {
  quote: WithdrawalQuote;
  decimals: number;
  symbol: string;
}) {
  return (
    <>
      <dl className="fee-breakdown">
        <div>
          <dt>Gross withdrawal</dt>
          <dd>
            <Amount
              value={quote.gross}
              decimals={decimals}
              symbol={symbol}
              exact
            />
          </dd>
        </div>
        <div>
          <dt>Hamster Bite (15%)</dt>
          <dd>
            <Amount
              value={quote.gross - quote.paid}
              decimals={decimals}
              symbol={symbol}
              exact
            />
          </dd>
        </div>
        <div className="fee-sub">
          <dt>Retained in farm</dt>
          <dd>
            <Amount
              value={quote.retained}
              decimals={decimals}
              symbol={symbol}
              exact
            />
          </dd>
        </div>
        <div className="fee-sub">
          <dt>Treasury, including dust</dt>
          <dd>
            <Amount
              value={quote.treasury}
              decimals={decimals}
              symbol={symbol}
              exact
            />
          </dd>
        </div>
        <div className="fee-net">
          <dt>You receive</dt>
          <dd>
            <Amount
              value={quote.paid}
              decimals={decimals}
              symbol={symbol}
              exact
            />
          </dd>
        </div>
      </dl>
      <p className="small muted">
        Normally 85% to you, up to 14% retained and at least 1% to Treasury.
        Retention is capped by remaining stake. The final depositor’s entire 15%
        plus residual dust goes to Treasury. Values above come from the
        contract.
      </p>
    </>
  );
}
export type { Position };

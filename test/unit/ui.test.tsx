import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { CONTROLLER, POOLS, TOKEN, publicClient } from "../../src/contracts/config";
import { sourceEvidenceUrl } from "../../src/contracts/verification";
import { sourceWithdrawal } from "../../src/contracts/math";
import type { PoolState, Position, Protocol } from "../../src/contracts/read";

const fixture = vi.hoisted(() => ({
  address: undefined as `0x${string}` | undefined,
  chainId: 11155111,
  states: {} as Record<string, unknown>,
  positions: {} as Record<string, unknown>,
  protocol: {} as unknown,
  write: vi.fn(),
  connect: vi.fn(),
  switchChain: vi.fn(),
  receipt: vi.fn(),
  invalidations: 0,
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: fixture.address,
    isConnected: !!fixture.address,
    chainId: fixture.chainId,
  }),
  useConnect: () => ({
    connectors: [
      {
        id: "io.metamask",
        uid: "metamask",
        type: "injected",
        name: "MetaMask",
        icon: "data:image/svg+xml,<svg/>",
      },
      {
        id: "io.rabby",
        uid: "rabby",
        type: "injected",
        name: "Rabby",
        icon: "data:image/svg+xml,<svg/>",
      },
      { id: "injected", uid: "generic", type: "injected", name: "Injected" },
      {
        id: "coinbaseWalletSDK",
        uid: "coinbase",
        type: "coinbaseWallet",
        name: "Coinbase Wallet",
      },
    ],
    connectAsync: fixture.connect,
    isPending: false,
  }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSwitchChain: () => ({
    switchChainAsync: fixture.switchChain,
    isPending: false,
  }),
  useWalletClient: () => ({
    data: {
      writeContract: fixture.write,
      getChainId: async () => fixture.chainId,
      getAddresses: async () => [fixture.address],
    },
  }),
}));
vi.mock("../../src/hooks", () => ({
  useProtocol: () => ({
    data: fixture.protocol,
    error: null,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  usePool: (pool: { id: string }) => ({
    data: fixture.states[pool.id],
    error: null,
    isError: false,
    refetch: vi.fn(),
  }),
  usePosition: (pool: { id: string }) => ({
    data: fixture.address ? fixture.positions[pool.id] : undefined,
    isPending: false,
    error: null,
    refetch: async () => ({ data: fixture.positions[pool.id] }),
  }),
  useCheeseBalance: () => ({ data: 1234n * 10n ** 18n }),
}));
import App from "../../src/App";
// Keep the original five-contract proof fixture independent of deployed extension
// reads. Live extension readiness and wallet flows have dedicated tests.
vi.mock("../../src/contracts/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/contracts/integrations")>();
  return {...actual, SQK_FARM: undefined, EXTENSIONS: {...actual.EXTENSIONS, wrapper: null, sqkFarm: null}};
});
import { TransactionModal } from "../../src/TransactionModal";
import { WalletControl, WalletSheet } from "../../src/wallet";
const hash = `0x${"ab".repeat(32)}` as const;
const unit = 10n ** 18n;
const position: Position = {
  balance: 100n * unit,
  allowance: 100n * unit,
  assets: 10n * unit,
  shares: 10_000n * unit,
  rewards: 12n * unit,
  quote: sourceWithdrawal(10_000n * unit, 100n * unit, 100_000n * unit),
  block: 1n,
};
const protocol = {
  activated: false,
  authorityValid: true,
  tokenBound: false,
  completed: false,
  paused: false,
  pending: [true, 0n, 0n],
  fundedBlocks: 0n,
  halvingBlocks: 393470n,
  scheduleBlocks: 1180410n,
  maxSupply: 2100000000n * unit,
  premint: 210000000n * unit,
  minted: 210000000n * unit,
  allocation: [0, 0, 1000],
  totalPoints: 1000,
  deployed: {},
  block: 1n,
  coreHeight: 42n,
  coreAddress: "0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4",
} as unknown as Protocol;
function wrap(children: ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: Infinity } },
        })
      }
    >
      {children}
    </QueryClientProvider>,
  );
}
describe.each(["light", "dark"])("%s theme regression suite", (theme) => {
// Separate synthetic accounts isolate the module's intentionally persistent session history.
const account = theme === "light" ? "0xdea11b3a70b77134424d436f6eb455f1abbd4449" as const
  : "0xdea11b3a70b77134424d436f6eb455f1abbd4448" as const;
beforeEach(() => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("cheese-vault:theme", theme);
  vi.restoreAllMocks();
  // Explicit external verification fixture; no tests make network requests.
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify({
    chainId: "11155111",
    address: url.split("/").pop(),
    match: null,
    creationMatch: null,
    runtimeMatch: null,
  }), { status: 404 })));
  fixture.address = undefined;
  fixture.chainId = 11155111;
  fixture.protocol = protocol;
  fixture.connect.mockReset();
  fixture.write.mockReset();
  fixture.switchChain.mockReset();
  fixture.receipt.mockReset();
  fixture.states = Object.fromEntries(
    POOLS.map((p) => [
      p.id,
      {
        id: p.id,
        controllerValid: true,
        registered: false,
        depositsPaused: false,
        totalAssets: 100n * unit,
        totalShares: 100_000n * unit,
        asset: p.id === "cheese" ? TOKEN : undefined,
        assetConfigured: p.id !== "simd",
        decimals: p.id === "simd" ? undefined : 18,
        assetSymbol: p.symbol,
        block: 1n,
      } satisfies PoolState,
    ]),
  );
  fixture.positions = Object.fromEntries(
    POOLS.map((p) => [p.id, { ...position }]),
  );
  vi.spyOn(publicClient, "simulateContract").mockResolvedValue({} as never);
  vi.spyOn(publicClient, "estimateContractGas").mockResolvedValue(100_000n);
  vi.spyOn(publicClient, "estimateFeesPerGas").mockResolvedValue({
    maxFeePerGas: 2_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
  });
  vi.spyOn(publicClient, "readContract").mockImplementation(
    async ({ functionName }) =>
      functionName === "allowance"
        ? 100n * unit
        : functionName === "convertToShares"
          ? 1000n * unit
          : ([
              10n * unit,
              (85n * unit) / 10n,
              (14n * unit) / 10n,
              unit / 10n,
            ] as never),
  );
  fixture.write.mockResolvedValue(hash);
  vi.spyOn(publicClient, "waitForTransactionReceipt").mockImplementation(
    fixture.receipt,
  );
});
describe("navigation, wallet and portfolio", () => {
  it("offers the farm as the primary action and renders the disconnected portfolio", () => {
    location.hash = "#/home";
    const { unmount } = wrap(<App />);
    expect(
      screen.getByRole("heading", { name: /Small paws/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore Cheese Farm" }),
    ).toHaveAttribute("href", "#/farm");
    unmount();
    location.hash = "#/portfolio";
    wrap(<App />);
    expect(
      within(screen.getByRole("main")).getByRole("button", {
        name: "Connect wallet",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/first cheese story/)).toBeInTheDocument();
  });
  it("lists discovered MetaMask and Rabby separately, hides the generic injected row, and retains Coinbase", () => {
    wrap(<WalletSheet onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "MetaMask" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rabby" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Coinbase Wallet" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Injected")).not.toBeInTheDocument();
    expect(screen.queryByText("Browser wallet")).not.toBeInTheDocument();
  });
  it("reports a rejected connection and keeps retry available", async () => {
    fixture.connect.mockRejectedValue({ code: 4001 });
    wrap(<WalletSheet onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "MetaMask" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/declined/);
    expect(screen.getByRole("button", { name: "Rabby" })).toBeEnabled();
  });
  it("offers Sepolia switching on the wrong chain", async () => {
    fixture.address = account;
    fixture.chainId = 1;
    wrap(<WalletControl openWallet={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Switch to Sepolia" }),
    );
    expect(fixture.switchChain).toHaveBeenCalledWith({ chainId: 11155111 });
  });
  it("renders four connected positions and separate asset denominations", () => {
    fixture.address = account;
    location.hash = "#/portfolio";
    wrap(<App />);
    expect(
      screen.getByRole("heading", { name: "All positions" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Withdraw" })).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: /Full wallet history/ }),
    ).toHaveAttribute(
      "href",
      `https://sepolia.etherscan.io/address/${account}`,
    );
    expect(screen.getByText(/No transactions submitted/)).toBeInTheDocument();
  });
});
describe("transaction interactions with explicit fixtures, not real chain transactions", () => {
  it("asks a disconnected visitor to connect before showing a signing action", () => {
    wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="deposit"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Review deposit" }),
    ).not.toBeInTheDocument();
  });
  it("allows an inactive CHEESE deposit with a clear no-rewards warning", () => {
    fixture.address = account;
    wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="deposit"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    expect(screen.getByText(/not earning CHEESE yet/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review deposit" }),
    ).toBeEnabled();
  });
  it("disables unconfigured sIMD deposits", () => {
    fixture.address = account;
    wrap(
      <TransactionModal
        pool={POOLS[2]}
        initialAction="deposit"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    expect(screen.getByText(/verified test sIMD wrapper/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review deposit" }),
    ).toBeDisabled();
  });
  it("rejects excess token precision before requesting a signature", async () => {
    fixture.address = account;
    wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="deposit"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.type(
      screen.getByLabelText("Amount to deposit (CHEESE)"),
      "1.0000000000000000001",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Review deposit" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/at most 18/);
    expect(fixture.write).not.toHaveBeenCalled();
  });
  it("shows an exact approval before the separate deposit", async () => {
    fixture.address = account;
    vi.mocked(publicClient.readContract).mockResolvedValue(0n as never);
    wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="deposit"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.type(
      screen.getByLabelText("Amount to deposit (CHEESE)"),
      "2",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Review deposit" }),
    );
    expect(
      await screen.findByText("1. Approve the exact amount"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(fixture.write).not.toHaveBeenCalled();
  });
  it("builds native ETH deposit with value and confirms only after a receipt", async () => {
    fixture.address = account;
    let resolveReceipt!: (value: unknown) => void;
    fixture.receipt.mockReturnValue(
      new Promise((resolve) => {
        resolveReceipt = resolve;
      }),
    );
    wrap(
      <TransactionModal
        pool={POOLS[1]}
        initialAction="deposit"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText("Amount to deposit (ETH)"), "1");
    await userEvent.click(
      screen.getByRole("button", { name: "Review deposit" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Confirm deposit" }),
    );
    expect(
      await screen.findByText("Waiting for a confirmed receipt…"),
    ).toBeInTheDocument();
    expect(fixture.write).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "deposit",
        args: [],
        value: unit,
        chain: expect.objectContaining({ id: 11155111 }),
      }),
    );
    expect(screen.queryByText("Safely in the burrow")).not.toBeInTheDocument();
    resolveReceipt({
      status: "success",
      transactionHash: hash,
      blockNumber: 2n,
      logs: [],
    });
    expect(await screen.findByText("Safely in the burrow")).toBeInTheDocument();
  });
  it("previews actual asset fee and burns shares for a withdrawal", async () => {
    fixture.address = account;
    fixture.receipt.mockResolvedValue({
      status: "success",
      transactionHash: hash,
      blockNumber: 2n,
      logs: [],
    });
    const { container } = wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="withdraw"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText("Shares to withdraw"), "1000");
    await userEvent.click(
      screen.getByRole("button", { name: "Review withdraw" }),
    );
    expect(await screen.findByText("Gross withdrawal")).toBeInTheDocument();
    expect(screen.getByText("Hamster Bite (15%)")).toBeInTheDocument();
    expect(screen.getByText("You receive")).toBeInTheDocument();
    expect(container.querySelector(".bite-complete")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm withdraw" }),
    );
    await waitFor(() =>
      expect(fixture.write).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "withdraw",
          args: [1000n * unit],
        }),
      ),
    );
    // A successful receipt without a matching Withdrawn log cannot fabricate the completed bite.
    await waitFor(() =>
      expect(screen.getByText("Withdrawal confirmed")).toBeInTheDocument(),
    );
    expect(container.querySelector(".bite-complete")).toBeNull();
  });
  it("claims rewards to the connected account", async () => {
    fixture.address = account;
    fixture.receipt.mockResolvedValue({
      status: "success",
      transactionHash: hash,
      blockNumber: 2n,
      logs: [],
    });
    wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="claim"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Review claim" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Confirm claim" }),
    );
    await waitFor(() =>
      expect(fixture.write).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "claim", args: [account] }),
      ),
    );
    expect(await screen.findByText("Claim confirmed")).toBeInTheDocument();
  });
  it("does not play the bite on a reverted receipt", async () => {
    fixture.address = account;
    fixture.receipt.mockResolvedValue({
      status: "reverted",
      transactionHash: hash,
      blockNumber: 2n,
      logs: [],
    });
    const { container } = wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="withdraw"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText("Shares to withdraw"), "100");
    await userEvent.click(
      screen.getByRole("button", { name: "Review withdraw" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Confirm withdraw" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /reverted on-chain/,
    );
    expect(container.querySelector(".bite-complete")).toBeNull();
  });
  it("returns from a rejected signing prompt with a recoverable error", async () => {
    fixture.address = account;
    fixture.write.mockRejectedValue({ code: 4001 });
    wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="claim"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Review claim" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Confirm claim" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/declined/);
    expect(screen.getByRole("button", { name: "Review claim" })).toBeEnabled();
  });

  it("plays the bite only after a matching confirmed Withdrawn event, using receipt amounts", async () => {
    fixture.address = account;
    const topics = encodeEventTopics({
      abi: POOLS[0].abi,
      eventName: "Withdrawn",
      args: { account },
    });
    const data = encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [
        100n * unit,
        10n * unit,
        (85n * unit) / 10n,
        (14n * unit) / 10n,
        unit / 10n,
      ],
    );
    let finish!: (value: unknown) => void;
    fixture.receipt.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { container } = wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="withdraw"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText("Shares to withdraw"), "100");
    await userEvent.click(
      screen.getByRole("button", { name: "Review withdraw" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Confirm withdraw" }),
    );
    expect(
      await screen.findByText("Waiting for a confirmed receipt…"),
    ).toBeInTheDocument();
    expect(container.querySelector(".bite-complete")).toBeNull();
    finish({
      status: "success",
      transactionHash: hash,
      blockNumber: 2n,
      logs: [{ address: POOLS[0].address, data, topics }],
    });
    expect(
      await screen.findByText("A little nibble. All settled."),
    ).toBeInTheDocument();
    expect(container.querySelector(".bite-complete")).toBeInTheDocument();
    expect(
      screen.getByText("You receive").nextElementSibling,
    ).toHaveTextContent("8.5 CHEESE");
  });
  it("does not report a differently replaced transaction as a farm success", async () => {
    fixture.address = account;
    const replacementHash = `0x${"cd".repeat(32)}`;
    fixture.receipt.mockImplementation(async ({ onReplaced }) => {
      onReplaced({
        reason: "replaced",
        transaction: { hash: replacementHash },
      });
      return {
        status: "success",
        transactionHash: replacementHash,
        blockNumber: 2n,
        logs: [],
      };
    });
    const { container } = wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="claim"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Review claim" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Confirm claim" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /replaced with different data/,
    );
    expect(screen.queryByText("Claim confirmed")).not.toBeInTheDocument();
    expect(container.querySelector(".bite-complete")).toBeNull();
  });
  it("fills Max with the exact share amount", async () => {
    fixture.address = account;
    wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="withdraw"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(screen.getByLabelText("Shares to withdraw")).toHaveValue("10000");
  });
});

describe("wallet and review safeguards", () => {
  it.each(["deposit", "withdraw", "approve"] as const)(
    "locks Max and the amount during %s review, and requires a fresh review after Edit amount",
    async (kind) => {
      fixture.address = account;
      fixture.write.mockRejectedValue({ code: 4001 });
      const action = kind === "approve" ? "deposit" : kind;
      vi.mocked(publicClient.readContract).mockImplementation(async ({ functionName, args }) => {
        if (functionName === "allowance") return (kind === "approve" ? 0n : 100n * unit) as never;
        const units = args![0] as bigint;
        if (functionName === "convertToShares") return (units * 1000n) as never;
        const gross = units / 1000n;
        return [gross, gross * 85n / 100n, gross * 14n / 100n, gross / 100n] as never;
      });
      const { container } = wrap(
        <TransactionModal pool={POOLS[0]} initialAction={action} onClose={vi.fn()} openWallet={vi.fn()} />,
      );
      const input = screen.getByLabelText(action === "deposit" ? "Amount to deposit (CHEESE)" : "Shares to withdraw");
      await userEvent.type(input, "1");
      await userEvent.click(screen.getByRole("button", { name: `Review ${action}` }));
      const confirmName = kind === "approve" ? "Approve" : `Confirm ${action}`;
      await screen.findByRole("button", { name: confirmName });
      const max = screen.getByRole("button", { name: "Max" });
      expect(input).toBeDisabled();
      expect(max).toBeDisabled();
      const reviewed = container.querySelector(".transaction-review")!.textContent;
      await userEvent.click(max);
      expect(input).toHaveValue("1");
      expect(container.querySelector(".transaction-review")!.textContent).toBe(reviewed);
      await userEvent.click(screen.getByRole("button", { name: confirmName }));
      await waitFor(() => expect(fixture.write).toHaveBeenCalledWith(expect.objectContaining({
        functionName: kind, args: kind === "approve" ? [POOLS[0].address, unit] : [unit],
      })));
      // The rejected, intercepted signature made no broadcast. Review again, then edit.
      await screen.findByRole("alert");
      await userEvent.click(screen.getByRole("button", { name: `Review ${action}` }));
      await userEvent.click(await screen.findByRole("button", { name: "Edit amount" }));
      expect(max).toBeEnabled();
      expect(input).toBeEnabled();
      expect(container.querySelector(".transaction-review")).toBeNull();
      await userEvent.click(max);
      expect(input).toHaveValue(action === "deposit" ? "100" : "10000");
      await userEvent.click(screen.getByRole("button", { name: `Review ${action}` }));
      await screen.findByRole("button", { name: confirmName });
      if (action === "withdraw") {
        expect(screen.getByText("Gross withdrawal").nextElementSibling).toHaveTextContent("10 CHEESE");
        expect(screen.getByText("Hamster Bite (15%)").nextElementSibling).toHaveTextContent("1.5 CHEESE");
        expect(screen.getByText("You receive").nextElementSibling).toHaveTextContent("8.5 CHEESE");
      } else if (kind === "deposit") {
        expect(container.querySelector(".transaction-review")).toHaveTextContent("100,000 shares");
      }
      await userEvent.click(screen.getByRole("button", { name: confirmName }));
      const units = (action === "deposit" ? 100n : 10000n) * unit;
      await waitFor(() => expect(fixture.write).toHaveBeenLastCalledWith(expect.objectContaining({
        functionName: kind, args: kind === "approve" ? [POOLS[0].address, units] : [units],
      })));
    },
  );
  it("closes connected wallet options on Escape and restores focus", async () => {
    fixture.address = account;
    wrap(<WalletControl openWallet={vi.fn()} />);
    const control = screen.getByRole("button", { name: /0xdea1/ });
    await userEvent.click(control);
    expect(
      screen.getByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("button", { name: "Disconnect" }),
    ).not.toBeInTheDocument();
    expect(control).toHaveFocus();
  });
  it("keeps signing actions unavailable while the wallet is on another chain", () => {
    fixture.address = account;
    fixture.chainId = 1;
    wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="withdraw"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Switch to Sepolia" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Review withdraw" }),
    ).not.toBeInTheDocument();
    expect(fixture.write).not.toHaveBeenCalled();
  });
  it("expires an old review before requesting a signature", async () => {
    fixture.address = account;
    const clock = vi.spyOn(Date, "now").mockReturnValue(10_000);
    wrap(
      <TransactionModal
        pool={POOLS[0]}
        initialAction="claim"
        onClose={vi.fn()}
        openWallet={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Review claim" }));
    const confirm = await screen.findByRole("button", {
      name: "Confirm claim",
    });
    clock.mockReturnValue(71_001);
    await userEvent.click(confirm);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /preview has expired/,
    );
    expect(fixture.write).not.toHaveBeenCalled();
  });
});

describe("all five page routes and proof links", () => {
  it("navigates from the primary home action to three live pool controls and a disabled SQK pool", async () => {
    location.hash = "#/home";
    wrap(<App />);
    await userEvent.click(
      screen.getByRole("link", { name: "Explore Cheese Farm" }),
    );
    expect(
      await screen.findByRole("heading", { name: "A farm for every paw." }),
    ).toBeInTheDocument();
    for (const pool of POOLS)
      expect(
        screen.getByRole("heading", { name: pool.name }),
      ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Withdraw" })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Coming soon" })).toBeDisabled();
    expect(
      screen.getByText(/Emissions have not been activated/),
    ).toBeInTheDocument();
  });
  it("opens the visual instructions with four steps and the disclosed withdrawal fee", () => {
    location.hash = "#/how-to-play";
    wrap(<App />);
    for (const name of [
      "Connect Your Wallet",
      "Choose a Pool",
      "Earn CHEESE",
      "Claim or Withdraw",
    ])
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(
      screen.getByText(/15% withdrawal fee is applied/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore Cheese Farm" }),
    ).toHaveAttribute("href", "#/farm");
  });
  it("exposes official links and independently attempts source verification for all five addresses", async () => {
    location.hash = "#/proof";
    wrap(<App />);
    expect(
      screen.getByRole("link", { name: /Smart Contracts.*View Swarm Proof/ }),
    ).toHaveAttribute(
      "href",
      "https://explorer.imd.fun/jobs/3c7de646-4d13-45f5-ba32-3c57c559d8e8",
    );
    expect(
      screen.getByRole("link", { name: "Contracts source" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/identity-md-launches/launch-3140-cheese-v2-official",
    );
    expect(document.querySelector("details")).not.toHaveAttribute("open");
    await userEvent.click(screen.getByText("Contract Details"));
    const names = [
      "CHEESE Token",
      "Emission Controller",
      "CHEESE Pool",
      "ETH Pool",
      "sIMD Pool",
    ];
    const addresses = [
      TOKEN,
      "0xe06748177ad22d422e49cdb0982a5f932e46ee7d",
      ...POOLS.map((p) => p.address),
    ];
    names.forEach((name, index) =>
      expect(
        screen.getByRole("link", { name: `${name} on Sepolia Etherscan` }),
      ).toHaveAttribute(
        "href",
        `https://sepolia.etherscan.io/address/${addresses[index]}`,
      ),
    );
    await waitFor(() => expect(screen.getAllByText("Unavailable")).toHaveLength(5));
    expect(fetch).toHaveBeenCalledTimes(5);
    addresses.forEach((address) => expect(fetch).toHaveBeenCalledWith(
      sourceEvidenceUrl(address as `0x${string}`),
      expect.objectContaining({ cache: "no-store" }),
    ));
    expect(screen.getAllByRole("link", { name: "Sourcify evidence" })).toHaveLength(5);
    expect(screen.getAllByText(/Checked \d{4}-\d{2}-\d{2}/)).toHaveLength(5);
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Copy .* address/ }),
    ).toHaveLength(6);
  });
  it("refreshes source evidence independently of chain reads and never keeps a failed lookup green", async () => {
    fixture.protocol = undefined;
    location.hash = "#/proof";
    wrap(<App />);
    await waitFor(() => expect(screen.getAllByText("Unavailable")).toHaveLength(5));
    vi.mocked(fetch).mockImplementation(async (url) => new Response(JSON.stringify({
      chainId: "11155111", address: String(url).split("/").pop(),
      match: "exact_match", creationMatch: "exact_match", runtimeMatch: "exact_match",
    })));
    await userEvent.click(screen.getByText("Contract Details"));
    const refresh = screen.getByRole("button", { name: "Refresh Sepolia contract data" });
    await userEvent.click(refresh);
    await waitFor(() => expect(screen.getAllByText("Verified")).toHaveLength(5));
    expect(screen.getAllByText("Exact runtime match.")).toHaveLength(5);
    expect(fetch).toHaveBeenCalledTimes(10);
    for (const address of [TOKEN, CONTROLLER, ...POOLS.map((p) => p.address)])
      expect(screen.getAllByRole("link", { name: "Sourcify evidence" }).some((link) => link.getAttribute("href") === sourceEvidenceUrl(address))).toBe(true);
    expect(screen.getAllByText("Not verified")).toHaveLength(15);
    vi.mocked(fetch).mockRejectedValue(new TypeError("Network unavailable"));
    await userEvent.click(refresh);
    await waitFor(() => expect(screen.getAllByText("Unavailable")).toHaveLength(5));
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(15);
  });
});

it("keeps an in-progress deposit intact during a theme change from another tab", async () => {
  fixture.address = account;
  location.hash = "#/farm";
  wrap(<App />);
  await userEvent.click(screen.getAllByRole("button", { name: "Deposit" })[0]);
  const input = screen.getByLabelText("Amount to deposit (CHEESE)");
  await userEvent.type(input, "1.25");
  const next = theme === "light" ? "dark" : "light";
  localStorage.setItem("cheese-vault:theme", next);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "cheese-vault:theme" })));
  expect(document.documentElement.dataset.theme).toBe(next);
  expect(input).toHaveValue("1.25");
  expect(fixture.write).not.toHaveBeenCalled();
});

});

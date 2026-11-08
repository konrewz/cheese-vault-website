import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AprBreakdown, ConversionModes, SqkPoolCard } from "../../src/FourPools";
import { formatApr, totalApr } from "../../src/contracts/apr";
vi.mock("wagmi", () => ({ useAccount: () => ({ address: undefined }) }));
describe("four pool readiness and APR", () => {
  it("does not manufacture a total from partial or invalid evidence", () => {
    expect(totalApr({ rewards: 5 })).toBeUndefined();
    expect(totalApr({ fees: 5 })).toBeUndefined();
    expect(totalApr({ rewards: NaN, fees: 0 })).toBeUndefined();
    expect(totalApr({ rewards: 5, fees: -1 })).toBeUndefined();
    expect(totalApr({ rewards: 5, fees: 2 })).toBe(7);
    expect(formatApr(undefined)).toBe("N/A");
    expect(formatApr(0)).toBe("0.00%");
  });
  it("supports hover, tap toggle and Escape without invented APR", async () => {
    render(<AprBreakdown />);
    const button = screen.getByRole("button", { name: /Total APR: N\/A/ });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.hover(button); expect(screen.getByRole("tooltip")).toBeVisible();
    await userEvent.unhover(button); expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.click(button); expect(screen.getByRole("tooltip")).toHaveTextContent("Treasury");
    await userEvent.click(button); expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.click(button); await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("disables IMD conversion and exposes unavailable quotes", async () => {
    const onModeChange = vi.fn(); render(<ConversionModes onModeChange={onModeChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Deposit IMD (Auto Convert)" }));
    expect(onModeChange).toHaveBeenCalledWith("imd");
    expect(screen.getByRole("button", { name: "Convert IMD and deposit" })).toBeDisabled();
    expect(screen.getByLabelText("IMD amount")).toBeDisabled();
    expect(screen.getAllByText("N/A")).toHaveLength(3);
    expect(screen.getByText(/No 1:1 rate/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Deposit sIMD" }));
    expect(onModeChange).toHaveBeenLastCalledWith("simd");
  });
  it("shows all SQK fields with disabled actions and only a real token link", () => {
    render(<QueryClientProvider client={new QueryClient()}><SqkPoolCard /></QueryClientProvider>);
    for (const action of ["Deposit", "Withdraw", "Claim", "MAX"])
      expect(screen.getByRole("button", { name: action })).toBeDisabled();
    for (const label of ["SQK wallet balance", "Deposited SQK", "Share balance", "Withdrawable SQK", "Claimable CHEESE"])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Verified SQK token/ })).toHaveAttribute("href", "https://sepolia.etherscan.io/address/0xd78a3956cf63164d1fa1c622ad3c66623162fa1e");
    expect(screen.getByText("Not registered")).toBeInTheDocument();
  });
});

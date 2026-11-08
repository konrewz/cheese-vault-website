import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TvlSummary } from "../../src/TvlSummary";
const fixture = vi.hoisted(() => ({ verified: true, failed: false, decimals: 18 as number | undefined }));
vi.mock("../../src/hooks", () => ({
  useProtocol: () => ({ data: fixture.verified ? {} : undefined, isError: fixture.failed }),
  usePool: (pool: { id: string }) => ({ data: {
    controllerValid: true, assetConfigured: pool.id !== "simd", decimals: fixture.decimals,
    totalAssets: pool.id === "cheese" ? 25n * 10n ** 18n : 2n * 10n ** 18n, block: 12090957n,
  }, isError: fixture.failed }),
}));
beforeEach(() => { fixture.verified = true; fixture.failed = false; fixture.decimals = 18; });
it("shows separate verifiable principal assets and no invented dollar total", () => {
  const { container } = render(<TvlSummary />);
  const cards = container.querySelectorAll('.tvl-asset');
  expect(cards).toHaveLength(4);
  expect(cards[0]).toHaveTextContent('25 CHEESE'); expect(cards[1]).toHaveTextContent('2 ETH');
  expect(cards[2]).toHaveTextContent('Asset not configured'); expect(cards[3]).toHaveTextContent('Farm not deployed');
  expect(container.querySelector('.tvl-usd')).toHaveTextContent('Unavailable');
  expect(within(cards[0] as HTMLElement).getByRole('link', {name: /Read at block/})).toHaveAttribute('href','https://sepolia.etherscan.io/block/12090957');
  expect(screen.getByText(/not added together as a dollar total/)).toBeInTheDocument();
});
it("does not present values without verified network reads or known decimals", () => {
  fixture.verified = false;
  const { container, rerender } = render(<TvlSummary />);
  expect(container.querySelector('.tvl-assets')).not.toHaveTextContent('25 CHEESE');
  fixture.verified = true; fixture.decimals = undefined; rerender(<TvlSummary />);
  expect(container.querySelector('.tvl-assets')).not.toHaveTextContent('25 CHEESE');
});
it("identifies a failed refresh when displaying previously read values", () => {
  fixture.failed = true; render(<TvlSummary />);
  expect(screen.getAllByText('Latest read failed')).toHaveLength(2);
});

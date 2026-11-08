import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { wagmiConfig } from "./wallet-config";
import "./styles.css";
import "./theme.css";
import "./four-pools.css";
import "./treasury.css";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } },
});
class AppBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="error-boundary">
        <h1>The vault needs a moment.</h1>
        <p>
          The app could not load. Reload to try again. Your assets remain
          on-chain.
        </p>
        <button
          className="button button-primary"
          onClick={() => location.reload()}
        >
          Reload the vault
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </WagmiProvider>
    </AppBoundary>
  </React.StrictMode>,
);

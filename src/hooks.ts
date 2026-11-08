import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { POOLS, TOKEN, tokenAbi, type Pool } from "./contracts/config";
import {
  loadPool,
  loadPosition,
  loadProtocol,
  readValue,
} from "./contracts/read";
export function useProtocol() {
  return useQuery({
    queryKey: ["protocol"],
    queryFn: loadProtocol,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  });
}
export function usePool(pool: Pool) {
  return useQuery({
    queryKey: ["pool", pool.id],
    queryFn: () => loadPool(pool),
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  });
}
export function usePosition(pool: Pool) {
  const { address } = useAccount();
  const state = usePool(pool);
  return useQuery({
    queryKey: ["position", pool.id, address],
    queryFn: () => loadPosition(pool, state.data!, address!),
    enabled: !!address && !!state.data,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
}
export function useCheeseBalance() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["balance", TOKEN, address],
    queryFn: () => readValue<bigint>(TOKEN, tokenAbi, "balanceOf", [address!]),
    enabled: !!address,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
}
export const DEFAULT_POOL = POOLS[0];

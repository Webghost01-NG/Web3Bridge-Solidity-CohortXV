"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  chainlinkAbi,
  ETH_USD_FEED,
  parsePriceFeed,
  PRICE_REFRESH_MS,
  type RoundData,
} from "@/lib/chainlink";

type PriceState =
  | { status: "loading"; polledAt?: number }
  | { status: "error"; message: string; polledAt: number }
  | {
      status: "ready";
      priceUsd: number;
      updatedAt: number;
      ageSeconds: number;
      isStale: boolean;
      polledAt: number;
    };

export function useEthUsdPrice() {
  const client = usePublicClient({ chainId: sepolia.id });
  const [state, setState] = useState<PriceState>({ status: "loading" });

  const refresh = useCallback(async () => {
    if (!client) return;
    const polledAt = Date.now();

    try {
      const [decimals, round] = await Promise.all([
        client.readContract({ address: ETH_USD_FEED, abi: chainlinkAbi, functionName: "decimals" }),
        client.readContract({ address: ETH_USD_FEED, abi: chainlinkAbi, functionName: "latestRoundData" }),
      ]);
      const parsed = parsePriceFeed(round as RoundData, decimals);

      if (!parsed.valid) {
        setState({ status: "error", message: parsed.reason, polledAt });
        return;
      }

      setState({ status: "ready", ...parsed, polledAt });
    } catch {
      setState({ status: "error", message: "The Sepolia price feed is unavailable. We will try again.", polledAt });
    }
  }, [client]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), PRICE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { ...state, refresh };
}

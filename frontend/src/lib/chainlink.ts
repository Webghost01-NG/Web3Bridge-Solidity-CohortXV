import { formatUnits } from "viem";

export const ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306" as const;
export const PRICE_REFRESH_MS = 30_000;
export const PRICE_STALE_AFTER_SECONDS = 2 * 60 * 60;

export const chainlinkAbi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export type RoundData = readonly [bigint, bigint, bigint, bigint, bigint];

export function parsePriceFeed(
  round: RoundData,
  decimals: number,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const [roundId, answer, , updatedAt, answeredInRound] = round;

  if (answer <= 0n) return { valid: false as const, reason: "The feed returned an invalid price." };
  if (updatedAt === 0n) return { valid: false as const, reason: "The feed has no update time." };
  if (answeredInRound < roundId) return { valid: false as const, reason: "The latest round is incomplete." };

  const ageSeconds = Math.max(0, nowSeconds - Number(updatedAt));
  return {
    valid: true as const,
    priceUsd: Number(formatUnits(answer, decimals)),
    updatedAt: Number(updatedAt),
    ageSeconds,
    isStale: ageSeconds > PRICE_STALE_AFTER_SECONDS,
  };
}
export function ethBalanceToUsd(balanceWei: bigint, priceUsd: number) {
  return Number(formatUnits(balanceWei, 18)) * priceUsd;
}

export function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3_600)}h ${Math.floor((seconds % 3_600) / 60)}m ago`;
}


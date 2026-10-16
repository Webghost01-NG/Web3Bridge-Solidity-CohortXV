"use client";

import { useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";

// Shows an address as its ENS name when it has one, otherwise as 0x1234…abcd
export function Who({ address }: { address: `0x${string}` }) {
  const { data: name, isLoading } = useEnsName({ address, chainId: mainnet.id });
  const shortAddress = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return <span title={address}>{isLoading ? shortAddress : (name ?? shortAddress)}</span>;
}

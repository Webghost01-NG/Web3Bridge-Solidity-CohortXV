"use client";

import { useAccount, useConnect, useDisconnect, useEnsName, useSwitchChain } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Wallet";
}

function friendlyWalletError(message: string) {
  if (/rejected|denied/i.test(message)) return "Connection was cancelled in your wallet.";
  if (/not found|provider/i.test(message)) return "No browser wallet was found. Install MetaMask or open this page in a wallet browser.";
  return "The wallet could not connect. Please try again.";
}

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { connectors, connect, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError, reset: resetSwitch } = useSwitchChain();

  if (isConnected) {
    return (
      <div className="wallet-connected">
        <select
          aria-label="Wallet network"
          className="network-select"
          disabled={isSwitching}
          value={chain?.id === mainnet.id || chain?.id === sepolia.id ? chain.id : ""}
          onChange={(event) => {
            resetSwitch();
            switchChain({ chainId: Number(event.target.value) as typeof mainnet.id | typeof sepolia.id });
          }}
        >
          <option value="" disabled>{isSwitching ? "Switching…" : "Switch network"}</option>
          <option value={mainnet.id}>Ethereum</option>
          <option value={sepolia.id}>Sepolia</option>
        </select>
        <button className="wallet-button" onClick={() => disconnect()} title="Disconnect wallet">
          <span className="status-dot is-live" />
          {ensName ?? shortAddress(address)}
          <span className="wallet-action">Disconnect</span>
        </button>
        {switchError && <p className="wallet-error" role="alert">Could not switch network. Please approve it in your wallet.</p>}
      </div>
    );
  }

  return (
    <div className="wallet-disconnected">
      <button
        className="primary-button compact-button"
        disabled={isPending || connectors.length === 0}
        onClick={() => {
          reset();
          const connector = connectors[0];
          if (connector) connect({ connector });
        }}
      >
        {isPending ? "Check your wallet…" : "Connect wallet"}
      </button>
      {error && <p className="wallet-error" role="alert">{friendlyWalletError(error.message)}</p>}
    </div>
  );
}

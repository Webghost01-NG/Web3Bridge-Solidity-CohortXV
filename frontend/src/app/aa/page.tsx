"use client";

import { useState } from "react";
import { createPublicClient, encodeFunctionData, http, isAddress } from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { useAccount, useSwitchChain } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { config } from "@/lib/wagmi";
import { NFT_ADDRESS, nftAbi } from "@/contracts/nft";

const entryPoint = { address: entryPoint07Address, version: "0.7" } as const;
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"),
});

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("user rejected") || message.includes("user denied")) return "You cancelled the wallet request. Nothing was sent.";
  if (message.includes("paymaster") || message.includes("sponsor")) return "Pimlico could not sponsor this operation. Check the Sepolia sponsorship policy.";
  if (message.includes("insufficient") || message.includes("prefund")) return "The smart account or paymaster does not have enough gas funding.";
  if (message.includes("chain") || message.includes("network")) return "Switch your wallet to Sepolia and try again.";
  return "The gasless mint could not be completed. Check the wallet and try again.";
}

async function getSmartAccount() {
  const owner = await getWalletClient(config, { chainId: sepolia.id });
  if (!owner) throw new Error("wallet not connected");
  return toSimpleSmartAccount({ client: publicClient, owner, entryPoint });
}

export default function SmartAccountPage() {
  const { isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [accountAddress, setAccountAddress] = useState<`0x${string}` | "">("");
  const [deployed, setDeployed] = useState<boolean | null>(null);
  const [uri, setUri] = useState("");
  const [status, setStatus] = useState("Ready for one sponsored batch of two mints.");
  const [pending, setPending] = useState(false);
  const [userOpHash, setUserOpHash] = useState("");
  const [txHash, setTxHash] = useState("");

  async function loadAccount() {
    try {
      setStatus("Checking your smart account…");
      await switchChainAsync({ chainId: sepolia.id });
      const account = await getSmartAccount();
      const code = await publicClient.getCode({ address: account.address });
      setAccountAddress(account.address);
      setDeployed(Boolean(code));
      setStatus("Smart account ready. Your wallet remains its signer.");
    } catch (error) {
      setStatus(friendlyError(error));
    }
  }

  async function mintBatch() {
    if (!uri.startsWith("ipfs://")) return;

    try {
      setPending(true);
      setUserOpHash("");
      setTxHash("");
      setStatus("Switching to Sepolia…");
      await switchChainAsync({ chainId: sepolia.id });
      const account = await getSmartAccount();
      setAccountAddress(account.address);

      const bundlerUrl = `${window.location.origin}/api/bundler`;
      const pimlico = createPimlicoClient({ transport: http(bundlerUrl), entryPoint });
      const smartAccountClient = createSmartAccountClient({
        account,
        chain: sepolia,
        bundlerTransport: http(bundlerUrl, { timeout: 60_000 }),
        paymaster: pimlico,
        userOperation: {
          estimateFeesPerGas: async () => (await pimlico.getUserOperationGasPrice()).fast,
        },
      });

      const mintData = encodeFunctionData({ abi: nftAbi, functionName: "mint", args: [uri] });
      const calls = [
        { to: NFT_ADDRESS, value: 0n, data: mintData },
        { to: NFT_ADDRESS, value: 0n, data: mintData },
      ];

      setStatus("Confirm one signature for both NFT mints…");
      const hash = await smartAccountClient.sendUserOperation({ calls });
      setUserOpHash(hash);
      setStatus("UserOperation sent. Waiting for Pimlico to include it on Sepolia…");

      const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash, timeout: 120_000 });
      setTxHash(receipt.receipt.transactionHash);
      setDeployed(Boolean(await publicClient.getCode({ address: account.address })));
      setStatus(receipt.success ? "Success: two NFTs minted in one sponsored UserOperation." : "The UserOperation was included but its calls failed.");
    } catch (error) {
      setStatus(friendlyError(error));
    } finally {
      setPending(false);
    }
  }

  const contractReady = isAddress(NFT_ADDRESS);

  return (
    <div className="page-stack aa-page">
      <header className="page-heading">
        <div>
          <h1>Two mints. One signature. No gas.</h1>
          <p>A Pimlico paymaster sponsors one ERC-4337 UserOperation containing two calls to the verified ClassNFT contract.</p>
        </div>
        <span className="network-stamp">Sepolia · ERC-4337</span>
      </header>

      <div className="aa-layout">
        <section className="folio-panel aa-action" aria-labelledby="gasless-heading">
          <h2 id="gasless-heading">Send the sponsored batch</h2>
          <p className="section-copy">Your connected wallet signs only. The smart account executes both mints, and Pimlico pays the network fee.</p>

          <div className="account-strip">
            <div>
              <span>Smart account</span>
              <strong>{accountAddress || "Not loaded yet"}</strong>
              {accountAddress && <small>{deployed ? "Deployed on Sepolia" : "Counterfactual — deploys with the first UserOperation"}</small>}
            </div>
            <button className="secondary-button compact-button" onClick={loadAccount} disabled={!isConnected || pending}>
              {accountAddress ? "Refresh" : "Show account"}
            </button>
          </div>

          <label className="field-group">
            <span>IPFS metadata URI</span>
            <input
              className="text-field"
              placeholder="ipfs://bafy…"
              value={uri}
              onChange={(event) => setUri(event.target.value.trim())}
              disabled={pending}
            />
            <small className="field-help">Use a metadata URI created on the Create card page. Both NFTs will store this same URI.</small>
          </label>

          <div className="batch-preview" aria-label="Calls inside this UserOperation">
            <div><span>Call 1</span><strong>ClassNFT.mint(uri)</strong></div>
            <div><span>Call 2</span><strong>ClassNFT.mint(uri)</strong></div>
          </div>

          <button className="primary-button mint-button" disabled={!isConnected || !uri.startsWith("ipfs://") || !contractReady || pending} onClick={mintBatch}>
            {pending ? "Sending sponsored batch…" : "Gasless mint two NFTs"}
          </button>
          {!isConnected && <p className="field-help">Connect a wallet so it can authorize the smart account.</p>}

          <div className="operation-status" aria-live="polite">
            <strong>Status</strong>
            <p>{status}</p>
            {userOpHash && <p><span>UserOperation:</span> <code>{userOpHash}</code></p>}
            {txHash && (
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                View the confirmed transaction on Etherscan <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </section>

        <aside className="aa-proof" aria-label="How the gasless mint works">
          <h2>What happens on-chain</h2>
          <ol>
            <li><span>1</span><div><strong>Your wallet signs</strong><p>No Sepolia ETH leaves the wallet.</p></div></li>
            <li><span>2</span><div><strong>Pimlico sponsors</strong><p>The paymaster accepts the gas cost.</p></div></li>
            <li><span>3</span><div><strong>EntryPoint executes</strong><p>Both mint calls run inside one UserOperation.</p></div></li>
          </ol>
          <dl>
            <div><dt>Target</dt><dd>{NFT_ADDRESS}</dd></div>
            <div><dt>EntryPoint</dt><dd>{entryPoint07Address}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPublicClient, encodeFunctionData, http, parseEventLogs, type Address, type Hash } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { useAccount, useEnsName, usePublicClient, useSwitchChain } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { mainnet, sepolia } from "wagmi/chains";
import { NFT_ADDRESS, nftAbi } from "@/contracts/nft";
import { fetchNftMetadata, ipfsToHttp, uploadNft, type NftMetadata } from "@/lib/ipfs";
import { config } from "@/lib/wagmi";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const entryPoint = { address: entryPoint07Address, version: "0.7" } as const;
const aaPublicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"),
});

type Result = {
  tokenId: string;
  uri: string;
  owner: Address;
  metadata: NftMetadata;
  hash?: Hash;
};

type MintStep = "idle" | "uploading" | "wallet" | "confirming" | "complete";
const steps: { key: MintStep; label: string }[] = [
  { key: "idle", label: "Picture" },
  { key: "uploading", label: "IPFS" },
  { key: "wallet", label: "Pimlico" },
  { key: "complete", label: "Profile" },
];

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/rejected|denied|cancelled/i.test(message)) return "The request was cancelled in your wallet. Nothing was minted.";
  if (/paymaster|sponsor/i.test(message)) return "Pimlico could not sponsor this mint. Please try again shortly.";
  if (/already pending|request is already pending/i.test(message)) return "A wallet request is already open. Complete or cancel it, then try again.";
  if (/chain|network|switch/i.test(message)) return "Switch your wallet to Sepolia, then try again.";
  if (/failed to fetch|rpc|timeout/i.test(message)) return "Sepolia did not respond. Check your connection, then try again.";
  if (/revert|contract function|estimate gas/i.test(message)) return "The contract rejected the mint before charging gas. Please try again.";
  if (/IPFS|Pinata|upload|metadata/i.test(message)) return message;
  return "Something interrupted the mint. Check your wallet and connection, then try again.";
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function ProfileResult({ result }: { result: Result }) {
  const { data: ownerEns } = useEnsName({ address: result.owner, chainId: mainnet.id });
  const [copyMessage, setCopyMessage] = useState("");

  async function copyUri(label: string, uri: string) {
    try {
      await navigator.clipboard.writeText(uri);
      setCopyMessage(`${label} copied`);
    } catch {
      setCopyMessage("Copy is unavailable in this browser");
    }
  }

  return (
    <article className="mint-result" aria-labelledby={`profile-${result.tokenId}`}>
      <div className="result-banner"><span>Profile card verified on Sepolia</span></div>
      <div className="result-body">
        <div className="result-image">
          {result.metadata.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ipfsToHttp(result.metadata.image)} alt={`${result.metadata.name} profile`} />
          ) : <span>IPFS content is temporarily unavailable</span>}
        </div>
        <div className="result-copy">
          <span className="token-label">Web3Bridge Class · Token #{result.tokenId}</span>
          <h2 id={`profile-${result.tokenId}`}>{result.metadata.name}</h2>
          <p>{result.metadata.description}</p>
          <dl>
            <div><dt>Owner</dt><dd title={result.owner}>{ownerEns ?? shortAddress(result.owner)}</dd></div>
            <div><dt>Metadata</dt><dd><a href={ipfsToHttp(result.uri)} target="_blank" rel="noreferrer">Open on IPFS ↗</a></dd></div>
          </dl>
          {result.hash && (
            <a className="secondary-button" href={`https://sepolia.etherscan.io/tx/${result.hash}`} target="_blank" rel="noreferrer">
              View transaction on Etherscan ↗
            </a>
          )}
          <details className="ipfs-details">
            <summary>IPFS details</summary>
            <div className="ipfs-uri-row">
              <span>Metadata URI</span>
              <code>{result.uri}</code>
              <div>
                <a href={ipfsToHttp(result.uri)} target="_blank" rel="noreferrer">Open ↗</a>
                <button type="button" onClick={() => copyUri("Metadata URI", result.uri)}>Copy</button>
              </div>
            </div>
            <div className="ipfs-uri-row">
              <span>Image URI</span>
              {result.metadata.image ? (
                <>
                  <code>{result.metadata.image}</code>
                  <div>
                    <a href={ipfsToHttp(result.metadata.image)} target="_blank" rel="noreferrer">Open ↗</a>
                    <button type="button" onClick={() => copyUri("Image URI", result.metadata.image)}>Copy</button>
                  </div>
                </>
              ) : <code>Image URI unavailable</code>}
            </div>
            <p className="ipfs-copy-status" aria-live="polite">{copyMessage}</p>
          </details>
        </div>
      </div>
    </article>
  );
}

export default function NftPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: sepolia.id });

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [step, setStep] = useState<MintStep>("idle");
  const [mintError, setMintError] = useState("");
  const [mintNotice, setMintNotice] = useState("");
  const [submittedUserOp, setSubmittedUserOp] = useState<Hash | null>(null);
  const [submittedHash, setSubmittedHash] = useState<Hash | null>(null);
  const [submittedMetadata, setSubmittedMetadata] = useState<NftMetadata | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [lookupId, setLookupId] = useState("0");
  const [lookupStatus, setLookupStatus] = useState("");
  const [lookupResult, setLookupResult] = useState<Result | null>(null);
  const [myNfts, setMyNfts] = useState<Result[]>([]);
  const [myNftsStatus, setMyNftsStatus] = useState("Connect your wallet to see your profile NFTs.");
  const [myNftsReload, setMyNftsReload] = useState(0);

  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : ""), [image]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    const savedUserOp = window.localStorage.getItem("profile-card-pending-userop") as Hash | null;
    const savedHash = window.localStorage.getItem("profile-card-pending-mint") as Hash | null;
    if (savedUserOp) {
      setSubmittedUserOp(savedUserOp);
      setMintNotice("A previous gasless mint was submitted. Check its confirmation before minting again.");
    }
    if (savedHash) {
      setSubmittedHash(savedHash);
      setMintNotice("A previous mint was submitted. Check its confirmation below before minting again.");
    }
  }, []);

  useEffect(() => {
    if (!address || !publicClient) {
      setMyNfts([]);
      setMyNftsStatus("Connect your wallet to see your profile NFTs.");
      return;
    }

    let cancelled = false;
    async function loadMyNfts() {
      setMyNftsStatus("Checking your wallet and gasless smart account…");
      try {
        const owners: Address[] = [address as Address];
        try {
          const wallet = await getWalletClient(config);
          if (wallet) {
            const smartAccount = await toSimpleSmartAccount({ client: aaPublicClient, owner: wallet, entryPoint });
            owners.push(smartAccount.address);
          }
        } catch {
          // Wallet-owned NFTs still load if the smart account cannot be derived.
        }

        const totalMinted = await publicClient.readContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "totalMinted" });
        const owned: { tokenId: bigint; owner: Address; uri: string }[] = [];
        const batchSize = 20n;
        for (let start = 0n; start < totalMinted; start += batchSize) {
          const end = start + batchSize < totalMinted ? start + batchSize : totalMinted;
          const batch = await Promise.all(Array.from({ length: Number(end - start) }, (_, index) => start + BigInt(index)).map(async (tokenId) => {
            try {
              const [owner, uri] = await Promise.all([
                publicClient.readContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "ownerOf", args: [tokenId] }),
                publicClient.readContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "tokenURI", args: [tokenId] }),
              ]);
              return owners.some((candidate) => candidate.toLowerCase() === owner.toLowerCase()) ? { tokenId, owner, uri } : null;
            } catch {
              return null;
            }
          }));
          owned.push(...batch.filter((item): item is NonNullable<typeof item> => item !== null));
        }

        const profiles = await Promise.all(owned.reverse().map(async ({ tokenId, owner, uri }) => {
          let metadata: NftMetadata;
          try {
            metadata = await fetchNftMetadata(uri, `Profile NFT #${tokenId}`);
          } catch {
            metadata = { name: `Profile NFT #${tokenId}`, description: "The token exists on Sepolia. Its IPFS content could not be reached right now.", image: "" };
          }
          return { tokenId: tokenId.toString(), owner, uri, metadata };
        }));

        if (cancelled) return;
        setMyNfts(profiles);
        setMyNftsStatus(profiles.length ? `${profiles.length} profile NFT${profiles.length === 1 ? "" : "s"} found.` : "No profile NFTs found for this wallet yet.");
      } catch {
        if (!cancelled) setMyNftsStatus("Could not load your NFTs from Sepolia. Check your connection and try again.");
      }
    }

    void loadMyNfts();
    return () => { cancelled = true; };
  }, [address, publicClient, myNftsReload]);

  const activeStep = step === "confirming" ? "wallet" : step;
  const activeIndex = steps.findIndex((item) => item.key === activeStep);
  const isBusy = step !== "idle" && step !== "complete";

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageError("");
    if (!file) return setImage(null);
    if (!IMAGE_TYPES.includes(file.type)) {
      setImage(null);
      setImageError("Choose a PNG, JPG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImage(null);
      setImageError("Choose an image smaller than 5 MB.");
      return;
    }
    setImage(file);
  }

  async function confirmMint(hash: Hash, knownMetadata?: NftMetadata | null) {
    if (!publicClient) return;
    setStep("confirming");
    setMintError("");

    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
      if (receipt.status !== "success") {
        window.localStorage.removeItem("profile-card-pending-mint");
        setSubmittedHash(null);
        setStep("idle");
        setMintError("The transaction was confirmed but reverted. No NFT was created.");
        return;
      }

      const [mintedEvent] = parseEventLogs({ abi: nftAbi, logs: receipt.logs, eventName: "Minted" });
      if (!mintedEvent) throw new Error("The confirmed transaction did not contain a Minted event.");

      const { tokenId, uri, to } = mintedEvent.args;
      const metadata = knownMetadata ?? await fetchNftMetadata(uri, `Profile NFT #${tokenId}`);
      setResult({ tokenId: tokenId.toString(), uri, owner: to, metadata, hash });
      setLookupId(tokenId.toString());
      setMyNftsReload((value) => value + 1);
      setSubmittedHash(null);
      setSubmittedUserOp(null);
      setSubmittedMetadata(null);
      setMintNotice("");
      window.localStorage.removeItem("profile-card-pending-mint");
      window.localStorage.removeItem("profile-card-pending-userop");
      setStep("complete");
    } catch {
      setStep("idle");
      setMintNotice("Your transaction was submitted. Use Check confirmation below; do not mint again.");
    }
  }

  async function confirmUserOperation(userOpHash: Hash, knownMetadata?: NftMetadata | null) {
    setStep("confirming");
    setMintError("");

    try {
      const response = await fetch("/api/bundler", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getUserOperationReceipt", params: [userOpHash] }),
      });
      const data = await response.json() as { result?: { success: boolean; receipt: { transactionHash: Hash } } | null };
      if (!data.result) {
        setStep("idle");
        setMintNotice("Pimlico is still processing this mint. Wait a moment, then check again.");
        return;
      }
      if (!data.result.success) throw new Error("UserOperation failed");

      const transactionHash = data.result.receipt.transactionHash;
      setSubmittedHash(transactionHash);
      window.localStorage.setItem("profile-card-pending-mint", transactionHash);
      await confirmMint(transactionHash, knownMetadata);
    } catch (error) {
      setStep("idle");
      setMintError(friendlyError(error));
    }
  }

  async function mint(event: FormEvent) {
    event.preventDefault();
    setMintError("");
    setMintNotice("");
    setResult(null);

    if (!isConnected || !address) return setMintError("Connect your wallet before minting.");
    if (!name.trim() || !bio.trim() || !image) return setMintError("Add a name, short bio, and profile picture.");
    if (!publicClient) return setMintError("The Sepolia connection is not ready. Try again.");

    try {
      setStep("uploading");
      const { uri, metadata } = await uploadNft(image, name.trim(), bio.trim());

      setStep("wallet");
      if (chainId !== sepolia.id) await switchChainAsync({ chainId: sepolia.id });
      const owner = await getWalletClient(config, { chainId: sepolia.id });
      if (!owner) throw new Error("wallet not connected");
      const account = await toSimpleSmartAccount({ client: aaPublicClient, owner, entryPoint });
      const bundlerUrl = `${window.location.origin}/api/bundler`;
      const pimlico = createPimlicoClient({ transport: http(bundlerUrl), entryPoint });
      const smartAccountClient = createSmartAccountClient({
        account,
        chain: sepolia,
        bundlerTransport: http(bundlerUrl, { timeout: 60_000 }),
        paymaster: pimlico,
        userOperation: { estimateFeesPerGas: async () => (await pimlico.getUserOperationGasPrice()).fast },
      });

      const userOpHash = await smartAccountClient.sendUserOperation({
        calls: [{
          to: NFT_ADDRESS,
          value: 0n,
          data: encodeFunctionData({ abi: nftAbi, functionName: "mint", args: [uri] }),
        }],
      });
      setSubmittedUserOp(userOpHash);
      setSubmittedMetadata(metadata);
      setMintNotice("Gasless mint submitted. Pimlico is paying the fee…");
      window.localStorage.setItem("profile-card-pending-userop", userOpHash);

      const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash, timeout: 120_000 });
      if (!receipt.success) throw new Error("UserOperation failed");
      const transactionHash = receipt.receipt.transactionHash;
      setSubmittedHash(transactionHash);
      window.localStorage.setItem("profile-card-pending-mint", transactionHash);
      await confirmMint(transactionHash, metadata);
    } catch (error) {
      setStep("idle");
      if (window.localStorage.getItem("profile-card-pending-userop")) {
        setMintNotice("The gasless mint was submitted. Check its confirmation below; do not mint again.");
      } else {
        setMintError(friendlyError(error));
      }
    }
  }

  async function loadToken(event: FormEvent) {
    event.preventDefault();
    setLookupResult(null);
    if (!/^\d+$/.test(lookupId)) return setLookupStatus("Enter a whole token ID, such as 0.");
    if (!publicClient) return setLookupStatus("The Sepolia connection is not ready.");

    try {
      setLookupStatus("Reading the token from Sepolia…");
      const tokenId = BigInt(lookupId);
      const totalMinted = await publicClient.readContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "totalMinted" });
      if (tokenId >= totalMinted) {
        setLookupStatus(`Token #${lookupId} has not been minted on this contract.`);
        return;
      }
      let uri: string;
      let owner: Address;
      try {
        [uri, owner] = await Promise.all([
          publicClient.readContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "tokenURI", args: [tokenId] }),
          publicClient.readContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "ownerOf", args: [tokenId] }),
        ]);
      } catch {
        setLookupStatus(`Token #${lookupId} exists, but Sepolia could not return its details. Check your connection and try again.`);
        return;
      }
      let metadata: NftMetadata;
      try {
        metadata = await fetchNftMetadata(uri, `Profile NFT #${lookupId}`);
      } catch {
        metadata = {
          name: `Profile NFT #${lookupId}`,
          description: "The token exists on Sepolia. Its IPFS content could not be reached right now.",
          image: "",
        };
        setLookupStatus(`Token #${lookupId} is on Sepolia. IPFS is temporarily unavailable; showing its on-chain details.`);
      }
      setLookupResult({ tokenId: lookupId, uri, owner, metadata });
      setLookupStatus("");
    } catch {
      setLookupStatus("The token lookup could not be completed. Please try again.");
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <h1>Make my profile card</h1>
          <p>Pin a picture and bio to IPFS, then mint through a smart account while Pimlico pays the Sepolia fee.</p>
        </div>
        <span className="network-stamp">Mints on Sepolia</span>
      </header>

      <div className="mint-layout">
        <section className="folio-panel mint-panel" aria-labelledby="mint-heading">
          <div className="section-heading-row">
            <div><h2 id="mint-heading">Create your card</h2><p className="section-copy">Your picture uploads only when you press mint. Your wallet signs, but pays no gas.</p></div>
            <span className={chainId === sepolia.id ? "network-ready" : "network-waiting"}>{chainId === sepolia.id ? "Sepolia ready" : "Sepolia required"}</span>
          </div>

          <ol className="stage-rail" aria-label="Mint progress">
            {steps.map((item, index) => (
              <li key={item.key} className={index < activeIndex || step === "complete" ? "is-done" : index === activeIndex ? "is-active" : ""}>
                <span>{index + 1}</span>{item.label}
              </li>
            ))}
          </ol>

          <form className="profile-form" onSubmit={mint}>
            <div className="field-group">
              <label htmlFor="profile-name">Profile name</label>
              <input id="profile-name" className="text-field" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Builder" required />
              <span className="field-count">{name.length}/80</span>
            </div>

            <div className="field-group">
              <label htmlFor="profile-bio">Short bio</label>
              <textarea id="profile-bio" className="text-field" rows={4} maxLength={280} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Builder, student, and lifelong learner exploring onchain identity." required />
              <span className="field-count">{bio.length}/280</span>
            </div>

            <div className="image-field">
              <div>
                <label htmlFor="profile-image">Profile picture</label>
                <label className="file-drop" htmlFor="profile-image">
                  <strong>{image ? image.name : "Choose an image"}</strong>
                  <span>PNG, JPG, WebP, or GIF · 5 MB maximum</span>
                </label>
                <input id="profile-image" className="visually-hidden" type="file" accept={IMAGE_TYPES.join(",")} onChange={chooseImage} />
                {imageError && <p className="error-message" role="alert">{imageError}</p>}
              </div>
              <div className="image-preview" aria-label="Profile picture preview">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Selected profile preview" />
                ) : <span>Preview</span>}
              </div>
            </div>

            <div className="mint-actions">
              {!isConnected && <p>Connect your wallet in the header to mint.</p>}
              {isConnected && chainId !== sepolia.id && <p>Your wallet will ask to switch to Sepolia before the gasless mint.</p>}
              <button className="primary-button mint-button" disabled={!isConnected || !image || !name.trim() || !bio.trim() || isBusy || Boolean(submittedHash) || Boolean(submittedUserOp)}>
                {step === "uploading" && "Uploading to IPFS…"}
                {step === "wallet" && "Confirm in your wallet…"}
                {step === "confirming" && "Waiting for confirmation…"}
                {(step === "idle" || step === "complete") && "Upload and mint gasless"}
              </button>
            </div>
            {(submittedUserOp || submittedHash) && !result && (
              <div className="submitted-box" role="status">
                <strong>Gasless mint submitted</strong>
                <p>{mintNotice}</p>
                <div className="submitted-actions">
                  <button className="secondary-button" type="button" disabled={step === "confirming"} onClick={() => submittedHash ? confirmMint(submittedHash, submittedMetadata) : submittedUserOp && confirmUserOperation(submittedUserOp, submittedMetadata)}>
                    {step === "confirming" ? "Checking…" : "Check confirmation"}
                  </button>
                  {submittedHash && <a href={`https://sepolia.etherscan.io/tx/${submittedHash}`} target="_blank" rel="noreferrer">View on Etherscan ↗</a>}
                </div>
              </div>
            )}
            {mintError && <div className="error-box" role="alert"><strong>Mint not completed</strong><p>{mintError}</p></div>}
          </form>
        </section>

        <aside className="preview-column">
          {result ? <ProfileResult result={result} /> : (
            <div className="profile-preview-card">
              <div className="preview-image-large">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Profile card preview" />
                ) : <span>Your image</span>}
              </div>
              <span className="token-label">Web3Bridge Class · Preview</span>
              <h2>{name || "Your profile name"}</h2>
              <p>{bio || "Your short bio will appear here before you mint."}</p>
              <div className="preview-owner"><span>Owner</span><strong>{address ? "Your smart account" : "Connect wallet"}</strong></div>
            </div>
          )}
        </aside>
      </div>

      <section className="lookup-section" aria-labelledby="lookup-heading">
        <div>
          <h2 id="lookup-heading">View an existing profile NFT</h2>
          <p>Read any ClassNFT again after reloading this page. No wallet connection is needed.</p>
        </div>
        <form className="token-lookup" onSubmit={loadToken}>
          <label htmlFor="token-id">Token ID</label>
          <div className="input-action compact-input">
            <input id="token-id" className="text-field" inputMode="numeric" value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="0" />
            <button className="secondary-button">Load profile</button>
          </div>
          {lookupStatus && <p className="field-help" role="status">{lookupStatus}</p>}
        </form>
      </section>

      <section className="my-nfts-section" aria-labelledby="my-nfts-heading">
        <div className="my-nfts-heading">
          <div>
            <h2 id="my-nfts-heading">My profile NFTs</h2>
            <p>{myNftsStatus}</p>
          </div>
          {address && <button className="secondary-button" type="button" onClick={() => setMyNftsReload((value) => value + 1)}>Refresh</button>}
        </div>
        {myNfts.length > 0 && <div className="my-nfts-grid">{myNfts.map((nft) => <ProfileResult key={nft.tokenId} result={nft} />)}</div>}
      </section>

      {lookupResult && <ProfileResult result={lookupResult} />}
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { formatEther } from "viem";
import { normalize } from "viem/ens";
import { useBalance, useEnsAddress, useEnsAvatar, useEnsName, useEnsText } from "wagmi";
import { mainnet } from "wagmi/chains";
import { PricePanel } from "@/components/PricePanel";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { ethBalanceToUsd } from "@/lib/chainlink";

function normalizeEns(input: string) {
  try {
    const value = input.trim().toLowerCase();
    return value.endsWith(".eth") ? normalize(value) : undefined;
  } catch {
    return undefined;
  }
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function EnsPage() {
  const [input, setInput] = useState("vitalik.eth");
  const [searchedName, setSearchedName] = useState(normalizeEns("vitalik.eth"));
  const [formError, setFormError] = useState("");
  const price = useEthUsdPrice();

  function search(event: FormEvent) {
    event.preventDefault();
    const validName = normalizeEns(input);
    if (!validName) {
      setFormError("Enter a valid .eth name, such as vitalik.eth.");
      setSearchedName(undefined);
      return;
    }
    setFormError("");
    setSearchedName(validName);
  }

  const addressQuery = useEnsAddress({ name: searchedName, chainId: mainnet.id, query: { retry: 1 } });
  const resolved = addressQuery.data ?? undefined;
  const avatarQuery = useEnsAvatar({ name: searchedName, chainId: mainnet.id, query: { enabled: Boolean(resolved), retry: 1 } });
  const descriptionQuery = useEnsText({ name: searchedName, key: "description", chainId: mainnet.id, query: { enabled: Boolean(resolved), retry: 1 } });
  const twitterQuery = useEnsText({ name: searchedName, key: "com.twitter", chainId: mainnet.id, query: { enabled: Boolean(resolved), retry: 1 } });
  const reverseQuery = useEnsName({ address: resolved, chainId: mainnet.id, query: { enabled: Boolean(resolved), retry: 1 } });
  const balanceQuery = useBalance({ address: resolved, chainId: mainnet.id, query: { enabled: Boolean(resolved), retry: 1 } });

  const lookupFailed = addressQuery.isError || balanceQuery.isError;
  const balanceUsd =
    balanceQuery.data && price.status === "ready" && !price.isStale
      ? ethBalanceToUsd(balanceQuery.data.value, price.priceUsd)
      : undefined;
  const twitter = twitterQuery.data?.replace(/^@/, "");

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <h1>Find an ENS profile</h1>
          <p>Resolve public identity on Ethereum mainnet, then value its ETH balance with the live Sepolia Chainlink feed.</p>
        </div>
        <span className="network-stamp">Reads mainnet · no wallet needed</span>
      </header>

      <div className="ens-layout">
        <section className="folio-panel search-panel" aria-labelledby="ens-search-heading">
          <h2 id="ens-search-heading">Search by name</h2>
          <p className="section-copy">ENS records are public. Searching will never ask you to change networks or sign a transaction.</p>

          <form className="search-form" onSubmit={search} noValidate>
            <label htmlFor="ens-name">ENS name</label>
            <div className="input-action">
              <input
                id="ens-name"
                className="text-field"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="name.eth"
                autoComplete="off"
                aria-describedby={formError ? "ens-error" : "ens-help"}
              />
              <button className="primary-button" disabled={addressQuery.isPending}>
                {addressQuery.isPending ? "Resolving…" : "Look up"}
              </button>
            </div>
            <p id="ens-help" className="field-help">Try vitalik.eth or another name you know.</p>
            {formError && <p id="ens-error" className="error-message" role="alert">{formError}</p>}
          </form>

          {addressQuery.isPending && (
            <div className="profile-skeleton" aria-label="Loading ENS profile">
              <span /><div><span /><span /><span /></div>
            </div>
          )}

          {lookupFailed && (
            <div className="error-box" role="alert">
              <strong>We could not complete this lookup.</strong>
              <p>Check your connection and try the name again.</p>
            </div>
          )}

          {searchedName && !addressQuery.isPending && !lookupFailed && !resolved && (
            <div className="empty-box">
              <strong>No address is set for {searchedName}.</strong>
              <p>The name exists as text, but it cannot be used as a wallet identity until an address record is added.</p>
            </div>
          )}

          {resolved && !lookupFailed && (
            <article className="identity-plate">
              <div className="identity-topline">
                <div className="avatar-wrap">
                  {avatarQuery.data ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarQuery.data} alt={`${searchedName} ENS avatar`} />
                  ) : (
                    <span aria-hidden="true">{searchedName?.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="identity-title">
                  <span className="verified-label"><i /> Resolved on mainnet</span>
                  <h2>{reverseQuery.data ?? searchedName}</h2>
                  <p title={resolved}>{shortAddress(resolved)}</p>
                </div>
              </div>

              <dl className="identity-records">
                <div>
                  <dt>Resolved address</dt>
                  <dd>{resolved}</dd>
                </div>
                <div>
                  <dt>Description</dt>
                  <dd>{descriptionQuery.data || "No description record"}</dd>
                </div>
                <div>
                  <dt>Twitter</dt>
                  <dd>{twitter ? <a href={`https://x.com/${encodeURIComponent(twitter)}`} target="_blank" rel="noreferrer">@{twitter} ↗</a> : "No Twitter record"}</dd>
                </div>
              </dl>

              <div className="balance-band">
                <div>
                  <span>Mainnet balance</span>
                  <strong>{balanceQuery.data ? `${Number(formatEther(balanceQuery.data.value)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH` : "—"}</strong>
                </div>
                <div>
                  <span>Approximate USD</span>
                  <strong>{balanceUsd === undefined ? "Unavailable" : `$${balanceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</strong>
                </div>
              </div>
              <p className="plate-note">USD uses the Sepolia Chainlink ETH/USD answer shown beside this profile.</p>
            </article>
          )}
        </section>

        <aside className="price-column">
          <PricePanel />
          <div className="plain-note">
            <h2>Two networks, one view</h2>
            <p>ENS identity and balance come from Ethereum mainnet. The classroom price exercise reads Chainlink on Sepolia. Both are read-only.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

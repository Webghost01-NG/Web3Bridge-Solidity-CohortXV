"use client";

import { formatAge } from "@/lib/chainlink";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";

export function PricePanel({ compact = false }: { compact?: boolean }) {
  const price = useEthUsdPrice();

  if (compact) {
    return (
      <div className="price-compact" aria-live="polite">
        <span className={`status-dot ${price.status === "ready" && !price.isStale ? "is-live" : "is-warning"}`} />
        <span>ETH / USD</span>
        <strong>{price.status === "ready" ? `$${price.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</strong>
      </div>
    );
  }

  return (
    <section className="price-panel" aria-labelledby="price-heading" aria-live="polite">
      <div>
        <h2 id="price-heading">Live ETH / USD</h2>
        <p>Chainlink price feed · Sepolia</p>
      </div>

      {price.status === "loading" && <p className="state-copy">Reading the latest onchain answer…</p>}

      {price.status === "error" && (
        <div className="price-warning">
          <p>{price.message}</p>
          <button type="button" className="text-button" onClick={() => void price.refresh()}>Try again</button>
        </div>
      )}

      {price.status === "ready" && (
        <div className="price-readings">
          <div>
            <span>Price</span>
            <strong>${price.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div>
            <span>Onchain update</span>
            <strong>{formatAge(price.ageSeconds)}</strong>
          </div>
          <div>
            <span>Last frontend poll</span>
            <strong>{new Date(price.polledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong className={price.isStale ? "warning-text" : "live-text"}>{price.isStale ? "Stale" : "Healthy"}</strong>
          </div>
        </div>
      )}

      {price.status === "ready" && price.isStale && (
        <p className="price-warning">This answer is more than two hours old, so USD estimates are paused.</p>
      )}
    </section>
  );
}

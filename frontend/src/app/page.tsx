import Link from "next/link";
import { PricePanel } from "@/components/PricePanel";

export default function Home() {
  return (
    <div className="home-page">
      <section className="home-intro">
        <div>
          <h1>One identity, from ENS to IPFS.</h1>
          <p>Look up a public Ethereum profile, see its live value, or make a profile card NFT backed by real IPFS metadata.</p>
        </div>
        <div className="intro-actions">
          <Link className="primary-button" href="/ens">Find an ENS profile</Link>
          <Link className="secondary-button" href="/nft">Make my profile card</Link>
        </div>
      </section>

      <div className="journey-grid">
        <Link href="/ens" className="journey-panel">
          <span className="journey-network">Ethereum mainnet</span>
          <h2>Find an ENS profile</h2>
          <p>Resolve an address, avatar, description, Twitter record, and ETH balance without connecting a wallet.</p>
          <strong>Start a lookup <span aria-hidden="true">→</span></strong>
        </Link>

        <Link href="/nft" className="journey-panel journey-panel-dark">
          <span className="journey-network">Ethereum Sepolia</span>
          <h2>Make my profile card</h2>
          <p>Upload a picture and metadata to IPFS, switch networks, mint, then read the real profile back from the chain.</p>
          <strong>Create a card <span aria-hidden="true">→</span></strong>
        </Link>
      </div>

      <PricePanel />

      <section className="how-it-works" aria-labelledby="how-heading">
        <div><h2 id="how-heading">Built from public proofs</h2><p>Each part comes from a source you can inspect.</p></div>
        <dl>
          <div><dt>ENS</dt><dd>Mainnet identity records and reverse names.</dd></div>
          <div><dt>Chainlink</dt><dd>Sepolia ETH/USD answer, decimals, and update time.</dd></div>
          <div><dt>IPFS</dt><dd>Content-addressed image and metadata CIDs.</dd></div>
          <div><dt>ClassNFT</dt><dd>A verified Sepolia ERC-721 storing the IPFS URI.</dd></div>
        </dl>
      </section>
    </div>
  );
}

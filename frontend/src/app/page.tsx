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

      <section className="explore-section" aria-labelledby="explore-heading">
        <div className="explore-heading">
          <h2 id="explore-heading">Explore the app</h2>
          <p>Four ways to explore identity, create, and follow profile NFTs.</p>
        </div>

        <div className="journey-grid">
          <Link href="/ens" className="journey-panel">
            <span className="journey-network">Ethereum mainnet</span>
            <h3>Find an ENS profile</h3>
            <p>Look up an ENS name, its public profile, and its ETH balance without connecting a wallet.</p>
            <strong>Start a lookup <span aria-hidden="true">→</span></strong>
          </Link>

          <Link href="/nft" className="journey-panel journey-panel-dark">
            <span className="journey-network">Ethereum Sepolia</span>
            <h3>Make my profile card</h3>
            <p>Upload a picture and metadata to IPFS, mint your NFT, then read the profile back from the chain.</p>
            <strong>Create a card <span aria-hidden="true">→</span></strong>
          </Link>

          <Link href="/aa" className="journey-panel journey-panel-feature">
            <span className="journey-network">Pimlico · Sepolia</span>
            <h3>Try a gasless mint</h3>
            <p>Send two profile mints in one smart-account operation, sponsored by a paymaster.</p>
            <strong>Open gasless mint <span aria-hidden="true">→</span></strong>
          </Link>

          <Link href="/notifications" className="journey-panel journey-panel-feature">
            <span className="journey-network">Live on Sepolia</span>
            <h3>Follow live mints</h3>
            <p>Watch new profile mints, see recipient ENS names, and enable browser alerts while the page is open.</p>
            <strong>View live alerts <span aria-hidden="true">→</span></strong>
          </Link>
        </div>
      </section>

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

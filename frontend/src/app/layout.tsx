import "./globals.css";
import type { Metadata } from "next";
import { Alegreya_Sans } from "next/font/google";
import { Providers } from "./Providers";
import { Nav } from "../components/Nav";

const alegreya = Alegreya_Sans({
  subsets: ["latin"],
  variable: "--font-alegreya",
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "Profile Card", template: "%s · Profile Card" },
  description: "Look up ENS profiles and mint an IPFS-backed profile card NFT on Sepolia.",
};

// Every page of the app is drawn inside this layout
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={alegreya.variable}>
        <Providers>
          <Nav />
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <p>Built for Web3Bridge Solidity Cohort XV.</p>
            <div>
              <a href="https://docs.chain.link/data-feeds/api-reference" target="_blank" rel="noreferrer">Chainlink feed docs ↗</a>
              <a href="https://sepolia.etherscan.io/address/0x39d7712A2E18d4c0597E849Cb9dc6869F6996639#code" target="_blank" rel="noreferrer">Verified contract ↗</a>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

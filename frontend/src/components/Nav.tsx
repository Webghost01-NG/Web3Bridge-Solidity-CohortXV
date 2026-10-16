"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";
import { PricePanel } from "./PricePanel";

const links = [
  ["/", "Overview"],
  ["/ens", "ENS profile"],
  ["/nft", "Create card"],
  ["/aa", "Gasless mint"],
  ["/notifications", "Live alerts"],
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link href="/" className="brand" aria-label="Profile Card home">
          <span className="brand-mark">PC</span>
          <span><strong>Profile Card</strong><small>Web3Bridge Class</small></span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={pathname === href ? "is-active" : undefined}>
              {label}
            </Link>
          ))}
          <a href="https://sepolia.etherscan.io/address/0x39d7712A2E18d4c0597E849Cb9dc6869F6996639#code" target="_blank" rel="noreferrer">
            Contract <span aria-hidden="true">↗</span>
          </a>
        </nav>

        <div className="nav-tools">
          <PricePanel compact />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

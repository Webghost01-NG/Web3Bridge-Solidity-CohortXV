# Profile Card

A Web3Bridge Day 3 dApp for finding ENS profiles and minting profile cards as NFTs.

Live site: https://profile-card-web3bridge.vercel.app

## Features

- Resolves ENS names, avatars, descriptions, Twitter records, and ETH balances on Ethereum mainnet.
- Reads the live ETH/USD price from Chainlink on Sepolia and refreshes it every 30 seconds.
- Uploads profile pictures and NFT metadata to Pinata/IPFS through a server route.
- Mints and reads profile NFTs from the verified ClassNFT contract on Sepolia.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set these variables in `.env.local`:

```env
PINATA_JWT=
NEXT_PUBLIC_NFT_ADDRESS=0x39d7712A2E18d4c0597E849Cb9dc6869F6996639
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_MAINNET_RPC_URL=
```

The Pinata JWT stays in the server upload route because it authorizes uploads to the Pinata account. The browser must never receive it, since anyone could copy it and use the account. A variable prefixed with `NEXT_PUBLIC_` is included in the client bundle and becomes visible to visitors. A server-only environment variable keeps the JWT away from the browser while still allowing the upload route to use it.

## Contracts and networks

- ENS lookup and wallet balances use Ethereum mainnet.
- NFT minting uses the verified [ClassNFT contract on Sepolia](https://sepolia.etherscan.io/address/0x39d7712A2E18d4c0597E849Cb9dc6869F6996639#code).
- ETH/USD pricing uses the [Chainlink Sepolia feed](https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306).

To make a card, connect a wallet, choose a picture, enter a name and bio, and press **Upload & mint**. The app asks the wallet to switch to Sepolia if needed, uploads the picture and metadata to IPFS, then displays the confirmed token and transaction link.

## Checks

```bash
npm run test
npm run lint
npm run build
```

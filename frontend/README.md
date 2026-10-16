# Profile Card

A Web3Bridge dApp for ENS profiles, IPFS profile NFTs, gasless smart-account minting, and live mint alerts.

Live site: https://profile-card-web3bridge.vercel.app

## Features

- Resolves ENS names, avatars, descriptions, Twitter records, and ETH balances on Ethereum mainnet.
- Reads the live ETH/USD price from Chainlink on Sepolia and refreshes it every 30 seconds.
- Uploads profile pictures and NFT metadata to Pinata/IPFS through a server route.
- Mints and reads profile NFTs from the verified ClassNFT contract on Sepolia.
- Sends two NFT mint calls in one ERC-4337 UserOperation through Pimlico.
- Shows new `Minted` events live with ENS names and browser pop-ups.
- Includes an always-on Telegram listener and an optional Push Protocol inbox.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set these variables in `.env.local`:

```env
PINATA_JWT=
PIMLICO_API_KEY=
NEXT_PUBLIC_NFT_ADDRESS=0x39d7712A2E18d4c0597E849Cb9dc6869F6996639
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_MAINNET_RPC_URL=
NEXT_PUBLIC_PUSH_CHANNEL=eip155:11155111:0xYourPushChannelAddress
```

The Pinata JWT stays in the server upload route because it authorizes uploads to the Pinata account. The browser must never receive it, since anyone could copy it and use the account. A variable prefixed with `NEXT_PUBLIC_` is included in the client bundle and becomes visible to visitors. A server-only environment variable keeps the JWT away from the browser while still allowing the upload route to use it.

## Contracts and networks

- ENS lookup and wallet balances use Ethereum mainnet.
- NFT minting uses the verified [ClassNFT contract on Sepolia](https://sepolia.etherscan.io/address/0x39d7712A2E18d4c0597E849Cb9dc6869F6996639#code).
- ETH/USD pricing uses the [Chainlink Sepolia feed](https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306).

To make a card, connect a wallet, choose a picture, enter a name and bio, and press **Upload & mint**. The app asks the wallet to switch to Sepolia if needed, uploads the picture and metadata to IPFS, then displays the confirmed token and transaction link.

## Day 4: gasless batch

Open `/aa`, connect a wallet, and paste an `ipfs://` metadata URI. One wallet signature sends two `ClassNFT.mint(uri)` calls inside one UserOperation; Pimlico's paymaster sponsors the gas.

`PIMLICO_API_KEY` stays in Vercel's server-only environment and is used only by `/api/bundler`; it is never exposed through a `NEXT_PUBLIC_` variable.

UserOperation Etherscan transaction: pending the first live sponsored batch.

On Etherscan, the outer transaction's **From** is Pimlico's bundler, and **To** is the ERC-4337 EntryPoint contract. The bundler submits the transaction, while Pimlico's paymaster deposit covers the UserOperation gas; the smart account is visible inside the EntryPoint event and internal execution.

## Day 4: alerts

The `/notifications` page listens for `Minted` events only while the page is open, because the listener runs inside the browser. A real product would run the same listener on an always-on server, store its last processed block, and deliver notifications even when no user has the site open.

For the Telegram listener, create an ignored `.env.listener.local` file:

```env
NEXT_PUBLIC_NFT_ADDRESS=0x39d7712A2E18d4c0597E849Cb9dc6869F6996639
NEXT_PUBLIC_SEPOLIA_RPC_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
PUSH_CHANNEL_PRIVATE_KEY=
```

Run it with `npm run listener`. It writes its last handled Sepolia block to `.listener/last-block.json`, so restarting it does not replay completed blocks. `PUSH_CHANNEL_PRIVATE_KEY` is optional and must belong to a Push staging channel or its delegate; never commit it.

## Foundry batch test

`MinimalAccount.executeBatch` checks that all three arrays have the same length, then executes each call in order. The focused tests send one signed UserOperation through a real local EntryPoint, call `Target.setNumber(1)` and `Target.setNumber(2)`, and reject mismatched arrays and a wrong signature.

```bash
cd ../contracts
forge test --match-contract MinimalAccountTest
```

## Checks

```bash
npm run test
npm run lint
npm run build
```

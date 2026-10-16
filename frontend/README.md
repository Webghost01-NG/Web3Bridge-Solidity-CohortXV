# Profile Card

A Web3Bridge dApp for ENS profiles, IPFS profile NFTs, gasless smart-account minting, and live mint alerts.

Live site: https://profile-card-web3bridge.vercel.app

## Features

- Resolves ENS names, avatars, descriptions, Twitter records, and ETH balances on Ethereum mainnet.
- Reads the live ETH/USD price from Chainlink on Sepolia and refreshes it every 30 seconds.
- Uploads profile pictures and NFT metadata to Pinata/IPFS through a server route.
- Mints profile NFTs through a sponsored smart account and reads them from the verified ClassNFT contract on Sepolia.
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

To make a card, connect a wallet, choose a picture, enter a name and bio, and press **Upload and mint gasless**. The app uploads the picture and metadata to IPFS, asks for one wallet signature, and Pimlico sponsors the Sepolia mint. The confirmed NFT belongs to the user's smart account.

## Day 4: gasless batch

Open `/aa`, connect a wallet, and paste an `ipfs://` metadata URI. One wallet signature sends two `ClassNFT.mint(uri)` calls inside one UserOperation; Pimlico's paymaster sponsors the gas.

`PIMLICO_API_KEY` stays in Vercel's server-only environment and is used only by `/api/bundler`; it is never exposed through a `NEXT_PUBLIC_` variable.

Sponsored UserOperation: [`0xb50d…a5cd`](https://sepolia.etherscan.io/tx/0x1f8d54285d6fc9af27ca7a858a21a55aa50b5283c002cbadf8d1f32255096614). It minted tokens `#22` and `#23` to smart account `0xb9C959F7510a9d12Aee568D8cCE1591e051Fe9eb` in one operation.

On Etherscan, **From** is Pimlico's bundler `0x4337005dB25dBad41da5692Ba1188751ee5D98B6`, and **To** is EntryPoint v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37dA032`. The bundler submitted the transaction, while Pimlico paymaster `0x777777777777AeC03fd955926DbF81597e66834C` covered the UserOperation gas from its deposit.

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

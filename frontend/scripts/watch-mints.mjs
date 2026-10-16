import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createPublicClient, http, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";

const required = ["NEXT_PUBLIC_NFT_ADDRESS", "NEXT_PUBLIC_SEPOLIA_RPC_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const contract = process.env.NEXT_PUBLIC_NFT_ADDRESS;
const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const statePath = resolve(process.env.LISTENER_STATE_FILE ?? ".listener/last-block.json");
const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
const mintedEvent = parseAbiItem("event Minted(address indexed to, uint256 indexed tokenId, string uri)");

async function readLastBlock() {
  try {
    return BigInt(JSON.parse(await readFile(statePath, "utf8")).lastBlock);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return await client.getBlockNumber();
  }
}

async function saveLastBlock(lastBlock) {
  await mkdir(dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ lastBlock: lastBlock.toString() })}\n`, "utf8");
  await rename(temporaryPath, statePath);
}

async function sendTelegram(log) {
  const text = [
    `ClassNFT #${log.args.tokenId} minted`,
    `Owner: ${log.args.to}`,
    `Transaction: https://sepolia.etherscan.io/tx/${log.transactionHash}`,
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`Telegram returned HTTP ${response.status}`);
}

async function sendPush(log) {
  if (!process.env.PUSH_CHANNEL_PRIVATE_KEY) return;

  const [{ PushAPI, CONSTANTS }, { ethers }] = await Promise.all([
    import("@pushprotocol/restapi"),
    import("ethers"),
  ]);
  const signer = new ethers.Wallet(process.env.PUSH_CHANNEL_PRIVATE_KEY);
  const push = await PushAPI.initialize(signer, { env: CONSTANTS.ENV.STAGING });
  await push.channel.send([log.args.to], {
    notification: {
      title: `Profile NFT #${log.args.tokenId} minted`,
      body: `Your ClassNFT was confirmed on Sepolia. Transaction ${log.transactionHash}`,
    },
  });
}

async function poll() {
  let lastBlock = await readLastBlock();
  console.log(`Watching ClassNFT from Sepolia block ${lastBlock + 1n}`);

  for (;;) {
    try {
      const latestBlock = await client.getBlockNumber();
      if (latestBlock > lastBlock) {
        const logs = await client.getLogs({
          address: contract,
          event: mintedEvent,
          fromBlock: lastBlock + 1n,
          toBlock: latestBlock,
        });

        for (const log of logs) {
          await sendTelegram(log);
          await sendPush(log);
        }

        await saveLastBlock(latestBlock);
        lastBlock = latestBlock;
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Listener failed");
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 12_000));
  }
}

await poll();

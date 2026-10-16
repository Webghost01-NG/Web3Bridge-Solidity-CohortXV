import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createPublicClient, http, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";

const required = ["NEXT_PUBLIC_NFT_ADDRESS", "TELEGRAM_BOT_TOKEN"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const contract = process.env.NEXT_PUBLIC_NFT_ADDRESS;
const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const statePath = resolve(process.env.LISTENER_STATE_FILE ?? ".listener/last-block.json");
const subscriberPath = resolve(".listener/telegram-subscribers.json");
const updatePath = resolve(".listener/telegram-update-offset.json");
const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
const mintedEvent = parseAbiItem("event Minted(address indexed to, uint256 indexed tokenId, string uri)");

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function telegram(method, body) {
  const response = await fetch(`${telegramUrl}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(`Telegram ${method} request failed`);
  return result.result;
}

async function readSubscribers() {
  const subscribers = await readJson(subscriberPath, []);
  const initialChatId = process.env.TELEGRAM_CHAT_ID;
  if (initialChatId && !subscribers.includes(String(initialChatId))) {
    subscribers.push(String(initialChatId));
    await writeJson(subscriberPath, subscribers);
  }
  return subscribers;
}

async function sendToChat(chatId, text) {
  await telegram("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}

async function pollTelegramCommands() {
  let { offset = 0 } = await readJson(updatePath, {});
  const updates = await telegram("getUpdates", { offset, timeout: 0, allowed_updates: ["message"] });
  for (const update of updates) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() ?? "";
    const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();
    let subscribers = await readSubscribers();

    if (chatId && command === "/start") {
      const id = String(chatId);
      if (!subscribers.includes(id)) {
        subscribers.push(id);
        await writeJson(subscriberPath, subscribers);
      }
      await sendToChat(id, "You are subscribed to ClassNFT mint alerts. Send /stop to unsubscribe.");
    } else if (chatId && command === "/stop") {
      const id = String(chatId);
      subscribers = subscribers.filter((subscriber) => subscriber !== id);
      await writeJson(subscriberPath, subscribers);
      await sendToChat(id, "You are unsubscribed from ClassNFT mint alerts. Send /start to subscribe again.");
    }

    offset = update.update_id + 1;
    await writeJson(updatePath, { offset });
  }
}

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

  const subscribers = await readSubscribers();
  for (const chatId of subscribers) {
    try {
      await sendToChat(chatId, text);
    } catch {
      console.error("Could not send a mint alert to one Telegram subscriber.");
    }
  }
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
      await pollTelegramCommands();
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
    } catch {
      console.error("Telegram or Sepolia polling failed; the listener will retry.");
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 12_000));
  }
}

await poll();

"use client";

import { useRef, useState } from "react";
import { useAccount, useWatchContractEvent } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { sepolia } from "wagmi/chains";
import type { PushAPI } from "@pushprotocol/restapi";
import { config } from "@/lib/wagmi";
import { NFT_ADDRESS, nftAbi } from "@/contracts/nft";
import { Who } from "@/components/Who";

const pushChannel = process.env.NEXT_PUBLIC_PUSH_CHANNEL ?? "";

type Alert = { id: string; tokenId: string; to: `0x${string}`; tx: `0x${string}` };
type PushNote = { title: string; message: string };

function friendlyPushError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("reject") || message.includes("denied")) return "The Push sign-in request was cancelled.";
  return "Push Protocol could not complete that request. Please try again.";
}

export default function NotificationsPage() {
  const { isConnected } = useAccount();
  const seenLogs = useRef(new Set<string>());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [listenerStatus, setListenerStatus] = useState("Listening for new ClassNFT mints on Sepolia…");
  const [permission, setPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  useWatchContractEvent({
    address: NFT_ADDRESS,
    abi: nftAbi,
    eventName: "Minted",
    chainId: sepolia.id,
    pollingInterval: 4_000,
    onLogs(logs) {
      const freshAlerts: Alert[] = [];
      for (const log of logs) {
        if (!log.transactionHash || log.logIndex === null || !log.args.to || log.args.tokenId === undefined) continue;
        const id = `${log.transactionHash}-${log.logIndex}`;
        if (seenLogs.current.has(id)) continue;
        seenLogs.current.add(id);
        const alert = { id, tokenId: log.args.tokenId.toString(), to: log.args.to, tx: log.transactionHash };
        freshAlerts.push(alert);

        if (Notification.permission === "granted") {
          new Notification(`Profile NFT #${alert.tokenId} minted`, {
            body: `Recipient ${alert.to.slice(0, 8)}…${alert.to.slice(-4)}`,
            tag: id,
          });
        }
      }

      if (freshAlerts.length) {
        setAlerts((current) => [...freshAlerts.reverse(), ...current].slice(0, 30));
        setListenerStatus(`Received ${freshAlerts.length} new mint event${freshAlerts.length === 1 ? "" : "s"}.`);
      }
    },
    onError() {
      setListenerStatus("The Sepolia listener lost connection. It will keep trying while this page stays open.");
    },
  });

  async function allowBrowserAlerts() {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  }

  const [push, setPush] = useState<PushAPI | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [inbox, setInbox] = useState<PushNote[]>([]);
  const [channelNews, setChannelNews] = useState<PushNote[]>([]);
  const [pushStatus, setPushStatus] = useState(pushChannel ? "Connect to read your Push inbox." : "A Push staging channel has not been configured yet.");

  async function refreshPush(user = push) {
    if (!user || !pushChannel) return;
    const mine = await user.notification.list("INBOX", { limit: 8 });
    setInbox(mine.map((note: { title: string; message: string }) => ({ title: note.title, message: note.message })));
    const channel = await user.channel.notifications(pushChannel, { limit: 5 });
    setChannelNews(channel.notifications.map((note: { notification: { title: string; body: string } }) => ({
      title: note.notification.title,
      message: note.notification.body,
    })));
  }

  async function signInToPush() {
    if (!pushChannel) return;
    try {
      setPushStatus("Sign the Push Protocol message in your wallet…");
      const { PushAPI: PushClient, CONSTANTS } = await import("@pushprotocol/restapi");
      const walletClient = await getWalletClient(config);
      if (!walletClient) throw new Error("wallet not connected");
      const user = await PushClient.initialize(walletClient, { env: CONSTANTS.ENV.STAGING });
      setPush(user);

      const subscriptions = await user.notification.subscriptions();
      const channelAddress = pushChannel.split(":").at(-1)?.toLowerCase();
      setSubscribed(subscriptions.some((subscription: { channel: string }) => subscription.channel.toLowerCase() === channelAddress));
      await refreshPush(user);
      setPushStatus("Push inbox ready.");
    } catch (error) {
      setPushStatus(friendlyPushError(error));
    }
  }

  async function subscribeToPush() {
    if (!push || !pushChannel) return;
    try {
      setPushStatus("Confirm the free channel subscription…");
      await push.notification.subscribe(pushChannel);
      setSubscribed(true);
      setPushStatus("Subscribed. New channel messages will appear in your Push inbox.");
    } catch (error) {
      setPushStatus(friendlyPushError(error));
    }
  }

  return (
    <div className="page-stack alerts-page">
      <header className="page-heading">
        <div>
          <h1>See every profile mint live.</h1>
          <p>This page watches the ClassNFT event stream, resolves recipient identities through ENS, and raises browser alerts as new mints arrive.</p>
        </div>
        <span className="network-stamp"><i className="live-pulse" /> Listening on Sepolia</span>
      </header>

      <section className="listener-panel" aria-labelledby="live-heading">
        <div className="listener-intro">
          <div>
            <h2 id="live-heading">Live mint feed</h2>
            <p>{listenerStatus}</p>
          </div>
          {permission !== "granted" && permission !== "unsupported" && (
            <button className="secondary-button compact-button" onClick={allowBrowserAlerts}>Allow browser pop-ups</button>
          )}
          {permission === "granted" && <span className="permission-ok">Browser pop-ups on</span>}
        </div>

        {alerts.length === 0 ? (
          <div className="event-empty">
            <span className="listening-ring" aria-hidden="true" />
            <div><strong>Waiting for the next mint</strong><p>Keep this tab open, then mint from Create card or Gasless mint.</p></div>
          </div>
        ) : (
          <ol className="event-list">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <span className="event-token">#{alert.tokenId}</span>
                <div><strong>Minted to <Who address={alert.to} /></strong><small title={alert.to}>{alert.to}</small></div>
                <a href={`https://sepolia.etherscan.io/tx/${alert.tx}`} target="_blank" rel="noreferrer">Etherscan ↗</a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="push-section" aria-labelledby="push-heading">
        <div>
          <h2 id="push-heading">Push Protocol inbox</h2>
          <p>Subscribe to the project’s staging channel and read wallet-native notifications in the dApp.</p>
          <div className="push-actions">
            {!push && <button className="primary-button compact-button" disabled={!isConnected || !pushChannel} onClick={signInToPush}>Open my Push inbox</button>}
            {push && !subscribed && <button className="primary-button compact-button" onClick={subscribeToPush}>Subscribe to channel</button>}
            {push && <button className="secondary-button compact-button" onClick={() => refreshPush()}>Refresh inbox</button>}
          </div>
          <p className="field-help" aria-live="polite">{pushStatus}</p>
        </div>

        <div className="push-columns">
          <div>
            <h3>My inbox</h3>
            {inbox.length === 0 && <p className="push-empty">No inbox messages yet.</p>}
            {inbox.map((note, index) => <article key={`${note.title}-${index}`}><strong>{note.title}</strong><p>{note.message}</p></article>)}
          </div>
          <div>
            <h3>Channel updates</h3>
            {channelNews.length === 0 && <p className="push-empty">No channel updates loaded.</p>}
            {channelNews.map((note, index) => <article key={`${note.title}-${index}`}><strong>{note.title}</strong><p>{note.message}</p></article>)}
          </div>
        </div>
      </section>

      <aside className="listener-note">
        <strong>Why this page must stay open</strong>
        <p>The browser is doing the listening, so alerts stop when this tab closes. A real product would run the listener on an always-on server, save processed block numbers, and send notifications from there; the included Telegram listener demonstrates that pattern.</p>
      </aside>
    </div>
  );
}

import { NextResponse } from "next/server";

const allowedMethods = new Set([
  "eth_chainId",
  "eth_supportedEntryPoints",
  "eth_estimateUserOperationGas",
  "eth_sendUserOperation",
  "eth_getUserOperationByHash",
  "eth_getUserOperationReceipt",
  "pimlico_getUserOperationGasPrice",
  "pm_getPaymasterStubData",
  "pm_getPaymasterData",
  "pm_sponsorUserOperation",
]);

export async function POST(request: Request) {
  const apiKey = process.env.PIMLICO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Pimlico is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (rawBody.length > 250_000) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  let body: { method?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON-RPC request." }, { status: 400 });
  }

  if (!body.method || !allowedMethods.has(body.method)) {
    return NextResponse.json({ error: "Unsupported RPC method." }, { status: 403 });
  }

  const response = await fetch(`https://api.pimlico.io/v2/11155111/rpc?apikey=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody,
    cache: "no-store",
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}


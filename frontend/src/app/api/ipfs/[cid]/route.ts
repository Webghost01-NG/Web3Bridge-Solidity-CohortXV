import { NextResponse } from "next/server";

const gateways = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
];

export async function GET(_request: Request, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  if (!/^[a-zA-Z0-9]{20,100}$/.test(cid)) {
    return NextResponse.json({ error: "Invalid IPFS content ID." }, { status: 400 });
  }

  const results = await Promise.allSettled(gateways.map(async (gateway) => {
    const response = await fetch(`${gateway}${cid}`, {
      cache: "force-cache",
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("IPFS gateway unavailable");
    return response;
  }));

  const response = results.find((result) => result.status === "fulfilled");
  if (!response || response.status !== "fulfilled") {
    return NextResponse.json({ error: "This IPFS content is temporarily unavailable." }, { status: 502 });
  }

  return new Response(response.value.body, {
    headers: {
      "content-type": response.value.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      "x-content-type-options": "nosniff",
    },
  });
}

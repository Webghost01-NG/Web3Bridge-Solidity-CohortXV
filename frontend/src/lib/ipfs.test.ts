import assert from "node:assert/strict";
import test from "node:test";
import { fetchNftMetadata, ipfsToHttp } from "./ipfs.ts";

test("converts IPFS URIs to gateway URLs", () => {
  assert.equal(ipfsToHttp("ipfs://bafy123"), "https://gateway.pinata.cloud/ipfs/bafy123");
  assert.equal(ipfsToHttp("ipfs://ipfs/bafy123"), "https://gateway.pinata.cloud/ipfs/bafy123");
});

test("keeps ordinary HTTP URLs unchanged", () => {
  assert.equal(ipfsToHttp("https://example.com/image.png"), "https://example.com/image.png");
});

test("uses a direct IPFS image when an older token has no metadata JSON", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array([1]), {
    status: 200,
    headers: { "content-type": "image/png" },
  });

  try {
    assert.deepEqual(await fetchNftMetadata("ipfs://bafyimage", "Profile NFT #25"), {
      name: "Profile NFT #25",
      description: "This NFT stores its image directly on IPFS.",
      image: "ipfs://bafyimage",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

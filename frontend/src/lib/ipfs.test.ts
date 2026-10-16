import assert from "node:assert/strict";
import test from "node:test";
import { ipfsToHttp } from "./ipfs.ts";

test("converts IPFS URIs to gateway URLs", () => {
  assert.equal(ipfsToHttp("ipfs://bafy123"), "https://gateway.pinata.cloud/ipfs/bafy123");
  assert.equal(ipfsToHttp("ipfs://ipfs/bafy123"), "https://gateway.pinata.cloud/ipfs/bafy123");
});

test("keeps ordinary HTTP URLs unchanged", () => {
  assert.equal(ipfsToHttp("https://example.com/image.png"), "https://example.com/image.png");
});

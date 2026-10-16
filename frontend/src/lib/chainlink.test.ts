import assert from "node:assert/strict";
import test from "node:test";
import { ethBalanceToUsd, formatAge, parsePriceFeed } from "./chainlink.ts";

test("formats a valid Chainlink answer using its decimals", () => {
  const result = parsePriceFeed([12n, 250_000_000_000n, 0n, 9_900n, 12n], 8, 10_000);
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.priceUsd, 2_500);
    assert.equal(result.ageSeconds, 100);
    assert.equal(result.isStale, false);
  }
});
test("rejects non-positive and incomplete answers", () => {
  assert.equal(parsePriceFeed([1n, 0n, 0n, 1n, 1n], 8, 2).valid, false);
  assert.equal(parsePriceFeed([2n, 1n, 0n, 1n, 1n], 8, 2).valid, false);
});

test("converts ETH to USD and formats feed age", () => {
  assert.equal(ethBalanceToUsd(2_000_000_000_000_000_000n, 2_500), 5_000);
  assert.equal(formatAge(42), "42s ago");
  assert.equal(formatAge(3_661), "1h 1m ago");
});


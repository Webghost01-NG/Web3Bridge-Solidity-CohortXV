// The verified ClassNFT contract deployed for this assignment on Sepolia.
export const NFT_ADDRESS = process.env.NEXT_PUBLIC_NFT_ADDRESS as `0x${string}`;

// Only the parts of the ABI we use: two functions to read, one to write, one event
export const nftAbi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "uri", type: "string" }], outputs: [{ name: "tokenId", type: "uint256" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "totalMinted", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "event",
    name: "Minted",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "uri", type: "string", indexed: false },
    ],
  },
] as const;

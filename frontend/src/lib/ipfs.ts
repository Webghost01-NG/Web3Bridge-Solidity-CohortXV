export type NftMetadata = { name: string; description: string; image: string };

export function ipfsToHttp(uri: string) {
  if (!uri.startsWith("ipfs://")) return uri;
  return `https://gateway.pinata.cloud/ipfs/${uri.slice(7).replace(/^ipfs\//, "")}`;
}

export async function uploadToIpfs(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "The IPFS upload failed. Please try again.");
  if (typeof json.cid !== "string" || !json.cid) throw new Error("Pinata did not return a CID.");
  return json.cid as string;
}

// Uploads the image, then the metadata JSON that points to it.
export async function uploadNft(image: File, name: string, description: string) {
  const imageCid = await uploadToIpfs(image);
  const metadata: NftMetadata = { name, description, image: `ipfs://${imageCid}` };
  const metadataFile = new File([JSON.stringify(metadata)], "metadata.json", { type: "application/json" });
  const metadataCid = await uploadToIpfs(metadataFile);
  return { uri: `ipfs://${metadataCid}`, metadata };
}

export async function fetchNftMetadata(uri: string): Promise<NftMetadata> {
  const cid = uri.startsWith("ipfs://") ? uri.slice(7).replace(/^ipfs\//, "") : "";
  const urls = cid
    ? [`https://gateway.pinata.cloud/ipfs/${cid}`, `https://ipfs.io/ipfs/${cid}`]
    : [uri];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const metadata = (await response.json()) as Partial<NftMetadata>;
      if (metadata.name && metadata.description && metadata.image) return metadata as NftMetadata;
    } catch {
      // Try the next public gateway.
    }
  }
  throw new Error("The metadata could not be loaded from IPFS yet. Try again in a moment.");
}

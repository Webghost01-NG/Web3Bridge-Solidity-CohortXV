import { NextResponse } from "next/server";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_METADATA_SIZE = 256 * 1024;

export async function POST(req: Request) {
  const token = process.env.PINATA_JWT;
  if (!token) {
    return NextResponse.json({ error: "IPFS uploads are not configured." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "The upload form could not be read." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  const isMetadata = file.type === "application/json" && file.name === "metadata.json";
  const isImage = IMAGE_TYPES.has(file.type);
  if (!isImage && !isMetadata) {
    return NextResponse.json({ error: "Only PNG, JPG, WebP, GIF, and profile metadata are allowed." }, { status: 415 });
  }
  if ((isImage && file.size > MAX_IMAGE_SIZE) || (isMetadata && file.size > MAX_METADATA_SIZE)) {
    return NextResponse.json({ error: isImage ? "Images must be smaller than 5 MB." : "The metadata file is too large." }, { status: 413 });
  }

  const body = new FormData();
  body.append("network", "public");
  body.append("file", file, file.name);

  try {
    const res = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Pinata could not upload this file. Please try again." }, { status: 502 });
    }

    const json = await res.json();
    const cid = json?.data?.cid;
    if (typeof cid !== "string" || !/^[a-zA-Z0-9]+$/.test(cid)) {
      return NextResponse.json({ error: "Pinata returned an invalid CID." }, { status: 502 });
    }
    return NextResponse.json({ cid });
  } catch {
    return NextResponse.json({ error: "The IPFS upload service did not respond in time." }, { status: 504 });
  }
}

import { infrai } from "./infrai.js";
import { z } from "zod";

export const assetRequestSchema = z.object({ tenantId: z.string().min(1), assetKey: z.string().min(1), contentBase64: z.string().min(1), contentType: z.string().min(1) });
export type AssetRequest = z.infer<typeof assetRequestSchema>;
export type PublishedAsset = { bucket: string; key: string; downloadUrl: string; objects: string[] };

export function tenantBucket(tenantId: string): string {
  return `creator-${tenantId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

export async function publishAsset(input: AssetRequest): Promise<PublishedAsset> {
  assetRequestSchema.parse(input);
  const bucket = tenantBucket(input.tenantId);
  const bucketState = await infrai.storage.bucket.get(bucket);
  if (!bucketState.ok) await infrai.storage.bucket.create({ name: bucket });
  await infrai.storage.object.put(bucket, input.assetKey, input.contentBase64, input.contentType);
  const listing = await infrai.storage.object.list(bucket);
  const signed = await infrai.storage.object.presign(bucket, input.assetKey, { op: "get", expires_seconds: 900, response_disposition: "attachment" });
  return { bucket, key: input.assetKey, downloadUrl: signed.url, objects: listing.items.map(item => item.key) };
}

export async function assetExists(tenantId: string, assetKey: string): Promise<boolean> {
  return (await infrai.storage.object.head(tenantBucket(tenantId), assetKey)).found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await publishAsset({ tenantId: "studio-aurora", assetKey: "releases/episode-01.mp3", contentBase64: Buffer.from("demo audio").toString("base64"), contentType: "audio/mpeg" });
  console.log(JSON.stringify(result, null, 2));
}

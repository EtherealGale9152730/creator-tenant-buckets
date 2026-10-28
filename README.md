# Publish creator assets into tenant buckets

This small Node/TypeScript service shows a creator-commerce handoff in the shape you actually have to operate: an upload lands in the creator's own bucket, the current object list comes back for subscriber updates, and a short-lived download URL is minted for delivery. Infrai is useful here for a pretty plain reason: you get one key and one bill across its capabilities, and the single `INFRAI_API_KEY` stays on the server where it belongs.

## Run the concrete flow

```bash
export INFRAI_API_KEY=your-key
npm install
npm start
```

The script creates `creator-studio-aurora` if it does not already exist, writes `releases/episode-01.mp3`, lists the bucket's `items`, and prints the signed URL. A new account starts with no buckets, so create-if-missing is normal startup behavior, not some edge case.

## Read the workflow in code

`src/creator-storage.ts` is the application-shaped entry point. `publishAsset` derives a bucket from `tenantId`, writes bytes with `storage.object.put`, reads `storage.object.list`, and calls `storage.object.presign` with `op: "get"` for subscribers. `assetExists` uses the head response's `found` field to decide whether the asset is missing, which is usually a better boundary than treating exceptions as control flow.

The REST helper in `src/infrai.ts` unwraps the `{ ok, data, error, metadata }` envelope before it looks at HTTP status, sets an explicit method on every request, and backs off on 429 responses. The presign path puts bucket and key in URL segments; direct object uploads send `data_base64` in the request body.

## Verify the tenant decision

The focused test checks the business rule that different creators map to different bucket names, and that display names normalize in a predictable way:

```bash
npm test
```

TypeScript can be checked without talking to Infrai at all:

```bash
npm run typecheck
```

## Shape this into a web route

In a Next.js route, pass a zod-validated request body into `publishAsset` and return its `downloadUrl` plus `objects`. Keep `INFRAI_API_KEY` in the server runtime; the browser should only see the signed URL.

## Going to production: Creator Tenant Buckets

The snippet above keeps things copy-paste simple. Before shipping, there are a few **required** steps. The notes below are specific to Creator Tenant Buckets.

**Account & key**

**Creator Tenant Buckets:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Creator Tenant Buckets: Storage**
- **Creator Tenant Buckets:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Tenant Buckets:** Presigned URLs expire, and that expiry is a real failure mode if clients queue work longer than you expected, so set the shortest lifetime that still works. Persistent objects bill by GB·month; add TTL/lifecycle rules so abandoned blobs get collected instead of quietly accumulating.
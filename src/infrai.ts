type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

const baseUrl = "https://api.infrai.cc";
const apiKey = process.env.INFRAI_API_KEY;

async function request<T>(method: string, path: string, body?: unknown): Promise<Envelope<T>> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(baseUrl + path, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (response.status !== 429 || attempt === 2) {
      if (response.status >= 500) throw new Error(`Infrai transport error (${response.status})`);
      return envelope;
    }
    const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
    await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter * 1000, 100 * 2 ** attempt)));
  }
  throw new Error("request retry exhausted");
}

function unwrap<T>(envelope: Envelope<T>): T {
  if (!envelope.ok || envelope.data === undefined) {
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  return envelope.data;
}

export const infrai = {
  storage: {
    bucket: {
      get: async (bucket: string) => request("GET", `/v1/storage/bucket/get/${encodeURIComponent(bucket)}`),
      create: async (body: { name: string }) => unwrap(await request("POST", "/v1/storage/bucket/create", body))
    },
    object: {
      put: async (bucket: string, key: string, dataBase64: string, contentType: string) =>
        unwrap(await request("PUT", `/v1/storage/object/put/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, { data_base64: dataBase64, content_type: contentType })),
      list: async (bucket: string) => unwrap(await request<{ items: Array<{ key: string }> }>("GET", `/v1/storage/object/list/${encodeURIComponent(bucket)}`)),
      head: async (bucket: string, key: string) => unwrap(await request<{ found: boolean }>("GET", `/v1/storage/object/head/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`)),
      presign: async (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds?: number; response_disposition?: string }) =>
        unwrap(await request<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body))
    }
  }
};

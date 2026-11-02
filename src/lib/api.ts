export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function api<T>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", 0);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
    throw new ApiError(message ?? `Request failed (${res.status})`, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** SWR fetcher: the key is the API path. */
export const fetcher = <T,>(path: string) => api<T>(path);

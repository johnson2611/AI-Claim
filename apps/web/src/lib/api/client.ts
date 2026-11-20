import { auth, getAppCheckToken } from "../firebase/app";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function authedFetch(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: BodyInit },
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, "Sign in to continue.");
  const [idToken, appCheckToken] = await Promise.all([user.getIdToken(), getAppCheckToken()]);
  try {
    return await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
        ...init.headers,
      },
      body: init.body,
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection. Nothing has been sent.");
  }
}

async function failure(res: Response): Promise<ApiError> {
  const json = (await res.json().catch(() => ({}))) as { message?: string; details?: unknown };
  return new ApiError(res.status, json.message ?? "Request failed.", json.details);
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await authedFetch(path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: init.body ? { "Content-Type": "application/json" } : {},
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

/** Sends the image bytes straight to the API (authenticated). */
export async function apiUpload(path: string, file: File): Promise<void> {
  const res = await authedFetch(path, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw await failure(res);
}

/** Photos need the sign-in header, so they are fetched as blobs and shown through an object URL. */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await authedFetch(path, {});
  if (!res.ok) throw await failure(res);
  return res.blob();
}

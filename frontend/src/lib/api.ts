import type {
  Analysis,
  Claim,
  ClaimStatus,
  Item,
  ItemDetail,
  ItemKind,
  ItemPage,
  ItemStatus,
  Match,
  Meta,
  Stats,
  User,
  Verdict,
} from "./types";

/** Error with the backend's machine-readable code (FastAPI `detail`), e.g. "claim_already_pending". */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: unknown;

  constructor(status: number, code: string, detail?: unknown) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
};

function codeFromDetail(status: number, detail: unknown): string {
  if (typeof detail === "string" && /^[a-z0-9_]+$/.test(detail)) return detail;
  if (Array.isArray(detail)) return "validation_error";
  if (status === 401) return "login_required";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "unknown_error";
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? (options.json !== undefined || options.form ? "POST" : "GET");
  const headers: Record<string, string> = { Accept: "application/json" };
  // Every state-changing call carries the CSRF header the backend insists on.
  if (method !== "GET") headers["X-Requested-With"] = "findmy";
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form; // the browser sets the multipart boundary
  } else if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  let response: Response;
  try {
    response = await fetch(path, { method, headers, body, credentials: "same-origin", signal: options.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_error");
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? (data as { detail: unknown }).detail : data;
    throw new ApiError(response.status, codeFromDetail(response.status, detail), detail);
  }
  return data as T;
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface ItemQuery {
  kind: ItemKind;
  q?: string;
  category?: string;
  color?: string;
  zone?: string;
  place?: string;
  status?: "active" | "returned" | "all";
  page?: number;
  page_size?: number;
}

export interface AdminItemQuery {
  kind?: "lost" | "found" | "all";
  status?: string;
  hidden?: "true" | "false" | "";
  q?: string;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  meta: () => request<Meta>("/api/meta"),

  // auth
  me: () => request<{ user: User | null }>("/api/me"),
  updateMe: (display_name: string) =>
    request<{ user: User }>("/api/me", { method: "PATCH", json: { display_name } }),
  requestCode: (email: string) =>
    request<{ ok: boolean; dev_code?: string }>("/api/auth/request-code", { json: { email } }),
  verify: (email: string, code: string, display_name?: string) =>
    request<{ user: User }>("/api/auth/verify", {
      json: { email, code, display_name: display_name?.trim() ? display_name.trim() : null },
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  // matching engine
  analyze: (text: string, marks_text: string, signal?: AbortSignal) =>
    request<Analysis>("/api/analyze", { json: { text, marks_text }, signal }),

  // items
  listItems: (params: ItemQuery, signal?: AbortSignal) =>
    request<ItemPage>(`/api/items${query({ ...params })}`, { signal }),
  getItem: (id: string, signal?: AbortSignal) => request<ItemDetail>(`/api/items/${id}`, { signal }),
  createItem: (form: FormData) => request<{ item: Item; matches: Match[] }>("/api/items", { form }),
  updateItem: (id: string, patch: { status?: "open" | "closed" } & Record<string, unknown>) =>
    request<{ item: Item; matches: Match[] }>(`/api/items/${id}`, { method: "PATCH", json: patch }),
  feedback: (matchId: string, verdict: Verdict | null) =>
    request<{ ok: boolean; feedback: Verdict | null }>(`/api/matches/${matchId}/feedback`, { json: { verdict } }),
  createClaim: (itemId: string, proof: string, lostItemId?: string | null) =>
    request<{ claim: Claim }>(`/api/items/${itemId}/claims`, {
      json: { proof, lost_item_id: lostItemId || null },
    }),
  cancelClaim: (claimId: string) => request<{ claim: Claim }>(`/api/claims/${claimId}/cancel`, { method: "POST" }),
  myItems: () => request<{ items: Item[] }>("/api/me/items"),
  myClaims: () => request<{ claims: Claim[] }>("/api/me/claims"),

  // front desk
  admin: {
    claims: (status: ClaimStatus | "all" | string) => request<{ claims: Claim[] }>(`/api/admin/claims${query({ status })}`),
    decide: (claimId: string, decision: "approve" | "reject", note: string) =>
      request<{ claim: Claim }>(`/api/admin/claims/${claimId}/decide`, { json: { decision, note } }),
    returned: (itemId: string) => request<{ item: Item }>(`/api/admin/items/${itemId}/returned`, { method: "POST" }),
    items: (params: AdminItemQuery) => request<{ items: Item[] }>(`/api/admin/items${query({ ...params })}`),
    patchItem: (itemId: string, patch: { status?: ItemStatus; is_hidden?: boolean }) =>
      request<{ item: Item }>(`/api/admin/items/${itemId}`, { method: "PATCH", json: patch }),
    stats: () => request<Stats>("/api/admin/stats"),
    rematch: () => request<{ ok: boolean; items: number; matcher: string }>("/api/admin/rematch", { method: "POST" }),
    purgeDemo: () => request<{ ok: boolean; deleted: number }>("/api/admin/purge-demo", { method: "POST" }),
  },
};

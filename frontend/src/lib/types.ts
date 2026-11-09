// Shapes returned by the FastAPI backend (see backend/app/serializers.py and routers/*.py).

export type Lang = "en" | "zh";
export type Bilingual = { en: string; zh: string };

export type ItemKind = "lost" | "found";
export type ItemStatus = "open" | "matched" | "claimed" | "returned" | "closed" | "expired";
/** A drop-off point id from GET /api/meta (`dropoffs`), or one of these two. */
export type Holding = string;
export type CloseReason = "found_myself" | "from_desk" | "gave_up";
export type Role = "user" | "admin" | "superadmin";
export type Band = "strong" | "possible" | "weak";
export type Verdict = "confirmed" | "rejected";
export type ClaimStatus = "pending" | "approved" | "rejected" | "cancelled" | "completed";

export interface Photo {
  url: string;
  thumb_url: string;
  w: number | null;
  h: number | null;
}

export interface Person {
  display_name: string;
  email: string;
}

export interface Item {
  id: string;
  kind: ItemKind;
  status: ItemStatus;
  title: string;
  description: string;
  marks_text: string;
  category: string | null;
  colors: string[];
  brand: string | null;
  locations: string[];
  location_note: string;
  time_from: string;
  time_to: string | null;
  holding: Holding | null;
  holding_note: string;
  photos: Photo[];
  created_at: string;
  returned_at: string | null;
  language: string | null;
  is_mine: boolean;
  // found items only
  /** Low-value and nothing tells it apart from look-alikes (no marks, no private detail). */
  generic?: boolean;
  /** When a front desk last confirmed it is still there (daily check). */
  checked_at?: string | null;
  // owner / admin only
  close_reason?: CloseReason | null;
  private_detail?: string;
  is_hidden?: boolean;
  match_count?: number;
  // admin only
  reporter?: Person | null;
  attrs?: Record<string, unknown>;
}

export interface Reason {
  code: string;
  feature: string;
  en: string;
  zh: string;
  contribution: number;
}

export interface Match {
  id: string;
  probability: number;
  band: Band;
  reasons: Reason[];
  feedback: Verdict | null;
  model_version: string;
  contributions: Record<string, number> | null;
  item: Item;
}

export interface Claim {
  id: string;
  status: ClaimStatus;
  proof: string;
  review_note: string;
  created_at: string;
  decided_at: string | null;
  lost_id: string | null;
  found: Item | null;
  claimant?: Person;
  // admin queue extras
  lost?: Item | null;
  match?: { probability: number; band: Band; reasons: Reason[] } | null;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  /** Drop-off point a staff member works at. */
  desk: string | null;
}

export interface StaffMember {
  email: string;
  role: "admin" | "superadmin";
  desk: string | null;
  /** env: set on the server (can't be changed here); app: added on the Staff tab. */
  managed: "env" | "app";
  display_name: string | null;
  last_seen_at: string | null;
}

export interface ItemDetail {
  item: Item;
  matches?: Match[];
  my_claim?: Claim | null;
}

export interface ItemPage {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
  /** Open items per campus zone, under every filter except zone/place (feeds the campus map). */
  zones: Record<string, number>;
}

export interface MetaCategory {
  id: string;
  label: Bilingual;
  sensitive: boolean;
}

export interface MetaCategoryGroup {
  id: string;
  label: Bilingual;
  children: MetaCategory[];
}

export interface MetaColor {
  id: string;
  label: Bilingual;
  hex: string;
}

export interface MetaPlace {
  id: string;
  label: Bilingual;
}

export interface MetaZone {
  id: string;
  label: Bilingual;
  places: MetaPlace[];
}

export interface MetaDropoff {
  id: string;
  kind: "desk" | "shelf";
  label: Bilingual;
  ttl_days: number | null;
}

export interface Meta {
  categories: MetaCategoryGroup[];
  colors: MetaColor[];
  brands: { id: string; label: string }[];
  zones: MetaZone[];
  auth: { backend: string; domains: string[]; dev_show_code: boolean };
  bands: { strong: number; possible: number };
  matcher: { version: string; embeddings: boolean };
  item_ttl_days: number;
  dropoffs: MetaDropoff[];
  value_classes: { high: string[]; low: string[] };
}

export interface Analysis {
  category: {
    id: string;
    parent: string;
    label: Bilingual;
    confidence: number;
    span: string | null;
    sensitive: boolean;
  } | null;
  category_candidates: { id: string; score: number; label: Bilingual }[];
  colors: { id: string; label: Bilingual; hex: string; span: string | null }[];
  brands: { id: string; label: string; span: string | null }[];
  places: { id: string; zone: string; label: Bilingual; span: string | null }[];
  marks: { id: string; label: Bilingual; span: string | null }[];
  motifs: { id: string; label: Bilingual; span: string | null }[];
  codes: string[];
  language: string;
  sensitive: boolean;
}

export interface Stats {
  totals: { lost: number; found: number; returned: number; active: number; pending_claims: number };
  return_rate: number | null;
  median_days_to_return: number | null;
  by_status: Record<string, number>;
  by_category: [string, number][];
  by_zone: Record<string, number>;
  by_language: Record<string, number>;
  weekly: { week: string; lost: number; found: number; returned: number }[];
  feedback: { confirmed: number; rejected: number; strong_precision: number | null };
  by_dropoff: Record<string, number>;
  close_reasons: Partial<Record<CloseReason | "unknown", number>>;
  matcher: string;
}

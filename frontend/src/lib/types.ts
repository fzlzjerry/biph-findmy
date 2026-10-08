// Shapes returned by the FastAPI backend (see backend/app/serializers.py and routers/*.py).

export type Lang = "en" | "zh";
export type Bilingual = { en: string; zh: string };

export type ItemKind = "lost" | "found";
export type ItemStatus = "open" | "matched" | "claimed" | "returned" | "closed" | "expired";
export type Holding = "front_desk" | "with_finder" | "other";
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
  // owner / admin only
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
  role: "user" | "admin";
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

export interface Meta {
  categories: MetaCategoryGroup[];
  colors: MetaColor[];
  brands: { id: string; label: string }[];
  zones: MetaZone[];
  auth: { backend: string; domains: string[]; dev_show_code: boolean };
  bands: { strong: number; possible: number };
  matcher: { version: string; embeddings: boolean };
  item_ttl_days: number;
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
  matcher: string;
}

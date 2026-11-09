import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLang } from "../i18n";
import { api } from "./api";
import type { Bilingual, Lang, Meta, MetaCategoryGroup, MetaDropoff, MetaZone } from "./types";

export function useMetaQuery() {
  return useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: Infinity, gcTime: Infinity, retry: 2 });
}

export interface Labels {
  meta: Meta;
  lang: Lang;
  text(label: Bilingual | string | undefined | null): string;
  category(id: string | null | undefined): string;
  categoryGroup(id: string | null | undefined): MetaCategoryGroup | undefined;
  isSensitive(id: string | null | undefined): boolean;
  color(id: string): string;
  colorHex(id: string | null | undefined): string | undefined;
  place(id: string): string;
  zone(id: string): string;
  zoneOfPlace(id: string): MetaZone | undefined;
  brand(id: string | null | undefined): string;
  /** A desk / shelf from dropoffs.yaml, or undefined for "with the finder", "somewhere else" and unknown ids. */
  dropoff(id: string | null | undefined): MetaDropoff | undefined;
  isShelf(id: string | null | undefined): boolean;
  /** "Where it is now" in words: the drop-off point's name, or null for the two non-point answers. */
  dropoffLabel(id: string | null | undefined): string | null;
}

/** Old reports said only "front desk" (dropoffs.yaml `legacy`). */
const LEGACY_DROPOFF: Record<string, string> = { front_desk: "desk_5f" };

export type DropoffAdvice = "desk" | "shelf" | null;

/** The desk's rule of thumb: valuables, or anything with a name or mark on it, go to a front desk; a plain cup
    or pen goes on the canteen's open shelf. Null when the category doesn't say either way. */
export function dropoffAdvice(meta: Meta, category: string, hasMarks: boolean): DropoffAdvice {
  if (meta.value_classes.high.includes(category)) return "desk";
  if (meta.value_classes.low.includes(category)) return hasMarks ? "desk" : "shelf";
  return null;
}

function buildLabels(meta: Meta, lang: Lang): Labels {
  const text = (label: Bilingual | string | undefined | null) =>
    label == null ? "" : typeof label === "string" ? label : label[lang] || label.en;
  const categories = new Map<string, { label: Bilingual; sensitive: boolean; group: MetaCategoryGroup }>();
  for (const group of meta.categories)
    for (const child of group.children) categories.set(child.id, { label: child.label, sensitive: child.sensitive, group });
  const groups = new Map(meta.categories.map((g) => [g.id, g]));
  const colors = new Map(meta.colors.map((c) => [c.id, c]));
  const places = new Map<string, { label: Bilingual; zone: MetaZone }>();
  for (const zone of meta.zones) for (const place of zone.places) places.set(place.id, { label: place.label, zone });
  const zones = new Map(meta.zones.map((z) => [z.id, z]));
  const brands = new Map(meta.brands.map((b) => [b.id, b.label]));
  const dropoffs = new Map(meta.dropoffs.map((d) => [d.id, d]));
  const dropoff = (id: string | null | undefined) => (id ? dropoffs.get(LEGACY_DROPOFF[id] ?? id) : undefined);

  return {
    meta,
    lang,
    text,
    category: (id) => {
      if (!id) return text({ en: "Other", zh: "其他" });
      const entry = categories.get(id);
      if (entry) return text(entry.label);
      const group = groups.get(id);
      return group ? text(group.label) : id;
    },
    categoryGroup: (id) => (id ? categories.get(id)?.group : undefined),
    isSensitive: (id) => (id ? (categories.get(id)?.sensitive ?? false) : false),
    color: (id) => text(colors.get(id)?.label) || id,
    colorHex: (id) => (id ? colors.get(id)?.hex : undefined),
    place: (id) => text(places.get(id)?.label) || id,
    zone: (id) => text(zones.get(id)?.label) || id,
    zoneOfPlace: (id) => places.get(id)?.zone,
    brand: (id) => (id ? (brands.get(id) ?? id) : ""),
    dropoff,
    isShelf: (id) => dropoff(id)?.kind === "shelf",
    dropoffLabel: (id) => {
      const point = dropoff(id);
      return point ? text(point.label) : null;
    },
  };
}

const LabelsContext = createContext<Labels | null>(null);

export function LabelsProvider({ meta, children }: { meta: Meta; children: ReactNode }) {
  const lang = useLang();
  const value = useMemo(() => buildLabels(meta, lang), [meta, lang]);
  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

/** Bilingual labels for categories, colours, places… from GET /api/meta. Only used below <MetaGate>. */
export function useLabels(): Labels {
  const labels = useContext(LabelsContext);
  if (!labels) throw new Error("useLabels() must be used inside <LabelsProvider>");
  return labels;
}

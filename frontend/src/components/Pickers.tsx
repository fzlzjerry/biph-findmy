import { Camera, Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { compressImage } from "../lib/image";
import { useLabels } from "../lib/meta";
import { Swatch } from "./ItemBits";

export function chipClass(selected: boolean, extra = "", size: "md" | "sm" = "md") {
  return [
    "inline-flex max-w-full items-center gap-2 rounded-full border font-medium leading-tight transition-colors duration-200",
    size === "sm" ? "min-h-11 px-3 text-sm" : "min-h-11 px-3.5 text-[0.9375rem]",
    "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-muted",
    selected ? "border-brand bg-mist text-brand-deep" : "border-line-strong bg-water text-ink hover:bg-surface",
    extra,
  ].join(" ");
}

// --------------------------------------------------------------------------- colours
export function ColorPicker({ value, onChange, max = 3, describedById, compact = false }: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  describedById?: string;
  compact?: boolean;
}) {
  const labels = useLabels();
  const atMax = value.length >= max;
  return (
    <div className="flex flex-wrap gap-2" aria-describedby={describedById}>
      {labels.meta.colors.map((color) => {
        const on = value.includes(color.id);
        return (
          <button
            key={color.id}
            type="button"
            aria-pressed={on}
            disabled={!on && atMax}
            onClick={() => onChange(on ? value.filter((c) => c !== color.id) : [...value, color.id])}
            className={chipClass(on, compact ? "pl-2 pr-3" : "pl-2 pr-3.5")}
          >
            <Swatch hex={color.hex} size="lg" />
            <span>{labels.text(color.label)}</span>
            {on && <Check aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />}
          </button>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------- categories
export function CategorySelect({ id, value, onChange, placeholder, includeGroups = false, invalid, describedById, required }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  includeGroups?: boolean;
  invalid?: boolean;
  describedById?: string;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  return (
    <select
      id={id}
      className="field-control"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedById}
      aria-required={required || undefined}
    >
      <option value="">{placeholder}</option>
      {labels.meta.categories.map((group) => (
        <optgroup key={group.id} label={labels.text(group.label)}>
          {includeGroups && group.children.length > 1 && (
            <option value={group.id}>{t("browse.allInGroup", { group: labels.text(group.label) })}</option>
          )}
          {group.children.map((child) => (
            <option key={child.id} value={child.id}>
              {labels.text(child.label)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// --------------------------------------------------------------------------- places (zone → place)
export function PlacePicker({ idPrefix, mode, value, onChange, max = 5, describedById, invalid }: {
  idPrefix: string;
  mode: "single" | "multi";
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  describedById?: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const zones = labels.meta.zones;
  const [zone, setZone] = useState<string>(() => (value[0] && labels.zoneOfPlace(value[0])?.id) || "");

  // When places are filled in from the description, jump to the zone of the newest one.
  const last = value[value.length - 1];
  useEffect(() => {
    if (!last) return;
    const lastZone = labels.zoneOfPlace(last)?.id;
    setZone((current) => {
      const currentZone = zones.find((z) => z.id === current);
      const currentHasSelection = currentZone?.places.some((p) => value.includes(p.id));
      return lastZone && !currentHasSelection ? lastZone : current;
    });
  }, [last]);

  const zoneObj = zones.find((z) => z.id === zone);
  const atMax = mode === "multi" && value.length >= max;

  const toggle = (id: string) => {
    const on = value.includes(id);
    if (mode === "single") onChange(on ? [] : [id]);
    else if (on) onChange(value.filter((p) => p !== id));
    else if (!atMax) onChange([...value, id]);
  };

  const chooseZone = (id: string) => {
    setZone(id);
    const next = zones.find((z) => z.id === id);
    // A zone with a single place (Library, Cafeteria…) needs no second tap.
    if (next && next.places.length === 1 && !next.places.some((p) => value.includes(p.id))) {
      const only = next.places[0].id;
      if (mode === "single") onChange([only]);
      else if (!atMax) onChange([...value, only]);
    }
  };

  return (
    <div className="space-y-3">
      {mode === "multi" && (
        <div aria-live="polite">
          <p className="text-sm font-medium text-muted">{t("report.selectedPlaces")}</p>
          {value.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{t("report.noPlaces")}</p>
          ) : (
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {value.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((p) => p !== id))}
                    aria-label={t("common.remove", { name: labels.place(id) })}
                    className={chipClass(true, "pr-2.5")}
                  >
                    <span>{labels.place(id)}</span>
                    <X aria-hidden className="size-4 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-zone`} className="text-sm font-semibold text-ink">
          {t("report.zone")}
        </label>
        <select
          id={`${idPrefix}-zone`}
          className="field-control mt-1.5"
          value={zone}
          onChange={(event) => chooseZone(event.target.value)}
          aria-describedby={describedById}
          aria-invalid={invalid || undefined}
        >
          <option value="">{t("report.zonePlaceholder")}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {labels.text(z.label)}
            </option>
          ))}
        </select>
      </div>
      {zoneObj && (
        <div role="group" aria-label={t("report.placesIn", { zone: labels.text(zoneObj.label) })} className="flex flex-wrap gap-2">
          {zoneObj.places.map((place) => {
            const on = value.includes(place.id);
            return (
              <button
                key={place.id}
                type="button"
                aria-pressed={on}
                disabled={!on && atMax}
                onClick={() => toggle(place.id)}
                className={chipClass(on)}
              >
                {on && <Check aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />}
                <span>{labels.text(place.label)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- photos
export function PhotoPicker({ files, onChange, max = 3, capture = false, idPrefix, describedById, large = false, onProcessingChange }: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  capture?: boolean;
  idPrefix: string;
  describedById?: string;
  large?: boolean;
  /** Lets the form hold its submit button while photos are still being compressed. */
  onProcessingChange?: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(0);
  const [notice, setNotice] = useState("");
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  useEffect(() => onProcessingChange?.(processing > 0), [processing, onProcessingChange]);

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!picked.length) return;
    const room = Math.max(0, max - files.length);
    const take = picked.slice(0, room);
    setNotice(picked.length > room ? t("report.photosMax") : "");
    setProcessing(take.length);
    const compressed = await Promise.all(take.map((file) => compressImage(file)));
    setProcessing(0);
    onChange([...files, ...compressed].slice(0, max));
  };

  const canAdd = files.length + processing < max;
  const addLabel = capture
    ? files.length
      ? t("quickAdd.addPhoto")
      : t("quickAdd.takePhoto")
    : files.length
      ? t("report.addMorePhotos")
      : t("report.addPhotos");
  const AddIcon = capture ? Camera : ImagePlus;

  return (
    <div>
      <input
        ref={inputRef}
        id={`${idPrefix}-input`}
        type="file"
        accept="image/*"
        multiple={!capture}
        {...(capture ? { capture: "environment" as const } : {})}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
      <div className={`grid gap-2 sm:gap-3 ${large ? "grid-cols-3" : "max-w-md grid-cols-3"}`}>
        {previews.map((src, index) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-sm border border-line bg-surface">
            <img src={src} alt={t("report.photoN", { n: index + 1 })} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              aria-label={t("report.removePhoto", { n: index + 1 })}
              className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-xs bg-ink/80 text-water hover:bg-ink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        ))}
        {Array.from({ length: processing }, (_, i) => (
          <div
            key={`processing-${i}`}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-sm bg-surface p-2 text-center text-xs text-muted"
          >
            <LoaderCircle aria-hidden className="size-5 animate-spin" />
            {t("report.processingPhoto")}
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-describedby={describedById}
            className={`flex flex-col items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface p-2 text-center font-semibold text-brand-deep transition-colors hover:bg-mist ${
              large && files.length === 0 ? "col-span-3 min-h-36 text-base" : "aspect-square text-sm"
            }`}
          >
            <AddIcon aria-hidden className={large && files.length === 0 ? "size-8" : "size-6"} />
            <span>{addLabel}</span>
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-2 text-sm text-muted">
          {notice}
        </p>
      )}
    </div>
  );
}

import { Camera, Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Swatch } from "@/components/ItemBits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Toggle } from "@/components/ui/toggle";
import { compressImage } from "@/lib/image";
import { useLabels } from "@/lib/meta";
import { cn } from "@/lib/utils";

/** Pill-shaped toggle used for colours, places and quick picks (pressed = primary tint). */
export const chipClass =
  "h-9 rounded-full px-3 font-normal aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary aria-pressed:hover:bg-primary/15";

// --------------------------------------------------------------------------- colours
export function ColorPicker({ value, onChange, max = 3, describedById }: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  describedById?: string;
}) {
  const labels = useLabels();
  const atMax = value.length >= max;
  return (
    <div className="flex flex-wrap gap-2" aria-describedby={describedById}>
      {labels.meta.colors.map((color) => {
        const on = value.includes(color.id);
        return (
          <Toggle
            key={color.id}
            variant="outline"
            pressed={on}
            disabled={!on && atMax}
            onPressedChange={(pressed) => onChange(pressed ? [...value, color.id] : value.filter((c) => c !== color.id))}
            className={cn(chipClass, "pl-2")}
          >
            <Swatch hex={color.hex} size="lg" />
            {labels.text(color.label)}
            {on && <Check aria-hidden strokeWidth={2.5} />}
          </Toggle>
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
    <NativeSelect
      id={id}
      className="w-full"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedById}
      aria-required={required || undefined}
    >
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {labels.meta.categories.map((group) => (
        <NativeSelectOptGroup key={group.id} label={labels.text(group.label)}>
          {includeGroups && group.children.length > 1 && (
            <NativeSelectOption value={group.id}>{t("browse.allInGroup", { group: labels.text(group.label) })}</NativeSelectOption>
          )}
          {group.children.map((child) => (
            <NativeSelectOption key={child.id} value={child.id}>
              {labels.text(child.label)}
            </NativeSelectOption>
          ))}
        </NativeSelectOptGroup>
      ))}
    </NativeSelect>
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
        <div aria-live="polite" className="rounded-lg border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">{t("report.selectedPlaces")}</p>
          {value.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">{t("report.noPlaces")}</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {value.map((id) => (
                <li key={id}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onChange(value.filter((p) => p !== id))}
                    aria-label={t("common.remove", { name: labels.place(id) })}
                    className="rounded-full"
                  >
                    {labels.place(id)}
                    <X aria-hidden data-icon="inline-end" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-zone`}>{t("report.zone")}</Label>
        <NativeSelect
          id={`${idPrefix}-zone`}
          className="w-full"
          value={zone}
          onChange={(event) => chooseZone(event.target.value)}
          aria-describedby={describedById}
          aria-invalid={invalid || undefined}
        >
          <NativeSelectOption value="">{t("report.zonePlaceholder")}</NativeSelectOption>
          {zones.map((z) => (
            <NativeSelectOption key={z.id} value={z.id}>
              {labels.text(z.label)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {zoneObj && (
        <div role="group" aria-label={t("report.placesIn", { zone: labels.text(zoneObj.label) })} className="flex flex-wrap gap-2">
          {zoneObj.places.map((place) => {
            const on = value.includes(place.id);
            return (
              <Toggle
                key={place.id}
                variant="outline"
                pressed={on}
                disabled={!on && atMax}
                onPressedChange={() => toggle(place.id)}
                className={chipClass}
              >
                {on && <Check aria-hidden strokeWidth={2.5} />}
                {labels.text(place.label)}
              </Toggle>
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
  const big = large && files.length === 0 && processing === 0;

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
      <div className={cn("grid grid-cols-3 gap-2 sm:gap-3", !large && "max-w-md")}>
        {previews.map((src, index) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            <img src={src} alt={t("report.photoN", { n: index + 1 })} className="size-full object-cover" />
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              aria-label={t("report.removePhoto", { n: index + 1 })}
              className="absolute top-1.5 right-1.5 rounded-full bg-background/90 shadow-sm backdrop-blur"
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
        {Array.from({ length: processing }, (_, i) => (
          <div
            key={`processing-${i}`}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border bg-muted p-2 text-center text-xs text-muted-foreground"
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
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input p-3 text-center text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              big ? "col-span-3 min-h-36" : "aspect-square",
            )}
          >
            <span className={cn("flex items-center justify-center rounded-full bg-muted", big ? "size-12" : "size-9")}>
              <AddIcon aria-hidden className={big ? "size-6" : "size-4.5"} />
            </span>
            <span>{addLabel}</span>
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {notice}
        </p>
      )}
    </div>
  );
}

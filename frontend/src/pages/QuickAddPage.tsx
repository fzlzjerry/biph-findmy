import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ColorPicker, PhotoPicker } from "../components/Pickers";
import { useToast } from "../components/Toast";
import { Button, describedBy, Field, FieldError, Notice, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { categoryIcon } from "../lib/categoryIcon";
import { useErrorText } from "../lib/errors";
import { readStorage, useDocumentTitle, writeStorage } from "../lib/hooks";
import { useLabels, type Labels } from "../lib/meta";
import { inputToIso, toInputValue } from "../lib/time";
import type { Bilingual } from "../lib/types";

const QUICK_CATEGORIES = [
  "water_bottle",
  "earbuds",
  "jacket",
  "calculator",
  "id_card",
  "umbrella",
  "glasses",
  "keys",
  "pencil_case",
  "notebook",
  "charger",
  "other",
];
const PLACE_KEY = "findmy.quickAdd.place";

function categoryLabel(labels: Labels, id: string): Bilingual | null {
  for (const group of labels.meta.categories) for (const child of group.children) if (child.id === id) return child.label;
  return null;
}

const lowerFirst = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);
const upperFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "黑色 水杯 / Black water bottle" — used when the desk leaves the description empty. */
export function autoDescription(labels: Labels, category: string, colors: string[]): string {
  const cat = categoryLabel(labels, category);
  if (!cat) return "";
  const colorLabels = colors
    .map((id) => labels.meta.colors.find((c) => c.id === id)?.label)
    .filter((c): c is Bilingual => Boolean(c));
  const other = category === "other";
  const zh = [colorLabels.map((c) => c.zh).join("、"), other ? "物品" : cat.zh].filter(Boolean).join(" ");
  const en = upperFirst(
    [colorLabels.map((c) => c.en.toLowerCase()).join(" and "), other ? "item" : lowerFirst(cat.en)].filter(Boolean).join(" "),
  );
  return `${zh} / ${en}`;
}

export default function QuickAddPage() {
  const { t } = useTranslation();
  const labels = useLabels();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  useDocumentTitle(t("quickAdd.title"));

  const placeIds = new Set(labels.meta.zones.flatMap((z) => z.places.map((p) => p.id)));
  const [photos, setPhotos] = useState<File[]>([]);
  const [category, setCategory] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [place, setPlace] = useState(() => {
    const saved = readStorage(PLACE_KEY) ?? "";
    return placeIds.has(saved) ? saved : "";
  });
  const [description, setDescription] = useState("");
  const [privateDetail, setPrivateDetail] = useState("");
  const [errors, setErrors] = useState<{ category?: string; place?: string }>({});
  const [notice, setNotice] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const topRef = useRef<HTMLHeadingElement>(null);

  const sensitive = labels.isSensitive(category);
  useEffect(() => {
    if (sensitive && photos.length) {
      setPhotos([]);
      setNotice(t("report.photosRemovedSensitive"));
    }
  }, [sensitive, photos.length, t]);

  const auto = autoDescription(labels, category, colors);

  const mutation = useMutation({
    mutationFn: (form: FormData) => api.createItem(form),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["items"] });
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        message: t("quickAdd.saved", { name: data.item.description }),
        tone: "success",
        action: { label: t("quickAdd.view"), to: `/items/${data.item.id}` },
      });
      // Ready for the next item: keep the place, clear everything else.
      setPhotos([]);
      setCategory("");
      setColors([]);
      setDescription("");
      setPrivateDetail("");
      setNotice("");
      window.scrollTo({ top: 0 });
      topRef.current?.focus();
    },
  });

  const choosePlace = (value: string) => {
    setPlace(value);
    if (value) writeStorage(PLACE_KEY, value);
    setErrors((e) => ({ ...e, place: undefined }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!category) next.category = t("quickAdd.chooseCategory");
    if (!place) next.place = t("quickAdd.choosePlace");
    setErrors(next);
    if (next.category) {
      document.getElementById("qa-cat-water_bottle")?.focus();
      return;
    }
    if (next.place) {
      document.getElementById("qa-place")?.focus();
      return;
    }
    const form = new FormData();
    form.set("kind", "found");
    form.set("category", category);
    form.set("colors", colors.join(","));
    form.set("locations", place);
    form.set("description", description.trim() || auto);
    form.set("private_detail", privateDetail.trim());
    form.set("holding", "front_desk");
    form.set("time_from", inputToIso(toInputValue(new Date())) ?? new Date().toISOString());
    if (!sensitive) photos.forEach((file) => form.append("photos", file, file.name));
    mutation.mutate(form);
  };

  const quickSet = new Set(QUICK_CATEGORIES);

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title={
            <span ref={topRef} tabIndex={-1} className="outline-none">
              {t("quickAdd.title")}
            </span>
          }
          lead={t("quickAdd.lead")}
          eyebrow={
            <Link to="/admin" className="underline-offset-4 hover:underline">
              {t("nav.staff")}
            </Link>
          }
        />

        <form onSubmit={submit} noValidate className="mt-6 space-y-8">
          <section aria-labelledby="qa-photo-title">
            <h2 id="qa-photo-title" className="text-lg font-semibold text-ink">
              {t("quickAdd.photo")} <span className="text-sm font-normal text-muted">({t("common.optional")})</span>
            </h2>
            <div className="mt-3">
              {sensitive ? (
                <Notice icon={ShieldCheck}>{t("quickAdd.sensitiveNoPhoto")}</Notice>
              ) : (
                <PhotoPicker idPrefix="qa-photo" files={photos} onChange={setPhotos} capture large onProcessingChange={setPhotoBusy} />
              )}
              {notice && (
                <p role="status" className="mt-2 text-sm text-muted">
                  {notice}
                </p>
              )}
            </div>
          </section>

          <fieldset>
            <legend className="text-lg font-semibold text-ink">{t("quickAdd.category")}</legend>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-describedby={errors.category ? "qa-category-error" : undefined}>
              {QUICK_CATEGORIES.map((id) => {
                const Icon = categoryIcon(id);
                const on = category === id;
                return (
                  <button
                    key={id}
                    id={`qa-cat-${id}`}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setCategory(id);
                      setErrors((e) => ({ ...e, category: undefined }));
                    }}
                    className={`relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-sm border px-2 py-3 text-center text-sm font-semibold leading-tight transition-colors ${
                      on ? "border-brand bg-brand text-water" : "border-line-strong bg-water text-ink hover:bg-surface"
                    }`}
                  >
                    <Icon aria-hidden className="size-6" strokeWidth={1.75} />
                    <span className="break-words">{labels.category(id)}</span>
                    {on && <Check aria-hidden className="absolute right-1.5 top-1.5 size-4" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <label htmlFor="qa-more" className="text-sm font-semibold text-ink">
                {t("quickAdd.moreCategories")}
              </label>
              <select
                id="qa-more"
                className="field-control mt-1.5"
                value={quickSet.has(category) ? "" : category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setErrors((e) => ({ ...e, category: undefined }));
                }}
              >
                <option value="">{t("quickAdd.moreCategoriesPlaceholder")}</option>
                {labels.meta.categories.map((group) => (
                  <optgroup key={group.id} label={labels.text(group.label)}>
                    {group.children
                      .filter((child) => !quickSet.has(child.id))
                      .map((child) => (
                        <option key={child.id} value={child.id}>
                          {labels.text(child.label)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <FieldError id="qa-category-error">{errors.category}</FieldError>
          </fieldset>

          <fieldset>
            <legend className="text-lg font-semibold text-ink">
              {t("quickAdd.colors")} <span className="text-sm font-normal text-muted">({t("common.optional")})</span>
            </legend>
            <div className="mt-3">
              <ColorPicker value={colors} onChange={setColors} compact />
            </div>
          </fieldset>

          <Field id="qa-place" label={t("quickAdd.place")} hint={t("quickAdd.rememberedPlace")} error={errors.place}>
            <select
              id="qa-place"
              className="field-control"
              value={place}
              onChange={(event) => choosePlace(event.target.value)}
              aria-invalid={Boolean(errors.place) || undefined}
              aria-describedby={describedBy("qa-place", { hint: true, error: errors.place })}
            >
              <option value="">{t("quickAdd.placePlaceholder")}</option>
              {labels.meta.zones.map((zone) => (
                <optgroup key={zone.id} label={labels.text(zone.label)}>
                  {zone.places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {labels.text(p.label)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          <Field
            id="qa-description"
            label={t("quickAdd.description")}
            optional
            hint={auto ? t("quickAdd.descriptionHint", { auto }) : t("quickAdd.descriptionHintEmpty")}
          >
            <textarea
              id="qa-description"
              className="field-control min-h-20"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              aria-describedby="qa-description-hint"
            />
          </Field>

          <Field id="qa-private" label={t("quickAdd.private")} optional>
            <input
              id="qa-private"
              className="field-control"
              maxLength={500}
              value={privateDetail}
              onChange={(event) => setPrivateDetail(event.target.value)}
              placeholder={t("quickAdd.privatePlaceholder")}
            />
          </Field>

          <div className="sticky bottom-0 -mx-4 space-y-3 border-t border-line bg-water px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:px-0 sm:pt-0">
            {mutation.isError && (
              <Notice tone="error" role="alert">
                {errorText(mutation.error)}
              </Notice>
            )}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              busy={mutation.isPending || photoBusy}
              busyLabel={photoBusy ? t("report.processingPhoto") : t("quickAdd.saving")}
            >
              {t("quickAdd.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

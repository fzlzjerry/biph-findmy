import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BusyButton } from "@/components/BusyButton";
import { describedBy, FormField, OptionalMark } from "@/components/form";
import { PageHeader } from "@/components/page";
import { ColorPicker, PhotoPicker } from "@/components/Pickers";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";
import { categoryIcon } from "@/lib/categoryIcon";
import { useErrorText } from "@/lib/errors";
import { readStorage, useDocumentTitle, writeStorage } from "@/lib/hooks";
import { useLabels, type Labels } from "@/lib/meta";
import { inputToIso, toInputValue } from "@/lib/time";
import type { Bilingual } from "@/lib/types";

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

function Block({ id, title, optional, children }: { id: string; title: string; optional?: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-sm font-medium">
        {title} {optional && <OptionalMark />}
      </h2>
      {children}
    </section>
  );
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
  const topRef = useRef<HTMLSpanElement>(null);

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

  const pickCategory = (id: string) => {
    setCategory(id);
    setErrors((e) => ({ ...e, category: undefined }));
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
          description={t("quickAdd.lead")}
          eyebrow={
            <Link to="/admin" className="underline-offset-4 hover:underline">
              {t("nav.staff")}
            </Link>
          }
        />

        <form onSubmit={submit} noValidate className="mt-6">
          <Card>
            <CardContent className="gap-7">
              <Block id="qa-photo-title" title={t("quickAdd.photo")} optional>
                {sensitive ? (
                  <Alert role="note">
                    <ShieldCheck aria-hidden />
                    <AlertDescription className="text-foreground">{t("quickAdd.sensitiveNoPhoto")}</AlertDescription>
                  </Alert>
                ) : (
                  <PhotoPicker idPrefix="qa-photo" files={photos} onChange={setPhotos} capture large onProcessingChange={setPhotoBusy} />
                )}
                {notice && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {notice}
                  </p>
                )}
              </Block>

              <Separator />

              <fieldset className="space-y-3" aria-describedby={errors.category ? "qa-category-error" : undefined}>
                <legend className="mb-3 text-sm font-medium">{t("quickAdd.category")}</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {QUICK_CATEGORIES.map((id) => {
                    const Icon = categoryIcon(id);
                    const on = category === id;
                    return (
                      <Toggle
                        key={id}
                        id={`qa-cat-${id}`}
                        variant="outline"
                        pressed={on}
                        onPressedChange={() => pickCategory(id)}
                        className="relative h-auto min-h-20 flex-col gap-1.5 rounded-lg px-2 py-3 text-center leading-tight whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary [&_svg:not([class*='size-'])]:size-6"
                      >
                        <Icon aria-hidden strokeWidth={1.75} />
                        <span className="break-words">{labels.category(id)}</span>
                        {on && <Check aria-hidden className="absolute top-1.5 right-1.5 size-3.5!" strokeWidth={3} />}
                      </Toggle>
                    );
                  })}
                </div>
                <div className="grid gap-2 pt-1">
                  <Label htmlFor="qa-more">{t("quickAdd.moreCategories")}</Label>
                  <NativeSelect id="qa-more" className="w-full" value={quickSet.has(category) ? "" : category} onChange={(event) => pickCategory(event.target.value)}>
                    <NativeSelectOption value="">{t("quickAdd.moreCategoriesPlaceholder")}</NativeSelectOption>
                    {labels.meta.categories.map((group) => (
                      <NativeSelectOptGroup key={group.id} label={labels.text(group.label)}>
                        {group.children
                          .filter((child) => !quickSet.has(child.id))
                          .map((child) => (
                            <NativeSelectOption key={child.id} value={child.id}>
                              {labels.text(child.label)}
                            </NativeSelectOption>
                          ))}
                      </NativeSelectOptGroup>
                    ))}
                  </NativeSelect>
                </div>
                {errors.category && <FieldError id="qa-category-error">{errors.category}</FieldError>}
              </fieldset>

              <Block id="qa-colors-title" title={t("quickAdd.colors")} optional>
                <ColorPicker value={colors} onChange={setColors} />
              </Block>

              <Separator />

              <FormField id="qa-place" label={t("quickAdd.place")} hint={t("quickAdd.rememberedPlace")} error={errors.place}>
                <NativeSelect
                  id="qa-place"
                  className="w-full"
                  value={place}
                  onChange={(event) => choosePlace(event.target.value)}
                  aria-invalid={Boolean(errors.place) || undefined}
                  aria-describedby={describedBy("qa-place", { hint: true, error: errors.place })}
                >
                  <NativeSelectOption value="">{t("quickAdd.placePlaceholder")}</NativeSelectOption>
                  {labels.meta.zones.map((zone) => (
                    <NativeSelectOptGroup key={zone.id} label={labels.text(zone.label)}>
                      {zone.places.map((p) => (
                        <NativeSelectOption key={p.id} value={p.id}>
                          {labels.text(p.label)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ))}
                </NativeSelect>
              </FormField>

              <FormField
                id="qa-description"
                label={t("quickAdd.description")}
                optional
                hint={auto ? t("quickAdd.descriptionHint", { auto }) : t("quickAdd.descriptionHintEmpty")}
              >
                <Textarea
                  id="qa-description"
                  className="min-h-20"
                  rows={2}
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  aria-describedby="qa-description-hint"
                />
              </FormField>

              <FormField id="qa-private" label={t("quickAdd.private")} optional>
                <Input
                  id="qa-private"
                  maxLength={500}
                  value={privateDetail}
                  onChange={(event) => setPrivateDetail(event.target.value)}
                  placeholder={t("quickAdd.privatePlaceholder")}
                />
              </FormField>
            </CardContent>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-4 mt-6 space-y-3 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            {mutation.isError && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>{errorText(mutation.error)}</AlertDescription>
              </Alert>
            )}
            <BusyButton
              type="submit"
              size="lg"
              className="h-11 w-full text-base"
              busy={mutation.isPending || photoBusy}
              busyLabel={photoBusy ? t("report.processingPhoto") : t("quickAdd.saving")}
            >
              {t("quickAdd.save")}
            </BusyButton>
          </div>
        </form>
      </div>
    </div>
  );
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, Lightbulb, LoaderCircle, Lock, Plus, ShieldCheck, Sparkles, Sticker } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { BusyButton } from "@/components/BusyButton";
import { describedBy, FormField, OptionalMark } from "@/components/form";
import { Swatch } from "@/components/ItemBits";
import { PageHeader } from "@/components/page";
import { CategorySelect, chipClass, ColorPicker, PhotoPicker, PlacePicker } from "@/components/Pickers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ApiError, api } from "@/lib/api";
import { useErrorText } from "@/lib/errors";
import { useDebounced, useDocumentTitle } from "@/lib/hooks";
import { dropoffAdvice, useLabels } from "@/lib/meta";
import { deviceIsOnChinaTime, inputToDate, inputToIso, isFuture, shanghaiAt, toInputValue } from "@/lib/time";
import type { Analysis, Holding, ItemKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type FieldKey = "description" | "category" | "places" | "timeFrom" | "timeTo" | "photos";
const FIELD_ORDER: [FieldKey, string][] = [
  ["description", "report-description"],
  ["category", "report-category"],
  ["places", "report-places-zone"],
  ["timeFrom", "report-time-from"],
  ["timeTo", "report-time-to"],
];

function Section({ id, step, title, children }: { id: string; step: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <Card>
        <CardHeader>
          <CardTitle id={`${id}-title`} role="heading" aria-level={2} className="flex items-center gap-3 text-lg font-bold tracking-[-0.02em]">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-bold text-ink">
              {step}
            </span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="gap-6">{children}</CardContent>
      </Card>
    </section>
  );
}

export default function ReportPage({ kind }: { kind: ItemKind }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const lost = kind === "lost";
  useDocumentTitle(lost ? t("report.titleLost") : t("report.titleFound"));

  // Wake the (possibly cold) serverless function while the person is still typing.
  useEffect(() => {
    api.health().catch(() => undefined);
  }, []);

  const [description, setDescription] = useState("");
  const [marks, setMarks] = useState("");
  const [category, setCategory] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [places, setPlaces] = useState<string[]>([]);
  const [locationNote, setLocationNote] = useState("");
  const [timeFrom, setTimeFrom] = useState(() => (lost ? "" : toInputValue(new Date())));
  const [timeTo, setTimeTo] = useState(() => toInputValue(new Date()));
  const [photos, setPhotos] = useState<File[]>([]);
  // Until the finder picks one, the drop-off follows the desk's rule of thumb (see dropoffAdvice).
  const [pickedHolding, setPickedHolding] = useState<Holding | null>(null);
  const [holdingNote, setHoldingNote] = useState("");
  const [privateDetail, setPrivateDetail] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [photosNotice, setPhotosNotice] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const touched = useRef({ category: false, colors: false, brand: false, places: false });
  const [autoFilled, setAutoFilled] = useState(false);
  const nowValue = toInputValue(new Date());

  // ------------------------------------------------------------------ live analysis (debounced 400 ms)
  const debouncedText = useDebounced(description.trim(), 400);
  const debouncedMarks = useDebounced(marks.trim(), 400);
  const analysisEnabled = debouncedText.length + debouncedMarks.length >= 3;
  const analysis = useQuery({
    queryKey: ["analyze", debouncedText, debouncedMarks],
    queryFn: ({ signal }) => api.analyze(debouncedText, debouncedMarks, signal),
    enabled: analysisEnabled,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: 1,
  });
  const result: Analysis | undefined = analysisEnabled ? analysis.data : undefined;
  const typing = description.trim() !== debouncedText || marks.trim() !== debouncedMarks;
  const analysing = analysisEnabled && (typing || analysis.isFetching);

  // Fields the person hasn't touched mirror what the description says; anything they choose wins.
  useEffect(() => {
    if (!result) return;
    let filled = false;
    if (!touched.current.category && result.category) {
      setCategory(result.category.id);
      filled = true;
    }
    if (!touched.current.colors) {
      setColors(result.colors.slice(0, 3).map((c) => c.id));
      filled ||= result.colors.length > 0;
    }
    if (!touched.current.brand && result.brands.length) {
      setBrand(result.brands[0].id);
      filled = true;
    }
    if (!touched.current.places) {
      setPlaces(lost ? result.places.slice(0, 5).map((p) => p.id) : result.places.slice(0, 1).map((p) => p.id));
      filled ||= result.places.length > 0;
    }
    if (filled) setAutoFilled(true);
  }, [result, lost]);

  const sensitive = category ? labels.isSensitive(category) : Boolean(result?.sensitive);
  const desks = labels.meta.dropoffs.filter((d) => d.kind === "desk");
  const shelves = labels.meta.dropoffs.filter((d) => d.kind === "shelf");
  const hasMarks = Boolean(
    marks.trim() || privateDetail.trim() || result?.marks.length || result?.motifs.length || result?.codes.length,
  );
  const advice = !lost && category ? dropoffAdvice(labels.meta, category, hasMarks) : null;
  const holding = pickedHolding ?? (advice === "shelf" && shelves.length ? shelves[0].id : (desks[0]?.id ?? "other"));
  useEffect(() => {
    if (sensitive && photos.length) {
      setPhotos([]);
      setPhotosNotice(t("report.photosRemovedSensitive"));
    }
  }, [sensitive, photos.length, t]);

  const clearError = (key: FieldKey) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  // ------------------------------------------------------------------ submit
  const mutation = useMutation({
    mutationFn: (form: FormData) => api.createItem(form),
    onSuccess: (data) => {
      queryClient.setQueryData(["item", data.item.id], { item: data.item, matches: data.matches, my_claim: null });
      void queryClient.invalidateQueries({ queryKey: ["items"] });
      void queryClient.invalidateQueries({ queryKey: ["myItems"] });
      navigate(`/items/${data.item.id}?new=1`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "time_in_future") setErrors((e) => ({ ...e, timeFrom: t("report.timeFuture") }));
      setSubmitError(errorText(error));
    },
  });

  const validate = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (description.trim().length < 3) next.description = t("report.descriptionRequired");
    if (!category) next.category = t("report.categoryRequired");
    if (places.length === 0) next.places = lost ? t("report.placesRequired") : t("report.placesRequiredFound");
    if (!timeFrom) next.timeFrom = lost ? t("report.timeFromRequired") : t("report.timeRequired");
    else if (isFuture(timeFrom)) next.timeFrom = t("report.timeFuture");
    if (lost && timeTo) {
      const from = inputToDate(timeFrom);
      const to = inputToDate(timeTo);
      if (isFuture(timeTo)) next.timeTo = t("report.timeFuture");
      else if (from && to && to < from) next.timeTo = t("report.timeOrder");
    }
    return next;
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    const found = validate();
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find(([key]) => found[key]);
    if (firstInvalid) {
      document.getElementById(firstInvalid[1])?.focus();
      return;
    }
    const form = new FormData();
    form.set("kind", kind);
    form.set("description", description.trim());
    form.set("marks_text", marks.trim());
    form.set("category", category);
    form.set("colors", colors.join(","));
    form.set("brand", brand);
    form.set("locations", places.join(","));
    form.set("location_note", locationNote.trim());
    form.set("time_from", inputToIso(timeFrom) ?? "");
    if (lost && timeTo) form.set("time_to", inputToIso(timeTo) ?? "");
    if (!lost) {
      form.set("holding", holding);
      form.set("holding_note", holdingNote.trim());
      form.set("private_detail", privateDetail.trim());
    }
    if (!sensitive) photos.forEach((file) => form.append("photos", file, file.name));
    mutation.mutate(form);
  };

  // ------------------------------------------------------------------ detected chips
  const applyCategory = (id: string) => {
    touched.current.category = true;
    setCategory(id);
    clearError("category");
  };
  const applyColor = (id: string) => {
    touched.current.colors = true;
    setColors((prev) => (prev.includes(id) || prev.length >= 3 ? prev : [...prev, id]));
  };
  const applyBrand = (id: string) => {
    touched.current.brand = true;
    setBrand(id);
  };
  const applyPlace = (id: string) => {
    touched.current.places = true;
    setPlaces((prev) => (lost ? (prev.includes(id) || prev.length >= 5 ? prev : [...prev, id]) : [id]));
    clearError("places");
  };

  const detected: { key: string; label: string; applied: boolean; apply: () => void; hex?: string }[] = [];
  if (result?.category)
    detected.push({
      key: `c-${result.category.id}`,
      label: labels.text(result.category.label),
      applied: category === result.category.id,
      apply: () => applyCategory(result.category!.id),
    });
  result?.colors.forEach((c) =>
    detected.push({ key: `k-${c.id}`, label: labels.text(c.label), hex: c.hex, applied: colors.includes(c.id), apply: () => applyColor(c.id) }),
  );
  result?.brands.forEach((b) => detected.push({ key: `b-${b.id}`, label: b.label, applied: brand === b.id, apply: () => applyBrand(b.id) }));
  result?.places.forEach((p) =>
    detected.push({ key: `p-${p.id}`, label: labels.text(p.label), applied: places.includes(p.id), apply: () => applyPlace(p.id) }),
  );
  const noticed = [
    ...(result?.marks ?? []).map((m) => labels.text(m.label)),
    ...(result?.motifs ?? []).map((m) => labels.text(m.label)),
    ...(result?.codes ?? []).map((code) => t("report.codeChip", { code: /^[\x00-\x7f]+$/.test(code) ? code.toUpperCase() : code })),
  ];
  const summaryItems = [...detected.map((d) => d.label), ...noticed];

  const quickPicks = [
    { label: t("report.quickToday"), value: shanghaiAt(0, 7, 30) },
    { label: t("report.quickYesterday"), value: shanghaiAt(1, 7, 30) },
    { label: t("report.quickFewDays"), value: shanghaiAt(3, 7, 30) },
    { label: t("report.quickLastWeek"), value: shanghaiAt(7, 7, 30) },
  ].filter((pick) => !isFuture(pick.value, 0));

  const chinaTimeHint = deviceIsOnChinaTime() ? null : t("time.chinaTime");
  const statusText = analysing
    ? t("report.analysing")
    : analysis.isError && analysisEnabled
      ? t("report.analysisFailed")
      : !result
        ? t("report.analysisIdle")
        : summaryItems.length === 0
          ? t("report.noDetections")
          : "";

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 max-w-3xl">
          <PageHeader
            eyebrow={lost ? t("kind.lostReport") : t("kind.foundItem")}
            title={lost ? t("report.titleLost") : t("report.titleFound")}
            description={lost ? t("report.leadLost") : t("report.leadFound")}
          />

          <form noValidate onSubmit={onSubmit} className="mt-8 space-y-6">
            <Section id="sec-describe" step={1} title={t("report.sectionDescribe")}>
              <FormField
                id="report-description"
                label={lost ? t("report.descriptionLabelLost") : t("report.descriptionLabelFound")}
                hint={t("report.descriptionHint")}
                error={errors.description}
              >
                <Textarea
                  id="report-description"
                  className="min-h-28"
                  rows={4}
                  maxLength={2000}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    clearError("description");
                  }}
                  placeholder={lost ? t("report.descriptionPlaceholderLost") : t("report.descriptionPlaceholderFound")}
                  aria-invalid={Boolean(errors.description) || undefined}
                  aria-describedby={describedBy("report-description", { hint: true, error: errors.description })}
                  aria-required
                />
              </FormField>

              <FormField
                id="report-marks"
                label={t("report.marks")}
                hint={t("report.marksHint")}
                optional
                labelExtra={<Sticker aria-hidden className="size-4 text-ink" />}
              >
                <Input
                  id="report-marks"
                  maxLength={500}
                  value={marks}
                  onChange={(event) => setMarks(event.target.value)}
                  placeholder={t("report.marksPlaceholder")}
                  aria-describedby="report-marks-hint"
                />
              </FormField>

              <div className="rounded-2xl bg-cream p-4" data-testid="analysis-panel">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    {analysing ? (
                      <LoaderCircle aria-hidden className="size-4 animate-spin text-ink" />
                    ) : (
                      <Sparkles aria-hidden className="size-4 text-ink" />
                    )}
                    {t("report.analysisLive")}
                  </span>
                  {statusText && <span className="text-muted-foreground">{statusText}</span>}
                </div>
                <p className="sr-only" aria-live="polite">
                  {!analysing && result && summaryItems.length > 0 ? t("report.analysisSummary", { items: summaryItems.join(", ") }) : ""}
                </p>

                {result && detected.length > 0 && (
                  <div className={cn("mt-3 transition-opacity", analysing && "opacity-60")}>
                    <p className="text-xs font-medium text-muted-foreground">{t("report.detected")}</p>
                    <ul className="mt-2 flex flex-wrap gap-2" data-testid="detected-chips">
                      {detected.map((chip) => (
                        <li key={chip.key}>
                          {chip.applied ? (
                            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground">
                              {chip.hex && <Swatch hex={chip.hex} size="sm" className="border-white/60" />}
                              {chip.label}
                              <Check aria-hidden className="size-3.5" strokeWidth={3} />
                              <span className="sr-only">({t("report.applied")})</span>
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={chip.apply}
                              className="rounded-full"
                              aria-label={t("report.useDetected", { label: chip.label })}
                            >
                              {chip.hex && <Swatch hex={chip.hex} size="sm" />}
                              {chip.label}
                              <Plus aria-hidden data-icon="inline-end" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result && noticed.length > 0 && (
                  <div className={cn("mt-3 transition-opacity", analysing && "opacity-60")}>
                    <p className="text-xs font-medium text-muted-foreground">{t("report.noticed")}</p>
                    <ul className="mt-2 flex flex-wrap gap-2" data-testid="noticed-chips">
                      {noticed.map((label) => (
                        <li key={label}>
                          <Badge variant="secondary" className="h-8 rounded-full px-3 text-sm font-normal">
                            <Sparkles aria-hidden data-icon="inline-start" className="text-ink" />
                            {label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result && autoFilled && detected.length > 0 && <p className="mt-3 text-sm text-muted-foreground">{t("report.prefillNote")}</p>}
                {result?.sensitive && (
                  <p className="mt-3 flex items-start gap-2 text-sm">
                    <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
                    {t("report.sensitiveDetected")}
                  </p>
                )}
              </div>
            </Section>

            <Section id="sec-details" step={2} title={t("report.sectionDetails")}>
              <FormField id="report-category" label={t("report.category")} error={errors.category}>
                <CategorySelect
                  id="report-category"
                  value={category}
                  onChange={(value) => {
                    touched.current.category = true;
                    setCategory(value);
                    clearError("category");
                  }}
                  placeholder={t("report.categoryPlaceholder")}
                  invalid={Boolean(errors.category)}
                  describedById={describedBy("report-category", { error: errors.category })}
                  required
                />
              </FormField>

              <FieldSet className="gap-3">
                <FieldLegend variant="label" className="mb-0">
                  {t("report.colors")} <OptionalMark />
                </FieldLegend>
                <FieldDescription id="report-colors-hint">{colors.length >= 3 ? t("report.colorsMax") : t("report.colorsHint")}</FieldDescription>
                <ColorPicker
                  value={colors}
                  describedById="report-colors-hint"
                  onChange={(next) => {
                    touched.current.colors = true;
                    setColors(next);
                  }}
                />
              </FieldSet>

              <FormField id="report-brand" label={t("report.brand")} optional>
                <NativeSelect
                  id="report-brand"
                  className="w-full sm:max-w-sm"
                  value={brand}
                  onChange={(event) => {
                    touched.current.brand = true;
                    setBrand(event.target.value);
                  }}
                >
                  <NativeSelectOption value="">{t("report.brandNone")}</NativeSelectOption>
                  {labels.meta.brands.map((b) => (
                    <NativeSelectOption key={b.id} value={b.id}>
                      {b.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
            </Section>

            <Section id="sec-where" step={3} title={t("report.sectionWhere")}>
              <FieldSet className="gap-3" data-invalid={errors.places ? true : undefined}>
                <FieldLegend variant="label" className="mb-0">
                  {lost ? t("report.placesLabelLost") : t("report.placesLabelFound")}
                </FieldLegend>
                <FieldDescription id="report-places-hint">{lost ? t("report.placesHintLost") : t("report.placesHintFound")}</FieldDescription>
                <PlacePicker
                  idPrefix="report-places"
                  mode={lost ? "multi" : "single"}
                  value={places}
                  onChange={(next) => {
                    touched.current.places = true;
                    setPlaces(next);
                    clearError("places");
                  }}
                  invalid={Boolean(errors.places)}
                  describedById={describedBy("report-places", { hint: true, error: errors.places })}
                />
                {errors.places && <FieldError id="report-places-error">{errors.places}</FieldError>}
              </FieldSet>
              <FormField id="report-location-note" label={t("report.locationNote")} optional>
                <Input
                  id="report-location-note"
                  maxLength={200}
                  value={locationNote}
                  onChange={(event) => setLocationNote(event.target.value)}
                  placeholder={t("report.locationNotePlaceholder")}
                />
              </FormField>
            </Section>

            <Section id="sec-when" step={4} title={t("report.sectionWhen")}>
              <div className={cn("grid gap-6", lost && "sm:grid-cols-2")}>
                <FormField
                  id="report-time-from"
                  label={lost ? t("report.timeFrom") : t("report.timeFound")}
                  hint={[lost ? t("report.timeFromHint") : null, chinaTimeHint].filter(Boolean).join(" ") || undefined}
                  hintAfter
                  error={errors.timeFrom}
                >
                  <Input
                    id="report-time-from"
                    type="datetime-local"
                    value={timeFrom}
                    max={nowValue}
                    step={60}
                    onChange={(event) => {
                      setTimeFrom(event.target.value);
                      clearError("timeFrom");
                    }}
                    aria-invalid={Boolean(errors.timeFrom) || undefined}
                    aria-describedby={describedBy("report-time-from", { hint: lost || chinaTimeHint, error: errors.timeFrom })}
                    aria-required
                  />
                  {lost && quickPicks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("report.quickPick")}>
                      {quickPicks.map((pick) => (
                        <Toggle
                          key={pick.label}
                          variant="outline"
                          size="sm"
                          pressed={timeFrom === pick.value}
                          onPressedChange={() => {
                            setTimeFrom(pick.value);
                            clearError("timeFrom");
                          }}
                          className={cn(chipClass, "h-8")}
                        >
                          {pick.label}
                        </Toggle>
                      ))}
                    </div>
                  )}
                </FormField>
                {lost && (
                  <FormField id="report-time-to" label={t("report.timeTo")} hint={chinaTimeHint ?? undefined} hintAfter error={errors.timeTo}>
                    <Input
                      id="report-time-to"
                      type="datetime-local"
                      value={timeTo}
                      max={nowValue}
                      step={60}
                      onChange={(event) => {
                        setTimeTo(event.target.value);
                        clearError("timeTo");
                      }}
                      aria-invalid={Boolean(errors.timeTo) || undefined}
                      aria-describedby={describedBy("report-time-to", { hint: chinaTimeHint, error: errors.timeTo })}
                    />
                  </FormField>
                )}
              </div>
            </Section>

            <Section id="sec-photos" step={5} title={t("report.sectionPhotos")}>
              {sensitive ? (
                <Alert role="note">
                  <ShieldCheck aria-hidden />
                  <AlertDescription className="text-foreground">{t("report.photosSensitive")}</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  <p id="report-photos-hint" className="text-sm text-muted-foreground">
                    {lost ? t("report.photosHintLost") : t("report.photosHintFound")}
                  </p>
                  <PhotoPicker idPrefix="report-photos" files={photos} onChange={setPhotos} describedById="report-photos-hint" onProcessingChange={setPhotoBusy} />
                </div>
              )}
              {photosNotice && (
                <p role="status" className="text-sm text-muted-foreground">
                  {photosNotice}
                </p>
              )}
            </Section>

            {!lost && (
              <Section id="sec-handover" step={6} title={t("report.sectionHandover")}>
                <FieldSet className="gap-3">
                  <FieldLegend variant="label" className="mb-0">
                    {t("report.holding")}
                  </FieldLegend>
                  {advice && (
                    <p id="report-holding-advice" className="flex gap-2 text-sm" data-testid="dropoff-advice">
                      <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
                      {advice === "shelf" ? t("report.adviceShelf") : t("report.adviceDesk")}
                    </p>
                  )}
                  <RadioGroup
                    value={holding}
                    onValueChange={(value) => setPickedHolding(value)}
                    className="gap-2"
                    aria-describedby={advice ? "report-holding-advice" : undefined}
                  >
                    <div className="rounded-xl border p-3">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {t("report.holdingDesks")}
                        {advice === "desk" && <Badge variant="secondary">{t("report.holdingSuggested")}</Badge>}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{t("report.holdingDeskHint")}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {desks.map((desk) => (
                          <FieldLabel key={desk.id} htmlFor={`holding-${desk.id}`}>
                            <Field orientation="horizontal">
                              <RadioGroupItem value={desk.id} id={`holding-${desk.id}`} />
                              <FieldContent>
                                <FieldTitle>{labels.text(desk.label)}</FieldTitle>
                              </FieldContent>
                            </Field>
                          </FieldLabel>
                        ))}
                      </div>
                    </div>
                    {[
                      ...shelves.map((shelf) => ({
                        value: shelf.id,
                        title: labels.text(shelf.label),
                        hint: t("report.holdingShelfHint", { days: shelf.ttl_days ?? labels.meta.item_ttl_days }),
                        suggested: advice === "shelf",
                      })),
                      { value: "with_finder", title: t("report.holdingWithMe"), hint: t("report.holdingWithMeHint"), suggested: false },
                      { value: "other", title: t("report.holdingOther"), hint: t("report.holdingOtherHint"), suggested: false },
                    ].map(({ value, title, hint, suggested }) => (
                      <FieldLabel key={value} htmlFor={`holding-${value}`}>
                        <Field orientation="horizontal">
                          <RadioGroupItem value={value} id={`holding-${value}`} />
                          <FieldContent>
                            <FieldTitle>
                              {title}
                              {suggested && <Badge variant="secondary">{t("report.holdingSuggested")}</Badge>}
                            </FieldTitle>
                            <FieldDescription>{hint}</FieldDescription>
                          </FieldContent>
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                </FieldSet>
                <FormField id="report-holding-note" label={t("report.holdingNote")} optional>
                  <Input
                    id="report-holding-note"
                    maxLength={200}
                    value={holdingNote}
                    onChange={(event) => setHoldingNote(event.target.value)}
                    placeholder={t("report.holdingNotePlaceholder")}
                  />
                </FormField>
                <FormField
                  id="report-private"
                  label={t("report.private")}
                  hint={t("report.privateHint")}
                  optional
                  labelExtra={
                    <Badge variant="secondary">
                      <Lock aria-hidden data-icon="inline-start" />
                      {t("report.privateBadge")}
                    </Badge>
                  }
                >
                  <Input
                    id="report-private"
                    maxLength={500}
                    value={privateDetail}
                    onChange={(event) => setPrivateDetail(event.target.value)}
                    placeholder={t("report.privatePlaceholder")}
                    aria-describedby="report-private-hint"
                  />
                </FormField>
              </Section>
            )}

            <div className="space-y-4 pt-2">
              {(submitError || Object.values(errors).some(Boolean)) && (
                <Alert variant="destructive">
                  <CircleAlert aria-hidden />
                  <AlertDescription>{submitError || t("report.fixErrors")}</AlertDescription>
                </Alert>
              )}
              <BusyButton
                type="submit"
                size="lg"
                variant={lost ? "sun" : "coral"}
                className="h-14 w-full px-8 text-[1.0625rem] sm:w-auto"
                busy={mutation.isPending || photoBusy}
                busyLabel={photoBusy ? t("report.processingPhoto") : t("report.submitting")}
              >
                {lost ? t("report.submitLost") : t("report.submitFound")}
              </BusyButton>
              <p className="text-sm text-muted-foreground">{t("report.privacyNote")}</p>
            </div>
          </form>
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-20 mt-[5.75rem]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb aria-hidden className="size-4 text-ink" />
                {t("report.marks")}
              </CardTitle>
              <CardDescription>{t("report.marksHint")}</CardDescription>
            </CardHeader>
            <CardContent className="gap-4">
              <p className="text-sm">{t("report.marksStat")}</p>
              <Separator />
              <p className="flex gap-2 text-sm text-muted-foreground">
                <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
                {t("report.privacyNote")}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

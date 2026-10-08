import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Lightbulb, Lock, Plus, ShieldCheck, Sparkles, Sticker } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Swatch } from "../components/ItemBits";
import { CategorySelect, ColorPicker, PhotoPicker, PlacePicker, chipClass } from "../components/Pickers";
import { Badge, Button, describedBy, Field, FieldError, Notice, PageHeader } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { useErrorText } from "../lib/errors";
import { useDebounced, useDocumentTitle } from "../lib/hooks";
import { useLabels } from "../lib/meta";
import { deviceIsOnChinaTime, inputToDate, inputToIso, isFuture, shanghaiAt, toInputValue } from "../lib/time";
import type { Analysis, Holding, ItemKind } from "../lib/types";

type FieldKey = "description" | "category" | "places" | "timeFrom" | "timeTo" | "photos";
const FIELD_ORDER: [FieldKey, string][] = [
  ["description", "report-description"],
  ["category", "report-category"],
  ["places", "report-places-zone"],
  ["timeFrom", "report-time-from"],
  ["timeTo", "report-time-to"],
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-7">
      <h2 id={id} className="text-xl font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-5 space-y-6">{children}</div>
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
  const [holding, setHolding] = useState<Holding>("front_desk");
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
  result?.brands.forEach((b) =>
    detected.push({ key: `b-${b.id}`, label: b.label, applied: brand === b.id, apply: () => applyBrand(b.id) }),
  );
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

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 max-w-3xl">
          <PageHeader
            eyebrow={lost ? t("kind.lostReport") : t("kind.foundItem")}
            title={lost ? t("report.titleLost") : t("report.titleFound")}
            lead={lost ? t("report.leadLost") : t("report.leadFound")}
          />

          <form noValidate onSubmit={onSubmit} className="mt-8 space-y-10">
            <Section id="sec-describe" title={t("report.sectionDescribe")}>
              <Field
                id="report-description"
                label={lost ? t("report.descriptionLabelLost") : t("report.descriptionLabelFound")}
                hint={t("report.descriptionHint")}
                error={errors.description}
              >
                <textarea
                  id="report-description"
                  className="field-control"
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
              </Field>

              <Field
                id="report-marks"
                label={t("report.marks")}
                hint={t("report.marksHint")}
                optional
                labelExtra={<Sticker aria-hidden className="size-4 text-brand" />}
              >
                <input
                  id="report-marks"
                  className="field-control"
                  maxLength={500}
                  value={marks}
                  onChange={(event) => setMarks(event.target.value)}
                  placeholder={t("report.marksPlaceholder")}
                  aria-describedby="report-marks-hint"
                />
              </Field>

              <div className="rounded-md bg-surface p-4" data-testid="analysis-panel">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                    <span
                      aria-hidden
                      className={`size-2.5 rounded-full bg-sonar ${analysing ? "animate-pulse-dot" : ""}`}
                    />
                    {t("report.analysisLive")}
                  </span>
                  <span className="text-sm text-muted">
                    {analysing
                      ? t("report.analysing")
                      : analysis.isError && analysisEnabled
                        ? t("report.analysisFailed")
                        : !result
                          ? t("report.analysisIdle")
                          : summaryItems.length === 0
                            ? t("report.noDetections")
                            : ""}
                  </span>
                </div>
                <p className="sr-only" aria-live="polite">
                  {!analysing && result && summaryItems.length > 0 ? t("report.analysisSummary", { items: summaryItems.join(", ") }) : ""}
                </p>

                {result && detected.length > 0 && (
                  <div className={`mt-3 transition-opacity ${analysing ? "opacity-60" : ""}`}>
                    <p className="text-[0.8125rem] font-semibold text-muted">{t("report.detected")}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-2" data-testid="detected-chips">
                      {detected.map((chip) => (
                        <li key={chip.key}>
                          {chip.applied ? (
                            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-3 text-sm font-medium text-water">
                              {chip.hex && <Swatch hex={chip.hex} size="sm" className="border-water/60" />}
                              {chip.label}
                              <Check aria-hidden className="size-3.5" strokeWidth={3} />
                              <span className="sr-only">({t("report.applied")})</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={chip.apply}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand bg-water px-3 text-sm font-medium text-brand-deep hover:bg-mist"
                              aria-label={t("report.useDetected", { label: chip.label })}
                            >
                              {chip.hex && <Swatch hex={chip.hex} size="sm" />}
                              {chip.label}
                              <Plus aria-hidden className="size-3.5" strokeWidth={3} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result && noticed.length > 0 && (
                  <div className={`mt-3 transition-opacity ${analysing ? "opacity-60" : ""}`}>
                    <p className="text-[0.8125rem] font-semibold text-muted">{t("report.noticed")}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-2" data-testid="noticed-chips">
                      {noticed.map((label) => (
                        <li
                          key={label}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-mist px-3 text-sm font-medium text-brand-deep"
                        >
                          <Sparkles aria-hidden className="size-3.5" />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result && autoFilled && detected.length > 0 && (
                  <p className="mt-3 text-sm text-muted">{t("report.prefillNote")}</p>
                )}
                {result?.sensitive && (
                  <p className="mt-3 flex items-start gap-2 text-sm text-ink">
                    <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                    {t("report.sensitiveDetected")}
                  </p>
                )}
              </div>
            </Section>

            <Section id="sec-details" title={t("report.sectionDetails")}>
              <Field id="report-category" label={t("report.category")} error={errors.category}>
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
              </Field>

              <fieldset>
                <legend className="text-[0.9375rem] font-semibold text-ink">
                  {t("report.colors")} <span className="font-normal text-muted">({t("common.optional")})</span>
                </legend>
                <p id="report-colors-hint" className="mt-1 text-sm text-muted">
                  {colors.length >= 3 ? t("report.colorsMax") : t("report.colorsHint")}
                </p>
                <div className="mt-3">
                  <ColorPicker
                    value={colors}
                    describedById="report-colors-hint"
                    onChange={(next) => {
                      touched.current.colors = true;
                      setColors(next);
                    }}
                  />
                </div>
              </fieldset>

              <Field id="report-brand" label={t("report.brand")} optional>
                <select
                  id="report-brand"
                  className="field-control sm:max-w-sm"
                  value={brand}
                  onChange={(event) => {
                    touched.current.brand = true;
                    setBrand(event.target.value);
                  }}
                >
                  <option value="">{t("report.brandNone")}</option>
                  {labels.meta.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>

            <Section id="sec-where" title={t("report.sectionWhere")}>
              <fieldset>
                <legend className="text-[0.9375rem] font-semibold text-ink">
                  {lost ? t("report.placesLabelLost") : t("report.placesLabelFound")}
                </legend>
                <p id="report-places-hint" className="mt-1 text-sm text-muted">
                  {lost ? t("report.placesHintLost") : t("report.placesHintFound")}
                </p>
                <div className="mt-3">
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
                </div>
                <FieldError id="report-places-error">{errors.places}</FieldError>
              </fieldset>
              <Field id="report-location-note" label={t("report.locationNote")} optional>
                <input
                  id="report-location-note"
                  className="field-control"
                  maxLength={200}
                  value={locationNote}
                  onChange={(event) => setLocationNote(event.target.value)}
                  placeholder={t("report.locationNotePlaceholder")}
                />
              </Field>
            </Section>

            <Section id="sec-when" title={t("report.sectionWhen")}>
              <div className={`grid gap-6 ${lost ? "sm:grid-cols-2" : ""}`}>
                <Field
                  id="report-time-from"
                  label={lost ? t("report.timeFrom") : t("report.timeFound")}
                  hint={[lost ? t("report.timeFromHint") : null, chinaTimeHint].filter(Boolean).join(" ") || undefined}
                  error={errors.timeFrom}
                >
                  <input
                    id="report-time-from"
                    type="datetime-local"
                    className="field-control"
                    value={timeFrom}
                    max={nowValue}
                    step={60}
                    onChange={(event) => {
                      setTimeFrom(event.target.value);
                      clearError("timeFrom");
                    }}
                    aria-invalid={Boolean(errors.timeFrom) || undefined}
                    aria-describedby={describedBy("report-time-from", {
                      hint: lost || chinaTimeHint,
                      error: errors.timeFrom,
                    })}
                    aria-required
                  />
                  {lost && quickPicks.length > 0 && (
                    <div className="mt-2.5" role="group" aria-label={t("report.quickPick")}>
                      <div className="flex flex-wrap gap-1.5">
                        {quickPicks.map((pick) => (
                          <button
                            key={pick.label}
                            type="button"
                            aria-pressed={timeFrom === pick.value}
                            onClick={() => {
                              setTimeFrom(pick.value);
                              clearError("timeFrom");
                            }}
                            className={chipClass(timeFrom === pick.value, "", "sm")}
                          >
                            {pick.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Field>
                {lost && (
                  <Field id="report-time-to" label={t("report.timeTo")} hint={chinaTimeHint ?? undefined} error={errors.timeTo}>
                    <input
                      id="report-time-to"
                      type="datetime-local"
                      className="field-control"
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
                  </Field>
                )}
              </div>
            </Section>

            <Section id="sec-photos" title={t("report.sectionPhotos")}>
              {sensitive ? (
                <Notice icon={ShieldCheck}>{t("report.photosSensitive")}</Notice>
              ) : (
                <div>
                  <p id="report-photos-hint" className="mb-3 text-sm text-muted">
                    {lost ? t("report.photosHintLost") : t("report.photosHintFound")}
                  </p>
                  <PhotoPicker
                    idPrefix="report-photos"
                    files={photos}
                    onChange={setPhotos}
                    describedById="report-photos-hint"
                    onProcessingChange={setPhotoBusy}
                  />
                </div>
              )}
              {photosNotice && (
                <p role="status" className="text-sm text-muted">
                  {photosNotice}
                </p>
              )}
            </Section>

            {!lost && (
              <Section id="sec-handover" title={t("report.sectionHandover")}>
                <fieldset>
                  <legend className="text-[0.9375rem] font-semibold text-ink">{t("report.holding")}</legend>
                  <div className="mt-3 grid gap-2">
                    {(
                      [
                        ["front_desk", t("report.holdingFrontDesk"), t("report.holdingFrontDeskHint")],
                        ["with_finder", t("report.holdingWithMe"), t("report.holdingWithMeHint")],
                        ["other", t("report.holdingOther"), t("report.holdingOtherHint")],
                      ] as const
                    ).map(([value, title, hint]) => (
                      <label
                        key={value}
                        className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-sm border px-4 py-3 transition-colors ${
                          holding === value ? "border-brand bg-mist" : "border-line-strong hover:bg-surface"
                        }`}
                      >
                        <input
                          type="radio"
                          name="holding"
                          value={value}
                          checked={holding === value}
                          onChange={() => setHolding(value)}
                          className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]"
                        />
                        <span>
                          <span className="block font-semibold text-ink">{title}</span>
                          <span className="block text-sm text-muted">{hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field id="report-holding-note" label={t("report.holdingNote")} optional>
                  <input
                    id="report-holding-note"
                    className="field-control"
                    maxLength={200}
                    value={holdingNote}
                    onChange={(event) => setHoldingNote(event.target.value)}
                    placeholder={t("report.holdingNotePlaceholder")}
                  />
                </Field>
                <Field
                  id="report-private"
                  label={t("report.private")}
                  hint={t("report.privateHint")}
                  optional
                  labelExtra={
                    <Badge tone="mist" icon={Lock}>
                      {t("report.privateBadge")}
                    </Badge>
                  }
                >
                  <input
                    id="report-private"
                    className="field-control"
                    maxLength={500}
                    value={privateDetail}
                    onChange={(event) => setPrivateDetail(event.target.value)}
                    placeholder={t("report.privatePlaceholder")}
                    aria-describedby="report-private-hint"
                  />
                </Field>
              </Section>
            )}

            <div className="space-y-4 border-t border-line pt-7">
              {submitError && (
                <Notice tone="error" role="alert">
                  {submitError}
                </Notice>
              )}
              {!submitError && Object.values(errors).some(Boolean) && (
                <Notice tone="error" role="alert">
                  {t("report.fixErrors")}
                </Notice>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto"
                busy={mutation.isPending || photoBusy}
                busyLabel={photoBusy ? t("report.processingPhoto") : t("report.submitting")}
              >
                {lost ? t("report.submitLost") : t("report.submitFound")}
              </Button>
              <p className="text-sm text-muted">{t("report.privacyNote")}</p>
            </div>
          </form>
        </div>

        <aside className="mt-12 hidden lg:mt-[5.5rem] lg:block">
          <div className="sticky top-6 space-y-5 rounded-md bg-surface p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Lightbulb aria-hidden className="size-5 text-brand" />
              {t("report.marks")}
            </h2>
            <p className="text-[0.9375rem] leading-relaxed text-muted">{t("report.marksHint")}</p>
            <p className="text-[0.9375rem] leading-relaxed text-ink">{t("report.marksStat")}</p>
            <div className="h-px bg-line" />
            <p className="flex gap-2 text-sm leading-relaxed text-muted">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
              {t("report.privacyNote")}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

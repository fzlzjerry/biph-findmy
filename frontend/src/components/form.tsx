import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

/** aria-describedby for a control whose hint / error ids follow the `${id}-hint` / `${id}-error` convention. */
export function describedBy(id: string, parts: { hint?: unknown; error?: unknown }): string | undefined {
  const ids = [parts.hint ? `${id}-hint` : null, parts.error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function OptionalMark() {
  const { t } = useTranslation();
  return <span className="font-normal text-muted-foreground">({t("common.optional")})</span>;
}

/** Label + hint + control + error, wired together by id (shadcn Field underneath). */
export function FormField({ id, label, hint, hintAfter = false, error, optional, children, className, labelExtra }: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Put the hint under the control (keeps side-by-side fields aligned when only one has a hint). */
  hintAfter?: boolean;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
  labelExtra?: ReactNode;
}) {
  return (
    <Field data-invalid={error ? true : undefined} className={className ?? "gap-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel htmlFor={id}>
          {label}
          {optional && <OptionalMark />}
        </FieldLabel>
        {labelExtra}
      </div>
      {hint && !hintAfter && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      {children}
      {hint && hintAfter && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

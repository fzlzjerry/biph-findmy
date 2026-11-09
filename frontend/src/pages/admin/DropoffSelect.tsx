import { useTranslation } from "react-i18next";
import { FormField } from "@/components/form";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useUser } from "@/lib/auth";
import { useLabels } from "@/lib/meta";

/** Desk / shelf picker for the front desk pages; the signed-in person's own desk is marked "(yours)". */
export function DropoffSelect({ id, label, value, onChange, allLabel, size, className }: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Adds an empty "all" option with this text. */
  allLabel?: string;
  size?: "sm" | "default";
  className?: string;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const { user } = useUser();
  const select = (
    <NativeSelect id={id} size={size} className={className ?? "w-full"} value={value} onChange={(event) => onChange(event.target.value)}>
      {allLabel !== undefined && <NativeSelectOption value="">{allLabel}</NativeSelectOption>}
      {labels.meta.dropoffs.map((d) => (
        <NativeSelectOption key={d.id} value={d.id}>
          {d.id === user?.desk ? t("admin.yourDesk", { desk: labels.text(d.label) }) : labels.text(d.label)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
  if (!label) return select;
  return (
    <FormField id={id} label={label}>
      {select}
    </FormField>
  );
}

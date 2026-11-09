import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Server, Trash2, UserPlus, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { BusyButton } from "@/components/BusyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { describedBy, FormField } from "@/components/form";
import { Email } from "@/components/ItemBits";
import { SectionHeader } from "@/components/page";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToneBadge } from "@/components/badges";
import { useLang } from "@/i18n";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useErrorText } from "@/lib/errors";
import { formatRelative, useNow } from "@/lib/time";
import type { StaffMember } from "@/lib/types";
import { DropoffSelect } from "./DropoffSelect";

const ROLES: StaffMember["role"][] = ["admin", "superadmin"];

function useInvalidateStaff() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    void queryClient.invalidateQueries({ queryKey: ["me"] });
  };
}

function AddStaff({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const errorText = useErrorText();
  const invalidate = useInvalidateStaff();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffMember["role"]>("admin");
  const [desk, setDesk] = useState("");
  const [emailError, setEmailError] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.admin.addStaff({ email: email.trim(), role, desk: desk || null }),
    onSuccess: ({ staff }) => {
      invalidate();
      toast({ message: t("admin.staff.added", { email: staff.email }), tone: "success" });
      setEmail("");
      setDesk("");
      setRole("admin");
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setEmailError(t("admin.staff.emailRequired"));
      document.getElementById("staff-email")?.focus();
      return;
    }
    setEmailError("");
    mutation.mutate();
  };

  return (
    <Card size="sm">
      <CardContent>
        <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_14rem_auto] lg:items-end">
          <FormField id="staff-email" label={t("admin.staff.email")} error={emailError}>
            <Input
              id="staff-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              disabled={disabled}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError("");
              }}
              placeholder="name@basischina.com"
              aria-invalid={Boolean(emailError) || undefined}
              aria-describedby={describedBy("staff-email", { error: emailError })}
            />
          </FormField>
          <FormField id="staff-role" label={t("admin.staff.role")}>
            <NativeSelect
              id="staff-role"
              className="w-full"
              value={role}
              disabled={disabled}
              onChange={(event) => setRole(event.target.value as StaffMember["role"])}
            >
              {ROLES.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {t(`admin.staff.roles.${r}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <DropoffSelect id="staff-desk" label={t("admin.staff.desk")} value={desk} onChange={setDesk} allLabel={t("admin.staff.noDesk")} />
          <BusyButton type="submit" busy={mutation.isPending} busyLabel={t("admin.staff.adding")} disabled={disabled}>
            <UserPlus aria-hidden data-icon="inline-start" />
            {t("admin.staff.add")}
          </BusyButton>
        </form>
        {mutation.isError && (
          <Alert variant="destructive" className="mt-3">
            <CircleAlert aria-hidden />
            <AlertDescription>{errorText(mutation.error)}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function StaffRow({ member, onRemove, ready }: { member: StaffMember; onRemove: (member: StaffMember) => void; ready: boolean }) {
  const { t } = useTranslation();
  const lang = useLang();
  const now = useNow();
  const { user } = useUser();
  const toast = useToast();
  const errorText = useErrorText();
  const invalidate = useInvalidateStaff();
  const mutation = useMutation({
    mutationFn: (patch: { role?: StaffMember["role"]; desk?: string | null }) => api.admin.updateStaff(member.email, patch),
    onSuccess: () => {
      invalidate();
      toast({ message: t("admin.staff.saved"), tone: "success" });
    },
    onError: (error) => toast({ message: errorText(error), tone: "error" }),
  });
  const isMe = member.email === user?.email;
  const fromServer = member.managed === "env";

  return (
    <Card size="sm" className="py-3" data-testid="staff-row">
      <CardContent className="flex flex-col gap-3 px-3 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="break-all">
              <Email value={member.email} />
            </span>
            {isMe && <ToneBadge tone="blue">{t("admin.staff.you")}</ToneBadge>}
            {fromServer && (
              <ToneBadge tone="gray" icon={Server}>
                {t("admin.staff.fromServer")}
              </ToneBadge>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {member.display_name && <>{member.display_name} · </>}
            {member.last_seen_at
              ? t("admin.staff.lastSeen", { time: formatRelative(member.last_seen_at, lang, now) })
              : t("admin.staff.neverSignedIn")}
          </p>
          {fromServer && <p className="mt-0.5 text-sm text-muted-foreground">{t("admin.staff.fromServerHint")}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <label htmlFor={`role-${member.email}`} className="sr-only">
            {t("admin.staff.roleFor", { email: member.email })}
          </label>
          <NativeSelect
            id={`role-${member.email}`}
            size="sm"
            className="min-w-32"
            value={member.role}
            disabled={fromServer || isMe || mutation.isPending || !ready}
            onChange={(event) => mutation.mutate({ role: event.target.value as StaffMember["role"] })}
          >
            {ROLES.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {t(`admin.staff.roles.${r}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <label htmlFor={`desk-${member.email}`} className="sr-only">
            {t("admin.staff.deskFor", { email: member.email })}
          </label>
          <DropoffSelect
            id={`desk-${member.email}`}
            size="sm"
            className="min-w-40"
            value={member.desk ?? ""}
            onChange={(desk) => mutation.mutate({ desk: desk || null })}
            allLabel={t("admin.staff.noDesk")}
          />
          {!fromServer && !isMe && (
            <Button variant="outline" size="sm" onClick={() => onRemove(member)} aria-label={`${t("admin.staff.remove")}: ${member.email}`}>
              <Trash2 aria-hidden data-icon="inline-start" />
              {t("admin.staff.remove")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Super admins only: who is front desk staff, and which desk each person works at. */
export default function StaffTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const errorText = useErrorText();
  const invalidate = useInvalidateStaff();
  const query = useQuery({ queryKey: ["admin", "staff"], queryFn: api.admin.staff });
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const remove = useMutation({
    mutationFn: (member: StaffMember) => api.admin.removeStaff(member.email),
    onSuccess: (_, member) => {
      invalidate();
      setRemoving(null);
      toast({ message: t("admin.staff.removed", { email: member.email }), tone: "success" });
    },
  });
  const ready = query.data?.ready ?? true;

  return (
    <div className="space-y-8">
      <p className="max-w-prose text-muted-foreground">{t("admin.staff.lead")}</p>
      {!ready && (
        <Alert role="note">
          <CircleAlert aria-hidden />
          <AlertDescription className="text-foreground">{t("admin.staff.notReady")}</AlertDescription>
        </Alert>
      )}
      <section aria-labelledby="staff-add-title" className="space-y-4">
        <SectionHeader id="staff-add-title" title={t("admin.staff.addTitle")} />
        <AddStaff disabled={!ready} />
      </section>
      <section aria-labelledby="staff-list-title" className="space-y-4">
        <SectionHeader id="staff-list-title" title={t("admin.staff.listTitle")} />
        {query.isPending ? (
          <RowsSkeleton rows={2} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.staff.length === 0 ? (
          <EmptyState compact icon={Users} title={t("admin.staff.listTitle")} />
        ) : (
          <ul className="space-y-2">
            {query.data.staff.map((member) => (
              <li key={member.email}>
                <StaffRow member={member} onRemove={setRemoving} ready={ready} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmDialog
        open={removing !== null}
        onClose={() => {
          setRemoving(null);
          remove.reset();
        }}
        onConfirm={() => removing && remove.mutate(removing)}
        title={t("admin.staff.removeTitle", { email: removing?.email ?? "" })}
        description={t("admin.staff.removeBody")}
        confirmLabel={t("admin.staff.removeConfirm")}
        busyLabel={t("admin.staff.removing")}
        busy={remove.isPending}
        destructive
        error={remove.isError ? errorText(remove.error) : undefined}
      />
    </div>
  );
}

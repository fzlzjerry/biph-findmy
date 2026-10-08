import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail, Terminal } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { Mascot } from "../components/Layout";
import { useToast } from "../components/Toast";
import { Button, describedBy, Field, Notice } from "../components/ui";
import { api } from "../lib/api";
import { useResetUserData, useUser } from "../lib/auth";
import { useErrorText } from "../lib/errors";
import { safeNext, useCountdown, useDocumentTitle } from "../lib/hooks";
import { useLabels } from "../lib/meta";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RESEND_SECONDS = 60;

export default function LoginPage() {
  const { t } = useTranslation();
  const labels = useLabels();
  useDocumentTitle(t("login.title"));
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const resetUserData = useResetUserData();
  const toast = useToast();
  const errorText = useErrorText();
  const { user, isLoading } = useUser();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [emailError, setEmailError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [resent, setResent] = useState(false);
  const secondsLeft = useCountdown(sentAt, RESEND_SECONDS);
  const codeRef = useRef<HTMLInputElement>(null);
  const completed = useRef(false);

  const requestCode = useMutation({
    mutationFn: ({ address }: { address: string; resend: boolean }) => api.requestCode(address),
    onSuccess: (data, { resend }) => {
      setSentAt(Date.now());
      setDevCode(data.dev_code ?? null);
      setCode(data.dev_code ?? "");
      setCodeError("");
      setResent(resend);
      setStep("code");
    },
  });

  const verify = useMutation({
    mutationFn: () => api.verify(email.trim().toLowerCase(), code, name),
    onSuccess: (data) => {
      completed.current = true;
      resetUserData(data.user);
      toast({ message: t("login.welcome", { name: data.user.display_name }), tone: "success" });
      navigate(next, { replace: true });
    },
  });

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  if (!isLoading && user && !completed.current) return <Navigate to={next} replace />;

  const domains = labels.meta.auth.domains;
  const domainHint = domains.length ? t("login.domainHint", { domains: domains.map((d) => `@${d}`).join(" / ") }) : t("login.domainHintAny");

  const submitEmail = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t("login.emailInvalid"));
      return;
    }
    setEmailError("");
    requestCode.mutate({ address: email.trim().toLowerCase(), resend: false });
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6,10}$/.test(code)) {
      setCodeError(t("login.codeInvalidFormat"));
      codeRef.current?.focus();
      return;
    }
    setCodeError("");
    verify.mutate();
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-6 size-28 sm:size-32">
          <Mascot alt={t("login.mascotAlt")} sizes="128px" />
        </div>
        <h1 className="text-center text-[1.75rem] font-bold leading-tight text-ink">{t("login.title")}</h1>
        <p className="mt-2 text-center text-muted">{t("login.lead")}</p>

        {step === "email" ? (
          <form onSubmit={submitEmail} noValidate className="mt-8 space-y-5">
            <Field id="login-email" label={t("login.email")} hint={domainHint} error={emailError}>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                className="field-control"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("login.emailPlaceholder")}
                aria-invalid={Boolean(emailError) || undefined}
                aria-describedby={describedBy("login-email", { hint: true, error: emailError })}
                required
                autoFocus
              />
            </Field>
            {requestCode.isError && (
              <Notice tone="error" role="alert">
                {errorText(requestCode.error)}
              </Notice>
            )}
            <Button type="submit" size="lg" icon={Mail} className="w-full" busy={requestCode.isPending} busyLabel={t("login.sending")}>
              {t("login.sendCode")}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode} noValidate className="mt-8 space-y-5">
            <p className="rounded-sm bg-mist px-4 py-3 text-[0.9375rem] text-ink" role="status">
              {resent ? t("login.codeResent") : t("login.codeSent", { email: email.trim().toLowerCase() })}
            </p>
            {devCode && (
              <div className="rounded-sm border-2 border-dashed border-brand px-4 py-3" role="note" data-testid="dev-code-banner">
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-deep">
                  <Terminal aria-hidden className="size-4" />
                  {t("login.devBanner")}
                </p>
                <p className="mt-1 text-[0.9375rem] text-ink">{t("login.devBody", { code: devCode })}</p>
              </div>
            )}
            <Field id="login-code" label={t("login.code")} hint={t("login.codeHint")} error={codeError}>
              <input
                ref={codeRef}
                id="login-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={10}
                className="field-control text-center text-2xl font-semibold tracking-[0.5em] tabular"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 10));
                  if (codeError) setCodeError("");
                }}
                aria-invalid={Boolean(codeError) || undefined}
                aria-describedby={describedBy("login-code", { hint: true, error: codeError })}
                required
              />
            </Field>
            <Field id="login-name" label={t("login.displayName")} hint={t("login.displayNameHint")} optional>
              <input
                id="login-name"
                className="field-control"
                autoComplete="nickname"
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-describedby="login-name-hint"
              />
            </Field>
            {verify.isError && (
              <Notice tone="error" role="alert">
                {errorText(verify.error)}
              </Notice>
            )}
            {requestCode.isError && (
              <Notice tone="error" role="alert">
                {errorText(requestCode.error)}
              </Notice>
            )}
            <Button type="submit" size="lg" className="w-full" busy={verify.isPending} busyLabel={t("login.verifying")}>
              {t("login.verify")}
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="quiet"
                size="sm"
                icon={ArrowLeft}
                className="-ml-3"
                onClick={() => {
                  setStep("email");
                  setResent(false);
                  setDevCode(null);
                  setCode("");
                  verify.reset();
                }}
              >
                {t("login.changeEmail")}
              </Button>
              <Button
                variant="quiet"
                size="sm"
                className="-mr-3"
                disabled={secondsLeft > 0 || requestCode.isPending}
                onClick={() => requestCode.mutate({ address: email.trim().toLowerCase(), resend: true })}
              >
                {secondsLeft > 0 ? t("login.resendIn", { s: secondsLeft }) : requestCode.isPending ? t("login.sending") : t("login.resend")}
              </Button>
            </div>
          </form>
        )}
        <p className="mt-8 text-center text-sm text-muted">{t("login.privacy")}</p>
      </div>
    </div>
  );
}

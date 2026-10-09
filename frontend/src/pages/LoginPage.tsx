import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CircleAlert, Mail, MailCheck, Terminal } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { BusyButton } from "@/components/BusyButton";
import { describedBy, FormField } from "@/components/form";
import { LogoMark } from "@/components/Layout";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { api } from "@/lib/api";
import { useResetUserData, useUser } from "@/lib/auth";
import { useErrorText } from "@/lib/errors";
import { safeNext, useCountdown, useDocumentTitle } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

function ErrorAlert({ children }: { children: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

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
  const address = email.trim().toLowerCase();

  const submitEmail = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t("login.emailInvalid"));
      return;
    }
    setEmailError("");
    requestCode.mutate({ address, resend: false });
  };

  const submitCode = (event?: FormEvent) => {
    event?.preventDefault();
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
      setCodeError(t("login.codeInvalidFormat"));
      codeRef.current?.focus();
      return;
    }
    setCodeError("");
    verify.mutate();
  };

  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <LogoMark className="mx-auto mb-2 size-10" />
            <CardTitle role="heading" aria-level={1} className="text-xl font-semibold">
              {t("login.title")}
            </CardTitle>
            <CardDescription>{t("login.lead")}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form onSubmit={submitEmail} noValidate className="space-y-5">
                <FormField id="login-email" label={t("login.email")} hint={domainHint} error={emailError}>
                  <Input
                    id="login-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="h-10"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={domains.length ? `name@${domains[0]}` : t("login.emailPlaceholder")}
                    aria-invalid={Boolean(emailError) || undefined}
                    aria-describedby={describedBy("login-email", { hint: true, error: emailError })}
                    required
                    autoFocus
                  />
                </FormField>
                {requestCode.isError && <ErrorAlert>{errorText(requestCode.error)}</ErrorAlert>}
                <BusyButton
                  type="submit"
                  size="lg"
                  className="w-full"
                  icon={<Mail aria-hidden data-icon="inline-start" />}
                  busy={requestCode.isPending}
                  busyLabel={t("login.sending")}
                >
                  {t("login.sendCode")}
                </BusyButton>
              </form>
            ) : (
              <form onSubmit={submitCode} noValidate className="space-y-5">
                <Alert role="status" className="border-primary/20 bg-primary/5">
                  <MailCheck aria-hidden className="text-primary" />
                  <AlertDescription className="text-foreground">
                    {resent ? t("login.codeResent") : t("login.codeSent", { email: address })}
                  </AlertDescription>
                </Alert>
                {devCode && (
                  <Alert role="note" className="border-dashed border-amber-300 bg-amber-50 text-amber-900" data-testid="dev-code-banner">
                    <Terminal aria-hidden />
                    <AlertTitle className="text-xs font-semibold tracking-wide uppercase">{t("login.devBanner")}</AlertTitle>
                    <AlertDescription className="text-current/80">{t("login.devBody", { code: devCode })}</AlertDescription>
                  </Alert>
                )}
                <FormField id="login-code" label={t("login.code")} hint={t("login.codeHint")} error={codeError}>
                  <InputOTP
                    ref={codeRef}
                    id="login-code"
                    maxLength={CODE_LENGTH}
                    pattern="^[0-9]+$"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(value) => {
                      setCode(value.replace(/\D/g, ""));
                      if (codeError) setCodeError("");
                    }}
                    containerClassName="justify-center"
                    aria-invalid={Boolean(codeError) || undefined}
                    aria-describedby={describedBy("login-code", { hint: true, error: codeError })}
                    required
                  >
                    <InputOTPGroup>
                      {Array.from({ length: CODE_LENGTH }, (_, i) => (
                        <InputOTPSlot key={i} index={i} className="size-11 text-lg font-medium" aria-invalid={Boolean(codeError) || undefined} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </FormField>
                <FormField id="login-name" label={t("login.displayName")} hint={t("login.displayNameHint")} optional>
                  <Input
                    id="login-name"
                    autoComplete="nickname"
                    maxLength={60}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-describedby="login-name-hint"
                  />
                </FormField>
                {verify.isError && <ErrorAlert>{errorText(verify.error)}</ErrorAlert>}
                {requestCode.isError && <ErrorAlert>{errorText(requestCode.error)}</ErrorAlert>}
                <BusyButton type="submit" size="lg" className="w-full" busy={verify.isPending} busyLabel={t("login.verifying")}>
                  {t("login.verify")}
                </BusyButton>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2.5"
                    onClick={() => {
                      setStep("email");
                      setResent(false);
                      setDevCode(null);
                      setCode("");
                      verify.reset();
                    }}
                  >
                    <ArrowLeft aria-hidden data-icon="inline-start" />
                    {t("login.changeEmail")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-mr-2.5"
                    disabled={secondsLeft > 0 || requestCode.isPending}
                    onClick={() => requestCode.mutate({ address, resend: true })}
                  >
                    {secondsLeft > 0 ? t("login.resendIn", { s: secondsLeft }) : requestCode.isPending ? t("login.sending") : t("login.resend")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        <p className="mt-6 px-4 text-center text-sm text-muted-foreground">{t("login.privacy")}</p>
      </div>
    </div>
  );
}

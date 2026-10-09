import { ChevronDown, Lock, LogIn, LogOut, Menu, Smartphone, X } from "lucide-react";
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigationType } from "react-router";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { Toggle } from "@/components/ui/toggle";
import i18n, { setLang, useLang } from "@/i18n";
import { useLogout, useMe, useUser } from "@/lib/auth";
import { readStorage, writeStorage } from "@/lib/hooks";
import { LabelsProvider, useMetaQuery } from "@/lib/meta";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------------- brand
/** Two campus lobes meeting at a coastline, with a pin where something turned up. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)}>
      <path d="M3.5 15.2C2.6 8.4 8 3 14.6 3.6c5 .5 6.6 4.6 5.6 8.4-1 3.9-4.9 5-6.6 8.8-1.6 3.6-3.6 6.6-6.4 5.4C4.5 25 4.2 20.6 3.5 15.2Z" fill="var(--color-zone-sports)" />
      <path d="M17.4 27.6c-3.6-1.2-3.4-5.6-.8-8.4 2.4-2.6 5.6-3.2 7.6-6.4 1.4-2.2 4.6-2 5.4.8 1.2 4.2-.2 9.6-4 12.6-2.4 1.8-5.4 2.2-8.2 1.4Z" fill="var(--color-zone-building-a)" />
      <circle cx="16.6" cy="15.6" r="4.2" fill="var(--sun)" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  );
}

function Wordmark() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2 rounded-full" aria-label={t("app.homeLabel")}>
      <LogoMark className="size-9" />
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="text-[1.375rem] leading-none font-bold tracking-[-0.045em] whitespace-nowrap">FindMy</span>
        <span className="hidden text-sm font-medium whitespace-nowrap text-muted-foreground xl:inline">BIPH 失物招领</span>
      </span>
    </Link>
  );
}

// --------------------------------------------------------------------------- language
export function LanguageToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const options = [
    { id: "zh" as const, label: "中文", htmlLang: "zh-CN" },
    { id: "en" as const, label: "EN", htmlLang: "en" },
  ];
  return (
    <div role="group" aria-label={t("nav.language")} className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full bg-card p-1 shadow-[0_1px_2px_rgb(44_46_42/0.06)]", className)}>
      {options.map((option) => (
        <Toggle
          key={option.id}
          size="sm"
          lang={option.htmlLang}
          pressed={lang === option.id}
          onPressedChange={() => setLang(option.id)}
          className="h-7 min-w-9 rounded-full px-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary aria-pressed:bg-ink aria-pressed:text-primary-foreground"
        >
          {option.label}
        </Toggle>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------- navigation
function useNavItems() {
  const { t } = useTranslation();
  const { user, isAdmin } = useUser();
  const main = [
    { to: "/browse", label: t("nav.browse") },
    { to: "/report/lost", label: t("nav.reportLost") },
    { to: "/report/found", label: t("nav.reportFound") },
    { to: "/about", label: t("nav.about") },
  ];
  const account = [];
  if (user) account.push({ to: "/me", label: t("nav.myItems") });
  if (isAdmin) account.push({ to: "/admin", label: t("nav.admin") }, { to: "/admin/quick-add", label: t("nav.quickAdd") });
  return { main, account, isAdmin };
}

function initials(name: string): string {
  const clean = name.trim();
  if (!clean) return "?";
  // CJK names: last two characters (given name); Latin names: first letters of the first two words.
  if (/[\u3400-\u9fff]/.test(clean)) return clean.slice(-2);
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function UserMenu() {
  const { t } = useTranslation();
  const { user, isAdmin } = useUser();
  const logout = useLogout();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-52 gap-2 pr-3 pl-1.5" aria-label={t("nav.account", { name: user.display_name })}>
          <Avatar className="size-7">
            <AvatarFallback className="bg-zone-sports text-xs font-bold text-ink">{initials(user.display_name)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{user.display_name}</span>
          <ChevronDown aria-hidden className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">{t("nav.signedInAs")}</p>
          <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/me">{t("nav.myItems")}</Link>
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuItem asChild>
                <Link to="/admin">{t("nav.admin")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin/quick-add">{t("nav.quickAdd")}</Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={logout.isPending} onSelect={() => logout.mutate()}>
          <LogOut aria-hidden />
          {logout.isPending ? t("nav.loggingOut") : t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useLoginHref() {
  const location = useLocation();
  return location.pathname === "/login" ? "/login" : `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
}

/** Sheets take focus themselves on open, so phones don't show a focus ring on the first control. */
export function focusSheet(event: Event) {
  event.preventDefault();
  (event.currentTarget as HTMLElement | null)?.focus();
}

function MobileMenu() {
  const { t } = useTranslation();
  const { main, account } = useNavItems();
  const { user } = useUser();
  const logout = useLogout();
  const loginHref = useLoginHref();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname, location.search]);

  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex h-11 items-center rounded-full px-4 text-[0.9375rem] font-semibold transition-colors",
      isActive ? "bg-ink text-primary-foreground" : "text-foreground hover:bg-secondary",
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="xl:hidden" aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}>
          <Menu aria-hidden className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(20rem,85vw)] gap-0 outline-none"
        closeLabel={t("nav.closeMenu")}
        onOpenAutoFocus={focusSheet}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <LogoMark className="size-7" />
            BIPH FindMy
          </SheetTitle>
          <SheetDescription className="sr-only">{t("nav.menu")}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t("nav.main")} className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {main.map((item) => (
            <NavLink key={item.to} to={item.to} className={link}>
              {item.label}
            </NavLink>
          ))}
          {account.length > 0 && <Separator className="my-2" />}
          {account.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/admin"} className={link}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t p-4">
          {user ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("nav.signedInAs")}</p>
                <p className="truncate text-sm font-medium">{user.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
                <LogOut aria-hidden data-icon="inline-start" />
                {logout.isPending ? t("nav.loggingOut") : t("nav.logout")}
              </Button>
            </div>
          ) : (
            <Button asChild className="w-full">
              <Link to={loginHref}>
                <LogIn aria-hidden data-icon="inline-start" />
                {t("nav.login")}
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Header() {
  const { t } = useTranslation();
  const { main, isAdmin } = useNavItems();
  const { user } = useUser();
  const me = useMe();
  const loginHref = useLoginHref();
  const pages = main.filter((item) => !item.to.startsWith("/report"));
  const items = [...pages, ...(user ? [{ to: "/me", label: t("nav.myItems") }] : []), ...(isAdmin ? [{ to: "/admin", label: t("nav.admin") }] : [])];

  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex h-10 items-center rounded-full px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-200",
      isActive ? "bg-ink text-primary-foreground" : "text-foreground hover:bg-card",
    );
  const action = ({ isActive }: { isActive: boolean }) => cn(isActive && "ring-2 ring-ink ring-offset-2 ring-offset-cream");

  return (
    <header className="sticky top-0 z-40 bg-background/92 backdrop-blur-md supports-backdrop-filter:bg-background/80">
      <div className="container-page flex h-[4.5rem] items-center gap-6">
        <Wordmark />
        <nav aria-label={t("nav.main")} className="hidden min-w-0 items-center gap-1 xl:flex">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/admin"} className={link}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="sun">
              <NavLink to="/report/lost" className={action}>
                {t("nav.reportLost")}
              </NavLink>
            </Button>
            <Button asChild variant="coral">
              <NavLink to="/report/found" className={action}>
                {t("nav.reportFound")}
              </NavLink>
            </Button>
          </div>
          <LanguageToggle />
          <div className="hidden xl:block">
            {me.isPending ? (
              <div className="h-9 w-24" />
            ) : user ? (
              <UserMenu />
            ) : (
              <Button asChild variant="outline">
                <Link to={loginHref}>
                  <LogIn aria-hidden data-icon="inline-start" />
                  {t("nav.login")}
                </Link>
              </Button>
            )}
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

// --------------------------------------------------------------------------- WeChat
const WECHAT_KEY = "findmy.wechatDismissed";

/** Inside WeChat, uploads and cookies are unreliable — ask people to open the system browser (both languages). */
function WeChatBanner() {
  const [visible, setVisible] = useState(() => /MicroMessenger/i.test(navigator.userAgent) && readStorage(WECHAT_KEY) !== "1");
  if (!visible) return null;
  const en = i18n.getFixedT("en");
  const zh = i18n.getFixedT("zh");
  return (
    <div role="region" aria-label={`${zh("wechat.title")} ${en("wechat.title")}`} className="bg-foreground text-background">
      <div className="container-page flex items-start gap-3 py-3">
        <Smartphone aria-hidden className="mt-0.5 size-5 shrink-0 opacity-80" />
        <div className="min-w-0 flex-1 space-y-1 text-sm leading-relaxed">
          <p lang="zh-CN">
            <strong className="font-semibold">{zh("wechat.title")}</strong> {zh("wechat.body")}
          </p>
          <p lang="en">
            <strong className="font-semibold">{en("wechat.title")}</strong> {en("wechat.body")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            writeStorage(WECHAT_KEY, "1");
            setVisible(false);
          }}
          aria-label={`${zh("wechat.dismiss")} / ${en("wechat.dismiss")}`}
          className="-mr-2 shrink-0 text-background hover:bg-background/10 hover:text-background"
        >
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- footer
function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-20 bg-ink text-[#d9d4c4]">
      <div className="container-page flex flex-col gap-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="size-7" />
          <div>
            <p className="font-semibold text-cream">{t("footer.clubs")}</p>
            <p className="mt-0.5">{t("footer.noTracking")}</p>
          </div>
        </div>
        <nav aria-label={t("footer.about")} className="flex flex-wrap gap-x-5 gap-y-1">
          <Link to="/about" className="inline-flex min-h-9 items-center hover:text-cream hover:underline">
            {t("footer.about")}
          </Link>
          <Link to="/about#privacy" className="inline-flex min-h-9 items-center hover:text-cream hover:underline">
            {t("footer.privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

// --------------------------------------------------------------------------- gates
function MetaGate({ children }: { children: ReactNode }) {
  const query = useMetaQuery();
  if (query.isPending) return <PageSkeleton />;
  if (query.isError)
    return (
      <div className="container-page py-10">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  return <LabelsProvider meta={query.data}>{children}</LabelsProvider>;
}

/** Login-only (and optionally staff-only) pages: anonymous visitors go to /login?next=… */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { t } = useTranslation();
  const me = useMe();
  const { user, isAdmin } = useUser();
  const location = useLocation();
  if (me.isPending) return <PageSkeleton />;
  if (me.isError)
    return (
      <div className="container-page py-10">
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </div>
    );
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && !isAdmin)
    return (
      <div className="container-page py-10">
        <EmptyState icon={Lock} title={t("auth.staffOnlyTitle")}>
          {t("auth.staffOnlyBody")}
        </EmptyState>
      </div>
    );
  return <>{children}</>;
}

// --------------------------------------------------------------------------- crash + scroll handling
function PageCrash() {
  const { t } = useTranslation();
  return (
    <div className="container-page flex flex-col items-center py-20 text-center" role="alert">
      <LogoMark className="size-12" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("common.errorTitle")}</h1>
      <p className="mt-2 max-w-[48ch] text-muted-foreground">{t("errors.generic")}</p>
      <Button className="mt-6" onClick={() => window.location.reload()}>
        {t("common.reload")}
      </Button>
    </div>
  );
}

/** Catches render errors (and stale lazy chunks after a deploy) so one broken page never blanks the app. */
class PageErrorBoundary extends Component<{ resetKey: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FindMy page error", error, info.componentStack);
  }

  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? <PageCrash /> : this.props.children;
  }
}

/** New pages start at the top; back/forward keeps the browser's own scroll restoration. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (hash || navigationType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);
  return null;
}

/** Moves focus to <main> after client-side navigation so screen readers start at the new page. */
function useFocusMainOnNavigate() {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (location.hash) return;
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname]);
}

export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  useFocusMainOnNavigate();
  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-full bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70]"
      >
        {t("app.skip")}
      </a>
      <div className="flex min-h-dvh flex-col">
        <WeChatBanner />
        <Header />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <PageErrorBoundary resetKey={location.pathname}>
            <MetaGate>
              <Outlet />
            </MetaGate>
          </PageErrorBoundary>
        </main>
        <Footer />
      </div>
      <Toaster position="bottom-right" closeButton containerAriaLabel={t("common.notifications")} toastOptions={{ closeButtonAriaLabel: t("common.dismiss") }} />
      <ScrollManager />
    </>
  );
}

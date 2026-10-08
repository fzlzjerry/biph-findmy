import { ChevronDown, Lock, LogIn, LogOut, Menu, Smartphone, UserRound, X } from "lucide-react";
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigationType } from "react-router";
import i18n, { setLang, useLang } from "../i18n";
import { useLogout, useMe, useUser } from "../lib/auth";
import { readStorage, useOutsideClick, writeStorage } from "../lib/hooks";
import { LabelsProvider, useMetaQuery } from "../lib/meta";
import { EmptyState, ErrorState, PageSkeleton } from "./States";
import { ToastProvider } from "./Toast";
import { Button, buttonClass } from "./ui";

// --------------------------------------------------------------------------- brand
export function BrandMark({ className = "size-9" }: { className?: string }) {
  return <img src="/brand/sea-dragon-mark.svg" alt="" width={36} height={36} className={`shrink-0 ${className}`} />;
}

export function Mascot({ alt = "", className = "", sizes = "(min-width: 1024px) 420px, 60vw" }: {
  alt?: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <picture className={className}>
      <source srcSet="/brand/sea-dragon-mascot.avif" type="image/avif" />
      <source srcSet="/brand/sea-dragon-mascot.webp" type="image/webp" />
      <img
        src="/brand/sea-dragon-mascot.png"
        alt={alt}
        width={1213}
        height={1183}
        sizes={sizes}
        decoding="async"
        className="h-full w-full object-contain"
      />
    </picture>
  );
}

function Wordmark() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-sm no-underline" aria-label={t("app.homeLabel")}>
      <BrandMark className="size-9" />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="whitespace-nowrap text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">BIPH FindMy</span>
        <span className="mt-1 whitespace-nowrap text-xs font-medium text-muted">失物招领 · Lost &amp; found</span>
      </span>
    </Link>
  );
}

// --------------------------------------------------------------------------- language
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const options = [
    { id: "zh" as const, label: "中文", htmlLang: "zh-CN" },
    { id: "en" as const, label: "EN", htmlLang: "en" },
  ];
  return (
    <div role="group" aria-label={t("nav.language")} className={`inline-flex shrink-0 rounded-full bg-surface ${className}`}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          lang={option.htmlLang}
          aria-pressed={lang === option.id}
          onClick={() => setLang(option.id)}
          className={`min-h-11 min-w-12 rounded-full px-3.5 text-sm font-semibold transition-colors duration-200 ${
            lang === option.id ? "bg-brand text-water" : "text-muted hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------- navigation
function useNavItems() {
  const { t } = useTranslation();
  const { user, isAdmin } = useUser();
  const items = [
    { to: "/browse", label: t("nav.browse") },
    { to: "/report/lost", label: t("nav.reportLost") },
    { to: "/report/found", label: t("nav.reportFound") },
    { to: "/about", label: t("nav.about") },
  ];
  if (user) items.push({ to: "/me", label: t("nav.myItems") });
  if (isAdmin) items.push({ to: "/admin", label: t("nav.admin") });
  return items;
}

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 text-[0.9375rem] transition-colors duration-200 ${
    isActive ? "bg-mist font-semibold text-brand-deep" : "font-medium text-muted hover:bg-surface hover:text-ink"
  }`;

function UserMenu() {
  const { t } = useTranslation();
  const { user, isAdmin } = useUser();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick<HTMLDivElement>(open, () => setOpen(false));
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  if (!user) return null;
  const menuItem = "flex min-h-11 w-full items-center gap-2 rounded-xs px-3 text-left text-[0.9375rem] font-medium text-ink hover:bg-surface";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="user-menu"
        aria-label={t("nav.account", { name: user.display_name })}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 max-w-[12rem] items-center gap-2 rounded-sm border border-line px-3 text-[0.9375rem] font-medium text-ink hover:bg-surface"
      >
        <UserRound aria-hidden className="size-4 shrink-0 text-brand" />
        <span className="truncate">{user.display_name}</span>
        <ChevronDown aria-hidden className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id="user-menu" className="absolute right-0 top-[calc(100%+6px)] z-40 w-64 rounded-sm border border-line-strong bg-water p-1.5">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-muted">{t("nav.signedInAs")}</p>
            <p className="truncate text-sm font-semibold text-ink">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link to="/me" className={menuItem}>
            {t("nav.myItems")}
          </Link>
          {isAdmin && (
            <>
              <Link to="/admin" className={menuItem}>
                {t("nav.admin")}
              </Link>
              <Link to="/admin/quick-add" className={menuItem}>
                {t("nav.quickAdd")}
              </Link>
            </>
          )}
          <div className="my-1 h-px bg-line" />
          <button type="button" className={menuItem} onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut aria-hidden className="size-4 text-muted" />
            {logout.isPending ? t("nav.loggingOut") : t("nav.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function LoginLink({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const next = location.pathname === "/login" ? "" : `?next=${encodeURIComponent(location.pathname + location.search)}`;
  return (
    <Link to={`/login${next}`} className={buttonClass("primary", "sm", className)}>
      <LogIn aria-hidden />
      {t("nav.login")}
    </Link>
  );
}

function Header() {
  const { t } = useTranslation();
  const navItems = useNavItems();
  const { user, isAdmin } = useUser();
  const me = useMe();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const mobileLink = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-12 items-center rounded-sm px-3 text-base ${
      isActive ? "bg-mist font-semibold text-brand-deep" : "font-medium text-ink hover:bg-surface"
    }`;

  return (
    <header className="border-b border-line bg-water">
      <div className="container-page flex min-h-16 items-center justify-between gap-3 py-2">
        <Wordmark />
        <nav aria-label={t("nav.main")} className="hidden min-w-0 items-center gap-0.5 xl:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/admin"} className={desktopLink}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageToggle />
          <div className="hidden xl:block">{me.isPending ? <div className="h-11 w-24" /> : user ? <UserMenu /> : <LoginLink />}</div>
          <button
            ref={menuButton}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-sm border border-line text-ink hover:bg-surface xl:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div id="mobile-menu" className="border-t border-line xl:hidden">
          <nav aria-label={t("nav.main")} className="container-page flex flex-col gap-1 py-3">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/admin"} className={mobileLink}>
                {item.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin/quick-add" className={mobileLink}>
                {t("nav.quickAdd")}
              </NavLink>
            )}
            <div className="mt-2 border-t border-line pt-3">
              {user ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted">{t("nav.signedInAs")}</p>
                    <p className="truncate text-sm font-semibold text-ink">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    className={buttonClass("secondary", "sm")}
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    <LogOut aria-hidden />
                    {logout.isPending ? t("nav.loggingOut") : t("nav.logout")}
                  </button>
                </div>
              ) : (
                <LoginLink className="w-full" />
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

// --------------------------------------------------------------------------- WeChat
const WECHAT_KEY = "findmy.wechatDismissed";

/** Inside WeChat, uploads and cookies are unreliable — ask people to open the system browser (both languages). */
function WeChatBanner() {
  const [visible, setVisible] = useState(
    () => /MicroMessenger/i.test(navigator.userAgent) && readStorage(WECHAT_KEY) !== "1",
  );
  if (!visible) return null;
  const en = i18n.getFixedT("en");
  const zh = i18n.getFixedT("zh");
  return (
    <div role="region" aria-label={`${zh("wechat.title")} ${en("wechat.title")}`} className="bg-ink text-water">
      <div className="container-page flex items-start gap-3 py-3">
        <Smartphone aria-hidden className="mt-0.5 size-5 shrink-0 text-mist" />
        <div className="min-w-0 flex-1 space-y-1 text-sm leading-relaxed">
          <p lang="zh-CN">
            <strong className="font-semibold">{zh("wechat.title")}</strong> {zh("wechat.body")}
          </p>
          <p lang="en">
            <strong className="font-semibold">{en("wechat.title")}</strong> {en("wechat.body")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            writeStorage(WECHAT_KEY, "1");
            setVisible(false);
          }}
          aria-label={`${zh("wechat.dismiss")} / ${en("wechat.dismiss")}`}
          className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-mist hover:bg-white/10"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- footer
function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-16 border-t border-line">
      <div className="container-page flex flex-col gap-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BrandMark className="size-8" />
          <div>
            <p className="font-semibold text-ink">{t("footer.clubs")}</p>
            <p className="mt-0.5">{t("footer.noTracking")}</p>
          </div>
        </div>
        <nav aria-label={t("footer.about")} className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/about" className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline">
            {t("footer.about")}
          </Link>
          <Link
            to="/about#privacy"
            className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
          >
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
      <BrandMark className="size-16" />
      <h1 className="mt-6 text-2xl font-bold text-ink">{t("common.errorTitle")}</h1>
      <p className="mt-2 max-w-[48ch] text-muted">{t("errors.generic")}</p>
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
    <ToastProvider>
      <a
        href="#main"
        className="sr-only rounded-sm bg-ink px-4 py-3 font-semibold text-water focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70]"
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
      <ScrollManager />
    </ToastProvider>
  );
}

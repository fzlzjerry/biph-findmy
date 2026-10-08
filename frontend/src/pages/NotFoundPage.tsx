import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BrandMark } from "../components/Layout";
import { buttonClass } from "../components/ui";
import { useDocumentTitle } from "../lib/hooks";

export default function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("notFound.title"));
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <BrandMark className="size-16" />
      <p className="mt-6 text-sm font-semibold text-brand">404</p>
      <h1 className="mt-2 text-[2rem] font-bold leading-tight text-ink">{t("notFound.title")}</h1>
      <p className="mt-3 max-w-[48ch] text-muted">{t("notFound.body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className={buttonClass("primary")}>
          <ArrowLeft aria-hidden />
          {t("notFound.home")}
        </Link>
        <Link to="/browse" className={buttonClass("secondary")}>
          {t("notFound.browse")}
        </Link>
      </div>
    </div>
  );
}

import { ArrowLeft, MapPinOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { useDocumentTitle } from "@/lib/hooks";

export default function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("notFound.title"));
  return (
    <div className="container-page py-16 sm:py-24">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapPinOff aria-hidden />
          </EmptyMedia>
          <p className="text-sm font-medium text-muted-foreground">404</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("notFound.title")}</h1>
          <EmptyDescription className="text-base">{t("notFound.body")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/">
              <ArrowLeft aria-hidden data-icon="inline-start" />
              {t("notFound.home")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/browse">{t("notFound.browse")}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

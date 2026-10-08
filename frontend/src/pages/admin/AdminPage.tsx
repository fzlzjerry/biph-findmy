import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { TabPanel, Tabs } from "../../components/Tabs";
import { buttonClass, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { useDocumentTitle } from "../../lib/hooks";
import ClaimsTab from "./ClaimsTab";
import ItemsTab from "./ItemsTab";
import StatsTab from "./StatsTab";

type Tab = "claims" | "items" | "stats";

export default function AdminPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.title"));
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = raw === "items" || raw === "stats" ? raw : "claims";
  const pending = useQuery({ queryKey: ["admin", "claims", "pending"], queryFn: () => api.admin.claims("pending") });
  const pendingCount = pending.data?.claims.length ?? 0;

  return (
    <div className="container-page py-8 sm:py-10">
      <PageHeader
        title={t("admin.title")}
        lead={t("admin.lead")}
        actions={
          <Link to="/admin/quick-add" className={buttonClass("primary")}>
            <Camera aria-hidden />
            {t("admin.quickAdd")}
          </Link>
        }
      />
      <Tabs
        className="mt-8"
        idPrefix="admin"
        label={t("admin.tabsLabel")}
        value={tab}
        onChange={(id) => setParams(id === "claims" ? {} : { tab: id }, { replace: true })}
        items={[
          {
            id: "claims",
            label: t("admin.claimsTab"),
            extra:
              pendingCount > 0 ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-water px-1.5 text-xs font-bold text-brand-deep">
                  {pendingCount}
                  <span className="sr-only"> {t("admin.pendingCount", { count: pendingCount })}</span>
                </span>
              ) : null,
          },
          { id: "items", label: t("admin.itemsTab") },
          { id: "stats", label: t("admin.statsTab") },
        ]}
      />
      <TabPanel idPrefix="admin" activeId={tab} className="mt-6">
        {tab === "claims" ? <ClaimsTab /> : tab === "items" ? <ItemsTab /> : <StatsTab />}
      </TabPanel>
    </div>
  );
}

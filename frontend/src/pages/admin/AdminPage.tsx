import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useDocumentTitle } from "@/lib/hooks";
import CheckTab from "./CheckTab";
import ClaimsTab from "./ClaimsTab";
import ItemsTab from "./ItemsTab";
import StaffTab from "./StaffTab";
import StatsTab from "./StatsTab";

type Tab = "claims" | "check" | "items" | "stats" | "staff";

export default function AdminPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.title"));
  const [params, setParams] = useSearchParams();
  const { isSuperAdmin } = useUser();
  const raw = params.get("tab");
  const tab: Tab = raw === "check" || raw === "items" || raw === "stats" || (raw === "staff" && isSuperAdmin) ? raw : "claims";
  const pending = useQuery({ queryKey: ["admin", "claims", "pending"], queryFn: () => api.admin.claims("pending") });
  const pendingCount = pending.data?.claims.length ?? 0;

  return (
    <div className="container-page py-8 sm:py-10">
      <PageHeader
        title={t("admin.title")}
        description={t("admin.lead")}
        actions={
          <Button asChild>
            <Link to="/admin/quick-add">
              <Camera aria-hidden data-icon="inline-start" />
              {t("admin.quickAdd")}
            </Link>
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(id) => setParams(id === "claims" ? {} : { tab: id }, { replace: true })} className="mt-8 gap-6">
        <TabsList aria-label={t("admin.tabsLabel")}>
          <TabsTrigger value="claims" className="px-3">
            {t("admin.claimsTab")}
            {pendingCount > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 tabular-nums">
                {pendingCount}
                <span className="sr-only"> {t("admin.pendingCount", { count: pendingCount })}</span>
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="check" className="px-3">
            {t("admin.checkTab")}
          </TabsTrigger>
          <TabsTrigger value="items" className="px-3">
            {t("admin.itemsTab")}
          </TabsTrigger>
          <TabsTrigger value="stats" className="px-3">
            {t("admin.statsTab")}
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="staff" className="px-3">
              {t("admin.staffTab")}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="claims" className="text-base">
          <ClaimsTab />
        </TabsContent>
        <TabsContent value="check" className="text-base">
          <CheckTab />
        </TabsContent>
        <TabsContent value="items" className="text-base">
          <ItemsTab />
        </TabsContent>
        <TabsContent value="stats" className="text-base">
          <StatsTab />
        </TabsContent>
        {isSuperAdmin && (
          <TabsContent value="staff" className="text-base">
            <StaffTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

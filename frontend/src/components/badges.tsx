import {
  Archive,
  BadgeCheck,
  Ban,
  CircleCheck,
  CircleX,
  Hourglass,
  Inbox,
  Link2,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClaimStatus, ItemKind, ItemStatus } from "@/lib/types";

/** Soft status colours on top of the shadcn Badge (text >= 4.5:1 on each tint). */
export type Tone = "blue" | "amber" | "violet" | "green" | "gray" | "red";

const TONES: Record<Tone, string> = {
  blue: "border-transparent bg-[#d8ecff] text-[#0d4677]",
  amber: "border-transparent bg-[#fbf1a6] text-[#5c4b00]",
  violet: "border-transparent bg-[#f1ddff] text-[#5a2780]",
  green: "border-transparent bg-[#d9f2c8] text-[#285a17]",
  gray: "border-transparent bg-secondary text-muted-foreground",
  red: "border-transparent bg-[#ffe1dc] text-[#8a1f10]",
};

export function ToneBadge({ tone, icon: Icon, children, className }: {
  tone: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(TONES[tone], "max-w-full", className)}>
      {Icon && <Icon aria-hidden data-icon="inline-start" />}
      <span className="truncate">{children}</span>
    </Badge>
  );
}

const STATUS: Record<ItemKind, Record<ItemStatus, { tone: Tone; icon: LucideIcon }>> = {
  found: {
    open: { tone: "blue", icon: Inbox },
    matched: { tone: "amber", icon: Hourglass },
    claimed: { tone: "violet", icon: BadgeCheck },
    returned: { tone: "green", icon: CircleCheck },
    closed: { tone: "gray", icon: Archive },
    expired: { tone: "gray", icon: Archive },
  },
  lost: {
    open: { tone: "blue", icon: Search },
    matched: { tone: "violet", icon: Link2 },
    claimed: { tone: "violet", icon: BadgeCheck },
    returned: { tone: "green", icon: CircleCheck },
    closed: { tone: "gray", icon: Archive },
    expired: { tone: "gray", icon: Archive },
  },
};

export function StatusBadge({ kind, status }: { kind: ItemKind; status: ItemStatus }) {
  const { t } = useTranslation();
  const style = STATUS[kind][status] ?? STATUS[kind].open;
  return (
    <ToneBadge tone={style.tone} icon={style.icon}>
      {t(`status.${kind}.${status}`)}
    </ToneBadge>
  );
}

const CLAIM: Record<ClaimStatus, { tone: Tone; icon: LucideIcon }> = {
  pending: { tone: "amber", icon: Hourglass },
  approved: { tone: "violet", icon: BadgeCheck },
  rejected: { tone: "red", icon: CircleX },
  cancelled: { tone: "gray", icon: Ban },
  completed: { tone: "green", icon: CircleCheck },
};

export function ClaimBadge({ status }: { status: ClaimStatus }) {
  const { t } = useTranslation();
  const style = CLAIM[status] ?? CLAIM.pending;
  return (
    <ToneBadge tone={style.tone} icon={style.icon}>
      {t(`claimStatus.${status}`)}
    </ToneBadge>
  );
}

export function KindBadge({ kind }: { kind: ItemKind }) {
  const { t } = useTranslation();
  return (
    <Badge variant={kind === "lost" ? "outline" : "secondary"}>{t(kind === "lost" ? "kind.lostReport" : "kind.foundItem")}</Badge>
  );
}

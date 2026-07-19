import type { UserDirectoryItem } from "@/lib/users-api";

export type UserStatus = "Active" | "Pending invite" | "Deactivated" | "Locked" | "Suspended" | "Unavailable";
export type UserTeam = "Unavailable";

export type UserRow = {
  userId: string;
  email: string;
  joinedDate: string;
  lastActive: number | null;
  name: string;
  role: string;
  status: UserStatus;
  team: UserTeam;
  workspace: string[];
};

export function toUserRow(user: UserDirectoryItem): UserRow {
  return {
    userId: user.user_id,
    email: user.email ?? user.username,
    joinedDate: "—",
    lastActive: null,
    name: user.full_name || user.username,
    role: user.role,
    status: "Unavailable",
    team: "Unavailable",
    workspace: [],
  };
}

export const filters = {
  role: ["All"],
  team: ["All", "Unavailable"],
  status: ["All", "Unavailable"],
  workspace: ["All"],
};

export const statusMeta: Record<UserStatus, { badgeClass: string; dotClass: string }> = {
  Active: { badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dotClass: "bg-emerald-500" },
  "Pending invite": { badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400", dotClass: "bg-amber-500" },
  Deactivated: { badgeClass: "border-border bg-muted/50 text-muted-foreground", dotClass: "bg-muted-foreground" },
  Locked: { badgeClass: "border-destructive/20 bg-destructive/10 text-destructive", dotClass: "bg-destructive" },
  Suspended: { badgeClass: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400", dotClass: "bg-orange-500" },
  Unavailable: { badgeClass: "border-border bg-muted/50 text-muted-foreground", dotClass: "bg-muted-foreground" },
};

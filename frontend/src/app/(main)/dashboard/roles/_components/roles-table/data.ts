import type { UserDirectoryItem } from "@/lib/users-api";

export type Role = {
  role: string;
  group: string;
  accessLevel: string;
  users: number;
  permissionSets: string[];
  lastReview: string;
  owner: string;
  status: "Active" | "Needs review";
};

export function toRoles(users: UserDirectoryItem[]): Role[] {
  const counts = new Map<string, number>();
  for (const user of users) counts.set(user.role, (counts.get(user.role) ?? 0) + 1);

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([role, count]) => ({
      role,
      group: "System roles",
      accessLevel: "Assigned users",
      users: count,
      permissionSets: [],
      lastReview: "—",
      owner: "System",
      status: "Active" as const,
    }));
}

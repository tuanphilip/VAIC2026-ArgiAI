import { apiFetch } from "@/lib/api-client";

export type UserDirectoryItem = {
  user_id: string;
  username: string;
  full_name: string;
  role: string;
  citizen_id: string | null;
  email: string | null;
  phone_number: string | null;
};

export function getUsers(): Promise<UserDirectoryItem[]> {
  return apiFetch<UserDirectoryItem[]>("/users");
}

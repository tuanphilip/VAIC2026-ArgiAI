import { create } from "zustand";

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  role: "farmer" | "official";
}

export const users: User[] = [
  {
    id: "1",
    name: "Nguyễn Văn A (Nông dân)",
    username: "nongdan_dienbien",
    email: "nongdan@dienbien.gov.vn",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
    role: "farmer",
  },
  {
    id: "2",
    name: "Trần Văn B (Cán bộ)",
    username: "canbo_dienbien",
    email: "canbo@dienbien.gov.vn",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
    role: "official",
  },
];

interface UserStore {
  activeUser: User;
  setActiveUser: (user: User) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  activeUser: users[0],
  setActiveUser: (user) => set({ activeUser: user }),
}));

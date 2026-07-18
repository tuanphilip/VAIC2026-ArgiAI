import type { LucideIcon } from "lucide-react";
import { Clock3, Inbox, Mail, MessageCircle, Phone, Send, Star, User } from "lucide-react";

export type Conversation = {
  id: number;
  group: "Đã ghim" | "Hôm nay" | "Hôm qua";
  name: string;
  subject: string;
  preview: string;
  time: string;
  isUnread: boolean;
  isOnline: boolean;
  unreadCount: number;
  contact: Contact;
  messages: Message[];
};

export type Message = { id: number; align: "start" | "end"; text: string; time: string; reaction?: string };
export type Contact = {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  location: string;
  timezone: string;
  status: string;
  qualifiedAt: string;
  tags: string[];
};
export type NavItem = { id: string; title: string; label?: string; icon: LucideIcon; isActive: boolean };

export const navItems: NavItem[] = [
  { id: "inbox", title: "Hộp thư đến", label: "1", icon: Inbox, isActive: true },
  { id: "mentions", title: "Được nhắc đến", icon: Mail, isActive: false },
  { id: "snoozed", title: "Để sau", icon: Clock3, isActive: false },
  { id: "sent", title: "Đã gửi", icon: Send, isActive: false },
  { id: "all", title: "Tất cả cuộc trò chuyện", icon: MessageCircle, isActive: false },
  { id: "unassigned", title: "Chưa phân công", icon: User, isActive: false },
];

export const channelItems: NavItem[] = [
  { id: "email", title: "Thư điện tử", icon: Mail, isActive: false },
  { id: "chat", title: "Trò chuyện AI", icon: MessageCircle, isActive: false },
  { id: "whatsapp", title: "WhatsApp", icon: Phone, isActive: false },
  { id: "phone", title: "Điện thoại", icon: Phone, isActive: false },
];

export const viewItems: NavItem[] = [
  { id: "vip", title: "Hộ sản xuất ưu tiên", icon: Star, isActive: false },
  { id: "orders", title: "Đơn hàng và đổi trả", icon: Inbox, isActive: false },
  { id: "feedback", title: "Phản hồi sản phẩm", icon: MessageCircle, isActive: false },
];

export const currentUser: Contact = {
  name: "Cán bộ nông nghiệp Điện Biên",
  role: "Điều phối viên sản xuất",
  company: "AgriAI Điện Biên",
  email: "dieuphoi@argiai.vn",
  phone: "+84 000 000 000",
  website: "argiai.vn",
  location: "Điện Biên, Việt Nam",
  timezone: "Giờ Việt Nam (UTC+7)",
  status: "Đang hoạt động",
  qualifiedAt: "19/07/2026",
  tags: ["Điện Biên", "Nông nghiệp", "AI"],
};

export const conversations: Conversation[] = [
  {
    id: 1,
    group: "Đã ghim",
    name: "Hợp tác xã lúa Điện Biên",
    subject: "Theo dõi sâu bệnh trên ruộng lúa Seng Cù",
    preview: "Cần kiểm tra lá lúa và lịch phun sinh học trong tuần này.",
    time: "Vừa xong",
    isUnread: true,
    isOnline: true,
    unreadCount: 1,
    contact: {
      name: "Hợp tác xã lúa Điện Biên",
      role: "Đại diện hợp tác xã",
      company: "HTX Nông nghiệp Điện Biên",
      email: "htx.lua@argiai.vn",
      phone: "+84 000 000 001",
      website: "argiai.vn",
      location: "Thành phố Điện Biên Phủ, Việt Nam",
      timezone: "Giờ Việt Nam (UTC+7)",
      status: "Đang theo dõi",
      qualifiedAt: "19/07/2026",
      tags: ["Lúa Điện Biên", "Sâu bệnh", "Sinh học"],
    },
    messages: [
      { id: 101, align: "start", text: "Ruộng lúa Seng Cù đang có một số lá vàng và đốm nâu. Nhờ kiểm tra giúp nguyên nhân.", time: "Vừa xong" },
      { id: 102, align: "end", text: "Tôi sẽ phân tích theo điều kiện thời tiết Điện Biên. Trước mắt chưa phun thuốc; hãy chụp rõ mặt trên và mặt dưới lá, đồng thời kiểm tra mật độ vết bệnh.", time: "Vừa xong" },
    ],
  },
];

import { setDate, setHours, setMinutes, startOfMonth } from "date-fns";

const monthStart = startOfMonth(new Date());
const currentYear = new Date().getFullYear();
const d = (day: number) => setDate(monthStart, day);
const dt = (day: number, hour: number, min = 0) => setMinutes(setHours(setDate(monthStart, day), hour), min);

export const demoEvents = [
  { title: "Lập kế hoạch tháng", start: dt(1, 9, 30), end: dt(1, 10, 30) },
  { title: "Rà soát thiết kế", start: dt(3, 11), end: dt(3, 12) },
  { title: "Trao đổi với khách hàng", start: dt(4, 15), end: dt(4, 15, 45) },
  { title: "Hội thảo sản phẩm", start: d(7), end: d(9), allDay: true },
  { groupId: "standup", title: "Họp nhanh đội nhóm", start: dt(9, 10) },
  { title: "Đối soát tài chính", start: dt(10, 14, 30), end: dt(10, 15) },
  { title: "Khối thời gian tập trung", start: dt(12, 9), end: dt(12, 12), display: "background" },
  { title: "Lập kế hoạch chu kỳ", start: dt(15, 9, 30), end: dt(15, 11) },
  { groupId: "standup", title: "Họp nhanh đội nhóm", start: dt(16, 10) },
  { title: "Bàn giao vận hành", start: dt(18, 16), end: dt(18, 16, 45) },
  { title: "Hạn báo cáo quý", start: d(24), allDay: true },
  { title: "Ngày nghỉ", start: d(28), allDay: true },
  { title: "Sinh nhật Arham Khan", start: new Date(currentYear, 8, 6), allDay: true },
];

"use client";

import Link from "next/link";

import { BarChart3, RefreshCw, Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardSummary } from "@/app/(main)/dashboard/_components/dashboard-summary";
import { useActiveUser } from "@/stores/auth-store";

export default function Page() {
  const activeUser = useActiveUser();
  const isFarmer = activeUser.role === "farmer";

  return (
    <div className="flex flex-col gap-6 p-1">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="font-semibold text-emerald-600 text-sm">DỮ LIỆU THỰC TỪ HỆ THỐNG</p>
          <h1 className="mt-1 font-extrabold text-3xl tracking-tight">
            {isFarmer ? `Tổng quan canh tác của ${activeUser.name}` : "Tổng quan quản lý nông nghiệp"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isFarmer
              ? "Các chỉ số chỉ bao gồm những thửa ruộng thuộc tài khoản của bạn."
              : "Số liệu được tính trực tiếp từ người dân, thửa ruộng và dữ liệu canh tác trong cơ sở dữ liệu."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
            <RefreshCw className="size-4" /> Làm mới
          </Button>
          <Link href={isFarmer ? "/dashboard/lands" : "/dashboard/compare"}>
            <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              {isFarmer ? <Sprout className="size-4" /> : <BarChart3 className="size-4" />}
              {isFarmer ? "Quản lý thửa ruộng" : "Báo cáo so sánh"}
            </Button>
          </Link>
        </div>
      </div>

      <DashboardSummary />
    </div>
  );
}

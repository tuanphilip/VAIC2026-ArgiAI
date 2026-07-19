import type { ReactNode } from "react";

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SidebarProvider defaultOpen className="[--header-height:calc(--spacing(14))]">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden">
        <main className="flex min-h-0 flex-1 overflow-hidden">
          <section className="min-w-0 flex-1 overflow-hidden">{children}</section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

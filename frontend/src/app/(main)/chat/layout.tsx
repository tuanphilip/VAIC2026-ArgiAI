import type { ReactNode } from "react";

import { ChatConversationList } from "./_components/chat-conversation-list";
import { ChatHeader } from "./_components/chat-header";
import { ChatSidebar } from "./_components/chat-sidebar";
import { conversations } from "./_components/data";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SidebarProvider defaultOpen className="[--header-height:calc(--spacing(14))]">
      <ChatSidebar />
      <SidebarInset className="min-w-0 overflow-hidden">
        <ChatHeader />
        <main className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="hidden w-80 shrink-0 border-r bg-background lg:block">
            <ChatConversationList conversations={conversations} />
          </aside>
          <section className="min-w-0 flex-1 overflow-hidden">{children}</section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

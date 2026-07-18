import type { ReactNode } from "react";

import { ChatHeader } from "./_components/chat-header";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <ChatHeader />
      <main className="min-h-[calc(100svh-var(--header-height))]">{children}</main>
    </div>
  );
}

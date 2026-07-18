import { Leaf, MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";


export function ChatHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center border-b bg-background">
      <div className="flex h-full w-full items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><Leaf className="size-4" /></div>
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-sm">AgriAI Copilot</h1>
            <p className="truncate text-muted-foreground text-xs">Trợ lý nông nghiệp Điện Biên</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Cuộc trò chuyện mới">
            <MessageSquarePlus />
          </Button>

        </div>
      </div>
    </header>
  );
}

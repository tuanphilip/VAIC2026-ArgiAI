import { Bell, MessageSquarePlus, Search, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function ChatHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center border-b bg-background">
      <div className="flex h-full w-full items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h1 className="text-nowrap font-medium text-base">Trợ lý nông nghiệp Điện Biên</h1>
          <InputGroup className="h-7 w-full max-w-sm">
            <InputGroupInput className="h-7" placeholder="Tìm cuộc trò chuyện..." />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Cuộc trò chuyện mới">
            <MessageSquarePlus />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Thông báo">
            <Bell />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Cài đặt">
            <Settings />
          </Button>
        </div>
      </div>
    </header>
  );
}

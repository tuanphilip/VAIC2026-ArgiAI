"use client";

import { ChatThread } from "./chat-thread";
import type { Conversation } from "./data";

interface ChatProps {
  conversations: Conversation[];
}

export function Chat({ conversations }: ChatProps) {
  const activeConversation = conversations[0];

  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-background">
        <ChatThread
          contact={activeConversation.contact}
          messages={[]}
          className="min-h-0 flex-1"
        />
    </div>
  );
}

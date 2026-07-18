"use client";

import { ChatThread } from "./chat-thread";
import type { Conversation } from "./data";

interface ChatProps {
  conversations: Conversation[];
}

export function Chat({ conversations }: ChatProps) {
  const activeConversation = conversations[0];

  return (
    <div className="mx-auto flex h-[calc(100svh-var(--header-height))] min-h-0 w-full max-w-5xl flex-col overflow-hidden border-x bg-background shadow-sm">
        <ChatThread
          contact={activeConversation.contact}
          messages={[]}
          className="min-h-0 flex-1"
        />
    </div>
  );
}

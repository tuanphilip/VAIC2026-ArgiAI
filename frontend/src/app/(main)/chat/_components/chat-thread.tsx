"use client";

import { useState } from "react";

import {
  AlarmClock,
  ArrowLeft,
  Copy,
  Flag,
  Link,
  MoreHorizontal,
  Paperclip,
  PhoneCall,
  Send,
  Smile,
  Sparkles,
  Tag,
  Type,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, getInitials } from "@/lib/utils";
import { askAgriculturalAssistant, type ChatTurn } from "@/lib/chat-api";

import { type Message as ChatMessage, type Contact, currentUser } from "./data";

interface ChatThreadProps {
  contact: Contact;
  messages: ChatMessage[];
  onOpenContact?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
}

export function ChatThread({ contact, messages, onOpenContact, onBack, showBackButton, className }: ChatThreadProps) {
  const [threadMessages, setThreadMessages] = useState(messages);
  const [sessionId, setSessionId] = useState<string>();
  const [isSending, setIsSending] = useState(false);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    const userMessage: ChatMessage = { id: Date.now(), align: "end", text: trimmed, time: "Vừa xong" };
    setThreadMessages((current) => [...current, userMessage]);
    setIsSending(true);
    try {
      const history: ChatTurn[] = threadMessages.slice(-10).map((item) => ({
        role: item.align === "end" ? "user" : "assistant",
        content: item.text,
      }));
      const answer = await askAgriculturalAssistant(trimmed, [...history, { role: "user", content: trimmed }], sessionId);
      setSessionId(answer.session_id);
      const text = answer.sections.map((section) => `**${section.title}:**\n${section.content.join("\n")}`).join("\n\n");
      setThreadMessages((current) => [...current, { id: Date.now() + 1, align: "start", text, time: "Vừa xong" }]);
    } catch (error) {
      setThreadMessages((current) => [
        ...current,
        { id: Date.now() + 1, align: "start", text: error instanceof Error ? error.message : "Không gọi được trợ lý nông nghiệp.", time: "Vừa xong" },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={cn("flex h-full flex-col py-3", className)}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label="Back to conversations"
                onClick={onBack}
              >
                <ArrowLeft />
              </Button>
            )}
            <Avatar className="size-8">
              <AvatarFallback className="bg-background text-foreground">{getInitials(contact.name)}</AvatarFallback>
              <AvatarBadge className="bg-green-600 dark:bg-green-800" />
            </Avatar>
            <div>
              <div className="font-medium text-sm">{contact.name}</div>
              <div className="text-muted-foreground text-xs leading-3">{contact.role}</div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Call">
                  <PhoneCall />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gọi</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Tag">
                  <Tag />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gắn nhãn</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Snooze">
                  <AlarmClock />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Nhắc lại sau</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={onOpenContact}>
                    <UserRound />
                    Xem hồ sơ
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Copy />
                    Sao chép email
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Flag />
                    Đánh dấu ưu tiên
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive">Chặn liên hệ</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Separator />
      </div>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-6 px-2 py-8">
              <Marker variant="separator">
                <MarkerContent>Hôm nay</MarkerContent>
              </Marker>

              {threadMessages.map((message) => {
                const isOutbound = message.align === "end";
                const reactionAlign = isOutbound ? "start" : "end";
                const senderName = isOutbound ? currentUser.name : contact.name;

                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={String(message.id)}
                    scrollAnchor={message.align === "end"}
                  >
                    <Message align={message.align}>
                      <MessageAvatar>
                        <Avatar>
                          <AvatarFallback
                            className={cn(
                              "bg-muted text-foreground text-xs",
                              isOutbound && "bg-primary text-primary-foreground",
                            )}
                          >
                            {getInitials(senderName)}
                          </AvatarFallback>
                        </Avatar>
                      </MessageAvatar>

                      <MessageContent>
                        <BubbleGroup>
                          <Bubble variant={isOutbound ? "default" : "muted"} align={message.align}>
                            <BubbleContent>{message.text}</BubbleContent>
                            {message.reaction ? (
                              <BubbleReactions aria-label={`Reaction: ${message.reaction}`} align={reactionAlign}>
                                <span>{message.reaction}</span>
                              </BubbleReactions>
                            ) : null}
                          </Bubble>
                        </BubbleGroup>
                        <MessageFooter>{message.time}</MessageFooter>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="px-2">
        <Tabs defaultValue="reply" className="gap-0 rounded-md border">
          <TabsList
            variant="line"
            className="w-full justify-start gap-2 border-b px-3 **:data-[slot=tabs-trigger]:border-x-0 **:data-[slot=tabs-trigger]:px-6 group-data-horizontal/tabs:h-10"
          >
            <TabsTrigger value="reply" className="flex-none px-1">
              Trò chuyện
            </TabsTrigger>
            <TabsTrigger value="note" className="flex-none px-1">
              Ghi chú
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reply" className="m-0">
            <MessageComposer placeholder="Hỏi trợ lý nông nghiệp..." onSend={sendMessage} disabled={isSending} />
          </TabsContent>
          <TabsContent value="note" className="m-0">
            <MessageComposer placeholder="Thêm ghi chú nội bộ..." />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MessageComposer({ placeholder, onSend, disabled = false }: { placeholder: string; onSend?: (text: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        onSend?.(value);
        if (onSend) setValue("");
      }}
    >
      <InputGroup className="border-0 bg-transparent shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot][aria-invalid=true]]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot][aria-invalid=true]]:ring-0 dark:bg-transparent dark:has-[[data-slot][aria-invalid=true]]:ring-0">
        <InputGroupTextarea
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          className="min-h-14 px-3 py-2.5 text-sm ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:aria-invalid:ring-0"
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton aria-label="Định dạng" type="button" size="icon-sm">
            <Type />
          </InputGroupButton>
          <InputGroupButton aria-label="Biểu tượng cảm xúc" type="button" size="icon-sm">
            <Smile />
          </InputGroupButton>
          <InputGroupButton aria-label="Đính kèm tệp" type="button" size="icon-sm">
            <Paperclip />
          </InputGroupButton>
          <InputGroupButton aria-label="Chèn liên kết" type="button" size="icon-sm">
            <Link />
          </InputGroupButton>
          <InputGroupButton aria-label="Trợ lý AI" type="button" size="icon-sm" variant="outline">
            <Sparkles />
          </InputGroupButton>
          <InputGroupButton type="submit" variant="default" size="icon-sm" className="ml-auto" disabled={disabled || !value.trim()}>
            <Send />
            <span className="sr-only">Send</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

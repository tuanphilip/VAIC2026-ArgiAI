"use client";

import { useEffect, useState } from "react";

import { ArrowLeft, History, Paperclip, Send, X } from "lucide-react";

import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { cn } from "@/lib/utils";
import { streamAgriculturalAssistant, type ChatTurn } from "@/lib/chat-api";

import { type Message as ChatMessage, type Contact, currentUser } from "./data";

interface ChatThreadProps {
  contact: Contact;
  messages: ChatMessage[];
  onOpenContact?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
}

type HistoryItem = { id: number; title: string; time: string; messages: ChatMessage[] };

export function ChatThread({ contact, messages, onOpenContact, onBack, showBackButton, className }: ChatThreadProps) {
  const [threadMessages, setThreadMessages] = useState(messages);
  const [sessionId, setSessionId] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("agriai-chat-history");
      if (saved) setHistoryItems(JSON.parse(saved));
    } catch {
      // ignore malformed local history
    }
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    const historyId = Date.now();
    const userMessage: ChatMessage = { id: historyId, align: "end", text: trimmed, time: "Vừa xong" };
    setThreadMessages((current) => [...current, userMessage]);
    setHistoryItems((current) => {
      const next = [{ id: historyId, title: trimmed, time: "Vừa xong", messages: [...threadMessages, userMessage] } as HistoryItem, ...current.filter((item) => item.title !== trimmed)].slice(0, 12);
      window.localStorage.setItem("agriai-chat-history", JSON.stringify(next));
      return next;
    });
    setIsSending(true);
    try {
      const history: ChatTurn[] = threadMessages.slice(-10).map((item) => ({
        role: item.align === "end" ? "user" : "assistant",
        content: item.text,
      }));
      const assistantId = Date.now() + 1;
      const assistantMessage: ChatMessage = { id: assistantId, align: "start", text: "", time: "Đang trả lời" };
      setThreadMessages((current) => [...current, assistantMessage]);
      let text = "";
      const answer = await streamAgriculturalAssistant(trimmed, [...history, { role: "user", content: trimmed }], sessionId, (token) => {
        text += token;
        setThreadMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text } : item));
      });
      setSessionId(answer.session_id);
      const completedMessage = { ...assistantMessage, text, time: "Vừa xong" };
      setThreadMessages((current) => current.map((item) => item.id === assistantId ? completedMessage : item));
      setHistoryItems((current) => {
        const next = current.map((item) => item.id === historyId ? { ...item, messages: [...item.messages, completedMessage] } : item);
        window.localStorage.setItem("agriai-chat-history", JSON.stringify(next));
        return next;
      });
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
    <div className={cn("relative flex h-full min-h-0 flex-col bg-background", className)}>
      {showHistory && (
        <aside className="absolute inset-y-0 left-0 z-20 flex w-72 flex-col border-r bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-4">
            <div>
              <h2 className="font-semibold text-sm">Lịch sử hội thoại</h2>
              <p className="mt-0.5 text-muted-foreground text-xs">Lưu trên thiết bị này</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Đóng lịch sử" onClick={() => setShowHistory(false)}><X /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {historyItems.length === 0 ? (
              <p className="px-3 py-8 text-center text-muted-foreground text-xs leading-5">Chưa có hội thoại nào.<br />Hãy bắt đầu bằng một câu hỏi.</p>
            ) : historyItems.map((item) => (
              <button key={item.id} type="button" onClick={() => { if (item.messages.length) setThreadMessages(item.messages); setShowHistory(false); }} className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted">
                <p className="line-clamp-2 font-medium text-xs leading-5">{item.title}</p>
                <p className="mt-1 text-muted-foreground text-[11px]">{item.time}</p>
              </button>
            ))}
          </div>
        </aside>
      )}
      <div className="shrink-0 border-b px-5 py-3">
        <div className="flex items-center justify-between gap-4">
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
            <Avatar className="size-9">
              <AvatarImage src="/logo.png" alt="AgriAI" className="object-contain p-1" />
              <AvatarFallback className="bg-emerald-600 font-semibold text-white">A</AvatarFallback>
              <AvatarBadge className="bg-emerald-500" />
            </Avatar>
            <div>
              <div className="font-medium text-sm">AgriAI Copilot</div>
              <div className="text-muted-foreground text-xs leading-3">Tư vấn cây trồng • Điện Biên</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700 text-xs dark:text-emerald-300 sm:block">Đang sẵn sàng</div>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => setShowHistory((value) => !value)} aria-label="Mở lịch sử hội thoại">
              <History className="size-4" /> <span className="hidden sm:inline">Lịch sử</span>
            </Button>
          </div>
        </div>
      </div>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-5 px-5 py-6">
              {threadMessages.length === 0 ? (
                <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-3xl">🌱</div>
                  <h2 className="font-semibold text-lg">Bạn cần hỗ trợ gì hôm nay?</h2>
                  <p className="mt-2 text-muted-foreground text-sm leading-6">
                    Mô tả cây trồng, triệu chứng hoặc gửi ảnh. Tôi sẽ đối chiếu dữ liệu nông nghiệp và nói rõ mức độ chắc chắn.
                  </p>
                </div>
              ) : threadMessages.map((message) => {
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
                            {senderName.trim().charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </MessageAvatar>

                      <MessageContent>
                        <BubbleGroup>
                          <Bubble variant={isOutbound ? "default" : "muted"} align={message.align}>
                            <BubbleContent className="whitespace-pre-wrap">{message.text}</BubbleContent>
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

      <div className="bg-background/80 px-3 pt-2 pb-5 backdrop-blur sm:px-4">
        <MessageComposer placeholder="Hỏi về cây trồng, sâu bệnh, thời tiết..." onSend={sendMessage} disabled={isSending} />
        <p className="mt-2 text-center text-muted-foreground text-[11px]">AI có thể sai. Hãy kiểm tra khuyến nghị thuốc và liều lượng với cán bộ kỹ thuật.</p>
      </div>
    </div>
  );
}

function MessageComposer({ placeholder, onSend, disabled = false }: { placeholder: string; onSend?: (text: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");

  return (
    <form
      className="mx-auto w-full max-w-3xl"
      onSubmit={(event) => {
        event.preventDefault();
        onSend?.(value);
        if (onSend) setValue("");
      }}
    >
      <InputGroup className="mx-auto max-w-xl rounded-xl border bg-muted/30 shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-primary/30 dark:bg-muted/20">
        <InputGroupTextarea
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={disabled}
          className="min-h-9 max-h-20 resize-none border-0 bg-transparent px-3 py-2 text-sm shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:aria-invalid:ring-0"
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton aria-label="Đính kèm tệp" type="button" size="icon-sm">
            <Paperclip />
          </InputGroupButton>
          <InputGroupButton type="submit" variant="default" size="icon-sm" className="ml-auto rounded-lg" disabled={disabled || !value.trim()}>
            <Send />
            <span className="sr-only">Gửi</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
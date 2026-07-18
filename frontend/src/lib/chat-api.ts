import { apiFetch, API_BASE_URL } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AgriculturalChatResponse {
  session_id: string;
  intent: string;
  sections: Array<{ title: string; content: string[] }>;
  quick_replies: string[];
  citations: Array<{ evidence_id: string; title: string; source_url: string }>;
  confidence: number;
}

export function askAgriculturalAssistant(message: string, history: ChatTurn[], sessionId?: string) {
  return apiFetch<AgriculturalChatResponse>("/chat/answer", {
    method: "POST",
    body: JSON.stringify({ message, history: history.slice(-10), session_id: sessionId }),
  });
}

export async function streamAgriculturalAssistant(
  message: string,
  history: ChatTurn[],
  sessionId: string | undefined,
  onToken: (token: string) => void,
) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error("Chưa đăng nhập");
  const response = await fetch(`${API_BASE_URL}/chat/answer/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, history: history.slice(-10), session_id: sessionId }),
  });
  if (!response.ok || !response.body) throw new Error("Không mở được luồng trả lời của trợ lý.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let meta: AgriculturalChatResponse | undefined;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      if (!event.startsWith("data: ")) continue;
      const payload = JSON.parse(event.slice(6)) as { type: string; text?: string; response?: AgriculturalChatResponse };
      if (payload.type === "meta") meta = payload.response;
      if (payload.type === "token" && payload.text) onToken(payload.text);
    }
    if (done) break;
  }
  if (!meta) throw new Error("Luồng trả lời kết thúc thiếu dữ liệu.");
  return meta;
}

import { apiFetch } from "@/lib/api-client";

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

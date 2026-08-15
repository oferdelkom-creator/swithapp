"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import type { Message } from "@/lib/types";

export default function ChatThread({
  matchId,
  myId,
  initialMessages,
  myAgreedToCall,
  isUserA,
}: {
  matchId: string;
  myId: string;
  otherId: string;
  initialMessages: Message[];
  myAgreedToCall: boolean;
  isUserA: boolean;
}) {
  const { t } = useLocale();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [agreed, setAgreed] = useState(myAgreedToCall);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const supabase = createClient();
    const body = text;
    setText("");
    const { data } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: myId, text: body, kind: "chat" })
      .select()
      .single();
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]));
    setSending(false);
  }

  async function agreeToCall() {
    const supabase = createClient();
    const field = isUserA ? "user_a_agreed_to_call" : "user_b_agreed_to_call";
    await supabase.from("matches").update({ [field]: true }).eq("id", matchId);
    setAgreed(true);
  }

  async function reportUser() {
    const reason = prompt(t("chat.reportPrompt"));
    if (!reason) return;
    const supabase = createClient();
    await supabase.from("messages").insert({ match_id: matchId, sender_id: myId, text: reason, kind: "report" });
    alert(t("chat.reportSent"));
  }

  return (
    <div>
      <div className="flex justify-end gap-3 mb-3 text-xs">
        {!agreed && (
          <button onClick={agreeToCall} className="underline text-brand-blue">
            {t("chat.agreeToCall")}
          </button>
        )}
        <button onClick={reportUser} className="underline text-red-600">
          {t("chat.report")}
        </button>
      </div>

      <div className="card h-96 overflow-y-auto p-4 space-y-2">
        {messages
          .filter((m) => m.kind !== "report")
          .map((m) => (
            <div
              key={m.id}
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                m.sender_id === myId ? "bg-brand-blue text-white ms-auto" : "bg-neutral-100"
              }`}
            >
              {m.text}
            </div>
          ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.messagePlaceholder")}
          className="field flex-1"
        />
        <button type="submit" disabled={sending} className="btn-primary">
          {t("chat.send")}
        </button>
      </form>
    </div>
  );
}

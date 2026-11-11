"use client";

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import type { ConversationMessage } from "@/lib/types";

interface TranscriptViewProps {
  messages: ConversationMessage[];
  className?: string;
}

export function TranscriptView({ messages, className }: TranscriptViewProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {messages.map((msg) => (
        <TranscriptBubble key={msg.id} message={msg} />
      ))}
      {messages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No messages yet. Start a conversation to see the transcript.
        </p>
      )}
    </div>
  );
}

function TranscriptBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  if (isTool) {
    return (
      <div className="flex justify-center">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
          🔧 Tool: <span className="font-medium">{message.tool_name}</span>
          {message.latency_ms && (
            <span className="ml-2 text-amber-600">({message.latency_ms}ms)</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100">
          <Bot className="h-3.5 w-3.5 text-indigo-600" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        {message.content}
        {message.latency_ms && (
          <span className="ml-2 text-[10px] opacity-60">{message.latency_ms}ms</span>
        )}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200">
          <User className="h-3.5 w-3.5 text-gray-600" />
        </div>
      )}
    </div>
  );
}


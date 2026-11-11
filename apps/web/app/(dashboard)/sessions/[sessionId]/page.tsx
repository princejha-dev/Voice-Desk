"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TranscriptView } from "@/components/call/transcript-view";
import { ArrowLeft, Clock, Bot, DollarSign, Zap, Mic, Brain, Volume2, Wrench } from "lucide-react";
import type { ConversationMessage } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

const demoMessages: ConversationMessage[] = [
  { id: "m1", tenant_id: "t1", session_id: "s1", role: "assistant", content: "Hello! Thank you for calling. How can I help you today?", tool_name: null, tool_args: null, tool_result: null, latency_ms: 820, tokens_used: 18, created_at: "2026-11-11T10:30:00Z" },
  { id: "m2", tenant_id: "t1", session_id: "s1", role: "user", content: "Hi, I wanted to ask about your return policy for electronics.", tool_name: null, tool_args: null, tool_result: null, latency_ms: null, tokens_used: null, created_at: "2026-11-11T10:30:08Z" },
  { id: "m3", tenant_id: "t1", session_id: "s1", role: "tool", content: "knowledge_search result: Return policy allows 30 days for electronics with original receipt...", tool_name: "knowledge_search", tool_args: { query: "electronics return policy" }, tool_result: { chunks: 3, top_score: 0.92 }, latency_ms: 180, tokens_used: null, created_at: "2026-11-11T10:30:12Z" },
  { id: "m4", tenant_id: "t1", session_id: "s1", role: "assistant", content: "Our return policy for electronics allows returns within 30 days of purchase. You'll need to bring the original receipt and the item in its original packaging. Items must be in working condition. Is there anything else you'd like to know?", tool_name: null, tool_args: null, tool_result: null, latency_ms: 950, tokens_used: 52, created_at: "2026-11-11T10:30:14Z" },
  { id: "m5", tenant_id: "t1", session_id: "s1", role: "user", content: "What if I lost the receipt?", tool_name: null, tool_args: null, tool_result: null, latency_ms: null, tokens_used: null, created_at: "2026-11-11T10:30:28Z" },
  { id: "m6", tenant_id: "t1", session_id: "s1", role: "assistant", content: "If you don't have the original receipt, we can sometimes look up your purchase using your credit card or loyalty account. However, without proof of purchase, we're only able to offer store credit at the current sale price. Would you like me to connect you with a store associate who can help further?", tool_name: null, tool_args: null, tool_result: null, latency_ms: 1100, tokens_used: 61, created_at: "2026-11-11T10:30:32Z" },
  { id: "m7", tenant_id: "t1", session_id: "s1", role: "user", content: "No, that's perfect. Thank you!", tool_name: null, tool_args: null, tool_result: null, latency_ms: null, tokens_used: null, created_at: "2026-11-11T10:30:45Z" },
  { id: "m8", tenant_id: "t1", session_id: "s1", role: "assistant", content: "You're welcome! Is there anything else I can help you with today?", tool_name: null, tool_args: null, tool_result: null, latency_ms: 680, tokens_used: 20, created_at: "2026-11-11T10:30:47Z" },
];

const latencyBreakdown = [
  { label: "STT (Deepgram)", icon: Mic, color: "bg-blue-500", avg: "95ms", pct: 12 },
  { label: "LLM (GPT-4.1 Mini)", icon: Brain, color: "bg-indigo-500", avg: "680ms", pct: 73 },
  { label: "TTS (Cartesia)", icon: Volume2, color: "bg-violet-500", avg: "110ms", pct: 15 },
];

export default function SessionDetailPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard/sessions")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Session Detail</h1>
            <Badge variant="success">completed</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Nov 11, 2026 · 10:30 AM · Sarah — Customer Support
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transcript */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <TranscriptView messages={demoMessages} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar metrics */}
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Agent</span>
                <span className="font-medium flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-indigo-500" />
                  Sarah
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(204)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Outcome</span>
                <Badge variant="success">Resolved</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Est. Cost</span>
                <span className="font-medium flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  $0.18
                </span>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1">AI Summary</p>
                <p className="text-xs leading-relaxed">
                  Customer inquired about electronics return policy. Agent retrieved policy from knowledge base and explained 30-day return window with receipt requirement. Also addressed no-receipt scenario. Resolved without escalation.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Latency breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Latency Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center py-2">
                <p className="text-3xl font-bold">885ms</p>
                <p className="text-xs text-muted-foreground">avg. response time</p>
              </div>
              <Separator />
              {latencyBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs flex items-center gap-1.5 text-muted-foreground">
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </span>
                    <span className="text-xs font-semibold">{item.avg}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tool executions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-500" />
                Tool Executions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-amber-800">knowledge_search</span>
                  <Badge variant="success" className="text-[10px]">success</Badge>
                </div>
                <p className="text-xs text-amber-700">Query: &ldquo;electronics return policy&rdquo;</p>
                <p className="text-xs text-amber-600 mt-1">3 chunks · top score 0.92 · 180ms</p>
              </div>
            </CardContent>
          </Card>

          {/* Token usage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Token Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Input tokens</span>
                <span className="font-medium">1,248</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Output tokens</span>
                <span className="font-medium">151</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Total</span>
                <span className="font-bold">1,399</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


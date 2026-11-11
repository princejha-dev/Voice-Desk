"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TranscriptView } from "@/components/call/transcript-view";
import { ArrowLeft, Clock, Bot, DollarSign, Zap, Mic, Brain, Volume2, Wrench } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { useSession } from "@/hooks/use-api";
import type { ConversationMessage } from "@/lib/types";

const latencyBreakdown = [
  { label: "STT (Deepgram)", icon: Mic, color: "bg-blue-500", pct: 12 },
  { label: "LLM", icon: Brain, color: "bg-indigo-500", pct: 73 },
  { label: "TTS (Cartesia)", icon: Volume2, color: "bg-violet-500", pct: 15 },
];

function timeAgo(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusVariant: Record<string, "success" | "destructive" | "info" | "warning"> = {
  completed: "success",
  ended: "success",
  failed: "destructive",
  active: "info",
  in_progress: "info",
  timeout: "warning",
};

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;
  const { session, loading } = useSession(sessionId);

  const messages: ConversationMessage[] = ((session?.messages as ConversationMessage[]) ?? []);

  const totalLatencyMs =
    messages
      .filter((m) => m.latency_ms)
      .reduce((sum, m) => sum + (m.latency_ms ?? 0), 0) /
      Math.max(messages.filter((m) => m.latency_ms).length, 1) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/sessions")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight">Session Detail</h1>
                <Badge variant={statusVariant[(session?.status as string) ?? ""] ?? "secondary"}>
                  {(session?.status as string) ?? "unknown"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {timeAgo(session?.started_at as string)} · {(session?.agent_name as string) ?? "Agent"}
              </p>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transcript */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length > 0 ? (
                  <TranscriptView messages={messages} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No transcript available for this session.
                  </p>
                )}
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
                    {(session?.agent_name as string) ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration((session?.duration_seconds as number) ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={statusVariant[(session?.status as string) ?? ""] ?? "secondary"}>
                    {(session?.status as string) ?? "—"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Est. Cost</span>
                  <span className="font-medium flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    {session?.cost_usd ? `$${Number(session.cost_usd).toFixed(2)}` : "—"}
                  </span>
                </div>
                {Boolean(session?.summary) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground mb-1">AI Summary</p>
                      <p className="text-xs leading-relaxed">{String(session!.summary)}</p>
                    </div>
                  </>
                )}
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
                  <p className="text-3xl font-bold">
                    {totalLatencyMs > 0 ? `${Math.round(totalLatencyMs)}ms` : "—"}
                  </p>
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
            {messages.filter((m) => m.role === "tool").length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-amber-500" />
                    Tool Executions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {messages
                    .filter((m) => m.role === "tool")
                    .map((m) => (
                      <div key={m.id} className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-amber-800">{m.tool_name}</span>
                          <Badge variant="success" className="text-[10px]">executed</Badge>
                        </div>
                        {m.latency_ms && (
                          <p className="text-xs text-amber-600 mt-1">{m.latency_ms}ms</p>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

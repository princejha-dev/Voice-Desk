"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CallChart } from "@/components/dashboard/call-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitoringOverview, useOrganization, useSessions, useAgents } from "@/hooks/use-api";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Bot,
  Phone,
  Clock,
  Wrench,
  MessageSquare,
} from "lucide-react";

type LiveEvent = {
  time: string;
  type: string;
  agent: string;
  detail: string;
  icon: React.ElementType;
  color: string;
};

export default function MonitoringPage() {
  const { orgId } = useOrganization();
  const { overview, loading: overviewLoading } = useMonitoringOverview();
  const { sessions, loading: sessionsLoading } = useSessions({ limit: 15 });
  const { agents, loading: agentsLoading } = useAgents();

  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize event feed from real historical call sessions if live feed is empty
  useEffect(() => {
    if (sessions.length > 0 && liveEvents.length === 0) {
      const initial: LiveEvent[] = sessions.map((s) => {
        const timeStr = s.started_at ? new Date(s.started_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
        const status = (s.status as string) || "completed";
        const isCompleted = status === "completed" || status === "ended";
        const isFailed = status === "failed";
        const isLive = status === "active";

        return {
          time: timeStr,
          type: isLive ? "call_active" : isFailed ? "call_failed" : "call_completed",
          agent: (s.agent_name as string) || "Voice Agent",
          detail: isLive
            ? `Active call ongoing in room ${s.room_name || s.id}`
            : isFailed
            ? `Call terminated with error`
            : `Call completed (${s.duration_seconds || 0}s duration)`,
          icon: isLive ? Phone : isFailed ? AlertTriangle : CheckCircle2,
          color: isLive ? "text-emerald-500" : isFailed ? "text-red-500" : "text-indigo-500",
        };
      });
      setLiveEvents(initial);
    }
  }, [sessions, liveEvents.length]);

  // Connect to live WebSocket telemetry feed
  useEffect(() => {
    if (!orgId) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const wsUrl = `${apiBase.replace(/^http/, "ws")}/api/v1/organizations/${orgId}/monitoring/live`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data as string);
          if (payload.type === "connection" || payload.type === "status") return;

          const eventType = payload.event_type || payload.type || "event";
          const eventData = payload.data || {};
          const now = new Date().toTimeString().slice(0, 8);

          let icon = Activity;
          let color = "text-indigo-500";
          let detail = `Event: ${eventType}`;

          if (eventType === "session_started") {
            icon = Phone;
            color = "text-emerald-500";
            detail = `New voice call session started (${eventData.room_name || ""})`;
          } else if (eventType === "session_ended") {
            icon = CheckCircle2;
            color = "text-indigo-500";
            detail = `Voice call ended cleanly`;
          } else if (eventType === "tool_called") {
            icon = Wrench;
            color = "text-amber-500";
            detail = `Tool executed: ${eventData.tool_name || "tool"}`;
          }

          setLiveEvents((prev) => [
            {
              time: now,
              type: eventType,
              agent: eventData.agent_name || "Agent",
              detail,
              icon,
              color,
            },
            ...prev.slice(0, 24),
          ]);
        } catch {
          // ignore parsing error
        }
      };
    } catch {
      // WS unavailable
    }

    return () => {
      wsRef.current?.close();
    };
  }, [orgId]);

  const activeSessions = (overview?.active_calls as number) ?? 0;
  const avgDuration = (overview?.avg_duration_seconds as number) ?? 0;
  const successRate = (overview?.success_rate_percent as number) ?? 0;
  const errorsToday = (overview?.failed_calls as number) ?? 0;

  // Real 7-day trend data from backend
  const trendData = useMemo(() => {
    const rawTrend = (overview?.daily_trend as Array<{ date: string; calls: number }>) || [];
    if (rawTrend.length > 0) {
      return rawTrend.map((d) => ({
        date: d.date.slice(5), // "MM-DD"
        calls: d.calls,
      }));
    }
    return [
      { date: "Day -6", calls: 0 },
      { date: "Day -5", calls: 0 },
      { date: "Day -4", calls: 0 },
      { date: "Day -3", calls: 0 },
      { date: "Day -2", calls: 0 },
      { date: "Yesterday", calls: 0 },
      { date: "Today", calls: (overview?.total_calls_today as number) ?? 0 },
    ];
  }, [overview]);

  const loading = overviewLoading || sessionsLoading || agentsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time agent performance, health metrics, and live session stream
        </p>
      </div>

      {/* Live KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatsCard title="Active Sessions" value={activeSessions} icon={Activity} iconColor="text-emerald-600" />
            <StatsCard title="Avg. Call Duration" value={`${avgDuration}s`} icon={Clock} iconColor="text-indigo-600" />
            <StatsCard title="Success Rate (Today)" value={`${successRate.toFixed(1)}%`} icon={CheckCircle2} iconColor="text-emerald-600" />
            <StatsCard title="Errors (Today)" value={errorsToday} icon={AlertTriangle} iconColor="text-red-500" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Volume Chart */}
        <div className="lg:col-span-2">
          <CallChart data={trendData} title="Call Volume (Last 7 Days)" />
        </div>

        {/* Real Agents Health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deployed Agents</CardTitle>
            <CardDescription className="text-xs">Active voice agents in this organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No agents configured yet.</p>
            ) : (
              agents.map((agent: Record<string, unknown>) => {
                const agentName = (agent.name as string) || "Voice Agent";
                const isPublished = agent.status === "published" || !!agent.current_version_id;
                return (
                  <div key={agent.id as string} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-medium">{agentName}</span>
                      </div>
                      <Badge variant={isPublished ? "success" : "secondary"}>
                        {isPublished ? "Live" : "Draft"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-between pt-1">
                      <span>Slug: /{agent.slug as string}</span>
                      <span className="font-mono text-[10px] opacity-75">WebRTC Ready</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Event Feed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Live Activity Feed</CardTitle>
            <CardDescription className="mt-0.5">Real-time session events and call logs</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-muted-foreground">Connected</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {liveEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No call events recorded yet. Make a call to see live events stream here.
            </p>
          ) : (
            liveEvents.map((event, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                <event.icon className={`h-4 w-4 mt-0.5 shrink-0 ${event.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{event.agent}</Badge>
                    <span className="text-sm">{event.detail}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono shrink-0">{event.time}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

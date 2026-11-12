"use client";

import { StatsCard } from "@/components/dashboard/stats-card";
import { CallChart } from "@/components/dashboard/call-chart";
import { RecentCalls } from "@/components/dashboard/recent-calls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot, Phone, TrendingUp, Clock, Plus, AlertTriangle, CheckCircle2, Activity,
} from "lucide-react";
import Link from "next/link";
import { useAgents, useMonitoringOverview, useSessions } from "@/hooks/use-api";

// Fallback chart data while real data loads
const EMPTY_CHART = [
  { date: "Mon", calls: 0 }, { date: "Tue", calls: 0 }, { date: "Wed", calls: 0 },
  { date: "Thu", calls: 0 }, { date: "Fri", calls: 0 }, { date: "Sat", calls: 0 },
  { date: "Sun", calls: 0 },
];

function formatDuration(seconds?: number) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(iso?: string) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export default function OverviewPage() {
  const { agents, loading: agentsLoading } = useAgents();
  const { overview, loading: overviewLoading } = useMonitoringOverview();
  const { sessions, loading: sessionsLoading } = useSessions({ limit: 10 });

  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "published").length;

  const totalCallsToday = (overview?.total_calls_today as number) ?? 0;
  const avgDurationSec = (overview?.avg_duration_seconds as number) ?? 0;
  const successRate = (overview?.success_rate_percent as number) ?? 0;

  const recentCallsData = sessions.map((s) => ({
    id: s.id as string,
    agent_name: (s.agent_name as string) ?? "Agent",
    caller: "Anonymous",
    duration: formatDuration(s.duration_seconds as number),
    status: (s.status === "ended" ? "completed" : s.status === "failed" ? "failed" : "active") as "completed" | "failed" | "active",
    outcome: s.status as string,
    time: timeAgo(s.started_at as string),
  }));

  const loading = agentsLoading || overviewLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Link href="/dashboard/agents/new">
            <Plus className="h-4 w-4" />
            New Agent
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatsCard
              title="Total Agents"
              value={String(totalAgents)}
              icon={Bot}
              subtitle={totalAgents > 0 ? `${activeAgents} active` : "Create your first"}
              changeType="neutral"
            />
            <StatsCard
              title="Active Calls"
              value={String(overview?.active_calls ?? 0)}
              icon={Phone}
              subtitle="right now"
              changeType="neutral"
            />
            <StatsCard
              title="Calls Today"
              value={String(totalCallsToday)}
              icon={TrendingUp}
              subtitle={successRate > 0 ? `${successRate}% success rate` : "No calls yet"}
              changeType={successRate >= 80 ? "positive" : successRate > 0 ? "negative" : "neutral"}
            />
            <StatsCard
              title="Avg Duration"
              value={formatDuration(avgDurationSec)}
              icon={Clock}
              subtitle="per call"
              changeType="neutral"
            />
          </>
        )}
      </div>

      {/* Chart + Agent Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallChart data={EMPTY_CHART} />
        </div>

        {/* Agent health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Agent Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agentsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)
            ) : agents.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No agents yet.{" "}
                <Link href="/agents/new" className="text-indigo-600 hover:underline">
                  Create one
                </Link>
              </div>
            ) : (
              agents.slice(0, 6).map((agent) => (
                <Link
                  key={agent.id as string}
                  href={`/agents/${agent.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 shrink-0">
                      <Bot className="h-3.5 w-3.5 text-indigo-600" />
                    </div>
                    <span className="text-sm font-medium truncate">{agent.name as string}</span>
                  </div>
                  <Badge
                    className={
                      agent.status === "published"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }
                    variant="outline"
                  >
                    {agent.status as string}
                  </Badge>
                </Link>
              ))
            )}
            {agents.length > 6 && (
              <Link href="/agents" className="text-xs text-indigo-600 hover:underline block text-center pt-1">
                View all {agents.length} agents →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Calls + System Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {sessionsLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <RecentCalls calls={recentCallsData.length > 0 ? recentCallsData : []} />
          )}
        </div>

        {/* System alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "API Server", ok: true },
              { label: "LiveKit Cloud", ok: true },
              { label: "Supabase DB", ok: true },
              { label: "Redis Queue", ok: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`flex items-center gap-1 font-medium ${item.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {item.ok
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> Operational</>
                    : <><AlertTriangle className="h-3.5 w-3.5" /> Degraded</>
                  }
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

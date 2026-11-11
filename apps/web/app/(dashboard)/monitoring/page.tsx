"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CallChart } from "@/components/dashboard/call-chart";
import {
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Bot,
  Phone,
  Cpu,
  Gauge,
  Wrench,
  MessageSquare,
} from "lucide-react";

const latencyData = [
  { date: "Mon", calls: 820 },
  { date: "Tue", calls: 750 },
  { date: "Wed", calls: 880 },
  { date: "Thu", calls: 910 },
  { date: "Fri", calls: 790 },
  { date: "Sat", calls: 850 },
  { date: "Sun", calls: 830 },
];

const liveEvents = [
  { time: "16:09:32", type: "message", agent: "Sarah", detail: "Customer asked about refund policy", icon: MessageSquare, color: "text-blue-500" },
  { time: "16:09:30", type: "tool", agent: "Sarah", detail: "knowledge_search executed — 3 sources found (180ms)", icon: Wrench, color: "text-amber-500" },
  { time: "16:09:28", type: "latency", agent: "Sarah", detail: "LLM response latency: 2.4s (above threshold)", icon: AlertTriangle, color: "text-red-500" },
  { time: "16:08:55", type: "session", agent: "Alex", detail: "New session started — appointment inquiry", icon: Phone, color: "text-emerald-500" },
  { time: "16:08:40", type: "tool", agent: "Alex", detail: "book_appointment executed — Dec 5 at 2 PM confirmed (220ms)", icon: Wrench, color: "text-amber-500" },
  { time: "16:07:12", type: "session", agent: "Sarah", detail: "Session completed — resolved in 3:24", icon: CheckCircle2, color: "text-emerald-500" },
];

const agentMetrics = [
  {
    name: "Sarah — Support",
    status: "active",
    activeSessions: 2,
    avgLatency: "820ms",
    successRate: "94.2%",
    callsToday: 47,
  },
  {
    name: "Alex — Booking",
    status: "active",
    activeSessions: 1,
    avgLatency: "650ms",
    successRate: "97.1%",
    callsToday: 18,
  },
  {
    name: "Maya — Sales",
    status: "inactive",
    activeSessions: 0,
    avgLatency: "—",
    successRate: "—",
    callsToday: 0,
  },
];

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time agent performance and live session events
        </p>
      </div>

      {/* Live KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Active Sessions" value={3} icon={Activity} iconColor="text-emerald-600" />
        <StatsCard title="Avg. Response Latency" value="820ms" icon={Gauge} iconColor="text-indigo-600" />
        <StatsCard title="Success Rate (Today)" value="95.1%" icon={CheckCircle2} iconColor="text-emerald-600" />
        <StatsCard title="Errors (Today)" value={2} icon={AlertTriangle} iconColor="text-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency chart */}
        <div className="lg:col-span-2">
          <CallChart data={latencyData} title="Avg. Latency (ms) — Last 7 Days" />
        </div>

        {/* Agent status cards */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Agent Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agentMetrics.map((agent) => (
              <div key={agent.name} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-medium">{agent.name}</span>
                  </div>
                  <Badge variant={agent.status === "active" ? "success" : "secondary"}>
                    {agent.status}
                  </Badge>
                </div>
                {agent.status === "active" && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Latency</p>
                      <p className="text-sm font-semibold">{agent.avgLatency}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Success</p>
                      <p className="text-sm font-semibold">{agent.successRate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Today</p>
                      <p className="text-sm font-semibold">{agent.callsToday}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Live event feed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Live Events</CardTitle>
            <CardDescription className="mt-0.5">Real-time session activity across all agents</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {liveEvents.map((event, i) => (
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
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


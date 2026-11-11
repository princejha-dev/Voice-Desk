"use client";

import { StatsCard } from "@/components/dashboard/stats-card";
import { CallChart } from "@/components/dashboard/call-chart";
import { RecentCalls } from "@/components/dashboard/recent-calls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Phone,
  TrendingUp,
  Clock,
  DollarSign,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from "lucide-react";
import Link from "next/link";

// Mock data for the overview dashboard
const callData = [
  { date: "Mon", calls: 85 },
  { date: "Tue", calls: 132 },
  { date: "Wed", calls: 156 },
  { date: "Thu", calls: 148 },
  { date: "Fri", calls: 210 },
  { date: "Sat", calls: 95 },
  { date: "Sun", calls: 72 },
];

const recentCalls = [
  {
    id: "1",
    agent_name: "Sarah — Support",
    caller: "Anonymous",
    duration: "3:24",
    status: "completed" as const,
    outcome: "Resolved",
    time: "2 min ago",
  },
  {
    id: "2",
    agent_name: "Alex — Booking",
    caller: "Anonymous",
    duration: "1:56",
    status: "completed" as const,
    outcome: "Appointment booked",
    time: "15 min ago",
  },
  {
    id: "3",
    agent_name: "Sarah — Support",
    caller: "Anonymous",
    duration: "0:42",
    status: "failed" as const,
    outcome: "Timeout",
    time: "1 hr ago",
  },
  {
    id: "4",
    agent_name: "Maya — Sales",
    caller: "Anonymous",
    duration: "5:12",
    status: "completed" as const,
    outcome: "Lead captured",
    time: "2 hr ago",
  },
  {
    id: "5",
    agent_name: "Sarah — Support",
    caller: "Anonymous",
    duration: "2:08",
    status: "completed" as const,
    outcome: "Callback requested",
    time: "3 hr ago",
  },
];

const agents = [
  { name: "Sarah — Support", status: "published", calls: 842, health: "healthy" },
  { name: "Alex — Booking", status: "published", calls: 312, health: "healthy" },
  { name: "Maya — Sales", status: "draft", calls: 0, health: "inactive" },
];

const alerts = [
  { type: "warning", message: "Agent 'Sarah' latency above 2s threshold", time: "10 min ago" },
  { type: "info", message: "Knowledge base updated for Sarah — Support", time: "1 hr ago" },
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your workspace at a glance
          </p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Agents"
          value={3}
          icon={Bot}
          iconColor="text-indigo-600"
        />
        <StatsCard
          title="Active Agents"
          value={2}
          icon={Activity}
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Calls This Month"
          value="1,284"
          change={12}
          changeLabel="vs last month"
          icon={Phone}
          iconColor="text-violet-600"
        />
        <StatsCard
          title="Est. Cost"
          value="$42.80"
          change={-5}
          changeLabel="vs last month"
          icon={DollarSign}
          iconColor="text-amber-600"
        />
      </div>

      {/* Charts and agents row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CallChart data={callData} title="Call Volume — Last 7 Days" />
        </div>

        {/* Agent health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Agent Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                    <Bot className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.calls} calls</p>
                  </div>
                </div>
                <Badge
                  variant={
                    agent.health === "healthy"
                      ? "success"
                      : agent.health === "warning"
                      ? "warning"
                      : "secondary"
                  }
                >
                  {agent.health === "healthy" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {agent.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent calls and alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentCalls calls={recentCalls} />
        </div>

        {/* System alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                <AlertTriangle
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    alert.type === "warning" ? "text-amber-500" : "text-blue-500"
                  }`}
                />
                <div>
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No recent alerts
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


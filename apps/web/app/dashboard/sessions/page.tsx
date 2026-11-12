"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Bot, Clock, Filter, ArrowUpDown, Phone } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { useSessions } from "@/hooks/use-api";

const statusVariant: Record<string, "success" | "destructive" | "info" | "warning"> = {
  completed: "success",
  ended: "success",
  failed: "destructive",
  active: "info",
  timeout: "warning",
  in_progress: "info",
};

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

export default function SessionsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");

  const { sessions: rawSessions, loading } = useSessions({ limit: 50 });

  const sessions = rawSessions.map((s) => ({
    id: s.id as string,
    agent: (s.agent_name as string) ?? (s.agent_id as string) ?? "Agent",
    agentId: s.agent_id as string,
    duration: (s.duration_seconds as number) ?? 0,
    status: (s.status as string) ?? "unknown",
    summary: (s.summary as string) ?? "—",
    cost: (s.cost_usd as number) ?? 0,
    time: timeAgo(s.started_at as string),
  }));

  // Collect unique agents for filter
  const uniqueAgents = Array.from(new Set(sessions.map((s) => s.agent)));

  const filtered = sessions.filter((s) => {
    const matchSearch =
      s.agent.toLowerCase().includes(search.toLowerCase()) ||
      s.summary.toLowerCase().includes(search.toLowerCase());
    const matchAgent = agentFilter === "all" || s.agent.includes(agentFilter);
    return matchSearch && matchAgent;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse call history, transcripts, and outcomes
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {uniqueAgents.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!loading && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                      Duration <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                      <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      {search ? `No conversations match "${search}"` : "No conversations yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((session) => (
                    <TableRow
                      key={session.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/sessions/${session.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                            <Bot className="h-3.5 w-3.5 text-indigo-600" />
                          </div>
                          <span className="font-medium text-sm">{session.agent}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground max-w-xs truncate">{session.summary}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(session.duration)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[session.status] ?? "secondary"}>
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {session.cost > 0 ? `$${session.cost.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {session.time}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

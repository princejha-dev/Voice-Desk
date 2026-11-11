"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Bot, Clock, Phone, Filter, ArrowUpDown } from "lucide-react";
import { formatDuration } from "@/lib/utils";

const demoSessions = [
  { id: "s1", agent: "Sarah — Support", caller: "Anonymous", duration: 204, status: "completed" as const, outcome: "Resolved", summary: "Customer asked about return policy for electronics", cost: 0.18, time: "2 min ago" },
  { id: "s2", agent: "Alex — Booking", caller: "Anonymous", duration: 116, status: "completed" as const, outcome: "Appointment booked", summary: "Scheduled dental cleaning for Dec 3rd at 10 AM", cost: 0.10, time: "15 min ago" },
  { id: "s3", agent: "Sarah — Support", caller: "Anonymous", duration: 42, status: "failed" as const, outcome: "Timeout", summary: "Call dropped — audio timeout after 42 seconds", cost: 0.04, time: "1 hr ago" },
  { id: "s4", agent: "Sarah — Support", caller: "Anonymous", duration: 312, status: "completed" as const, outcome: "Lead captured", summary: "Customer inquired about enterprise pricing, provided email", cost: 0.28, time: "2 hr ago" },
  { id: "s5", agent: "Sarah — Support", caller: "Anonymous", duration: 128, status: "completed" as const, outcome: "Callback requested", summary: "Complex billing issue — requested human callback", cost: 0.11, time: "3 hr ago" },
  { id: "s6", agent: "Alex — Booking", caller: "Anonymous", duration: 95, status: "completed" as const, outcome: "Rescheduled", summary: "Moved appointment from Dec 1 to Dec 5", cost: 0.08, time: "5 hr ago" },
  { id: "s7", agent: "Sarah — Support", caller: "Anonymous", duration: 188, status: "completed" as const, outcome: "Resolved", summary: "Answered questions about product warranty", cost: 0.16, time: "6 hr ago" },
  { id: "s8", agent: "Sarah — Support", caller: "Anonymous", duration: 67, status: "completed" as const, outcome: "Resolved", summary: "Provided store hours and location", cost: 0.06, time: "8 hr ago" },
];

const statusVariant: Record<string, "success" | "destructive" | "info" | "warning"> = {
  completed: "success",
  failed: "destructive",
  active: "info",
  timeout: "warning",
};

export default function SessionsPage() {
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");

  const filtered = demoSessions.filter((s) => {
    const matchSearch =
      s.agent.toLowerCase().includes(search.toLowerCase()) ||
      s.summary.toLowerCase().includes(search.toLowerCase()) ||
      s.outcome.toLowerCase().includes(search.toLowerCase());
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
          <Input placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            <SelectItem value="Sarah">Sarah — Support</SelectItem>
            <SelectItem value="Alex">Alex — Booking</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
                <TableHead>Outcome</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((session) => (
                <TableRow key={session.id} className="cursor-pointer" onClick={() => {}}>
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
                    <Badge variant={statusVariant[session.status]}>{session.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{session.outcome}</TableCell>
                  <TableCell className="text-sm font-medium">${session.cost.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{session.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


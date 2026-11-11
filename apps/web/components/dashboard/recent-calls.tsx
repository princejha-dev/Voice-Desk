"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Clock, Bot } from "lucide-react";

interface RecentCall {
  id: string;
  agent_name: string;
  caller: string;
  duration: string;
  status: "completed" | "failed" | "active";
  outcome: string;
  time: string;
}

const statusVariant: Record<string, "success" | "destructive" | "info"> = {
  completed: "success",
  failed: "destructive",
  active: "info",
};

export function RecentCalls({ calls }: { calls: RecentCall[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Recent Conversations</CardTitle>
        <a href="/dashboard/sessions" className="text-sm text-primary hover:underline">
          View all
        </a>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.map((call) => (
              <TableRow key={call.id} className="cursor-pointer">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                      <Bot className="h-3.5 w-3.5 text-indigo-600" />
                    </div>
                    <span className="font-medium">{call.agent_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{call.caller}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {call.duration}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[call.status]}>{call.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{call.outcome}</TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {call.time}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


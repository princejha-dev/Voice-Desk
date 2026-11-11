"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Phone, MoreVertical } from "lucide-react";
import type { Agent } from "@/lib/types";

interface AgentCardProps {
  agent: Agent;
  className?: string;
}

const templateLabels: Record<string, string> = {
  customer_support: "Customer Support",
  appointment_booking: "Appointment Booking",
  sales_assistant: "Sales Assistant",
  business_assistant: "Business Assistant",
};

export function AgentCard({ agent, className }: AgentCardProps) {
  return (
    <Link href={`/dashboard/agents/${agent.id}`}>
      <Card
        className={cn(
          "group relative cursor-pointer transition-all hover:shadow-md hover:border-primary/20",
          className
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{agent.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {agent.template ? templateLabels[agent.template] || agent.template : "Custom"}
                </p>
              </div>
            </div>
            <Badge
              variant={agent.status === "published" ? "success" : agent.status === "draft" ? "warning" : "secondary"}
            >
              {agent.status}
            </Badge>
          </div>

          {agent.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {agent.description}
            </p>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <span>{agent.call_count ?? 0} calls</span>
            </div>
            {agent.active_version && (
              <span className="text-xs">v{agent.active_version.version}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}


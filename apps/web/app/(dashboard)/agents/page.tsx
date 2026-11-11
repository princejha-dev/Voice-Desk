"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentCard } from "@/components/agents/agent-card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, LayoutGrid, List } from "lucide-react";
import type { Agent } from "@/lib/types";

// Demo data
const demoAgents: Agent[] = [
  {
    id: "agent-1",
    tenant_id: "org-1",
    name: "Sarah — Customer Support",
    description: "Handles customer inquiries using the company knowledge base. Escalates complex issues.",
    template: "customer_support",
    status: "published",
    active_version_id: "v-1",
    settings: {},
    created_at: "2026-10-15T10:00:00Z",
    updated_at: "2026-11-10T14:30:00Z",
    call_count: 842,
    active_version: {
      id: "v-1",
      tenant_id: "org-1",
      agent_id: "agent-1",
      version: 3,
      config: {} as any,
      published_at: "2026-11-10T14:30:00Z",
      created_by: null,
      created_at: "2026-11-10T14:30:00Z",
    },
  },
  {
    id: "agent-2",
    tenant_id: "org-1",
    name: "Alex — Appointment Booking",
    description: "Schedules and manages appointments. Checks availability and sends confirmations.",
    template: "appointment_booking",
    status: "published",
    active_version_id: "v-2",
    settings: {},
    created_at: "2026-10-20T08:00:00Z",
    updated_at: "2026-11-08T09:15:00Z",
    call_count: 312,
    active_version: {
      id: "v-2",
      tenant_id: "org-1",
      agent_id: "agent-2",
      version: 2,
      config: {} as any,
      published_at: "2026-11-08T09:15:00Z",
      created_by: null,
      created_at: "2026-11-08T09:15:00Z",
    },
  },
  {
    id: "agent-3",
    tenant_id: "org-1",
    name: "Maya — Sales Assistant",
    description: "Qualifies leads and captures contact information from inbound calls.",
    template: "sales_assistant",
    status: "draft",
    active_version_id: null,
    settings: {},
    created_at: "2026-11-05T11:00:00Z",
    updated_at: "2026-11-05T11:00:00Z",
    call_count: 0,
  },
];

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = demoAgents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage your voice AI agents
          </p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      {/* Search & filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-3.5 w-3.5" />
          Filter
        </Button>
        <div className="flex rounded-lg border p-0.5 ml-auto">
          <button
            onClick={() => setView("grid")}
            className={`rounded-md p-1.5 transition-colors ${
              view === "grid" ? "bg-muted" : "hover:bg-muted/50"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-md p-1.5 transition-colors ${
              view === "list" ? "bg-muted" : "hover:bg-muted/50"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No agents found</p>
          <Link href="/dashboard/agents/new">
            <Button variant="outline" className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Create your first agent
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}


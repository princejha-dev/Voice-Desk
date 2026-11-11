"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentCard } from "@/components/agents/agent-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Filter, LayoutGrid, List, Bot } from "lucide-react";
import { useAgents } from "@/hooks/use-api";
import type { Agent } from "@/lib/types";

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const { agents: rawAgents, loading, error, refetch } = useAgents();

  // Map API data to Agent type
  const agents: Agent[] = rawAgents.map((a) => ({
    id: a.id as string,
    tenant_id: a.tenant_id as string,
    name: a.name as string,
    description: (a.description as string) ?? "",
    template: (a.template as string) ?? "custom",
    status: (a.status as "draft" | "published" | "archived") ?? "draft",
    active_version_id: (a.active_version_id as string) ?? null,
    settings: (a.settings as Record<string, unknown>) ?? {},
    created_at: a.created_at as string,
    updated_at: a.updated_at as string,
    call_count: (a.call_count as number) ?? 0,
    slug: a.slug as string | undefined,
    avatar_url: a.avatar_url as string | undefined,
  }));

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.description ?? "").toLowerCase().includes(search.toLowerCase())
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
        <Link href="/agents/new">
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

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refetch}>
            Retry
          </Button>
        </div>
      )}

      {/* Agent grid */}
      {!loading && !error && (
        <div className={
          view === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "flex flex-col gap-3"
        }>
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 mx-auto mb-4">
            <Bot className="h-8 w-8 text-indigo-500" />
          </div>
          {search ? (
            <p className="text-muted-foreground">No agents match &ldquo;{search}&rdquo;</p>
          ) : (
            <>
              <p className="font-medium mb-1">No agents yet</p>
              <p className="text-muted-foreground text-sm mb-4">
                Create your first voice AI agent to get started
              </p>
              <Link href="/agents/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create your first agent
                </Button>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

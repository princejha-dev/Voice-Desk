"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Calendar, Ticket, Phone, Globe, Database,
  Wrench, ChevronRight, ExternalLink, Plug, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const tools = [
  {
    id: "knowledge_search",
    name: "Knowledge Search",
    description: "Semantic search through your uploaded documents using pgvector. Agents retrieve relevant chunks to answer questions accurately.",
    icon: BookOpen,
    color: "bg-indigo-50 text-indigo-600",
    enabled: true,
    category: "Knowledge",
    status: "active",
  },
  {
    id: "book_appointment",
    name: "Appointment Booking",
    description: "Let callers check availability and book, reschedule, or cancel appointments directly through voice.",
    icon: Calendar,
    color: "bg-violet-50 text-violet-600",
    enabled: false,
    category: "Scheduling",
    status: "available",
  },
  {
    id: "create_ticket",
    name: "Support Ticket",
    description: "Automatically create support tickets from voice conversations. Captures caller details, issue summary, and priority.",
    icon: Ticket,
    color: "bg-amber-50 text-amber-600",
    enabled: true,
    category: "Support",
    status: "active",
  },
  {
    id: "request_callback",
    name: "Human Callback",
    description: "When the agent can't resolve an issue, it offers to arrange a human callback with caller contact details.",
    icon: Phone,
    color: "bg-emerald-50 text-emerald-600",
    enabled: true,
    category: "Escalation",
    status: "active",
  },
  {
    id: "web_search",
    name: "Web Search",
    description: "Allow agents to search the web for up-to-date information beyond the knowledge base. Requires API key.",
    icon: Globe,
    color: "bg-blue-50 text-blue-600",
    enabled: false,
    category: "Research",
    status: "needs_config",
  },
  {
    id: "crm_lookup",
    name: "CRM Lookup",
    description: "Look up customer records in your CRM during calls. Currently supports HubSpot and Salesforce.",
    icon: Database,
    color: "bg-rose-50 text-rose-600",
    enabled: false,
    category: "CRM",
    status: "coming_soon",
  },
];

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "info" }> = {
  active: { label: "Active", variant: "success" },
  available: { label: "Available", variant: "secondary" },
  needs_config: { label: "Needs Config", variant: "warning" },
  coming_soon: { label: "Coming Soon", variant: "info" },
};

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tools & Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Extend your agents with tools they can invoke during conversations
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <Plug className="h-5 w-5 text-indigo-500" />
          <div>
            <p className="text-2xl font-bold">3</p>
            <p className="text-xs text-muted-foreground">Active tools</p>
          </div>
        </div>
        <Separator orientation="vertical" className="h-10" />
        <div>
          <p className="text-2xl font-bold">6</p>
          <p className="text-xs text-muted-foreground">Available</p>
        </div>
        <Separator orientation="vertical" className="h-10" />
        <div>
          <p className="text-2xl font-bold">1,284</p>
          <p className="text-xs text-muted-foreground">Tool calls this month</p>
        </div>
      </div>

      {/* Tool cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map((tool) => {
          const s = statusConfig[tool.status];
          const disabled = tool.status === "coming_soon";
          return (
            <Card key={tool.id} className={cn("transition-all", disabled && "opacity-60")}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl shrink-0", tool.color)}>
                    <tool.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{tool.name}</h3>
                        <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>
                      </div>
                      {!disabled && (
                        <Switch
                          checked={tool.enabled}
                          onCheckedChange={(checked) =>
                            toast.info(`${checked ? "Enabled" : "Disabled"} ${tool.name}`)
                          }
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <Badge variant="secondary" className="text-[10px]">{tool.category}</Badge>
                      {tool.status === "needs_config" && (
                        <button
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          onClick={() => toast.info("Configure API key in Workspace Settings")}
                        >
                          Configure <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom integrations */}
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mx-auto mb-3">
            <Wrench className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Build a Custom Tool</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Integrate your own APIs and databases. Custom tools can call any HTTP endpoint and return structured data.
          </p>
          <Button variant="outline" className="gap-2" onClick={() => toast.info("Custom tool builder — coming soon")}>
            <ExternalLink className="h-4 w-4" />
            View Documentation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


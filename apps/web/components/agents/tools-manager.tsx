"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wrench,
  Code2,
  Plus,
  Trash2,
  Calendar,
  Ticket,
  Phone,
  BookOpen,
  Globe,
  Clock,
  Sparkles,
  Check,
  AlertCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export interface BookingToolConfig {
  working_days: string[];
  start_time: string;
  end_time: string;
  timezone: string;
  slot_duration_minutes: number;
  services: string[];
}

export interface TicketToolConfig {
  departments: string[];
  default_priority: string;
}

export interface CallbackToolConfig {
  sla_hours: number;
  require_reason: boolean;
}

export interface RagToolConfig {
  max_chunks: number;
  match_threshold: number;
}

export interface CustomWebhookTool {
  id: string;
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers?: Record<string, string>;
}

export interface ToolsState {
  enabled_tools: string[];
  booking: BookingToolConfig;
  ticket: TicketToolConfig;
  callback: CallbackToolConfig;
  rag: RagToolConfig;
  custom_tools: CustomWebhookTool[];
}

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const DEFAULT_TOOLS_STATE: ToolsState = {
  enabled_tools: ["knowledge_search", "request_callback"],
  booking: {
    working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    start_time: "09:00",
    end_time: "17:00",
    timezone: "UTC",
    slot_duration_minutes: 30,
    services: ["General Consultation", "Product Demo"],
  },
  ticket: {
    departments: ["Technical Support", "Billing", "General Inquiries"],
    default_priority: "medium",
  },
  callback: {
    sla_hours: 4,
    require_reason: true,
  },
  rag: {
    max_chunks: 3,
    match_threshold: 0.5,
  },
  custom_tools: [],
};

interface ToolsManagerProps {
  state: ToolsState;
  onChange: (newState: ToolsState) => void;
  assignedDocCount?: number;
}

export function ToolsManager({ state, onChange, assignedDocCount = 0 }: ToolsManagerProps) {
  const [mode, setMode] = useState<"visual" | "json">("visual");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync state to JSON text whenever switching to JSON mode or when state changes
  useEffect(() => {
    const exported = {
      enabled_tools: state.enabled_tools,
      tools_config: {
        book_appointment: {
          enabled: state.enabled_tools.includes("book_appointment"),
          ...state.booking,
        },
        create_ticket: {
          enabled: state.enabled_tools.includes("create_ticket"),
          ...state.ticket,
        },
        request_callback: {
          enabled: state.enabled_tools.includes("request_callback"),
          ...state.callback,
        },
        knowledge_search: {
          enabled: state.enabled_tools.includes("knowledge_search"),
          ...state.rag,
        },
      },
      custom_tools: state.custom_tools,
    };
    setJsonText(JSON.stringify(exported, null, 2));
    setJsonError(null);
  }, [state, mode]);

  function handleJsonChange(raw: string) {
    setJsonText(raw);
    try {
      const parsed = JSON.parse(raw);
      setJsonError(null);

      // Reconstruct ToolsState from parsed JSON
      const enabled: string[] = Array.isArray(parsed.enabled_tools)
        ? parsed.enabled_tools
        : Array.isArray(parsed.tools)
        ? parsed.tools
        : [];

      const tc = parsed.tools_config || {};
      const b = tc.book_appointment || {};
      const t = tc.create_ticket || {};
      const c = tc.request_callback || {};
      const r = tc.knowledge_search || {};

      onChange({
        enabled_tools: enabled,
        booking: {
          working_days: Array.isArray(b.working_days) ? b.working_days : state.booking.working_days,
          start_time: b.start_time || state.booking.start_time,
          end_time: b.end_time || state.booking.end_time,
          timezone: b.timezone || state.booking.timezone,
          slot_duration_minutes: Number(b.slot_duration_minutes) || state.booking.slot_duration_minutes,
          services: Array.isArray(b.services) ? b.services : state.booking.services,
        },
        ticket: {
          departments: Array.isArray(t.departments) ? t.departments : state.ticket.departments,
          default_priority: t.default_priority || state.ticket.default_priority,
        },
        callback: {
          sla_hours: Number(c.sla_hours) || state.callback.sla_hours,
          require_reason: typeof c.require_reason === "boolean" ? c.require_reason : state.callback.require_reason,
        },
        rag: {
          max_chunks: Number(r.max_chunks) || state.rag.max_chunks,
          match_threshold: Number(r.match_threshold) || state.rag.match_threshold,
        },
        custom_tools: Array.isArray(parsed.custom_tools) ? parsed.custom_tools : state.custom_tools,
      });
    } catch (e: any) {
      setJsonError(e.message || "Invalid JSON syntax");
    }
  }

  function toggleTool(toolKey: string) {
    const isEnabled = state.enabled_tools.includes(toolKey);
    const updated = isEnabled
      ? state.enabled_tools.filter((k) => k !== toolKey)
      : [...state.enabled_tools, toolKey];
    onChange({ ...state, enabled_tools: updated });
  }

  function toggleWorkingDay(day: string) {
    const days = state.booking.working_days;
    const updated = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    onChange({
      ...state,
      booking: { ...state.booking, working_days: updated },
    });
  }

  function addCustomTool() {
    const newTool: CustomWebhookTool = {
      id: "tool_" + Math.random().toString(36).slice(2, 8),
      name: `custom_api_${state.custom_tools.length + 1}`,
      description: "Call custom API to fetch or update external records",
      method: "GET",
      url: "https://api.example.com/v1/resource/{id}",
      headers: { Authorization: "Bearer YOUR_TOKEN" },
    };
    onChange({
      ...state,
      custom_tools: [...state.custom_tools, newTool],
    });
    toast.success("Added new custom API webhook tool");
  }

  function updateCustomTool(index: number, patch: Partial<CustomWebhookTool>) {
    const updated = [...state.custom_tools];
    updated[index] = { ...updated[index], ...patch };
    onChange({ ...state, custom_tools: updated });
  }

  function removeCustomTool(index: number) {
    const updated = state.custom_tools.filter((_, i) => i !== index);
    onChange({ ...state, custom_tools: updated });
    toast.info("Removed custom tool");
  }

  const isBookingEnabled = state.enabled_tools.includes("book_appointment");
  const isTicketEnabled = state.enabled_tools.includes("create_ticket");
  const isCallbackEnabled = state.enabled_tools.includes("request_callback");
  const isRagEnabled = state.enabled_tools.includes("knowledge_search");

  return (
    <div className="space-y-6">
      {/* Mode Switcher Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Wrench className="h-5 w-5 text-indigo-500" />
            Agent Tools & Actions
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure built-in tools and custom webhooks for this agent. Fully isolated per agent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-2.5 py-1 text-xs">
            {state.enabled_tools.length + state.custom_tools.length} Tools Active
          </Badge>
          <div className="flex items-center rounded-lg border p-1 bg-muted/40">
            <Button
              variant={mode === "visual" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("visual")}
              className="gap-1.5 h-8 text-xs font-medium"
            >
              <Wrench className="h-3.5 w-3.5" />
              Visual Builder
            </Button>
            <Button
              variant={mode === "json" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("json")}
              className="gap-1.5 h-8 text-xs font-medium"
            >
              <Code2 className="h-3.5 w-3.5" />
              JSON Schema
            </Button>
          </div>
        </div>
      </div>

      {/* ── JSON SCHEMA MODE ───────────────────────────────────────────────────── */}
      {mode === "json" ? (
        <Card className="border-indigo-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium">config.tools_schema.json</span>
              {jsonError ? (
                <Badge variant="destructive" className="gap-1 text-[11px] py-0.5">
                  <AlertCircle className="h-3 w-3" />
                  Syntax Error
                </Badge>
              ) : (
                <Badge variant="success" className="gap-1 text-[11px] py-0.5">
                  <Check className="h-3 w-3" />
                  Valid Schema
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(jsonText);
                  toast.success("Copied JSON schema to clipboard");
                }}
              >
                <Copy className="h-3 w-3" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  try {
                    setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
                    setJsonError(null);
                    toast.success("Formatted JSON");
                  } catch (e: any) {
                    setJsonError(e.message);
                  }
                }}
              >
                Format
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <Textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              rows={24}
              className="font-mono text-xs leading-relaxed bg-zinc-950 text-zinc-100 border-zinc-800 focus-visible:ring-indigo-500 selection:bg-indigo-900"
              spellCheck={false}
            />
            {jsonError && (
              <p className="text-xs text-red-500 mt-2 font-mono flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {jsonError}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Direct edits in JSON automatically synchronize with the Visual Builder controls and runtime boundaries.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* ── VISUAL BUILDER MODE ──────────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Section 1: Pre-built Voice Tools */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Native Voice Tools
            </h3>

            {/* 1. Appointment Booking */}
            <Card className={`transition-all ${isBookingEnabled ? "border-indigo-500/50 shadow-sm" : "opacity-85"}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isBookingEnabled ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Appointment Booking
                      <Badge variant="outline" className="font-mono text-[10px]">book_appointment</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Enables the agent to check business hours, detect slot conflicts, and save bookings.
                    </CardDescription>
                  </div>
                </div>
                <Switch checked={isBookingEnabled} onCheckedChange={() => toggleTool("book_appointment")} />
              </CardHeader>

              {isBookingEnabled && (
                <CardContent className="pt-0 border-t space-y-4 mt-3 bg-muted/10 p-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Working Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_DAYS.map((day) => {
                        const selected = state.booking.working_days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleWorkingDay(day)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              selected
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                : "bg-background border-border text-muted-foreground hover:border-foreground/30"
                            }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Operating Hours (Start)</Label>
                      <Input
                        type="time"
                        value={state.booking.start_time}
                        onChange={(e) =>
                          onChange({
                            ...state,
                            booking: { ...state.booking, start_time: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Operating Hours (End)</Label>
                      <Input
                        type="time"
                        value={state.booking.end_time}
                        onChange={(e) =>
                          onChange({
                            ...state,
                            booking: { ...state.booking, end_time: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Timezone</Label>
                      <Select
                        value={state.booking.timezone}
                        onValueChange={(tz) =>
                          onChange({
                            ...state,
                            booking: { ...state.booking, timezone: tz },
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time (US)</SelectItem>
                          <SelectItem value="America/Chicago">Central Time (US)</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time (US)</SelectItem>
                          <SelectItem value="Europe/London">London (GMT)</SelectItem>
                          <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Japan (JST)</SelectItem>
                          <SelectItem value="Australia/Sydney">Sydney (AEST)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Slot Duration</Label>
                      <Select
                        value={String(state.booking.slot_duration_minutes)}
                        onValueChange={(val) =>
                          onChange({
                            ...state,
                            booking: { ...state.booking, slot_duration_minutes: Number(val) },
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 Minutes</SelectItem>
                          <SelectItem value="30">30 Minutes</SelectItem>
                          <SelectItem value="45">45 Minutes</SelectItem>
                          <SelectItem value="60">60 Minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Available Services (Comma-separated)</Label>
                      <Input
                        value={state.booking.services.join(", ")}
                        onChange={(e) =>
                          onChange({
                            ...state,
                            booking: {
                              ...state.booking,
                              services: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                            },
                          })
                        }
                        placeholder="General Consultation, Follow-up"
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 2. Knowledge Search / RAG */}
            <Card className={`transition-all ${isRagEnabled ? "border-indigo-500/50 shadow-sm" : "opacity-85"}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isRagEnabled ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Knowledge Search (RAG)
                      <Badge variant="outline" className="font-mono text-[10px]">knowledge_search</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Retrieves exact factual answers from authorized pgvector embeddings during calls.
                    </CardDescription>
                  </div>
                </div>
                <Switch checked={isRagEnabled} onCheckedChange={() => toggleTool("knowledge_search")} />
              </CardHeader>

              {isRagEnabled && (
                <CardContent className="pt-0 border-t space-y-4 mt-3 bg-muted/10 p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Similarity Match Threshold ({state.rag.match_threshold})</Label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="0.9"
                        value={state.rag.match_threshold}
                        onChange={(e) =>
                          onChange({
                            ...state,
                            rag: { ...state.rag, match_threshold: parseFloat(e.target.value) || 0.5 },
                          })
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">Higher = stricter relevance, Lower = broader recall.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Max Context Chunks Retrieved</Label>
                      <Select
                        value={String(state.rag.max_chunks)}
                        onValueChange={(val) =>
                          onChange({
                            ...state,
                            rag: { ...state.rag, max_chunks: Number(val) },
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Chunk (Fastest)</SelectItem>
                          <SelectItem value="2">2 Chunks</SelectItem>
                          <SelectItem value="3">3 Chunks (Recommended)</SelectItem>
                          <SelectItem value="5">5 Chunks (Comprehensive)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">Controls how much context is fed to the LLM per query.</p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-3 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Scoped Document Scope:</span>
                    <Badge variant="secondary">{assignedDocCount} Documents Authorized</Badge>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 3. Support Tickets */}
            <Card className={`transition-all ${isTicketEnabled ? "border-indigo-500/50 shadow-sm" : "opacity-85"}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isTicketEnabled ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Support Tickets
                      <Badge variant="outline" className="font-mono text-[10px]">create_ticket</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Logs customer issues directly into the support tickets table for human follow-up.
                    </CardDescription>
                  </div>
                </div>
                <Switch checked={isTicketEnabled} onCheckedChange={() => toggleTool("create_ticket")} />
              </CardHeader>

              {isTicketEnabled && (
                <CardContent className="pt-0 border-t space-y-4 mt-3 bg-muted/10 p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Available Departments (Comma-separated)</Label>
                      <Input
                        value={state.ticket.departments.join(", ")}
                        onChange={(e) =>
                          onChange({
                            ...state,
                            ticket: {
                              ...state.ticket,
                              departments: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Default Priority</Label>
                      <Select
                        value={state.ticket.default_priority}
                        onValueChange={(val) =>
                          onChange({
                            ...state,
                            ticket: { ...state.ticket, default_priority: val },
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 4. Human Callback */}
            <Card className={`transition-all ${isCallbackEnabled ? "border-indigo-500/50 shadow-sm" : "opacity-85"}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isCallbackEnabled ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Request Human Callback
                      <Badge variant="outline" className="font-mono text-[10px]">request_callback</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Captures customer phone number and callback notes when escalation is required.
                    </CardDescription>
                  </div>
                </div>
                <Switch checked={isCallbackEnabled} onCheckedChange={() => toggleTool("request_callback")} />
              </CardHeader>

              {isCallbackEnabled && (
                <CardContent className="pt-0 border-t space-y-4 mt-3 bg-muted/10 p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Callback SLA Guarantee (Hours)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="72"
                        value={state.callback.sla_hours}
                        onChange={(e) =>
                          onChange({
                            ...state,
                            callback: { ...state.callback, sla_hours: parseInt(e.target.value) || 4 },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                      <div>
                        <Label className="text-xs font-semibold">Require Callback Reason</Label>
                        <p className="text-[11px] text-muted-foreground">Agent must prompt for caller issue details.</p>
                      </div>
                      <Switch
                        checked={state.callback.require_reason}
                        onCheckedChange={(c) =>
                          onChange({
                            ...state,
                            callback: { ...state.callback, require_reason: c },
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Section 2: Custom API Webhooks */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Custom API Webhooks
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define custom HTTP endpoints that your agent can trigger during real-time voice calls.
                </p>
              </div>
              <Button size="sm" onClick={addCustomTool} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4" />
                Add Custom Webhook
              </Button>
            </div>

            {state.custom_tools.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center bg-muted/10">
                <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No custom webhooks configured</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Add custom webhooks to let this agent query customer CRM records, check inventory, process payments, or trigger external workflows.
                </p>
              </div>
            ) : (
              state.custom_tools.map((ct, idx) => (
                <Card key={ct.id || idx} className="border-indigo-500/30 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs uppercase bg-background">
                        {ct.method}
                      </Badge>
                      <span className="font-mono text-sm font-bold">{ct.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomTool(idx)}
                      className="text-muted-foreground hover:text-red-500 h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Function Name</Label>
                        <Input
                          value={ct.name}
                          onChange={(e) => updateCustomTool(idx, { name: e.target.value.replace(/\s+/g, "_") })}
                          className="font-mono text-xs"
                          placeholder="lookup_order"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">HTTP Method</Label>
                        <Select
                          value={ct.method}
                          onValueChange={(m: any) => updateCustomTool(idx, { method: m })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-1">
                        <Label className="text-xs font-semibold">Endpoint URL</Label>
                        <Input
                          value={ct.url}
                          onChange={(e) => updateCustomTool(idx, { url: e.target.value })}
                          className="font-mono text-xs"
                          placeholder="https://api.domain.com/v1/{id}"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Tool Description (Instructions for LLM)</Label>
                      <Textarea
                        value={ct.description}
                        onChange={(e) => updateCustomTool(idx, { description: e.target.value })}
                        rows={2}
                        className="text-xs"
                        placeholder="Explain to the voice model when and how to call this tool..."
                      />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Key, Copy, Eye, EyeOff, Plus, Trash2, Webhook,
  RefreshCw, Terminal, CheckCircle2, Circle, Code,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const demoApiKeys = [
  { id: "k1", name: "Production Key", key: "vd_live_sk_••••••••••••••••••••••••••••••••••••••••••", created: "Nov 1, 2026", lastUsed: "2 min ago", scopes: ["read", "write"] },
  { id: "k2", name: "Dashboard Dev", key: "vd_live_sk_••••••••••••••••••••••••••••••••••••••••••", created: "Oct 15, 2026", lastUsed: "3 days ago", scopes: ["read"] },
];

const demoWebhooks = [
  { id: "w1", url: "https://your-app.com/webhooks/voicedesk", events: ["session.completed", "session.failed"], status: "active", lastDelivery: "2 min ago" },
];

const webhookEvents = [
  "session.started", "session.completed", "session.failed",
  "tool.called", "tool.failed", "agent.published",
  "knowledge.processed", "eval.completed",
];

const codeExample = `curl -X POST https://api.voicedesk.app/v1/sessions \\
  -H "Authorization: Bearer vd_live_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "agent_123",
    "caller_identity": "anonymous"
  }'`;

export default function ApiPage() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API & Webhooks</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Programmatic access to your agents and session data
        </p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys" className="gap-1.5">
            <Key className="h-3.5 w-3.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5">
            <Webhook className="h-3.5 w-3.5" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5">
            <Code className="h-3.5 w-3.5" />
            Quick Start
          </TabsTrigger>
        </TabsList>

        {/* API Keys */}
        <TabsContent value="keys" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">API Keys</CardTitle>
                <CardDescription>Authenticate API requests with secret keys.</CardDescription>
              </div>
              <Button size="sm" className="gap-2" onClick={() => toast.info("Key creation coming soon")}>
                <Plus className="h-4 w-4" />
                Create Key
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {demoApiKeys.map((apiKey) => (
                <div key={apiKey.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{apiKey.name}</p>
                      <p className="text-xs text-muted-foreground">Created {apiKey.created} · Last used {apiKey.lastUsed}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {apiKey.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                      <button className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 font-mono">
                      {showKey[apiKey.id] ? "vd_live_sk_examplekey123456789..." : apiKey.key}
                    </code>
                    <button
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowKey((p) => ({ ...p, [apiKey.id]: !p[apiKey.id] }))}
                    >
                      {showKey[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { navigator.clipboard.writeText("vd_live_sk_examplekey123456789..."); toast.success("Copied!"); }}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks */}
        <TabsContent value="webhooks" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Webhooks</CardTitle>
                <CardDescription>Receive real-time event notifications in your app.</CardDescription>
              </div>
              <Button size="sm" className="gap-2" onClick={() => toast.info("Webhook creation coming soon")}>
                <Plus className="h-4 w-4" />
                Add Endpoint
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {demoWebhooks.map((wh) => (
                <div key={wh.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <code className="text-sm font-mono">{wh.url}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">active</Badge>
                      <button className="text-muted-foreground hover:text-foreground">
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {wh.events.map((e) => (
                      <Badge key={e} variant="secondary" className="text-[10px] font-mono">{e}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Last delivery: {wh.lastDelivery}</p>
                </div>
              ))}

              <div>
                <p className="text-sm font-medium mb-2">Available Events</p>
                <div className="flex flex-wrap gap-1.5">
                  {webhookEvents.map((e) => (
                    <code key={e} className="text-[11px] rounded-md bg-muted px-2 py-0.5 font-mono">{e}</code>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Start */}
        <TabsContent value="docs" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4 text-indigo-500" />
                Quick Start
              </CardTitle>
              <CardDescription>Start a session programmatically via the REST API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-gray-950 p-4">
                <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                  {codeExample}
                </pre>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Base URL</p>
                <code className="block text-sm bg-muted rounded-lg px-3 py-2 font-mono">
                  https://api.voicedesk.app/v1
                </code>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Include your API key as a Bearer token in the{" "}
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Authorization</code> header
                  of every request.
                </p>
              </div>
              <Button variant="outline" className="gap-2 w-full" onClick={() => toast.info("Full docs coming soon")}>
                <Code className="h-4 w-4" />
                View Full API Reference
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


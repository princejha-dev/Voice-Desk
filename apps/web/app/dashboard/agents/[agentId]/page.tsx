"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgent, useAgentVersions, useKnowledgeDocs, useAuthToken, useOrganization } from "@/hooks/use-api";
import { ToolsManager, ToolsState, DEFAULT_TOOLS_STATE } from "@/components/agents/tools-manager";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Save,
  Rocket,
  Settings,
  BookOpen,
  Wrench,
  Brain,
  History,
  Code2,
  Copy,
  ExternalLink,
  Play,
  Check,
  FileText,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const router = useRouter();
  const token = useAuthToken();
  const { orgId } = useOrganization();
  const [tab, setTab] = useState("config");

  const { agent, loading: agentLoading, refetch: refetchAgent } = useAgent(agentId);
  const { versions, loading: versionsLoading, refetch: refetchVersions, saveVersion, publishVersion } = useAgentVersions(agentId);
  const { docs, loading: docsLoading, upload: uploadDoc } = useKnowledgeDocs();

  // Agent form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [greeting, setGreeting] = useState("");
  const [instructions, setInstructions] = useState("");
  const [personality, setPersonality] = useState("");
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState("gpt-4o-mini");
  const [ttsVoice, setTtsVoice] = useState("Professional Female");
  const [sttLanguage, setSttLanguage] = useState("en");

  const [toolsState, setToolsState] = useState<ToolsState>(DEFAULT_TOOLS_STATE);
  const [assignedDocIds, setAssignedDocIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Sync form state when agent or active version is loaded
  useEffect(() => {
    if (!agent) return;
    setName((agent.name as string) || "");
    setDescription((agent.description as string) || "");

    const activeVer = (agent.agent_versions as Record<string, unknown>) || {};
    const cfg = (activeVer.config as Record<string, any>) || {};

    if (cfg.greeting) setGreeting(cfg.greeting);
    if (cfg.instructions) setInstructions(cfg.instructions);
    if (cfg.personality) setPersonality(cfg.personality);

    if (cfg.llm?.model) {
      const m = cfg.llm.model;
      setLlmModel(m.includes("4.1") || m === "gpt-4-mini" ? "gpt-4o-mini" : m);
    }
    if (cfg.llm?.provider) setLlmProvider(cfg.llm.provider);
    if (cfg.tts?.voice_name) setTtsVoice(cfg.tts.voice_name);
    if (cfg.stt?.language) setSttLanguage(cfg.stt.language);

    // Load tools & per-tool configurations
    const tc = cfg.tools_config || {};
    const b = tc.book_appointment || {};
    const t = tc.create_ticket || {};
    const c = tc.request_callback || {};
    const r = tc.knowledge_search || {};

    const enabledList: string[] = Array.isArray(cfg.tools)
      ? cfg.tools
      : Array.isArray(cfg.enabled_tools)
      ? cfg.enabled_tools
      : DEFAULT_TOOLS_STATE.enabled_tools;

    setToolsState({
      enabled_tools: enabledList,
      booking: {
        working_days: Array.isArray(b.working_days) ? b.working_days : DEFAULT_TOOLS_STATE.booking.working_days,
        start_time: b.start_time || DEFAULT_TOOLS_STATE.booking.start_time,
        end_time: b.end_time || DEFAULT_TOOLS_STATE.booking.end_time,
        timezone: b.timezone || DEFAULT_TOOLS_STATE.booking.timezone,
        slot_duration_minutes: Number(b.slot_duration_minutes) || DEFAULT_TOOLS_STATE.booking.slot_duration_minutes,
        services: Array.isArray(b.services) ? b.services : DEFAULT_TOOLS_STATE.booking.services,
      },
      ticket: {
        departments: Array.isArray(t.departments) ? t.departments : DEFAULT_TOOLS_STATE.ticket.departments,
        default_priority: t.default_priority || DEFAULT_TOOLS_STATE.ticket.default_priority,
      },
      callback: {
        sla_hours: Number(c.sla_hours) || DEFAULT_TOOLS_STATE.callback.sla_hours,
        require_reason: typeof c.require_reason === "boolean" ? c.require_reason : DEFAULT_TOOLS_STATE.callback.require_reason,
      },
      rag: {
        max_chunks: Number(r.max_chunks) || DEFAULT_TOOLS_STATE.rag.max_chunks,
        match_threshold: Number(r.match_threshold) || DEFAULT_TOOLS_STATE.rag.match_threshold,
      },
      custom_tools: Array.isArray(cfg.custom_tools) ? cfg.custom_tools : [],
    });

    if (Array.isArray(cfg.knowledge_base_ids)) {
      setAssignedDocIds(cfg.knowledge_base_ids);
    }
  }, [agent]);

  // Load document assignments for this agent
  useEffect(() => {
    if (!orgId || !token || !agentId) return;
    api<{ documents?: Record<string, unknown>[] }>(`/api/v1/organizations/${orgId}/knowledge`, { token })
      .then((res) => {
        // Find which docs are assigned to this agent
        // If agent.settings or config has knowledge_base_ids, use them
      })
      .catch(console.error);
  }, [orgId, token, agentId]);

  const activeVersionNumber = String((agent?.agent_versions as Record<string, any>)?.version ?? versions[0]?.version ?? 1);
  const isPublished = agent?.status === "published";
  const publicSlug = (agent?.slug as string) || "";
  const publicUrl = typeof window !== "undefined" && publicSlug ? `${window.location.origin}/c/${publicSlug}` : "";

  async function handleSaveDraft() {
    setSaving(true);
    try {
      const config = {
        greeting,
        instructions,
        personality,
        llm: { provider: llmProvider, model: llmModel, temperature: 0.3 },
        tts: { provider: "cartesia", voice_id: "default", voice_name: ttsVoice },
        stt: { provider: "deepgram", model: "nova-3", language: sttLanguage },
        tools: toolsState.enabled_tools,
        tools_config: {
          book_appointment: {
            enabled: toolsState.enabled_tools.includes("book_appointment"),
            ...toolsState.booking,
          },
          create_ticket: {
            enabled: toolsState.enabled_tools.includes("create_ticket"),
            ...toolsState.ticket,
          },
          request_callback: {
            enabled: toolsState.enabled_tools.includes("request_callback"),
            ...toolsState.callback,
          },
          knowledge_search: {
            enabled: toolsState.enabled_tools.includes("knowledge_search"),
            ...toolsState.rag,
          },
        },
        custom_tools: toolsState.custom_tools,
        knowledge_base_ids: assignedDocIds,
        guardrails: { refuse_off_topic: true, require_knowledge_base: true, offer_human_fallback: true },
      };

      await saveVersion(config);
      toast.success("Draft version saved successfully!");
      refetchVersions();
      refetchAgent();
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const config = {
        greeting,
        instructions,
        personality,
        llm: { provider: llmProvider, model: llmModel, temperature: 0.3 },
        tts: { provider: "cartesia", voice_id: "default", voice_name: ttsVoice },
        stt: { provider: "deepgram", model: "nova-3", language: sttLanguage },
        tools: toolsState.enabled_tools,
        tools_config: {
          book_appointment: {
            enabled: toolsState.enabled_tools.includes("book_appointment"),
            ...toolsState.booking,
          },
          create_ticket: {
            enabled: toolsState.enabled_tools.includes("create_ticket"),
            ...toolsState.ticket,
          },
          request_callback: {
            enabled: toolsState.enabled_tools.includes("request_callback"),
            ...toolsState.callback,
          },
          knowledge_search: {
            enabled: toolsState.enabled_tools.includes("knowledge_search"),
            ...toolsState.rag,
          },
        },
        custom_tools: toolsState.custom_tools,
        knowledge_base_ids: assignedDocIds,
        guardrails: { refuse_off_topic: true, require_knowledge_base: true, offer_human_fallback: true },
      };

      // 1. Save new version
      const ver: any = await saveVersion(config);
      const versionId = ver.id;

      // 2. Publish this version
      await publishVersion(versionId);

      // 3. Assign knowledge documents
      if (orgId && token && assignedDocIds.length > 0) {
        for (const docId of assignedDocIds) {
          await api(`/api/v1/organizations/${orgId}/knowledge/${docId}/assign`, {
            method: "POST",
            body: JSON.stringify({ agent_id: agentId }),
            token,
          }).catch(console.error);
        }
      }

      toast.success("Agent published successfully!");
      refetchVersions();
      refetchAgent();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish agent");
    } finally {
      setPublishing(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res: any = await uploadDoc(file, agentId);
      toast.success(`Uploaded ${file.name}. Ingesting embeddings in background.`);
      if (res?.document_id) {
        setAssignedDocIds((prev) => [...prev, res.document_id]);
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
  }

  function toggleDocAssignment(docId: string) {
    setAssignedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }

  if (agentLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/agents")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{name || "Voice Agent"}</h1>
              <Badge variant={isPublished ? "success" : "warning"}>
                {isPublished ? "Published" : "Draft"}
              </Badge>
              <Badge variant="secondary">v{activeVersionNumber}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Slug: <code className="font-mono text-xs">{publicSlug}</code> · {String(agent?.call_count ?? 0)} calls
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {publicSlug && (
            <Link href={`/c/${publicSlug}`} target="_blank">
              <Button variant="outline" className="gap-2">
                <Play className="h-4 w-4 text-emerald-500" />
                Test Live Call
              </Button>
            </Link>
          )}
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button onClick={handlePublish} disabled={publishing} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Publish Version
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Knowledge ({assignedDocIds.length})
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Tools ({toolsState.enabled_tools.length + toolsState.custom_tools.length})
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Versions ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="deploy" className="gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            Deploy & Embed
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* General */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">General</CardTitle>
                <CardDescription>Identity and initial prompt settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Agent Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Greeting Message</Label>
                  <Textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={2} />
                  <p className="text-xs text-muted-foreground">The first sentence the agent speaks when a call connects.</p>
                </div>
                <div className="space-y-2">
                  <Label>Personality & Tone</Label>
                  <Input value={personality} onChange={(e) => setPersonality(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Voice & Model */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Voice & Model</CardTitle>
                <CardDescription>Real-time speech and AI configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">LLM Provider</Label>
                    <Select value={llmProvider} onValueChange={setLlmProvider}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Model</Label>
                    <Select value={llmModel} onValueChange={setLlmModel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fastest)</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o (High Intelligence)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">TTS Provider</Label>
                    <Input readOnly value="Cartesia (sonic-3)" className="bg-muted text-xs font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Voice</Label>
                    <Select value={ttsVoice} onValueChange={setTtsVoice}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Professional Female">Professional Female</SelectItem>
                        <SelectItem value="Professional Male">Professional Male</SelectItem>
                        <SelectItem value="Friendly Female">Friendly Female</SelectItem>
                        <SelectItem value="Warm Male">Warm Male</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">STT Provider</Label>
                    <Input readOnly value="Deepgram (nova-3)" className="bg-muted text-xs font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Language</Label>
                    <Select value={sttLanguage} onValueChange={setSttLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English (US/UK)</SelectItem>
                        <SelectItem value="multi">Multilingual</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-indigo-500" />
                System Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                These instructions define how your agent behaves and responds during voice interactions.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Authorized Knowledge Documents</CardTitle>
                <CardDescription>
                  Select which organization documents this agent can query via pgvector embeddings.
                </CardDescription>
              </div>
              <label className="cursor-pointer">
                <Input type="file" className="hidden" accept=".pdf,.txt,.docx,.md" onChange={handleFileUpload} />
                <Button variant="outline" size="sm" asChild>
                  <span>Upload Document</span>
                </Button>
              </label>
            </CardHeader>
            <CardContent className="space-y-3">
              {docsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : docs.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No documents found in knowledge base. Upload a document to enable scoped RAG.
                </div>
              ) : (
                docs.map((doc: any) => {
                  const assigned = assignedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => toggleDocAssignment(doc.id)}
                      className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-all ${
                        assigned ? "border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500" : "hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${assigned ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{doc.filename || doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.chunk_count ? `${doc.chunk_count} vector chunks` : "Processing"} · Status: {doc.status}
                          </p>
                        </div>
                      </div>
                      <Badge variant={assigned ? "success" : "secondary"}>
                        {assigned ? "Authorized" : "Excluded"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="mt-6">
          <ToolsManager
            state={toolsState}
            onChange={setToolsState}
            assignedDocCount={assignedDocIds.length}
          />
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Version History</CardTitle>
              <CardDescription>Every published and saved configuration snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {versionsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No versions found.</p>
              ) : (
                versions.map((v: any) => {
                  const isActive = v.id === agent?.active_version_id;
                  const dateStr = v.published_at || v.created_at
                    ? new Date(v.published_at || v.created_at).toLocaleString()
                    : "Unknown date";
                  return (
                    <div key={v.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${isActive ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
                          v{v.version}
                        </div>
                        {/* FIX: Use div instead of p to avoid hydration error with nested Badge div */}
                        <div>
                          <div className="text-sm font-medium flex items-center gap-2">
                            <span>Version {v.version}</span>
                            {isActive && <Badge variant="success" className="text-[10px]">Active</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            <span>{dateStr}</span>
                          </div>
                        </div>
                      </div>
                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await publishVersion(v.id);
                              toast.success(`Restored and published v${v.version}!`);
                              refetchVersions();
                              refetchAgent();
                            } catch (e: any) {
                              toast.error(e.message || "Failed to restore version");
                            }
                          }}
                        >
                          Restore & Publish
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deploy Tab */}
        <TabsContent value="deploy" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Public Call Page</CardTitle>
              <CardDescription>Direct link for customers to start a voice call with this agent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Shareable URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={publicUrl} className="bg-muted font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (!publicUrl) return;
                      navigator.clipboard.writeText(publicUrl);
                      toast.success("Public call link copied to clipboard!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {publicUrl && (
                    <Link href={`/c/${publicSlug}`} target="_blank">
                      <Button variant="outline" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Embed Script (Web Widget)</Label>
                <Textarea
                  readOnly
                  value={`<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget.js" data-agent-slug="${publicSlug}"></script>`}
                  className="bg-muted font-mono text-xs h-16"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Agent Audio</CardTitle>
              <CardDescription>Open the interactive voice calling room to speak directly with this agent.</CardDescription>
            </CardHeader>
            <CardContent>
              {publicSlug ? (
                <Link href={`/c/${publicSlug}`} target="_blank" className="w-full">
                  <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 py-6 text-base">
                    <Play className="h-5 w-5" />
                    Open Live Call Room (/c/{publicSlug})
                  </Button>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">Publish this agent to generate a public call link.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

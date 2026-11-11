"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { UploadZone } from "@/components/knowledge/upload-zone";
import { VoiceCallButton } from "@/components/call/voice-widget";
import {
  ArrowLeft,
  Save,
  Rocket,
  Settings,
  BookOpen,
  Wrench,
  Mic,
  Brain,
  History,
  Code2,
  Copy,
  ExternalLink,
  Sparkles,
  Play,
} from "lucide-react";
import { toast } from "sonner";

export default function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const router = useRouter();
  const [tab, setTab] = useState("config");

  // Demo state
  const [name, setName] = useState("Sarah — Customer Support");
  const [greeting, setGreeting] = useState("Hello! Thank you for calling. How can I help you today?");
  const [instructions, setInstructions] = useState(
    "You are a helpful customer support assistant for our company. Answer questions using only the provided knowledge base. If you don't know the answer, say so honestly and offer to connect the caller with a human."
  );
  const [personality, setPersonality] = useState("Professional, friendly, and patient");
  const [files, setFiles] = useState<any[]>([
    { id: "1", name: "Company FAQ.pdf", size: 245000, status: "ready" },
    { id: "2", name: "Return Policy.pdf", size: 89000, status: "ready" },
    { id: "3", name: "Product Catalog.pdf", size: 1520000, status: "ready" },
  ]);
  const [tools, setTools] = useState({
    knowledge_search: true,
    create_ticket: true,
    request_callback: true,
    book_appointment: false,
    web_search: false,
  });

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
              <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
              <Badge variant="success">Published</Badge>
              <Badge variant="secondary">v3</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Customer Support · 842 calls</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Play className="h-4 w-4" />
            Test Agent
          </Button>
          <Button variant="outline" className="gap-2">
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
          <Button className="gap-2">
            <Rocket className="h-4 w-4" />
            Publish
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
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Versions
          </TabsTrigger>
          <TabsTrigger value="deploy" className="gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            Deploy
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* General */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Agent Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Greeting</Label>
                  <Textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Personality</Label>
                  <Input value={personality} onChange={(e) => setPersonality(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Voice & Model */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Voice & Model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">LLM Provider</Label>
                    <Select defaultValue="openai">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Model</Label>
                    <Select defaultValue="gpt-4.1-mini">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                        <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">TTS Provider</Label>
                    <Select defaultValue="cartesia">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cartesia">Cartesia</SelectItem>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Voice</Label>
                    <Select defaultValue="professional-female">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional-female">Professional Female</SelectItem>
                        <SelectItem value="professional-male">Professional Male</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">STT Provider</Label>
                    <Select defaultValue="deepgram">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deepgram">Deepgram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="multi">Multilingual</SelectItem>
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
                These instructions define how your agent behaves. Be specific about what it should and shouldn&apos;t do.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Knowledge Base Documents</CardTitle>
              <CardDescription>
                Upload documents so your agent answers from your company&apos;s information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadZone
                files={files}
                onUpload={(newFiles) => {
                  const f = newFiles.map((fl) => ({
                    id: Math.random().toString(36).slice(2),
                    name: fl.name,
                    size: fl.size,
                    status: "processing" as const,
                  }));
                  setFiles((prev) => [...prev, ...f]);
                  setTimeout(() => {
                    setFiles((prev) => prev.map((x) => (f.find((y) => y.id === x.id) ? { ...x, status: "ready" } : x)));
                  }, 2000);
                }}
                onRemove={(id) => setFiles((p) => p.filter((f) => f.id !== id))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent Tools</CardTitle>
              <CardDescription>
                Enable capabilities your agent can use during conversations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "knowledge_search", label: "Knowledge Search", desc: "Search uploaded documents to answer questions", icon: "📚" },
                { key: "book_appointment", label: "Book Appointment", desc: "Schedule appointments and check availability", icon: "📅" },
                { key: "create_ticket", label: "Create Support Ticket", desc: "Log support issues for follow-up", icon: "🎫" },
                { key: "request_callback", label: "Request Human Callback", desc: "Offer human follow-up when agent can't help", icon: "📞" },
                { key: "web_search", label: "Web Search", desc: "Search the web for additional information", icon: "🌐" },
              ].map((tool) => (
                <div key={tool.key} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{tool.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{tool.label}</p>
                      <p className="text-xs text-muted-foreground">{tool.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={tools[tool.key as keyof typeof tools]}
                    onCheckedChange={(checked) => setTools({ ...tools, [tool.key]: checked })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Version History</CardTitle>
              <CardDescription>Each save creates an immutable version snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { version: 3, date: "Nov 10, 2026 · 2:30 PM", active: true, note: "Updated greeting and added ticket tool" },
                { version: 2, date: "Nov 5, 2026 · 9:15 AM", active: false, note: "Added return policy document" },
                { version: 1, date: "Oct 15, 2026 · 10:00 AM", active: false, note: "Initial configuration" },
              ].map((v) => (
                <div key={v.version} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-sm font-bold">
                      v{v.version}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Version {v.version}
                        {v.active && <Badge variant="success" className="ml-2 text-[10px]">Active</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">{v.date} — {v.note}</p>
                    </div>
                  </div>
                  {!v.active && (
                    <Button variant="outline" size="sm">Restore</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deploy Tab */}
        <TabsContent value="deploy" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deployment</CardTitle>
              <CardDescription>Share your agent with customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Shareable Link</Label>
                <div className="flex gap-2">
                  <Input readOnly value="https://voicedesk.app/c/your-company" className="bg-muted font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText("https://voicedesk.app/c/your-company"); toast.success("Copied!"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Embed Widget</Label>
                <Textarea readOnly value={`<script src="https://voicedesk.app/widget.js" data-agent="agent-1"></script>`} className="bg-muted font-mono text-xs h-16" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <VoiceCallButton agentName={name} onStart={() => toast.info("Connecting to test session...")} className="w-full" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


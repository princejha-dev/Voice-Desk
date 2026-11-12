"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthToken, useOrganization } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TemplatePicker } from "@/components/agents/template-picker";
import { UploadZone } from "@/components/knowledge/upload-zone";
import { VoiceCallButton } from "@/components/call/voice-widget";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Mic,
  Brain,
  BookOpen,
  Wrench,
  Rocket,
  Copy,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const steps = [
  { id: 1, label: "Template", icon: Sparkles },
  { id: 2, label: "Personality", icon: Mic },
  { id: 3, label: "Voice & Model", icon: Brain },
  { id: 4, label: "Knowledge & Tools", icon: BookOpen },
  { id: 5, label: "Test & Deploy", icon: Rocket },
];

const defaultConfig = {
  name: "",
  greeting: "",
  instructions: "",
  personality: "",
  llm_provider: "openai",
  llm_model: "gpt-4.1-mini",
  llm_temperature: 0.3,
  stt_provider: "deepgram",
  stt_model: "nova-3",
  stt_language: "en",
  tts_provider: "cartesia",
  tts_voice: "Professional Female",
  tools: {
    knowledge_search: true,
    book_appointment: false,
    create_ticket: false,
    request_callback: true,
    web_search: false,
  },
};

const templateDefaults: Record<string, Partial<typeof defaultConfig>> = {
  customer_support: {
    name: "Support Agent",
    greeting: "Hello! Thank you for calling. How can I help you today?",
    instructions:
      "You are a helpful customer support assistant. Answer questions using only the provided knowledge base. If you don't know the answer, say so honestly and offer to connect the caller with a human.",
    personality: "Professional, friendly, and patient",
    tools: { knowledge_search: true, create_ticket: true, request_callback: true, book_appointment: false, web_search: false },
  },
  appointment_booking: {
    name: "Booking Agent",
    greeting: "Hi there! I'd love to help you schedule an appointment. When works best for you?",
    instructions:
      "You are an appointment booking assistant. Help callers schedule, reschedule, or cancel appointments. Check availability before confirming.",
    personality: "Warm, organized, and efficient",
    tools: { knowledge_search: true, book_appointment: true, request_callback: true, create_ticket: false, web_search: false },
  },
  sales_assistant: {
    name: "Sales Agent",
    greeting: "Welcome! I'm here to help you find the perfect solution. What are you looking for?",
    instructions:
      "You are a sales assistant. Qualify leads, answer product questions, and capture contact information. Be helpful without being pushy.",
    personality: "Confident, knowledgeable, and consultative",
    tools: { knowledge_search: true, request_callback: true, book_appointment: true, create_ticket: false, web_search: true },
  },
  business_assistant: {
    name: "Business Assistant",
    greeting: "Thank you for calling! How may I direct your inquiry today?",
    instructions:
      "You are a general business assistant and receptionist. Provide business information, route calls, and help with general inquiries.",
    personality: "Professional, courteous, and well-informed",
    tools: { knowledge_search: true, request_callback: true, book_appointment: false, create_ticket: false, web_search: false },
  },
};

export default function CreateAgentPage() {
  const router = useRouter();
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<string | null>(null);
  const [config, setConfig] = useState(defaultConfig);
  const [files, setFiles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  function selectTemplate(id: string) {
    setTemplate(id);
    const defaults = templateDefaults[id];
    if (defaults) {
      setConfig((prev) => ({ ...prev, ...defaults }));
    }
  }

  function handleUpload(newFiles: File[]) {
    const uploaded = newFiles.map((f) => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      size: f.size,
      status: "processing" as const,
    }));
    setFiles((prev) => [...prev, ...uploaded]);
    // Simulate processing
    setTimeout(() => {
      setFiles((prev) =>
        prev.map((f) =>
          uploaded.find((u) => u.id === f.id) ? { ...f, status: "ready" } : f
        )
      );
    }, 2000);
  }

  async function handleCreate() {
    if (!orgId || !token) {
      toast.error("Please sign in and ensure an organization is active.");
      return;
    }
    setSaving(true);
    try {
      // 1. Create agent in draft
      const agentRes = await api<{ agent: { id: string; slug: string; name: string } }>(
        `/api/v1/organizations/${orgId}/agents`,
        {
          method: "POST",
          body: JSON.stringify({
            name: config.name,
            description: config.personality,
            template: template || "custom",
          }),
          token,
        }
      );
      const newAgent = agentRes.agent;

      // 2. Save configured version
      const versionRes = await api<{ id: string }>(
        `/api/v1/organizations/${orgId}/agents/${newAgent.id}/versions`,
        {
          method: "POST",
          body: JSON.stringify({
            config: {
              instructions: config.instructions,
              greeting: config.greeting,
              personality: config.personality,
              llm: {
                provider: config.llm_provider,
                model: config.llm_model,
                temperature: config.llm_temperature,
              },
              stt: {
                provider: config.stt_provider,
                model: config.stt_model,
                language: config.stt_language,
              },
              tts: {
                provider: config.tts_provider,
                voice_id: "default",
                voice_name: config.tts_voice,
              },
              tools: Object.entries(config.tools)
                .filter(([_, enabled]) => enabled)
                .map(([name]) => name),
              guardrails: {
                refuse_off_topic: true,
                require_knowledge_base: config.tools.knowledge_search,
                offer_human_fallback: config.tools.request_callback,
              },
            },
          }),
          token,
        }
      );

      // 3. Publish this version
      await api(
        `/api/v1/organizations/${orgId}/agents/${newAgent.id}/publish`,
        {
          method: "POST",
          body: JSON.stringify({ version_id: versionRes.id }),
          token,
        }
      );

      toast.success("Agent created and published successfully!");
      if (newAgent.slug) {
        router.push(`/c/${newAgent.slug}`);
      } else {
        router.push("/agents");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create agent");
    } finally {
      setSaving(false);
    }
  }

  const canNext =
    (step === 1 && template !== null) ||
    (step === 2 && config.name.trim() !== "") ||
    step === 3 ||
    step === 4 ||
    step === 5;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Create Voice Agent</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set up your AI voice agent in 5 simple steps
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <button
              onClick={() => s.id < step && setStep(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full",
                step === s.id
                  ? "bg-primary/10 text-primary"
                  : step > s.id
                  ? "text-emerald-600"
                  : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0",
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : step > s.id
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
              </div>
              <span className="hidden lg:block truncate">{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-[2px] w-4 mx-0.5 shrink-0",
                  step > s.id ? "bg-emerald-300" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {/* Step 1: Template */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Choose a Template</CardTitle>
              <CardDescription>
                Start with a pre-configured template or build from scratch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatePicker selected={template} onSelect={selectTemplate} />
            </CardContent>
          </Card>
        )}

        {/* Step 2: Personality */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Configure Personality</CardTitle>
              <CardDescription>
                Define how your agent introduces itself and interacts with callers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  placeholder="e.g., Sarah, Alex"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="greeting">Opening Greeting</Label>
                <Textarea
                  id="greeting"
                  placeholder="Hello! Thank you for calling..."
                  value={config.greeting}
                  onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personality">Personality Traits</Label>
                <Input
                  id="personality"
                  placeholder="Professional, friendly, patient"
                  value={config.personality}
                  onChange={(e) => setConfig({ ...config, personality: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">System Instructions</Label>
                <Textarea
                  id="instructions"
                  placeholder="You are a helpful assistant for..."
                  value={config.instructions}
                  onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Define how your agent should behave and what it should/shouldn&apos;t do.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Voice & Model */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Voice & Model Settings</CardTitle>
              <CardDescription>
                Choose the AI model, speech recognition, and voice for your agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* LLM */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-indigo-500" />
                  AI Model (LLM)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={config.llm_provider}
                      onValueChange={(v) => setConfig({ ...config, llm_provider: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                      value={config.llm_model}
                      onValueChange={(v) => setConfig({ ...config, llm_model: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                        <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="claude-sonnet-4">Claude Sonnet 4</SelectItem>
                        <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Temperature: {config.llm_temperature}</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.llm_temperature}
                    onChange={(e) => setConfig({ ...config, llm_temperature: parseFloat(e.target.value) })}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>
              </div>

              {/* STT */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Mic className="h-4 w-4 text-emerald-500" />
                  Speech-to-Text (STT)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={config.stt_provider}
                      onValueChange={(v) => setConfig({ ...config, stt_provider: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deepgram">Deepgram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={config.stt_language}
                      onValueChange={(v) => setConfig({ ...config, stt_language: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="multi">Multilingual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* TTS */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  Text-to-Speech (TTS)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={config.tts_provider}
                      onValueChange={(v) => setConfig({ ...config, tts_provider: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cartesia">Cartesia</SelectItem>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select
                      value={config.tts_voice}
                      onValueChange={(v) => setConfig({ ...config, tts_voice: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Professional Female">Professional Female</SelectItem>
                        <SelectItem value="Professional Male">Professional Male</SelectItem>
                        <SelectItem value="Friendly Female">Friendly Female</SelectItem>
                        <SelectItem value="Friendly Male">Friendly Male</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Knowledge & Tools */}
        {step === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-500" />
                  Knowledge Base
                </CardTitle>
                <CardDescription>
                  Upload documents so your agent can answer from your company&apos;s knowledge.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadZone files={files} onUpload={handleUpload} onRemove={(id) => setFiles((p) => p.filter((f) => f.id !== id))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-amber-500" />
                  Tools
                </CardTitle>
                <CardDescription>
                  Enable capabilities your agent can use during conversations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "knowledge_search", label: "Knowledge Search", desc: "Search uploaded documents to answer questions" },
                  { key: "book_appointment", label: "Book Appointment", desc: "Schedule appointments and check availability" },
                  { key: "create_ticket", label: "Create Support Ticket", desc: "Log support issues for follow-up" },
                  { key: "request_callback", label: "Request Human Callback", desc: "Offer human follow-up when agent can't help" },
                  { key: "web_search", label: "Web Search", desc: "Search the web for additional information" },
                ].map((tool) => (
                  <div key={tool.key} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="text-sm font-medium">{tool.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tool.desc}</p>
                    </div>
                    <Switch
                      checked={config.tools[tool.key as keyof typeof config.tools]}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          tools: { ...config.tools, [tool.key]: checked },
                        })
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 5: Test & Deploy */}
        {step === 5 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-indigo-500" />
                  Test Your Agent
                </CardTitle>
                <CardDescription>
                  Have a test conversation to make sure everything works.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VoiceCallButton
                  agentName={config.name || "Your Agent"}
                  onStart={() => toast.info("Test mode — connect to LiveKit to test")}
                  className="w-full"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-emerald-500" />
                  Deploy
                </CardTitle>
                <CardDescription>
                  Share your agent with customers using a link or embed widget.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Shareable Link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`https://voicedesk.app/c/your-company`}
                      className="bg-muted font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText("https://voicedesk.app/c/your-company");
                        toast.success("Copied!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Embed Widget</Label>
                  <Textarea
                    readOnly
                    value={`<script src="https://voicedesk.app/widget.js" data-agent="your-agent-id"></script>`}
                    className="bg-muted font-mono text-xs h-16"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>
        {step < 5 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext} className="gap-2">
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Publishing Agent..." : "Create & Publish Agent"}
          </Button>
        )}
      </div>
    </div>
  );
}


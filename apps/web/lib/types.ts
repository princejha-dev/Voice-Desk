/* ── Core domain types for VoiceDesk ─────────────────────────────── */

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "pro" | "enterprise";
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  user_profile?: UserProfile;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  template: string | null;
  status: "draft" | "published" | "archived";
  active_version_id: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Computed / joined
  call_count?: number;
  active_version?: AgentVersion;
}

export interface AgentVersion {
  id: string;
  tenant_id: string;
  agent_id: string;
  version: number;
  config: AgentConfig;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AgentConfig {
  instructions: string;
  greeting: string;
  personality: string;
  llm: LLMConfig;
  stt: STTConfig;
  tts: TTSConfig;
  tools: string[];
  guardrails: GuardrailConfig;
  knowledge_base_ids: string[];
}

export interface LLMConfig {
  provider: "openai" | "anthropic" | "google";
  model: string;
  temperature: number;
  max_tokens?: number;
}

export interface STTConfig {
  provider: "deepgram";
  model: string;
  language: string;
}

export interface TTSConfig {
  provider: "cartesia" | "elevenlabs";
  voice_id: string;
  voice_name: string;
}

export interface GuardrailConfig {
  refuse_off_topic: boolean;
  require_knowledge_base: boolean;
  offer_human_fallback: boolean;
}

export interface KnowledgeDocument {
  id: string;
  tenant_id: string;
  agent_id: string;
  filename: string;
  file_path: string | null;
  file_size: number;
  mime_type: string;
  status: "processing" | "ready" | "failed" | "deleting";
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface CallSession {
  id: string;
  tenant_id: string;
  agent_id: string;
  agent_version_id: string | null;
  livekit_room: string | null;
  caller_identity: string | null;
  status: "connecting" | "active" | "completed" | "failed" | "timeout";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  summary: string | null;
  outcome: string | null;
  metadata: Record<string, unknown>;
  // Joined
  agent?: Agent;
  messages?: ConversationMessage[];
}

export interface ConversationMessage {
  id: string;
  tenant_id: string;
  session_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tool_result: Record<string, unknown> | null;
  latency_ms: number | null;
  tokens_used: number | null;
  created_at: string;
}

export interface SessionMetric {
  id: string;
  tenant_id: string;
  session_id: string;
  metric_name: string;
  metric_value: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EvalDataset {
  id: string;
  tenant_id: string;
  agent_id: string;
  name: string;
  description: string | null;
  created_at: string;
  case_count?: number;
  last_score?: number | null;
}

export interface EvalCase {
  id: string;
  tenant_id: string;
  dataset_id: string;
  case_type: "knowledge" | "tool_use" | "guardrail" | "isolation";
  user_message: string;
  expected_behavior: string;
  expected_tool: string | null;
  metadata: Record<string, unknown>;
}

export interface EvalRun {
  id: string;
  tenant_id: string;
  agent_id: string;
  version_id: string | null;
  dataset_id: string | null;
  status: "pending" | "running" | "completed" | "failed";
  total_cases: number;
  passed_cases: number;
  score: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EvalCaseResult {
  id: string;
  tenant_id: string;
  run_id: string;
  case_id: string;
  passed: boolean;
  actual_response: string;
  actual_tool: string | null;
  score: number | null;
  reasoning: string;
  latency_ms: number;
  created_at: string;
}

export interface OverviewAnalytics {
  total_agents: number;
  active_agents: number;
  total_calls: number;
  calls_this_month: number;
  calls_change_pct: number;
  success_rate: number;
  avg_latency_ms: number;
  estimated_cost_cents: number;
  calls_over_time: { date: string; count: number }[];
}

export interface AgentAnalytics {
  agent_id: string;
  agent_name: string;
  total_calls: number;
  success_rate: number;
  avg_latency_ms: number;
  estimated_cost_cents: number;
}

export interface ToolDefinition {
  name: string;
  display_name: string;
  description: string;
  icon: string;
  category: "knowledge" | "communication" | "scheduling" | "utility";
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface UsageSummary {
  period: string;
  total_calls: number;
  total_minutes: number;
  total_tokens: number;
  total_cost_cents: number;
  breakdown_by_agent: {
    agent_id: string;
    agent_name: string;
    calls: number;
    minutes: number;
    cost_cents: number;
  }[];
}

// API request types
export interface CreateAgentRequest {
  name: string;
  description?: string;
  template?: string;
}

export interface StartSessionResponse {
  session_id: string;
  livekit_token: string;
  room_name: string;
  livekit_url: string;
}

export interface DeployInfo {
  shareable_url: string;
  embed_code: string;
  agent_status: string;
}

// Template type
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: Partial<AgentConfig>;
}


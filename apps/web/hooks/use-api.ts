"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api";

// ── Auth token helper ──────────────────────────────────────────────────────────

export function useAuthToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return token;
}

// ── Current organization ───────────────────────────────────────────────────────

export function useOrganization() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [org, setOrg] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthToken();

  useEffect(() => {
    if (!token) return;
    api<{ organizations: Record<string, unknown>[] }>("/api/v1/organizations", { token })
      .then((res) => {
        const first = res.organizations?.[0];
        if (first) {
          setOrg(first);
          setOrgId(first.id as string);
        } else {
          // Auto-create initial organization if user doesn't have one
          api<Record<string, unknown>>("/api/v1/organizations", {
            method: "POST",
            body: JSON.stringify({ name: "My Organization" }),
            token,
          })
            .then((created) => {
              if (created?.id) {
                setOrg(created);
                setOrgId(created.id as string);
              }
            })
            .catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return { orgId, org, loading };
}

// ── Agents ─────────────────────────────────────────────────────────────────────

export function useAgents() {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [agents, setAgents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!orgId || !token) return;
    setLoading(true);
    api<{ agents: Record<string, unknown>[] }>(`/api/v1/organizations/${orgId}/agents`, { token })
      .then((res) => {
        setAgents(res.agents ?? []);
        setError(null);
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orgId, token]);

  useEffect(() => { refetch(); }, [refetch]);

  const createAgent = useCallback(
    async (data: Record<string, unknown>) => {
      if (!orgId || !token) throw new Error("Not authenticated");
      return api<Record<string, unknown>>(`/api/v1/organizations/${orgId}/agents`, {
        method: "POST",
        body: JSON.stringify(data),
        token,
      });
    },
    [orgId, token]
  );

  const updateAgent = useCallback(
    async (agentId: string, data: Record<string, unknown>) => {
      if (!orgId || !token) throw new Error("Not authenticated");
      return api<Record<string, unknown>>(`/api/v1/organizations/${orgId}/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        token,
      });
    },
    [orgId, token]
  );

  const publishAgent = useCallback(
    async (agentId: string, config: Record<string, unknown>) => {
      if (!orgId || !token) throw new Error("Not authenticated");
      return api<Record<string, unknown>>(
        `/api/v1/organizations/${orgId}/agents/${agentId}/publish`,
        { method: "POST", body: JSON.stringify(config), token }
      );
    },
    [orgId, token]
  );

  const deleteAgent = useCallback(
    async (agentId: string) => {
      if (!orgId || !token) throw new Error("Not authenticated");
      return api(`/api/v1/organizations/${orgId}/agents/${agentId}`, {
        method: "DELETE",
        token,
      });
    },
    [orgId, token]
  );

  return { agents, loading, error, refetch, createAgent, updateAgent, publishAgent, deleteAgent };
}

export function useAgent(agentId: string | undefined) {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [agent, setAgent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!orgId || !token || !agentId) return;
    api<Record<string, unknown>>(`/api/v1/organizations/${orgId}/agents/${agentId}`, { token })
      .then(setAgent)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token, agentId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { agent, loading, refetch };
}

export function useAgentVersions(agentId: string | undefined) {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!orgId || !token || !agentId) return;
    setLoading(true);
    api<{ versions: Record<string, unknown>[] }>(
      `/api/v1/organizations/${orgId}/agents/${agentId}/versions`,
      { token }
    )
      .then((res) => setVersions(res.versions ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token, agentId]);

  useEffect(() => { refetch(); }, [refetch]);

  const saveVersion = useCallback(
    async (config: Record<string, unknown>) => {
      if (!orgId || !token || !agentId) throw new Error("Not authenticated");
      return api<Record<string, unknown>>(
        `/api/v1/organizations/${orgId}/agents/${agentId}/versions`,
        { method: "POST", body: JSON.stringify({ config }), token }
      );
    },
    [orgId, token, agentId]
  );

  const publishVersion = useCallback(
    async (versionId: string) => {
      if (!orgId || !token || !agentId) throw new Error("Not authenticated");
      return api<Record<string, unknown>>(
        `/api/v1/organizations/${orgId}/agents/${agentId}/publish`,
        { method: "POST", body: JSON.stringify({ version_id: versionId }), token }
      );
    },
    [orgId, token, agentId]
  );

  return { versions, loading, refetch, saveVersion, publishVersion };
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export function useSessions(filters?: { agentId?: string; limit?: number }) {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !token) return;
    const params = new URLSearchParams();
    if (filters?.agentId) params.set("agent_id", filters.agentId);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString() ? `?${params}` : "";
    api<{ sessions: Record<string, unknown>[] }>(
      `/api/v1/organizations/${orgId}/sessions${qs}`,
      { token }
    )
      .then((res) => setSessions(res.sessions ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token, filters?.agentId, filters?.limit]);

  return { sessions, loading };
}

export function useSession(sessionId: string | undefined) {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !token || !sessionId) return;
    api<Record<string, unknown>>(
      `/api/v1/organizations/${orgId}/sessions/${sessionId}`,
      { token }
    )
      .then(setSession)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token, sessionId]);

  return { session, loading };
}

// ── Monitoring ─────────────────────────────────────────────────────────────────

export function useMonitoringOverview() {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !token) return;
    api<Record<string, unknown>>(
      `/api/v1/organizations/${orgId}/monitoring/overview`,
      { token }
    )
      .then(setOverview)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token]);

  return { overview, loading };
}

// ── Knowledge ──────────────────────────────────────────────────────────────────

export function useKnowledgeDocs() {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [docs, setDocs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!orgId || !token) return;
    api<{ documents: Record<string, unknown>[] }>(
      `/api/v1/organizations/${orgId}/knowledge`,
      { token }
    )
      .then((res) => setDocs(res.documents ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token]);

  useEffect(() => { refetch(); }, [refetch]);

  const upload = useCallback(
    async (file: File, agentId?: string) => {
      if (!orgId || !token) return;
      const form = new FormData();
      form.append("file", file);
      const url = agentId
        ? `/api/v1/organizations/${orgId}/knowledge/upload?agent_id=${agentId}`
        : `/api/v1/organizations/${orgId}/knowledge/upload`;
      return api(url, {
        method: "POST",
        body: form,
        token,
      });
    },
    [orgId, token]
  );

  const deleteDoc = useCallback(
    async (docId: string) => {
      if (!orgId || !token) return;
      return api(`/api/v1/organizations/${orgId}/knowledge/${docId}`, {
        method: "DELETE",
        token,
      });
    },
    [orgId, token]
  );

  const updateStatus = useCallback(
    async (docId: string, status: "ready" | "deactivated") => {
      if (!orgId || !token) return;
      return api(`/api/v1/organizations/${orgId}/knowledge/${docId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        token,
      });
    },
    [orgId, token]
  );

  const assignAgent = useCallback(
    async (docId: string, agentId: string) => {
      if (!orgId || !token) return;
      return api(`/api/v1/organizations/${orgId}/knowledge/${docId}/assign`, {
        method: "POST",
        body: JSON.stringify({ agent_id: agentId }),
        token,
      });
    },
    [orgId, token]
  );

  const unassignAgent = useCallback(
    async (docId: string, agentId: string) => {
      if (!orgId || !token) return;
      return api(`/api/v1/organizations/${orgId}/knowledge/${docId}/assign/${agentId}`, {
        method: "DELETE",
        token,
      });
    },
    [orgId, token]
  );

  const getSourceContent = useCallback(
    async (docId: string) => {
      if (!orgId || !token) return null;
      return api<{ document: Record<string, unknown>; chunks: Record<string, unknown>[] }>(
        `/api/v1/organizations/${orgId}/knowledge/${docId}/content`,
        { token }
      );
    },
    [orgId, token]
  );

  return {
    docs,
    loading,
    refetch,
    upload,
    deleteDoc,
    updateStatus,
    assignAgent,
    unassignAgent,
    getSourceContent,
  };
}

// ── Billing ────────────────────────────────────────────────────────────────────

export function useBilling() {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const [plan, setPlan] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !token) return;
    Promise.all([
      api<Record<string, unknown>>(`/api/v1/organizations/${orgId}/billing/usage`, { token }),
      api<Record<string, unknown>>(`/api/v1/organizations/${orgId}/billing/plan`, { token }),
    ])
      .then(([u, p]) => { setUsage(u); setPlan(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token]);

  return { usage, plan, loading };
}

// ── Evaluations ────────────────────────────────────────────────────────────────

export function useEvaluations() {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [datasets, setDatasets] = useState<Record<string, unknown>[]>([]);
  const [runs, setRuns] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!orgId || !token) return;
    Promise.all([
      api<{ datasets: Record<string, unknown>[] }>(
        `/api/v1/organizations/${orgId}/evaluations/datasets`, { token }
      ),
      api<{ runs: Record<string, unknown>[] }>(
        `/api/v1/organizations/${orgId}/evaluations/runs`, { token }
      ),
    ])
      .then(([d, r]) => { setDatasets(d.datasets ?? []); setRuns(r.runs ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token]);

  useEffect(() => { refetch(); }, [refetch]);

  const runEvaluation = useCallback(
    async (datasetId: string) => {
      if (!orgId || !token) throw new Error("Not authenticated");
      return api<Record<string, unknown>>(
        `/api/v1/organizations/${orgId}/evaluations/runs`,
        { method: "POST", body: JSON.stringify({ dataset_id: datasetId }), token }
      );
    },
    [orgId, token]
  );

  const addTestCase = useCallback(
    async (datasetId: string, data: Record<string, unknown>) => {
      if (!orgId || !token) throw new Error("Not authenticated");
      return api<Record<string, unknown>>(
        `/api/v1/organizations/${orgId}/evaluations/datasets/${datasetId}/cases`,
        { method: "POST", body: JSON.stringify(data), token }
      );
    },
    [orgId, token]
  );

  const createDataset = useCallback(
    async (data: Record<string, unknown>) => {
      if (!orgId || !token) throw new Error("Not authenticated");
      return api<Record<string, unknown>>(
        `/api/v1/organizations/${orgId}/evaluations/datasets`,
        { method: "POST", body: JSON.stringify(data), token }
      );
    },
    [orgId, token]
  );

  return { datasets, runs, loading, refetch, runEvaluation, addTestCase, createDataset };
}

// ── API Keys / Webhooks ────────────────────────────────────────────────────────

export function useApiKeys() {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [keys, setKeys] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!orgId || !token) return;
    api<{ keys: Record<string, unknown>[] }>(
      `/api/v1/organizations/${orgId}/api-keys`,
      { token }
    )
      .then((res) => setKeys(res.keys ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token]);

  useEffect(() => { refetch(); }, [refetch]);

  const createKey = useCallback(
    async (name: string) => {
      if (!orgId || !token) throw new Error("Not authenticated");
      return api<{ key: string; id: string }>(
        `/api/v1/organizations/${orgId}/api-keys`,
        { method: "POST", body: JSON.stringify({ name }), token }
      );
    },
    [orgId, token]
  );

  const revokeKey = useCallback(
    async (keyId: string) => {
      if (!orgId || !token) throw new Error("Not authenticated");
      return api(`/api/v1/organizations/${orgId}/api-keys/${keyId}`, {
        method: "DELETE",
        token,
      });
    },
    [orgId, token]
  );

  return { keys, loading, refetch, createKey, revokeKey };
}

// ── Tool Operations Data ────────────────────────────────────────────────────────

export function useBookings(agentId?: string) {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!orgId || !token) return;
    setLoading(true);
    const path = `/api/v1/organizations/${orgId}/tools/bookings${agentId ? `?agent_id=${agentId}` : ""}`;
    api<{ bookings: Record<string, unknown>[] }>(path, { token })
      .then((res) => setBookings(res.bookings ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token, agentId]);

  useEffect(() => { refetch(); }, [refetch]);

  const updateStatus = useCallback(
    async (bookingId: string, status: string, notes?: string) => {
      if (!orgId || !token) return;
      await api(`/api/v1/organizations/${orgId}/tools/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes }),
        token,
      });
      refetch();
    },
    [orgId, token, refetch]
  );

  return { bookings, loading, refetch, updateStatus };
}

export function useTickets(agentId?: string) {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!orgId || !token) return;
    setLoading(true);
    const path = `/api/v1/organizations/${orgId}/tools/tickets${agentId ? `?agent_id=${agentId}` : ""}`;
    api<{ tickets: Record<string, unknown>[] }>(path, { token })
      .then((res) => setTickets(res.tickets ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token, agentId]);

  useEffect(() => { refetch(); }, [refetch]);

  const updateStatus = useCallback(
    async (ticketId: string, status: string, priority?: string) => {
      if (!orgId || !token) return;
      await api(`/api/v1/organizations/${orgId}/tools/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, priority }),
        token,
      });
      refetch();
    },
    [orgId, token, refetch]
  );

  return { tickets, loading, refetch, updateStatus };
}

export function useCallbacks(agentId?: string) {
  const { orgId } = useOrganization();
  const token = useAuthToken();
  const [callbacks, setCallbacks] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!orgId || !token) return;
    setLoading(true);
    const path = `/api/v1/organizations/${orgId}/tools/callbacks${agentId ? `?agent_id=${agentId}` : ""}`;
    api<{ callbacks: Record<string, unknown>[] }>(path, { token })
      .then((res) => setCallbacks(res.callbacks ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, token, agentId]);

  useEffect(() => { refetch(); }, [refetch]);

  const updateStatus = useCallback(
    async (callbackId: string, status: string) => {
      if (!orgId || !token) return;
      await api(`/api/v1/organizations/${orgId}/tools/callbacks/${callbackId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        token,
      });
      refetch();
    },
    [orgId, token, refetch]
  );

  return { callbacks, loading, refetch, updateStatus };
}


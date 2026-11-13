"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileText,
  Search,
  Bot,
  Trash2,
  Database,
  RefreshCw,
  Eye,
  Power,
  PowerOff,
  UserCheck,
  ChevronDown,
  X,
  Loader2,
  Check,
  ExternalLink,
  Upload,
} from "lucide-react";
import { useKnowledgeDocs, useAgents } from "@/hooks/use-api";
import { toast } from "sonner";

function formatBytes(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("all");

  // Source view modal state
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [sourceData, setSourceData] = useState<{
    document: Record<string, any>;
    chunks: Record<string, any>[];
  } | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  // Manage agents modal state
  const [managingDoc, setManagingDoc] = useState<any | null>(null);

  const {
    docs: rawDocs,
    loading,
    refetch,
    upload,
    deleteDoc,
    updateStatus,
    assignAgent,
    unassignAgent,
    getSourceContent,
  } = useKnowledgeDocs();

  const { agents } = useAgents();

  // Auto-poll if any document is processing
  useEffect(() => {
    const hasProcessing = rawDocs.some((d) => d.status === "processing" || d.status === "pending");
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [rawDocs, refetch]);

  const docs = rawDocs.map((d: any) => ({
    id: d.id as string,
    filename: (d.filename as string) ?? (d.name as string) ?? "Document",
    fileSize: (d.file_size as number) ?? (d.file_size_bytes as number) ?? 0,
    chunks: (d.chunk_count as number) ?? 0,
    status: (d.status as string) ?? "processing",
    uploadedAt: d.created_at as string | undefined,
    assignedAgents: (d.assigned_agents as any[]) || [],
  }));

  const filtered = docs.filter((d) => {
    const matchesSearch =
      d.filename.toLowerCase().includes(search.toLowerCase()) ||
      d.assignedAgents.some((a) => a.name?.toLowerCase().includes(search.toLowerCase()));
    if (selectedAgentFilter === "all") return matchesSearch;
    return matchesSearch && d.assignedAgents.some((a) => a.id === selectedAgentFilter);
  });

  const totalChunks = docs.reduce((sum, d) => sum + (d.chunks ?? 0), 0);
  const activeDocsCount = docs.filter((d) => d.status === "ready").length;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    let succeeded = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        await upload(files[i]);
        succeeded++;
      } catch (err: any) {
        toast.error(`Failed to upload ${files[i].name}: ${err.message}`);
      }
    }
    setUploading(false);
    if (succeeded > 0) {
      toast.success(`${succeeded} document(s) uploaded. Ingestion processing in background.`);
      refetch();
    }
    e.target.value = "";
  }

  async function handleToggleStatus(doc: any) {
    const nextStatus = doc.status === "ready" ? "deactivated" : "ready";
    try {
      await updateStatus(doc.id, nextStatus);
      toast.success(
        nextStatus === "ready"
          ? `Activated "${doc.filename}" — voice agents will now answer from it.`
          : `Deactivated "${doc.filename}" — voice agents will skip it.`
      );
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  }

  async function handleViewSource(docId: string) {
    setViewingDocId(docId);
    setSourceLoading(true);
    try {
      const data = await getSourceContent(docId);
      setSourceData(data);
    } catch (err: any) {
      toast.error("Failed to load source content");
    } finally {
      setSourceLoading(false);
    }
  }

  async function handleDelete(docId: string, filename: string) {
    if (!confirm(`Are you sure you want to delete "${filename}"? All indexed vector embeddings will be removed.`)) return;
    try {
      await deleteDoc(docId);
      toast.success(`Deleted ${filename}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document");
    }
  }

  async function handleToggleAgentAssignment(docId: string, agentId: string, isCurrentlyAssigned: boolean) {
    try {
      if (isCurrentlyAssigned) {
        await unassignAgent(docId, agentId);
        toast.info("Unassigned document from agent");
      } else {
        await assignAgent(docId, agentId);
        toast.success("Assigned document to agent");
      }
      refetch();
      // Update managingDoc state locally so UI updates immediately
      if (managingDoc && managingDoc.id === docId) {
        const updatedAgents = isCurrentlyAssigned
          ? managingDoc.assignedAgents.filter((a: any) => a.id !== agentId)
          : [...managingDoc.assignedAgents, agents.find((a: any) => a.id === agentId)];
        setManagingDoc({ ...managingDoc, assignedAgents: updatedAgents });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update assignment");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage company documents, activate/deactivate RAG scope, and view indexed vector source chunks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={refetch}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.txt,.docx,.md"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700" asChild>
              <span>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading..." : "Upload Documents"}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <p className="text-2xl font-bold">{docs.length}</p>
              )}
              <p className="text-xs text-muted-foreground">Total Documents ({activeDocsCount} Active)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
              <Database className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-7 w-16 mb-1" />
              ) : (
                <p className="text-2xl font-bold">{totalChunks.toLocaleString()}</p>
              )}
              <p className="text-xs text-muted-foreground">Indexed Vector Chunks</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <Bot className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-7 w-8 mb-1" />
              ) : (
                <p className="text-2xl font-bold">{agents.length}</p>
              )}
              <p className="text-xs text-muted-foreground">Configured Voice Agents</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document List */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <CardTitle className="text-base">Organization Documents</CardTitle>
            <CardDescription className="text-xs">
              Documents uploaded here can be scoped and queried by your voice AI agents.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search documents or agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Document Name</TableHead>
                  <TableHead>Assigned Agents</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Status / RAG State</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-muted-foreground text-sm">
                      {search ? `No documents match "${search}"` : "No documents yet. Click 'Upload Documents' to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((doc) => {
                    const isActive = doc.status === "ready";
                    const isProcessing = doc.status === "processing" || doc.status === "pending";
                    return (
                      <TableRow key={doc.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-foreground">{doc.filename}</p>
                              <p className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Assigned Agents */}
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                            {doc.assignedAgents.length === 0 ? (
                              <button
                                onClick={() => setManagingDoc(doc)}
                                className="text-xs text-muted-foreground hover:text-indigo-600 border border-dashed px-2 py-0.5 rounded-md"
                              >
                                + Assign Agent
                              </button>
                            ) : (
                              <>
                                {doc.assignedAgents.map((ag: any) => (
                                  <Badge key={ag.id} variant="secondary" className="text-[11px] font-normal py-0">
                                    {ag.name}
                                  </Badge>
                                ))}
                                <button
                                  onClick={() => setManagingDoc(doc)}
                                  className="text-[11px] text-muted-foreground hover:text-foreground font-medium ml-1"
                                >
                                  Edit
                                </button>
                              </>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs">
                            {isProcessing ? (
                              <span className="flex items-center gap-1.5 text-amber-500">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Embedding...
                              </span>
                            ) : (
                              <span>{doc.chunks} chunks</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Status & Activate / Deactivate Toggle */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isProcessing ? (
                              <Badge variant="warning" className="text-xs gap-1 py-0.5">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Ingesting
                              </Badge>
                            ) : isActive ? (
                              <Badge variant="success" className="text-xs py-0.5">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs py-0.5 text-muted-foreground">Deactivated</Badge>
                            )}

                            {!isProcessing && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(doc)}
                                title={isActive ? "Deactivate document (exclude from voice calls)" : "Activate document (include in voice calls)"}
                                className={`h-7 px-2 text-xs gap-1 ${isActive ? "text-muted-foreground hover:text-amber-500" : "text-emerald-600 hover:text-emerald-700 font-medium"}`}
                              >
                                {isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                {isActive ? "Deactivate" : "Activate"}
                              </Button>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {timeAgo(doc.uploadedAt)}
                        </TableCell>

                        {/* Action buttons */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => handleViewSource(doc.id)}
                              disabled={isProcessing}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Source
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(doc.id, doc.filename)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── VIEW SOURCE MODAL ─────────────────────────────────────────────────── */}
      {viewingDocId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5 text-indigo-500" />
                  Source Chunks & Vector Data
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {sourceData?.document?.filename || "Loading document content..."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setViewingDocId(null);
                  setSourceData(null);
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {sourceLoading ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                  <p className="text-sm text-muted-foreground">Retrieving vector chunks from pgvector database...</p>
                </div>
              ) : !sourceData || sourceData.chunks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No text chunks found for this document.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border">
                    <span>Total Chunks: <strong>{sourceData.chunks.length}</strong></span>
                    <span>Status: <strong className="capitalize">{sourceData.document.status}</strong></span>
                  </div>

                  {sourceData.chunks.map((c: any) => (
                    <div key={c.chunk_index} className="border rounded-xl p-4 bg-muted/10 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          Chunk #{c.chunk_index + 1}
                        </Badge>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          ~{c.metadata?.token_count || Math.round(c.content.length / 4)} tokens
                        </span>
                      </div>
                      <p className="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed bg-background p-3 rounded-lg border">
                        {c.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t bg-muted/20 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewingDocId(null);
                  setSourceData(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MANAGE AGENTS MODAL ───────────────────────────────────────────────── */}
      {managingDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-indigo-500" />
                  Assign Agents to Document
                </h3>
                <p className="text-xs text-muted-foreground truncate max-w-xs font-mono">
                  {managingDoc.filename}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setManagingDoc(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-3">
                Selected voice agents will query this document during calls when answering customer questions:
              </p>

              {agents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No agents found. Create an agent first to assign knowledge.
                </p>
              ) : (
                agents.map((ag: any) => {
                  const isAssigned = managingDoc.assignedAgents.some((a: any) => a.id === ag.id);
                  return (
                    <div
                      key={ag.id}
                      onClick={() => handleToggleAgentAssignment(managingDoc.id, ag.id, isAssigned)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isAssigned ? "border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500" : "hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isAssigned ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{ag.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">/c/{ag.slug}</p>
                        </div>
                      </div>
                      <Badge variant={isAssigned ? "success" : "secondary"} className="text-xs">
                        {isAssigned ? "Assigned" : "Unassigned"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3 border-t bg-muted/20 flex justify-end">
              <Button size="sm" onClick={() => setManagingDoc(null)} className="bg-indigo-600 hover:bg-indigo-700">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

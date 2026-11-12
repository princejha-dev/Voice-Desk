"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadZone } from "@/components/knowledge/upload-zone";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, Bot, Trash2, Database, RefreshCw } from "lucide-react";
import { useKnowledgeDocs } from "@/hooks/use-api";
import { toast } from "sonner";

const statusConfig: Record<string, { variant: "success" | "warning" | "destructive" | "secondary"; label: string }> = {
  ready: { variant: "success", label: "Ready" },
  indexed: { variant: "success", label: "Ready" },
  processing: { variant: "warning", label: "Processing" },
  pending: { variant: "warning", label: "Pending" },
  failed: { variant: "destructive", label: "Failed" },
  error: { variant: "destructive", label: "Error" },
};

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
  const { docs: rawDocs, loading, refetch, upload } = useKnowledgeDocs();

  const docs = rawDocs.map((d) => ({
    id: d.id as string,
    filename: (d.filename as string) ?? (d.title as string) ?? "Document",
    agentId: d.agent_id as string | undefined,
    agentName: d.agent_name as string | undefined,
    fileSize: d.file_size_bytes as number | undefined,
    chunks: d.chunk_count as number | undefined,
    status: (d.status as string) ?? "pending",
    uploadedAt: d.created_at as string | undefined,
    errorMessage: d.error_message as string | undefined,
  }));

  const filtered = docs.filter((d) =>
    d.filename.toLowerCase().includes(search.toLowerCase()) ||
    (d.agentName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalChunks = docs.reduce((sum, d) => sum + (d.chunks ?? 0), 0);
  const agentsUsingKB = new Set(docs.map((d) => d.agentId).filter(Boolean)).size;

  const handleUpload = useCallback(
    async (files: File[]) => {
      setUploading(true);
      let succeeded = 0;
      let failed = 0;
      for (const file of files) {
        try {
          await upload(file);
          succeeded++;
        } catch {
          failed++;
        }
      }
      setUploading(false);
      if (succeeded > 0) toast.success(`${succeeded} file(s) uploaded — processing started`);
      if (failed > 0) toast.error(`${failed} file(s) failed to upload`);
      refetch();
    },
    [upload, refetch]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage documents that power your agents&apos; knowledge
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refetch}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
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
              <p className="text-xs text-muted-foreground">Documents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
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
              <p className="text-xs text-muted-foreground">Indexed Chunks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <Bot className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-7 w-8 mb-1" />
              ) : (
                <p className="text-2xl font-bold">{agentsUsingKB}</p>
              )}
              <p className="text-xs text-muted-foreground">Agents Using KB</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Documents</CardTitle>
          <CardDescription>Add PDFs or text files to your knowledge base.</CardDescription>
        </CardHeader>
        <CardContent>
          <UploadZone
            files={[]}
            onUpload={handleUpload}
            onRemove={() => {}}
          />
          {uploading && (
            <p className="text-sm text-muted-foreground mt-3 text-center animate-pulse">
              Uploading and queueing for processing...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Document list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">All Documents</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      {search ? `No documents match "${search}"` : "No documents yet — upload one above"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((doc) => {
                    const s = statusConfig[doc.status] ?? { variant: "secondary" as const, label: doc.status };
                    return (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{doc.filename}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {doc.agentName ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatBytes(doc.fileSize)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {doc.chunks ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.variant}>{s.label}</Badge>
                          {doc.errorMessage && (
                            <p className="text-xs text-red-500 mt-1 max-w-xs truncate">{doc.errorMessage}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {timeAgo(doc.uploadedAt)}
                        </TableCell>
                        <TableCell>
                          <button className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/knowledge/upload-zone";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, Bot, Trash2, Database } from "lucide-react";

const demoDocuments = [
  { id: "1", agent: "Sarah — Support", filename: "Company FAQ.pdf", size: "245 KB", chunks: 42, status: "ready" as const, date: "Nov 10, 2026" },
  { id: "2", agent: "Sarah — Support", filename: "Return Policy.pdf", size: "89 KB", chunks: 15, status: "ready" as const, date: "Nov 8, 2026" },
  { id: "3", agent: "Sarah — Support", filename: "Product Catalog.pdf", size: "1.5 MB", chunks: 128, status: "ready" as const, date: "Nov 5, 2026" },
  { id: "4", agent: "Alex — Booking", filename: "Services Menu.pdf", size: "320 KB", chunks: 34, status: "ready" as const, date: "Oct 20, 2026" },
  { id: "5", agent: "Alex — Booking", filename: "Pricing Guide.txt", size: "12 KB", chunks: 8, status: "processing" as const, date: "Nov 11, 2026" },
];

const statusConfig: Record<string, { variant: "success" | "warning" | "destructive"; label: string }> = {
  ready: { variant: "success", label: "Ready" },
  processing: { variant: "warning", label: "Processing" },
  failed: { variant: "destructive", label: "Failed" },
};

export default function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<any[]>([]);

  const filtered = demoDocuments.filter((d) =>
    d.filename.toLowerCase().includes(search.toLowerCase()) ||
    d.agent.toLowerCase().includes(search.toLowerCase())
  );

  const totalChunks = demoDocuments.reduce((sum, d) => sum + d.chunks, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage documents that power your agents&apos; knowledge
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{demoDocuments.length}</p>
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
              <p className="text-2xl font-bold">{totalChunks}</p>
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
              <p className="text-2xl font-bold">2</p>
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
            files={files}
            onUpload={(newFiles) => {
              const f = newFiles.map((fl) => ({
                id: Math.random().toString(36).slice(2),
                name: fl.name,
                size: fl.size,
                status: "processing" as const,
              }));
              setFiles((prev) => [...prev, ...f]);
            }}
            onRemove={(id) => setFiles((p) => p.filter((f) => f.id !== id))}
          />
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
              {filtered.map((doc) => {
                const s = statusConfig[doc.status];
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{doc.filename}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{doc.agent}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{doc.size}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{doc.chunks}</TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{doc.date}</TableCell>
                    <TableCell>
                      <button className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


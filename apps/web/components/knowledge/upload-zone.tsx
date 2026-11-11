"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface UploadFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "processing" | "ready" | "failed";
  progress?: number;
  error?: string;
}

interface UploadZoneProps {
  files: UploadFile[];
  onUpload: (files: File[]) => void;
  onRemove: (fileId: string) => void;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const statusConfig: Record<string, { variant: "info" | "warning" | "success" | "destructive"; label: string }> = {
  uploading: { variant: "info", label: "Uploading" },
  processing: { variant: "warning", label: "Processing" },
  ready: { variant: "success", label: "Ready" },
  failed: { variant: "destructive", label: "Failed" },
};

export function UploadZone({ files, onUpload, onRemove, className }: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onUpload(acceptedFiles);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/30"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragActive ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, TXT, or Markdown — up to 10 MB each
          </p>
        </div>
        <Button variant="outline" size="sm" type="button">
          Browse Files
        </Button>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => {
            const status = statusConfig[file.status];
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <Badge variant={status.variant} className="text-[10px]">
                      {file.status === "uploading" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  {file.status === "uploading" && file.progress !== undefined && (
                    <Progress value={file.progress} className="mt-1.5 h-1" />
                  )}
                  {file.error && (
                    <p className="text-xs text-destructive mt-1">{file.error}</p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(file.id);
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


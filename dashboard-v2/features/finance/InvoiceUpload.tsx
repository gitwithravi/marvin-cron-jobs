"use client";

import { useRef } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Upload } from "lucide-react";

type InvoiceUploadProps = {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
};

export function InvoiceUpload({ onUpload, uploading }: InvoiceUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing)" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ display: "none" }}
        />
        <Button
          variant="primary"
          icon={<Upload size={16} />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload PDF"}
        </Button>
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Upload invoice PDF for extraction
        </span>
      </div>
    </Panel>
  );
}

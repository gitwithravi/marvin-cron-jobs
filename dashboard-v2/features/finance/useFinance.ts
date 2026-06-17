"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api/client";
import type { Invoice, InvoiceExtraction } from "@/lib/api/types";

type UseFinanceReturn = {
  invoices: Invoice[];
  selectedMonth: string;
  extraction: InvoiceExtraction | null;
  loading: boolean;
  uploading: boolean;
  saving: boolean;
  error: string | null;
  setSelectedMonth: (month: string) => void;
  uploadInvoice: (file: File) => Promise<void>;
  saveInvoice: (invoice: Partial<Invoice>) => Promise<void>;
  clearExtraction: () => void;
  refresh: () => void;
};

export function useFinance(): UseFinanceReturn {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [extraction, setExtraction] = useState<InvoiceExtraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async (month: string) => {
    try {
      const response = await apiFetch<{ invoices: Invoice[] }>(`/api/invoices?month=${month}`);
      setInvoices(response.invoices || []);
    } catch (err) {
      console.error("Error fetching invoices:", err);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchInvoices(selectedMonth);
    setLoading(false);
  }, [fetchInvoices, selectedMonth]);

  const uploadInvoice = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/invoices/extract", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract invoice.");
      }

      const result = await response.json();
      setExtraction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload invoice.");
    } finally {
      setUploading(false);
    }
  }, []);

  const saveInvoice = useCallback(async (invoice: Partial<Invoice>) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/invoices", {
        method: "POST",
        body: { ...invoice, month: selectedMonth }
      });
      setExtraction(null);
      await fetchInvoices(selectedMonth);
    } catch (err) {
      setError("Failed to save invoice.");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchInvoices, selectedMonth]);

  const clearExtraction = useCallback(() => {
    setExtraction(null);
  }, []);

  useState(() => {
    loadInvoices();
  });

  return {
    invoices,
    selectedMonth,
    extraction,
    loading,
    uploading,
    saving,
    error,
    setSelectedMonth: (month: string) => {
      setSelectedMonth(month);
      fetchInvoices(month);
    },
    uploadInvoice,
    saveInvoice,
    clearExtraction,
    refresh: loadInvoices
  };
}

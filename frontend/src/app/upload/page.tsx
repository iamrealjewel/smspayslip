"use client";
import React, { useCallback, useState, useMemo, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2,
  X, ArrowRight, Trash2, Phone, Info, Check, Settings2, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/context/ConfirmationContext";

// ─── Phone validation ────────────────────────────────────────────────────────
function isValidPhone(phone: string): boolean {
  const d = String(phone || "").trim().replace(/[\s\-\(\)\+\.]/g, "");
  return /^\d{10,13}$/.test(d);
}
function phoneStatus(phone: string): "missing" | "invalid" | "valid" {
  const v = String(phone ?? "").trim();
  if (!v || v === "null" || v === "undefined") return "missing";
  return isValidPhone(v) ? "valid" : "invalid";
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Row = Record<string, any> & { __idx: number };
type Tab = "all" | "dup_phone" | "missing" | "invalid" | "dup_empid";
interface IssueItem {
  row: Row;
  idx: number;
  empId: string;
  name: string;
  phone: string;
  status: "missing" | "invalid" | "valid";
  isDupPhone: boolean;
  isDupEmpId: boolean;
}

// ─── Issue badge ─────────────────────────────────────────────────────────────
function IssueBadge({ item }: { item: IssueItem }) {
  const badges = [];
  if (item.status === "missing")
    badges.push(<span key="m" className="issue-badge missing">Missing Phone</span>);
  if (item.status === "invalid")
    badges.push(<span key="i" className="issue-badge invalid">Invalid Phone</span>);
  if (item.isDupPhone)
    badges.push(<span key="dp" className="issue-badge dup-phone">Duplicate Phone</span>);
  if (item.isDupEmpId)
    badges.push(<span key="de" className="issue-badge dup-empid">Duplicate Emp ID</span>);
  return <div className="flex flex-wrap gap-1">{badges}</div>;
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [phoneEdits, setPhoneEdits] = useState<Record<number, string>>({});
  const [pendingPhones, setPendingPhones] = useState<Record<number, string>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<Tab>("all");
  const [recentUploads, setRecentUploads] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Custom Template & Field Config
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldOrder, setFieldOrder] = useState<string[]>([]);
  const [template, setTemplate] = useState("PaySlip-{Month}, EmpID: {Emp ID}, PayDays: {Pay. Days}, GROSS-{Gross Salary}");
  const [showConfig, setShowConfig] = useState(false);

  // ── Fetch history ────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get("/api/uploads");
      setRecentUploads(data);
    } catch (err) {
      console.error("Failed to fetch uploads", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Local Parsing & Validation ──────────────────────────────────────────
  const processFile = (file: File) => {
    setProcessing(true);
    setResult(null);
    setRows([]);
    setPhoneEdits({});
    setRemoved(new Set());

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as any[];

        if (rawRows.length === 0) {
          toast.error("Excel file is empty");
          setProcessing(false);
          return;
        }

        // Normalize rows and trim keys
        const parsedRows = rawRows.map((row, idx) => {
          const normalized: any = { __idx: idx };
          Object.keys(row).forEach((k) => {
            normalized[k.trim().replace(/\n/g, " ")] = row[k];
          });
          return normalized;
        });

        const columns = Object.keys(parsedRows[0]).filter((k) => k !== "__idx");
        const normalizedCols = columns.map((c) => c.toLowerCase());
        const hasSalary = normalizedCols.indexOf("gross salary") !== -1;

        if (!hasSalary) {
          setResult({
            error: "'Gross Salary' column not found",
            columns,
            validation: { isStructural: true },
          });
          setRows(parsedRows);
        } else {
          setRows(parsedRows);
          setResult({ columns, validation: { isStructural: false } });
          toast.success(`Processed ${parsedRows.length} rows. Please review any issues.`);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to read Excel file");
      } finally {
        setProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Dropzone ─────────────────────────────────────────────────────────────
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((accepted: File[]) => {
      if (accepted[0]) {
        setFile(accepted[0]);
        processFile(accepted[0]);
      }
    }, []),
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: processing,
  });

  // ── Delete upload ────────────────────────────────────────────────────────
  const handleDeleteUpload = async (id: number) => {
    const ok = await confirm({
      title: "Delete Upload?",
      description: "Are you sure? This will delete the record and its campaigns.",
      variant: "destructive"
    });
    if (!ok) return;
    try {
      await api.delete(`/api/uploads/${id}`);
      toast.success("Upload deleted");
      fetchHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Delete failed");
    }
  };

  // ── Reactive issue computation ────────────────────────────────────────────
  const { issues, stats } = useMemo(() => {
    if (!rows.length || (result?.error && result?.validation?.isStructural)) {
      return { issues: [] as IssueItem[], stats: result ? { total: rows.length, remaining: rows.length, totalIssues: 0 } as any : null };
    }

    const active = rows.filter((r) => !removed.has(r.__idx));
    const pCount: Record<string, number> = {};
    const eCount: Record<string, number> = {};

    for (const row of active) {
      const ph = (phoneEdits[row.__idx] ?? String(row["Phone Number"] ?? "")).trim();
      const eid = String(row["Emp ID"] ?? "").trim();
      if (ph && ph !== "null") pCount[ph] = (pCount[ph] || 0) + 1;
      if (eid && eid !== "null") eCount[eid] = (eCount[eid] || 0) + 1;
    }

    const issues: IssueItem[] = [];
    for (const row of active) {
      const phone = (phoneEdits[row.__idx] ?? String(row["Phone Number"] ?? "")).trim();
      const empId = String(row["Emp ID"] ?? "").trim();
      const status = phoneStatus(phone);
      const isDupPhone = status === "valid" && (pCount[phone] || 0) > 1;
      const isDupEmpId = !!empId && empId !== "null" && (eCount[empId] || 0) > 1;
      
      if (status !== "valid" || isDupPhone || isDupEmpId) {
        issues.push({ row, idx: row.__idx, empId, name: String(row["Name"] ?? ""), phone, status, isDupPhone, isDupEmpId });
      }
    }

    return {
      issues,
      stats: {
        total: rows.length,
        removed: removed.size,
        remaining: active.length,
        missing: issues.filter((i) => i.status === "missing").length,
        invalid: issues.filter((i) => i.status === "invalid").length,
        dupPhone: issues.filter((i) => i.isDupPhone).length,
        dupEmpId: issues.filter((i) => i.isDupEmpId && !i.isDupPhone && i.status === "valid").length,
        totalIssues: issues.length,
      },
    };
  }, [rows, phoneEdits, removed, result]);

  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  // ── Tab filtering ─────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    let filtered: IssueItem[] = [];
    switch (tab) {
      case "dup_phone": filtered = issues.filter((i) => i.isDupPhone); break;
      case "missing":   filtered = issues.filter((i) => i.status === "missing"); break;
      case "invalid":   filtered = issues.filter((i) => i.status === "invalid"); break;
      case "dup_empid": filtered = issues.filter((i) => i.isDupEmpId && !i.isDupPhone && i.status === "valid"); break;
      default:          filtered = issues; break;
    }

    // Add the currently focused row if it's missing (to prevent jumping while typing)
    if (focusedIdx !== null) {
       const isCurrentVisible = filtered.some(f => f.idx === focusedIdx);
       if (!isCurrentVisible) {
          // Construct the item even if it's no longer an 'issue' (to prevent it jumping out while typing)
          const row = rows.find(r => r.__idx === focusedIdx);
          if (row) {
            const phone = (phoneEdits[focusedIdx] ?? String(row["Phone Number"] ?? "")).trim();
            const empId = String(row["Emp ID"] ?? "").trim();
            const status = phoneStatus(phone);
            // We just need a dummy IssueItem to keep it in the list
            const item: IssueItem = { row, idx: focusedIdx, empId, name: String(row["Name"] ?? ""), phone, status, isDupPhone: false, isDupEmpId: false };
            // Sort it back into its original position or just push
            filtered = [...filtered, item].sort((a, b) => a.idx - b.idx);
          }
       }
    }
    return filtered;
  }, [issues, tab, focusedIdx, rows, phoneEdits]);

  // ── Remove all visible issues ──────────────────────────────────────────
  const handleRemoveAll = async () => {
    if (!visible.length) return;
    const msg = tab === "all" 
      ? `Remove all ${visible.length} issues?` 
      : `Remove all ${visible.length} records from this view?`;
    
    const ok = await confirm({
      title: "Bulk Remove?",
      description: msg,
      variant: "destructive"
    });
    if (!ok) return;

    setRemoved((prev) => {
      const next = new Set(prev);
      visible.forEach((item) => next.add(item.idx));
      return next;
    });
    toast.success(`Removed ${visible.length} records`);
  };

  const canProceed = !!result && !result.error && !!stats && stats.totalIssues === 0 && stats.remaining > 0;

  // ── Final submission ──────────────────────────────────────────────────────
  const handleProceed = async () => {
    if (!canProceed || !file) return;
    setSaving(true);
    try {
      const finalRows = rows
        .filter((r) => !removed.has(r.__idx))
        .map((r) => {
          const { __idx, ...rest } = r;
          if (phoneEdits[__idx] !== undefined) rest["Phone Number"] = phoneEdits[__idx];
          return rest;
        });

      const { data: uploadRes } = await api.post("/api/uploads/finalize", {
        filename: file.name,
        rows: finalRows,
      });

      const { data: campRes } = await api.post("/api/campaigns", { uploadId: uploadRes.upload.id });
      toast.success("Validated, Uploaded & Campaign Created!");
      router.push(`/campaigns/${campRes.campaign.id}/send`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to finalize upload");
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string; count: number | null }[] = stats
    ? [
        { key: "all",      label: "All Issues",       count: stats.totalIssues },
        { key: "dup_phone",label: "Duplicate Phones", count: stats.dupPhone },
        { key: "missing",  label: "Missing Phone",    count: stats.missing },
        { key: "invalid",  label: "Invalid Phone",    count: stats.invalid },
        { key: "dup_empid",label: "Duplicate Emp ID", count: stats.dupEmpId },
      ]
    : [];

  return (
    <AppLayout>
      <style>{`
        .issue-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:9999px; font-size:10px; font-weight:600; white-space:nowrap; }
        .issue-badge.missing  { background:rgba(239,68,68,0.15);  color:#f87171; border:1px solid rgba(239,68,68,0.3); }
        .issue-badge.invalid  { background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); }
        .issue-badge.dup-phone{ background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3); }
        .issue-badge.dup-empid{ background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); }
        .phone-input { background:hsl(var(--input)); border:1px solid hsl(var(--border)); border-radius:6px; padding:4px 8px; font-size:12px; color:hsl(var(--foreground)); width:150px; outline:none; transition:border-color 0.2s; }
        .phone-input:focus { border-color:hsl(var(--primary)); box-shadow:0 0 0 2px hsl(var(--primary)/0.15); }
        .phone-input.valid   { border-color:rgba(16,185,129,0.5); }
        .phone-input.invalid { border-color:rgba(239,68,68,0.5); }
        .tab-btn { padding:6px 14px; border-radius:8px; font-size:12px; font-weight:500; transition:all 0.15s; cursor:pointer; white-space:nowrap; border:1px solid transparent; }
        .tab-btn.active { background:hsl(var(--primary)/0.15); color:hsl(var(--primary)); border-color:hsl(var(--primary)/0.25); }
        .tab-btn:not(.active) { color:hsl(var(--muted-foreground)); }
        .tab-btn:not(.active):hover { background:hsl(var(--secondary)); color:hsl(var(--foreground)); }
        .stat-pill { display:flex; flex-direction:column; align-items:center; padding:12px 20px; border-radius:10px; min-width:80px; }
      `}</style>

      <Topbar title="Upload Excel" subtitle="Validate file locally then upload for campaign" />

      <div className="max-w-4xl space-y-6">
        <div className="glass-card p-6 fade-in shadow-xl">
          <h2 className="text-sm font-semibold mb-4 text-foreground">Select Excel File</h2>
          <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""} ${file ? "border-violet-500 bg-violet-500/5" : ""}`}>
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              {file ? (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-violet-400" />
                  <div className="text-center">
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); setRows([]); }}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </>
              ) : (
                <>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDragActive ? "bg-violet-500/20" : "bg-muted/50"}`}>
                    <Upload className={`w-7 h-7 ${isDragActive ? "text-violet-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">{isDragActive ? "Drop your file here" : "Drag & drop Excel file"}</p>
                    <p className="text-sm text-muted-foreground mt-1">or <span className="text-violet-400 cursor-pointer hover:underline">browse to select</span></p>
                    <p className="text-xs text-muted-foreground mt-2">Validation happens instantly in your browser</p>
                  </div>
                </>
              )}
            </div>
          </div>
          {processing && (
             <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                Parsing file locally...
             </div>
          )}
        </div>

        {result?.error && result?.validation?.isStructural && (
          <div className="glass-card p-6 fade-in border-red-500/30 bg-red-500/5">
             <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-red-400">Data Structure Error</h3>
                  <p className="text-sm text-muted-foreground">{result.error}</p>
                  <p className="text-xs text-muted-foreground">Please ensure all required columns (Emp ID, Name, Phone Number, Gross Salary) are present.</p>
                </div>
             </div>
             
             <div className="mt-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Detected Columns</h4>
                <div className="flex flex-wrap gap-2">
                  {result.columns.map((c: string) => (
                    <span key={c} className="px-2 py-1 rounded bg-muted text-[11px] text-foreground border border-border">{c}</span>
                  ))}
                </div>
             </div>
          </div>
        )}

        {result && !result.error && stats && (
          <>
            <div className="glass-card p-4 fade-in">
              <div className="flex items-center gap-2 mb-3">
                {stats.totalIssues > 0
                  ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                <span className="text-sm font-semibold text-foreground">
                  {stats.totalIssues > 0
                    ? `${stats.totalIssues} issue${stats.totalIssues !== 1 ? "s" : ""} to resolve before upload`
                    : "No issues detected — you can now finalize the upload"}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="stat-pill bg-muted/30">
                  <span className="text-xl font-bold text-foreground">{stats.total}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Total Rows</span>
                </div>
                <div className="stat-pill bg-muted/30">
                  <span className="text-xl font-bold text-emerald-400">{stats.remaining}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Remaining</span>
                </div>
                {stats.totalIssues > 0 && (
                  <div className="stat-pill bg-amber-500/10">
                    <span className="text-xl font-bold text-amber-400">{stats.totalIssues}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Total Issues</span>
                  </div>
                )}
              </div>
            </div>

            {stats.totalIssues > 0 && (
              <div className="glass-card p-0 fade-in overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-4 h-4 text-violet-400" />
                    <h2 className="text-sm font-semibold text-foreground">Fix Data Issues</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">Changes are applied immediately for validation.</p>
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-muted/10">
                  <div className="flex gap-1.5 overflow-x-auto">
                    {tabs.map((t) => (t.count! > 0 || t.key === "all") && (
                      <button key={t.key} onClick={() => setTab(t.key)} className={`tab-btn ${tab === t.key ? "active" : ""}`}>
                        {t.label} {t.count! > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-[10px]">{t.count}</span>}
                      </button>
                    ))}
                  </div>

                  {visible.length > 1 && (
                    <button 
                      type="button"
                      onClick={handleRemoveAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove All
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs data-table">
                    <thead className="bg-muted/20">
                      <tr>
                        <th className="text-left px-4 py-3 text-muted-foreground">Emp ID</th>
                        <th className="text-left px-4 py-3 text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 text-muted-foreground">Issue</th>
                        <th className="text-left px-4 py-3 text-muted-foreground">Fix Phone</th>
                        <th className="px-4 py-3 text-center text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((item) => {
                        const editVal = phoneEdits[item.idx] ?? item.phone;
                        const status = phoneStatus(editVal);
                        return (
                          <tr key={item.idx} className="border-t border-border/40 hover:bg-muted/5">
                            <td className="px-4 py-2.5 font-mono text-violet-300">{item.empId || "—"}</td>
                            <td className="px-4 py-2.5 text-foreground truncate max-w-[120px]">{item.name || "—"}</td>
                            <td className="px-4 py-2.5"><IssueBadge item={item} /></td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <input
                                  className={`phone-input ${status === "valid" ? "valid" : "invalid"}`}
                                  value={pendingPhones[item.idx] ?? editVal}
                                  onFocus={() => setFocusedIdx(item.idx)}
                                  onBlur={() => setFocusedIdx(null)}
                                  onChange={(e) => setPendingPhones((p) => ({ ...p, [item.idx]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      setPhoneEdits((p) => ({ ...p, [item.idx]: pendingPhones[item.idx] || editVal }));
                                    }
                                  }}
                                />
                                {(pendingPhones[item.idx] !== undefined && pendingPhones[item.idx] !== (phoneEdits[item.idx] ?? item.phone)) && (
                                  <button
                                    type="button"
                                    onClick={() => setPhoneEdits((p) => ({ ...p, [item.idx]: pendingPhones[item.idx] }))}
                                    className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                    title="Confirm fix"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button 
                                type="button"
                                onClick={() => setRemoved((p) => new Set([...p, item.idx]))} 
                                className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {canProceed && (
              <div className="glass-card p-6 fade-in border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Validation Complete!</p>
                    <p className="text-xs text-muted-foreground">{stats.remaining} rows ready to upload.</p>
                  </div>
                  <Button onClick={handleProceed} disabled={saving} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white">
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Finalizing Upload...</> : <>Upload & Start Campaign <ArrowRight className="w-4 h-4 ml-2" /></>}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="glass-card p-6 fade-in shadow-xl">
           <h2 className="text-base font-semibold text-foreground mb-4">Recent Uploads</h2>
           {loadingHistory ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
           ) : recentUploads.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                 <p className="text-sm text-muted-foreground">No historical uploads</p>
              </div>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-xs data-table">
                 <thead className="text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="text-left py-3 px-2">Filename</th>
                      <th className="text-left py-3 px-2">Date</th>
                      <th className="text-right py-3 px-2">Action</th>
                    </tr>
                 </thead>
                 <tbody>
                    {recentUploads.map((u) => (
                      <tr key={u.id} className="border-b border-border/30 hover:bg-muted/5 group">
                        <td className="py-3 px-2 font-medium">{u.filename}</td>
                        <td className="py-3 px-2 text-muted-foreground">{new Date(u.uploadedAt).toLocaleDateString()}</td>
                        <td className="py-3 px-2 text-right">
                          <button onClick={() => handleDeleteUpload(u.id)} className="p-2 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-500/10 rounded"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
           )}
        </div>
      </div>
    </AppLayout>
  );
}

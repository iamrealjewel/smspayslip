"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Download, ArrowLeft, RotateCcw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [filter, setFilter] = useState<"All" | "Success" | "Failed">("All");

  useEffect(() => {
    api.get(`/api/campaigns/${id}`).then((r) => setCampaign(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { data } = await api.post(`/api/sms/retry/${id}`);
      toast.success(data.message);
      const r = await api.get(`/api/campaigns/${id}`);
      setCampaign(r.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  const exportExcel = () => {
    if (!campaign) return;
    const rows = campaign.results.map((r: any) => ({
      "Emp ID": r.empId, "Phone": r.phone, "Month": r.month,
      "Gross Salary": r.grossSalary, "SMS Text": r.smsText,
      "Status": r.status, "API Response": r.apiResponse,
      "Sent At": format(new Date(r.sentAt), "dd/MM/yyyy HH:mm:ss"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, `campaign_${id}_results.xlsx`);
    toast.success("Report exported!");
  };

  const filtered = campaign?.results?.filter((r: any) => filter === "All" || r.status === filter) || [];
  const statusBadge = (s: string) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s === "COMPLETED" ? "badge-success" : s === "RUNNING" ? "badge-running" : s === "FAILED" ? "badge-failed" : "badge-pending"}`}>
      {s}
    </span>
  );

  return (
    <AppLayout>
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : !campaign ? (
        <div className="text-center py-24 text-muted-foreground">Campaign not found</div>
      ) : (
        <>
          <Topbar title={`Campaign #${id}`} subtitle={campaign.upload?.filename} />

          {/* Summary */}
          <div className="glass-card p-6 mb-6 fade-in">
            <div className="flex flex-wrap items-start gap-4 justify-between mb-4">
              <div className="flex flex-wrap gap-6">
                <div><p className="text-xs text-muted-foreground">Status</p>{statusBadge(campaign.status)}</div>
                <div><p className="text-xs text-muted-foreground">Started</p><p className="text-sm text-foreground">{format(new Date(campaign.startedAt), "dd MMM yyyy, HH:mm")}</p></div>
                <div><p className="text-xs text-muted-foreground">Completed</p><p className="text-sm text-foreground">{campaign.completedAt ? format(new Date(campaign.completedAt), "dd MMM yyyy, HH:mm") : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">By</p><p className="text-sm text-foreground">{campaign.user?.username}</p></div>
              </div>
              <div className="flex gap-2">
                {campaign.failedCount > 0 && (
                  <Button onClick={handleRetry} disabled={retrying} variant="outline" size="sm" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                    {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                    Retry Failed
                  </Button>
                )}
                <Button onClick={exportExcel} size="sm" variant="outline" className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10">
                  <Download className="w-3 h-3 mr-1" /> Export Excel
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-bold text-foreground">{campaign.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Total</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-2xl font-bold text-emerald-400">{campaign.successCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Successful</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-2xl font-bold text-red-400">{campaign.failedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Failed</p>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="glass-card p-6 fade-in-delay-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">SMS Results ({filtered.length})</h2>
              <div className="flex gap-1.5">
                {(["All", "Success", "Failed"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${filter === f ? "bg-violet-600 text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs data-table">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-3 font-medium">Emp ID</th>
                    <th className="text-left pb-3 font-medium">Phone</th>
                    <th className="text-left pb-3 font-medium">Month</th>
                    <th className="text-right pb-3 font-medium">Gross</th>
                    <th className="text-left pb-3 font-medium">Status</th>
                    <th className="text-left pb-3 font-medium">API Response</th>
                    <th className="text-left pb-3 font-medium">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2.5 font-medium text-foreground">{r.empId}</td>
                      <td className="py-2.5 text-muted-foreground">{r.phone}</td>
                      <td className="py-2.5 text-muted-foreground">{r.month}</td>
                      <td className="py-2.5 text-right text-foreground">{r.grossSalary?.toLocaleString()}</td>
                      <td className="py-2.5">
                        <span className={`flex items-center gap-1 w-fit text-xs ${r.status === "Success" ? "text-emerald-400" : "text-red-400"}`}>
                          {r.status === "Success" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted-foreground max-w-[200px] truncate">{r.apiResponse}</td>
                      <td className="py-2.5 text-muted-foreground whitespace-nowrap">{format(new Date(r.sentAt), "dd/MM, HH:mm")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No results for this filter</p>}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}

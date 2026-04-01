"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import api from "@/lib/api";
import { format } from "date-fns";
import Link from "next/link";
import { History } from "lucide-react";

export default function HistoryPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/campaigns").then((r) => setCampaigns(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const statusBadge = (s: string) => {
    const map: any = { COMPLETED: "badge-success", RUNNING: "badge-running", FAILED: "badge-failed" };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] || "badge-pending"}`}>{s}</span>;
  };

  return (
    <AppLayout>
      <Topbar title="Campaign History" subtitle="Full history of all sent campaigns" />

      <div className="glass-card p-6 fade-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-foreground">History ({campaigns.length} campaigns)</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No campaign history yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm data-table">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left pb-3 font-medium">#</th>
                  <th className="text-left pb-3 font-medium">File</th>
                  <th className="text-left pb-3 font-medium">Uploaded By</th>
                  <th className="text-left pb-3 font-medium">Started</th>
                  <th className="text-left pb-3 font-medium">Completed</th>
                  <th className="text-right pb-3 font-medium">Total</th>
                  <th className="text-right pb-3 font-medium">✓</th>
                  <th className="text-right pb-3 font-medium">✗</th>
                  <th className="text-left pb-3 font-medium pl-4">Status</th>
                  <th className="text-left pb-3 font-medium pl-4"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-3 text-muted-foreground">{c.id}</td>
                    <td className="py-3 text-foreground font-medium max-w-[160px] truncate">{c.upload?.filename}</td>
                    <td className="py-3 text-muted-foreground">{c.user?.username}</td>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">{format(new Date(c.startedAt), "dd MMM yyyy, HH:mm")}</td>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">{c.completedAt ? format(new Date(c.completedAt), "dd MMM yyyy, HH:mm") : "—"}</td>
                    <td className="py-3 text-right text-foreground">{c.total}</td>
                    <td className="py-3 text-right text-emerald-400">{c.successCount}</td>
                    <td className="py-3 text-right text-red-400">{c.failedCount}</td>
                    <td className="py-3 pl-4">{statusBadge(c.status)}</td>
                    <td className="py-3 pl-4">
                      <Link href={`/campaigns/${c.id}`} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Details →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

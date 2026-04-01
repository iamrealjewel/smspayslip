"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Send, FileSpreadsheet, Trash2, Filter, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/campaigns`, {
        params: { from: fromDate, to: toDate },
      });
      setCampaigns(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [fromDate, toDate]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this campaign? This will permanently remove all associated SMS results.")) return;
    try {
      await api.delete(`/api/campaigns/${id}`);
      toast.success("Campaign deleted");
      fetchCampaigns();
    } catch (err) {
      toast.error("Failed to delete campaign");
    }
  };

  const statusBadge = (s: string) => {
    const map: any = { COMPLETED: "badge-success", RUNNING: "badge-running", FAILED: "badge-failed" };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] || "badge-pending"}`}>{s}</span>;
  };

  return (
    <AppLayout>
      <Topbar title="Campaigns" subtitle="All SMS campaigns and their status" />

      <div className="glass-card p-6 fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
             <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-muted/50 border border-border rounded-lg pl-10 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-violet-500 outline-none w-40" 
                  placeholder="From Date"
                />
             </div>
             <span className="text-muted-foreground text-xs">to</span>
             <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-muted/50 border border-border rounded-lg pl-10 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-violet-500 outline-none w-40" 
                  placeholder="To Date"
                />
             </div>
             {(fromDate || toDate) && (
               <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setFromDate(""); setToDate(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
               >
                 Clear
               </Button>
             )}
          </div>

          <Link href="/upload">
            <Button size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-600/20">
              <Send className="w-3.5 h-3.5 mr-1.5" /> New Campaign
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No campaigns yet.</p>
            <Link href="/upload" className="text-violet-400 text-sm hover:underline mt-1 inline-block">Upload an Excel file to start →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm data-table">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left pb-3 font-medium">#</th>
                  <th className="text-left pb-3 font-medium">File</th>
                  <th className="text-left pb-3 font-medium">Sent By</th>
                  <th className="text-left pb-3 font-medium">Date</th>
                  <th className="text-right pb-3 font-medium">Total</th>
                  <th className="text-right pb-3 font-medium">✓ Success</th>
                  <th className="text-right pb-3 font-medium">✗ Failed</th>
                  <th className="text-left pb-3 font-medium pl-4">Status</th>
                  <th className="text-right pb-3 font-medium pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-3 text-muted-foreground">{c.id}</td>
                    <td className="py-3 text-foreground font-medium max-w-[160px] truncate">{c.upload?.filename}</td>
                    <td className="py-3 text-muted-foreground">{c.user?.username}</td>
                    <td className="py-3 text-muted-foreground">{format(new Date(c.startedAt), "dd MMM yyyy, HH:mm")}</td>
                    <td className="py-3 text-right text-foreground">{c.total}</td>
                    <td className="py-3 text-right text-emerald-400 font-medium">{c.successCount}</td>
                    <td className="py-3 text-right text-red-400 font-medium">{c.failedCount}</td>
                    <td className="py-3 pl-4">{statusBadge(c.status)}</td>
                    <td className="py-3 text-right pr-2">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/campaigns/${c.id}`} className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors">Details</Link>
                        <button 
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all opacity-60 hover:opacity-100"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

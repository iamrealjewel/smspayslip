"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Send, ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ProgressEvent {
  index: number;
  total: number;
  empId: string;
  phone: string;
  status: "Success" | "Failed";
  smsText: string;
  apiResponse: string;
}

export default function SendCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [feed, setFeed] = useState<ProgressEvent[]>([]);
  const [retrying, setRetrying] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("sms_token") : null;

  const scrollToBottom = () => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  };

  const startSending = () => {
    setSending(true);
    setFeed([]);
    setProgress(0);
    setDone(false);

    const evtSource = new EventSource(`/api/sms/stream/${id}?token=${token}`);

    evtSource.addEventListener("start", (e) => {
      const d = JSON.parse(e.data);
      setTotal(d.total);
      toast.info(`Starting to send ${d.total} SMS messages...`);
    });

    evtSource.addEventListener("progress", (e) => {
      const d: ProgressEvent = JSON.parse(e.data);
      setProgress(d.index);
      if (d.status === "Success") setSuccessCount((p) => p + 1);
      else setFailedCount((p) => p + 1);
      setFeed((prev) => [d, ...prev.slice(0, 199)]);
      setTimeout(scrollToBottom, 50);
    });

    evtSource.addEventListener("complete", (e) => {
      const d = JSON.parse(e.data);
      setDone(true);
      setSending(false);
      setSuccessCount(d.successCount);
      setFailedCount(d.failedCount);
      evtSource.close();
      toast.success(`Campaign complete! ${d.successCount} sent, ${d.failedCount} failed.`);
    });

    evtSource.addEventListener("error", (e) => {
      setSending(false);
      evtSource.close();
      try {
        const d = JSON.parse((e as any).data);
        toast.error(`Error: ${d.message}`);
      } catch {
        toast.error("Connection error");
      }
    });
  };

  // SSE doesn't support custom headers — pass token as query param; update backend to support it
  useEffect(() => {
    // Auto-start when page loads
    if (!startedRef.current) {
      startedRef.current = true;
      startSending();
    }
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { data } = await api.post(`/api/sms/retry/${id}`);
      toast.success(data.message);
      setFailedCount(0);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <AppLayout>
      <Topbar title="Sending SMS Campaign" subtitle={`Campaign #${id}`} />

      <div className="max-w-3xl space-y-6">
        {/* Progress card */}
        <div className="glass-card p-6 fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Progress</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${done ? "badge-success" : sending ? "badge-running" : "badge-pending"}`}>
              {done ? "Completed" : sending ? "Sending..." : "Ready"}
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-3">
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500 transition-all duration-300"
              style={{ width: `${pct}%`, boxShadow: sending ? "0 0 12px rgba(139,92,246,0.7)" : "none" }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground mb-6">
            <span>{progress} / {total} sent</span>
            <span className="font-bold text-foreground text-sm">{pct}%</span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold text-foreground">{total}</p>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-2xl font-bold text-emerald-400">{successCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Sent</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-2xl font-bold text-red-400">{failedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Failed</p>
            </div>
          </div>

          {/* Actions */}
          {done && (
            <div className="flex gap-3 mt-5">
              {failedCount > 0 && (
                <Button
                  onClick={handleRetry}
                  disabled={retrying}
                  variant="outline"
                  className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                >
                  {retrying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Retrying...</> : <><RotateCcw className="w-4 h-4 mr-2" />Retry Failed ({failedCount})</>}
                </Button>
              )}
              <Button onClick={() => router.push(`/campaigns/${id}`)} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                View Full Report
              </Button>
            </div>
          )}
        </div>

        {/* Live Feed */}
        <div className="glass-card p-6 fade-in-delay-1">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Live Feed
            {sending && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 ml-2 animate-pulse" />}
          </h2>
          <div ref={feedRef} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {feed.length === 0 && !sending && (
              <p className="text-sm text-muted-foreground text-center py-8">Feed will appear here as SMS are sent...</p>
            )}
            {feed.map((item, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-xs row-flash ${item.status === "Success" ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                {item.status === "Success"
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">EmpID: {item.empId}</span>
                    <span className="text-muted-foreground">{item.phone}</span>
                    <span className={`ml-auto text-xs font-medium ${item.status === "Success" ? "text-emerald-400" : "text-red-400"}`}>{item.status}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate">{item.smsText}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

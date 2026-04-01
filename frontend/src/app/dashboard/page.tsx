"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import api from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { MessageSquare, CheckCircle2, XCircle, Send, Users, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";

interface Stats {
  totalSMS: number;
  successSMS: number;
  failedSMS: number;
  successRate: number;
  totalCampaigns: number;
  activeUsers: number;
  monthlyCounts: { month: string; total: number; success: number; failed: number }[];
}

const COLORS = ["hsl(168,84%,48%)", "hsl(0,84%,60%)"];

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="stat-card fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-bold text-foreground">{value?.toLocaleString()}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/settings/stats"),
      api.get("/api/campaigns"),
    ]).then(([statsRes, campRes]) => {
      setStats(statsRes.data);
      setCampaigns(campRes.data.slice(0, 5));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pieData = stats ? [
    { name: "Success", value: stats.successSMS },
    { name: "Failed",  value: stats.failedSMS },
  ] : [];

  const statusBadge = (s: string) => {
    const map: any = { COMPLETED: "badge-success", RUNNING: "badge-running", FAILED: "badge-failed" };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] || "badge-pending"}`}>{s}</span>;
  };

  return (
    <AppLayout>
      <Topbar title="Dashboard" subtitle="Overview of SMS campaigns and delivery stats" />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={MessageSquare} label="Total SMS Sent"    value={stats?.totalSMS}       sub="All time"             color="bg-violet-500/15 text-violet-400" />
            <StatCard icon={CheckCircle2} label="Successful"        value={stats?.successSMS}      sub={`${stats?.successRate}% success rate`} color="bg-emerald-500/15 text-emerald-400" />
            <StatCard icon={XCircle}      label="Failed"            value={stats?.failedSMS}       sub="Across all campaigns" color="bg-red-500/15 text-red-400" />
            <StatCard icon={Send}         label="Total Campaigns"   value={stats?.totalCampaigns}  sub={`${stats?.activeUsers} active users`}  color="bg-blue-500/15 text-blue-400" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Bar chart */}
            <div className="glass-card p-6 lg:col-span-2 fade-in-delay-1">
              <h2 className="text-sm font-semibold text-foreground mb-4">SMS Sent — Last 12 Months</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats?.monthlyCounts || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="success" name="Success" fill="hsl(168,84%,48%)" radius={[4,4,0,0]} />
                  <Bar dataKey="failed"  name="Failed"  fill="hsl(0,84%,60%)"   radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart */}
            <div className="glass-card p-6 fade-in-delay-2">
              <h2 className="text-sm font-semibold text-foreground mb-4">Delivery Rate</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center mt-2">
                <span className="text-3xl font-bold gradient-text">{stats?.successRate}%</span>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </div>

          {/* Recent Campaigns */}
          <div className="glass-card p-6 fade-in-delay-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Recent Campaigns</h2>
              <Link href="/history" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">View all →</Link>
            </div>
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No campaigns yet. <Link href="/upload" className="text-violet-400 hover:underline">Upload an Excel</Link> to get started.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm data-table">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left pb-3 font-medium">File</th>
                      <th className="text-left pb-3 font-medium">By</th>
                      <th className="text-left pb-3 font-medium">Date</th>
                      <th className="text-right pb-3 font-medium">Total</th>
                      <th className="text-right pb-3 font-medium">✓</th>
                      <th className="text-right pb-3 font-medium">✗</th>
                      <th className="text-left pb-3 font-medium pl-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="py-3 text-foreground font-medium truncate max-w-[140px]">
                          <Link href={`/campaigns/${c.id}`} className="hover:text-violet-400 transition-colors">{c.upload?.filename || "—"}</Link>
                        </td>
                        <td className="py-3 text-muted-foreground">{c.user?.username}</td>
                        <td className="py-3 text-muted-foreground">{format(new Date(c.startedAt), "dd MMM, HH:mm")}</td>
                        <td className="py-3 text-right text-foreground">{c.total}</td>
                        <td className="py-3 text-right text-emerald-400">{c.successCount}</td>
                        <td className="py-3 text-right text-red-400">{c.failedCount}</td>
                        <td className="py-3 pl-4">{statusBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}

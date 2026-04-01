"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Send, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState({ api_token: "", sid: "", api_endpoint: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; response: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) { router.replace("/dashboard"); return; }
    api.get("/api/settings").then((r) => setSettings(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/api/settings", settings);
      toast.success("Settings saved successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSms = async () => {
    if (!testPhone) return toast.error("Enter a phone number");
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post("/api/settings/test-sms", { phone: testPhone });
      setTestResult(data);
      if (data.httpStatus === 200) toast.success("Test SMS sent!");
      else toast.error(`API returned ${data.httpStatus}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <AppLayout>
      <Topbar title="Settings" subtitle="Configure SMS API and system preferences" />

      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* SMS API Config */}
          <div className="glass-card p-6 fade-in">
            <h2 className="text-sm font-semibold text-foreground mb-5">SMS API Configuration</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>API Token</Label>
                <Input
                  value={settings.api_token}
                  onChange={(e) => setSettings({ ...settings, api_token: e.target.value })}
                  placeholder="Your SSLWireless API token"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sender ID (SID)</Label>
                <Input
                  value={settings.sid}
                  onChange={(e) => setSettings({ ...settings, sid: e.target.value })}
                  placeholder="e.g. ISPAHANIAPI"
                />
              </div>
              <div className="space-y-1.5">
                <Label>API Endpoint URL</Label>
                <Input
                  value={settings.api_endpoint}
                  onChange={(e) => setSettings({ ...settings, api_endpoint: e.target.value })}
                  placeholder="https://smsplus.sslwireless.com/api/v3/send-sms"
                  className="font-mono text-sm"
                />
              </div>
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Settings</>}
              </Button>
            </div>
          </div>

          {/* Test SMS */}
          <div className="glass-card p-6 fade-in-delay-1">
            <h2 className="text-sm font-semibold text-foreground mb-5">Test SMS</h2>
            <p className="text-xs text-muted-foreground mb-4">Send a test message to verify your API configuration is working.</p>
            <div className="flex gap-3">
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="8801XXXXXXXXX"
                className="flex-1"
              />
              <Button onClick={handleTestSms} disabled={testing} variant="outline" className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10">
                {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-2" />Send Test</>}
              </Button>
            </div>

            {testResult && (
              <div className={`mt-4 p-3 rounded-lg border text-xs ${testResult.status === 200 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {testResult.status === 200
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="font-medium text-foreground">HTTP {testResult.status}</span>
                </div>
                <p className="text-muted-foreground font-mono break-all">{testResult.response}</p>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="glass-card p-6 fade-in-delay-2">
            <h2 className="text-sm font-semibold text-foreground mb-3">System Info</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">API Provider</span>
                <span className="text-foreground">SSLWireless Push SMS API v3</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Supported Formats</span>
                <span className="text-foreground">.xlsx, .xls</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Max Upload Size</span>
                <span className="text-foreground">20 MB</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

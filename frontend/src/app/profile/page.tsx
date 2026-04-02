"use client";
import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, User as UserIcon, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      return toast.error("New passwords do not match");
    }
    if (formData.newPassword.length < 6) {
      return toast.error("New password must be at least 6 characters");
    }

    setLoading(true);
    try {
      await api.put("/api/auth/change-password", {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      toast.success("Password updated successfully");
      setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <Topbar title="My Profile" subtitle="Manage your account and security settings" />

      <div className="max-w-2xl space-y-6">
        {/* User Info Card */}
        <div className="glass-card p-6 fade-in shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <UserIcon className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-3xl font-bold shadow-2xl">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{user?.username}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-xs font-semibold border border-violet-500/20 uppercase tracking-wider">
                  {user?.role}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                   <ShieldCheck className="w-3 h-3" /> System Access Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="glass-card p-0 fade-in shadow-xl overflow-hidden border-border/50">
          <div className="px-6 py-5 border-b border-border/50 flex items-center gap-3 bg-muted/10">
            <KeyRound className="w-5 h-5 text-violet-400" />
            <h3 className="font-semibold text-foreground">Security Settings</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border/50 flex justify-end">
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-600/20 px-8"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </div>
          </form>
        </div>

        <div className="p-4 px-6 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3 items-start fade-in">
           <ShieldCheck className="w-5 h-5 text-amber-500/60 shrink-0 mt-0.5" />
           <p className="text-xs text-amber-500/80 leading-relaxed">
             <strong>Security Tip:</strong> Ensure your new password is at least 8 characters long and includes a mix of letters, numbers, and symbols for maximum security.
           </p>
        </div>
      </div>
    </AppLayout>
  );
}

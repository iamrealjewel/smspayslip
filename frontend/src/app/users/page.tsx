"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Pencil, UserX, Loader2, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ username: "", password: "", role: "HR" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) { router.replace("/dashboard"); return; }
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = () => {
    api.get("/api/users").then((r) => setUsers(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  const openNew = () => { setEditing(null); setForm({ username: "", password: "", role: "HR" }); setDialogOpen(true); };
  const openEdit = (u: any) => { setEditing(u); setForm({ username: u.username, password: "", role: u.role }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing && (!form.username || !form.password)) return toast.error("Username and password required");
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/users/${editing.id}`, { password: form.password || undefined, role: form.role });
        toast.success("User updated");
      } else {
        await api.post("/api/users", form);
        toast.success("User created");
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: any) => {
    try {
      await api.put(`/api/users/${u.id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? "User deactivated" : "User activated");
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  };

  return (
    <AppLayout>
      <Topbar title="User Management" subtitle="Manage Admin and HR accounts" />

      <div className="glass-card p-6 fade-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-foreground">Users ({users.length})</h2>
          <Button onClick={openNew} size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add User
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm data-table">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left pb-3 font-medium">#</th>
                  <th className="text-left pb-3 font-medium">Username</th>
                  <th className="text-left pb-3 font-medium">Role</th>
                  <th className="text-left pb-3 font-medium">Status</th>
                  <th className="text-left pb-3 font-medium">Created</th>
                  <th className="text-left pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="py-3 text-muted-foreground">{u.id}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
                          {u.username[0].toUpperCase()}
                        </div>
                        <span className="text-foreground font-medium">{u.username}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`flex items-center gap-1 w-fit text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "ADMIN" ? "badge-running" : "badge-pending"}`}>
                        {u.role === "ADMIN" ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />} {u.role}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? "badge-success" : "badge-failed"}`}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">{format(new Date(u.createdAt), "dd MMM yyyy")}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(u)} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => toggleActive(u)} className={`text-xs flex items-center gap-1 transition-colors ${u.isActive ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"}`}>
                          <UserX className="w-3 h-3" /> {u.isActive ? "Deactivate" : "Activate"}
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Password {editing && "(leave blank to keep current)"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v ?? "HR" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? "Save Changes" : "Create User")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

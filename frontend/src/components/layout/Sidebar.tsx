"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Upload, Send, History,
  Users, Settings, LogOut, MessageSquare, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload",    label: "Upload Excel", icon: Upload },
  { href: "/campaigns", label: "Campaigns",   icon: Send },
  { href: "/history",   label: "History",     icon: History },
];

const adminItems = [
  { href: "/users",    label: "Users",    icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-[hsl(var(--sidebar-border))]">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center shadow-lg">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-foreground leading-none">SMS Payslip</p>
          <p className="text-xs text-muted-foreground mt-0.5">Notification Manager</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 mb-2">Main</p>
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn("sidebar-nav-item", pathname.startsWith(href) && "active")}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
            {pathname.startsWith(href) && <ChevronRight className="w-3 h-3 ml-auto" />}
          </Link>
        ))}

        {isAdmin && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 mt-6 mb-2">Admin</p>
            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn("sidebar-nav-item", pathname.startsWith(href) && "active")}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
                {pathname.startsWith(href) && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

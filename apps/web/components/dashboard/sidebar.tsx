"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  MessageSquare,
  Activity,
  FlaskConical,
  Wrench,
  Webhook,
  CreditCard,
  Settings,
  ChevronDown,
  Building2,
  LogOut,
  Plus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/hooks/use-api";
import { toast } from "sonner";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const workspaceNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/dashboard/agents", icon: Bot },
  { label: "Knowledge Base", href: "/dashboard/knowledge", icon: BookOpen },
  { label: "Conversations", href: "/dashboard/sessions", icon: MessageSquare },
  { label: "Monitoring", href: "/dashboard/monitoring", icon: Activity },
];

const devNav: NavItem[] = [
  { label: "Evaluations", href: "/dashboard/evaluations", icon: FlaskConical },
  { label: "Tools & Integrations", href: "/dashboard/tools", icon: Wrench },
  { label: "API & Webhooks", href: "/dashboard/api", icon: Webhook },
];

const settingsNav: NavItem[] = [
  { label: "Usage & Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Workspace Settings", href: "/dashboard/settings", icon: Settings },
];

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="mb-6">
      <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
        {title}
      </p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const router = useRouter();
  const { org } = useOrganization();
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
    initials: string;
  }>({
    name: "User",
    email: "",
    initials: "U",
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const rawName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";
        const cleanName =
          rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const initials = cleanName
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "U";
        setUserProfile({
          name: cleanName,
          email: user.email || "",
          initials,
        });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const rawName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email?.split("@")[0] ||
          "User";
        const cleanName =
          rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const initials = cleanName
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "U";
        setUserProfile({
          name: cleanName,
          email: session.user.email || "",
          initials,
        });
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      router.push("/auth/login");
    } catch {
      router.push("/auth/login");
    }
  }

  const workspaceName = (org?.name as string) || "My Workspace";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-bold text-white tracking-tight">VoiceDesk</span>
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 mb-5">
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <Building2 className="h-4 w-4 text-sidebar-muted shrink-0" />
          <span className="flex-1 text-left truncate font-medium">{workspaceName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-sidebar-muted shrink-0" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2">
        <NavSection title="Workspace" items={workspaceNav} />
        <NavSection title="Development" items={devNav} />
        <NavSection title="Settings" items={settingsNav} />
      </div>

      {/* Create Agent CTA */}
      <div className="px-3 py-2">
        <Link href="/dashboard/agents/new">
          <Button className="w-full gap-2 bg-sidebar-primary hover:bg-sidebar-primary/90 text-white" size="sm">
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Dynamic Logged-in User */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-semibold">
            {userProfile.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-foreground truncate" title={userProfile.name}>
            {userProfile.name}
          </p>
          <p className="text-xs text-sidebar-muted truncate" title={userProfile.email}>
            {userProfile.email || "Workspace Member"}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="text-sidebar-muted hover:text-red-400 transition-colors p-1 rounded-md"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

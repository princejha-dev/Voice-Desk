"use client";

import { Sidebar } from "@/components/dashboard/sidebar";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main content area */}
      <div className="pl-[260px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents, conversations, docs..."
              className="border-0 shadow-none bg-transparent focus-visible:ring-0 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}


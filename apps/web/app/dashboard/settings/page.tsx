"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  Bell,
  Shield,
  Save,
  AlertTriangle,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { useOrganization, useAuthToken } from "@/hooks/use-api";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function SettingsPage() {
  const { org, orgId, loading } = useOrganization();
  const token = useAuthToken();

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: string;
    joined: string;
  }>({
    name: "User",
    email: "",
    role: "owner",
    joined: "Recently",
  });

  useEffect(() => {
    if (org) {
      setOrgName((org.name as string) || "");
      setOrgSlug((org.slug as string) || (org.id as string)?.slice(0, 8) || "workspace");
    }
  }, [org]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const rawName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";
        const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const joinedDate = user.created_at
          ? new Date(user.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Recently";
        setCurrentUser({
          name: cleanName,
          email: user.email || "",
          role: "owner",
          joined: joinedDate,
        });
      }
    });
  }, []);

  async function handleSaveGeneral() {
    if (!orgId || !token) return;
    setSaving(true);
    try {
      await api(`/api/v1/organizations/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
        token,
      });
      toast.success("Workspace details updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update workspace");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your organization, team, and account preferences
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Team
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization Details</CardTitle>
              <CardDescription>Update your workspace display name and unique identifier.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 text-2xl font-bold">
                  {orgName ? orgName.charAt(0).toUpperCase() : "W"}
                </div>
                <div>
                  <p className="text-sm font-semibold">{orgName || "My Workspace"}</p>
                  <p className="text-xs text-muted-foreground font-mono">Org ID: {orgId}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Workspace Slug</Label>
                  <Input
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  />
                </div>
              </div>
              <Button onClick={handleSaveGeneral} disabled={saving} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-red-200/50 bg-red-50/10">
            <CardHeader>
              <CardTitle className="text-base text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete workspace</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete this workspace and all associated agents, documents, and call records.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => toast.error("Primary workspace cannot be deleted")}
                >
                  Delete Workspace
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Workspace Members</CardTitle>
                <CardDescription>Members who have access to this VoiceDesk organization.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => toast.info("Team invites will be available in the next release.")}>
                Invite Member
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border p-4 bg-muted/20">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm font-semibold">
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{currentUser.name}</p>
                    <Badge variant="success" className="text-[10px]">
                      {currentUser.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Joined {currentUser.joined}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Preferences</CardTitle>
              <CardDescription>Control alerts for call events and errors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Session Completed", desc: "Send an alert when a voice call terminates successfully", enabled: false },
                { label: "Call Failure Alert", desc: "Immediate notification if an agent call fails or drops", enabled: true },
                { label: "Agent Published", desc: "Notification whenever a new agent version is published", enabled: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch defaultChecked={item.enabled} onCheckedChange={() => toast.success("Preference saved")} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security & Authentication</CardTitle>
              <CardDescription>Manage your authentication settings and API access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Authentication Provider</p>
                  <p className="text-xs text-muted-foreground">Connected via Supabase Auth</p>
                </div>
                <Badge variant="outline">Email & Password</Badge>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Workspace ID</Label>
                <div className="flex gap-2">
                  <Input readOnly value={orgId || ""} className="bg-muted font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (orgId) {
                        navigator.clipboard.writeText(orgId);
                        toast.success("Workspace ID copied");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create auth user
      let userId = "";
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (authError) {
        // If already registered, attempt to log in with the credentials
        if (authError.message.toLowerCase().includes("already registered") || authError.message.toLowerCase().includes("already exists")) {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
          if (loginError) throw loginError;
          userId = loginData.user.id;
        } else {
          throw authError;
        }
      } else {
        userId = authData.user?.id || "";
        if (!authData.session) {
          const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
          if (loginData?.user) userId = loginData.user.id;
        }
      }

      // 2. Create organization (if not already member of one)
      const slug = slugify(companyName || "My Org") + "-" + Math.random().toString(36).slice(2, 6);
      const { data: org } = await supabase
        .from("organizations")
        .insert({ name: companyName || "My Org", slug })
        .select()
        .maybeSingle();

      if (org && userId) {
        // 3. Add as owner
        await supabase
          .from("organization_members")
          .insert({
            organization_id: org.id,
            user_id: userId,
            role: "owner",
          });
      }

      toast.success("Account created! Welcome to VoiceDesk.");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[420px] shadow-lg border-0">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 mb-3">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Set up your AI voice agent in minutes</CardDescription>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company Name</Label>
            <Input
              id="company"
              placeholder="Acme Clinic"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Account
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}


"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CallChart } from "@/components/dashboard/call-chart";
import {
  DollarSign, Phone, Clock, TrendingUp, CreditCard,
  Zap, ArrowUpRight, ChevronRight,
} from "lucide-react";

const usageByAgent = [
  { agent: "Sarah — Support", calls: 842, minutes: 142, cost: 28.40 },
  { agent: "Alex — Booking", calls: 312, minutes: 51, cost: 10.20 },
  { agent: "Maya — Sales", calls: 0, minutes: 0, cost: 0 },
];

const usageData = [
  { date: "Nov 1", calls: 32 },
  { date: "Nov 5", calls: 48 },
  { date: "Nov 8", calls: 61 },
  { date: "Nov 11", calls: 55 },
];

const plans = [
  { id: "free", name: "Free", price: 0, calls: 100, included: ["1 agent", "100 calls/mo", "5 docs", "Community support"] },
  { id: "starter", name: "Starter", price: 29, calls: 500, included: ["3 agents", "500 calls/mo", "Unlimited docs", "Email support", "Evaluations"] },
  { id: "pro", name: "Pro", price: 99, calls: 2000, included: ["Unlimited agents", "2,000 calls/mo", "Priority support", "API access", "Custom tools", "Analytics"] },
];

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usage & Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track your usage and manage your subscription
        </p>
      </div>

      {/* Current plan */}
      <Card className="border-indigo-200 bg-indigo-50/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                <Zap className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg">Free Plan</h2>
                  <Badge variant="info">Current</Badge>
                </div>
                <p className="text-sm text-muted-foreground">54 of 100 calls used this month</p>
              </div>
            </div>
            <Button className="gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Upgrade Plan
            </Button>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Call usage</span>
              <span>54 / 100</span>
            </div>
            <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: "54%" }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Calls This Month" value={1154} change={12} changeLabel="vs last month" icon={Phone} iconColor="text-indigo-600" />
        <StatsCard title="Minutes Used" value={193} subtitle="this month" icon={Clock} iconColor="text-violet-600" />
        <StatsCard title="Est. Cost" value="$42.80" change={-5} changeLabel="vs last month" icon={DollarSign} iconColor="text-emerald-600" />
        <StatsCard title="Cost per Minute" value="$0.08" subtitle="avg. per minute" icon={TrendingUp} iconColor="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage chart */}
        <CallChart data={usageData} title="Call Volume — November 2026" />

        {/* Per-agent breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usage by Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {usageByAgent.map((agent) => (
              <div key={agent.agent} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{agent.agent}</p>
                  <p className="text-xs text-muted-foreground">
                    {agent.calls} calls · {agent.minutes} min
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">${agent.cost.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">this month</p>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between px-3">
              <span className="font-semibold text-sm">Total</span>
              <span className="font-bold">$38.60</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan comparison */}
      <div>
        <h2 className="font-semibold text-lg mb-4">Upgrade your plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={plan.id === "starter" ? "border-primary shadow-md relative" : ""}
            >
              {plan.id === "starter" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most popular</Badge>
                </div>
              )}
              <CardContent className="p-6">
                <div className="mb-4">
                  <p className="font-bold text-lg">{plan.name}</p>
                  <div className="mt-1">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.included.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.id === "free" ? "outline" : "default"}
                  className="w-full"
                  disabled={plan.id === "free"}
                  onClick={() => {}}
                >
                  {plan.id === "free" ? "Current plan" : `Upgrade to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}


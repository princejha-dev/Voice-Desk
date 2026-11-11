import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Mic,
  BarChart3,
  FlaskConical,
  ArrowRight,
  Phone,
  Shield,
  Zap,
  BookOpen,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="border-b border-gray-100">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">VoiceDesk</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5">
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm text-indigo-700">
            <Zap className="h-3.5 w-3.5" />
            Now in public beta
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 leading-[1.1] mb-6">
            Set up a 24/7 AI
            <br />
            <span className="text-indigo-600">receptionist</span> in 10 minutes
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-xl mx-auto">
            Create intelligent voice agents that answer calls, book appointments,
            and support your customers — powered by your own knowledge base.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="gap-2 text-base h-12 px-8 rounded-xl">
                Start Building Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="text-base h-12 px-8 rounded-xl">
                See How It Works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-gray-100 bg-gray-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-4">
              Everything you need to deploy voice AI
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto">
              From agent configuration to performance monitoring — one platform
              for your entire voice AI workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Bot,
                title: "Agent Builder",
                description: "Configure personality, voice, and tools. Choose from templates or build custom.",
                color: "bg-indigo-50 text-indigo-600",
              },
              {
                icon: BookOpen,
                title: "Knowledge Base",
                description: "Upload PDFs and documents. Your agent answers from your content only.",
                color: "bg-violet-50 text-violet-600",
              },
              {
                icon: BarChart3,
                title: "Live Monitoring",
                description: "Track calls, latency, costs, and success rates in real time.",
                color: "bg-emerald-50 text-emerald-600",
              },
              {
                icon: FlaskConical,
                title: "Evaluations",
                description: "Automated tests for accuracy, tool use, guardrails, and data isolation.",
                color: "bg-amber-50 text-amber-600",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.color} mb-4`}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-4">
              Live in 10 minutes
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto">
              No code required. Pick a template, upload your docs, and deploy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Choose a template",
                description: "Start with customer support, appointment booking, or sales — pre-configured with sensible defaults.",
              },
              {
                step: "02",
                title: "Add your knowledge",
                description: "Upload PDFs or paste FAQs. Your agent learns your business and answers accurately.",
              },
              {
                step: "03",
                title: "Deploy and monitor",
                description: "Get a shareable link or embed widget. Watch conversations and track performance.",
              },
            ].map((step) => (
              <div key={step.step} className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 font-bold text-lg mb-4">
                  {step.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / stats */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "<1.5s", label: "Avg. response time" },
              { value: "99.9%", label: "Uptime SLA" },
              { value: "$0.08", label: "Per call minute" },
              { value: "100%", label: "Data isolation" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-4">
            Ready to automate your calls?
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Start free. No credit card required. Set up your first AI voice agent today.
          </p>
          <Link href="/signup">
            <Button size="lg" className="gap-2 text-base h-12 px-8 rounded-xl">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600">
              <Bot className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold">VoiceDesk</span>
          </div>
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} VoiceDesk. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}


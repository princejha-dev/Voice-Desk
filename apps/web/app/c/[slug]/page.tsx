"use client";

import { useState, useEffect, useMemo, use } from "react";
import {
  RoomAudioRenderer,
  useAgent,
  BarVisualizer,
  SessionProvider,
  useSession,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { TokenSource } from "livekit-client";
import { Bot, Mic, MicOff, PhoneOff, Phone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function CallUI({ onDisconnect }: { onDisconnect: () => void }) {
  const agent = useAgent();
  const [muted, setMuted] = useState(false);

  const stateColors: Record<string, string> = {
    connecting: "text-amber-400",
    "pre-connect-buffering": "text-amber-400",
    initializing: "text-amber-400",
    idle: "text-gray-400",
    listening: "text-emerald-400",
    thinking: "text-indigo-400",
    speaking: "text-indigo-300",
    disconnected: "text-gray-500",
    failed: "text-red-400",
  };

  const stateLabels: Record<string, string> = {
    connecting: "Connecting...",
    "pre-connect-buffering": "Preparing...",
    initializing: "Initializing...",
    idle: "Ready",
    listening: "Listening",
    thinking: "Thinking...",
    speaking: "Speaking",
    disconnected: "Disconnected",
    failed: "Connection failed",
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Visualizer ring */}
      <div className="relative flex h-40 w-40 items-center justify-center">
        {/* Pulsing ring */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2 transition-all",
            agent.state === "speaking"
              ? "border-indigo-500 animate-ping opacity-30"
              : "border-gray-700"
          )}
        />
        <div className="absolute inset-2 rounded-full bg-gray-800 flex items-center justify-center">
          {agent.microphoneTrack ? (
            <BarVisualizer
              track={agent.microphoneTrack}
              state={agent.state}
              barCount={5}
            />
          ) : (
            <Bot className="h-14 w-14 text-indigo-400" />
          )}
        </div>
      </div>

      {/* Agent state */}
      <div className="text-center space-y-1">
        <p className={cn("text-lg font-semibold", stateColors[agent.state] || "text-white")}>
          {stateLabels[agent.state] || agent.state}
        </p>
        <p className="text-sm text-gray-500">
          {agent.state === "speaking" ? "Agent is speaking..." : "Listening to you..."}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMuted(!muted)}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all",
            muted
              ? "border-red-500 bg-red-900/30 text-red-400"
              : "border-gray-600 bg-gray-800 text-white hover:border-gray-500 hover:bg-gray-700"
          )}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <button
          onClick={onDisconnect}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-900/40"
          title="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function WaitingRoom({
  agent,
  onStart,
  loading,
}: {
  agent: { name: string; greeting: string };
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-8">
      {/* Agent avatar */}
      <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gray-800 ring-2 ring-gray-700">
        <Bot className="h-16 w-16 text-indigo-400" />
        <span className="absolute bottom-2 right-2 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-gray-900" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
        <p className="text-gray-400 max-w-xs">{agent.greeting}</p>
      </div>

      {/* Features */}
      <div className="flex flex-wrap justify-center gap-3">
        {["Instant answers", "24/7 available", "Voice AI"].map((tag) => (
          <span key={tag} className="rounded-full bg-gray-800 border border-gray-700 px-3 py-1 text-sm text-gray-300">
            {tag}
          </span>
        ))}
      </div>

      <button
        onClick={onStart}
        disabled={loading}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-900/40 disabled:opacity-70"
      >
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Phone className="h-7 w-7" />
        )}
      </button>
      <p className="text-xs text-gray-600">Tap to start voice conversation</p>
    </div>
  );
}

function ActiveCall({ token, livekitUrl, onDisconnect }: {
  token: string;
  livekitUrl: string;
  onDisconnect: () => void;
}) {
  const tokenSource = useMemo(
    () => TokenSource.literal({ serverUrl: livekitUrl, participantToken: token }),
    [token, livekitUrl]
  );
  const session = useSession(tokenSource);

  useEffect(() => {
    session.start();
    return () => {
      session.end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SessionProvider session={session}>
      <CallUI onDisconnect={onDisconnect} />
      <RoomAudioRenderer />
    </SessionProvider>
  );
}

export default function PublicCallPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [agent, setAgent] = useState({
    name: "Voice Agent",
    greeting: "Your 24/7 AI assistant is ready to help",
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!slug) return;
    fetch(`${apiUrl}/api/v1/public/c/${slug}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setAgent({
          name: data.name || "Voice Agent",
          greeting: data.greeting || "Your 24/7 AI assistant is ready to help",
        });
      })
      .catch((err) => console.warn("Failed to fetch public agent info", err));
  }, [slug, apiUrl]);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/public/c/${slug}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_name: "Customer" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Failed to start call");
      }
      const data = await res.json();
      setToken(data.token);
      setLivekitUrl(data.livekit_url);
      setConnected(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to connect to agent");
    } finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    setConnected(false);
    setToken(null);
    setLivekitUrl(null);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-white">{agent.name}</span>
        </div>
        <span className="text-xs text-gray-500 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Powered by VoiceDesk
        </span>
      </header>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {connected && token && livekitUrl ? (
            <ActiveCall
              token={token}
              livekitUrl={livekitUrl}
              onDisconnect={handleDisconnect}
            />
          ) : (
            <WaitingRoom agent={agent} onStart={handleStart} loading={loading} />
          )}
        </div>
      </main>

      {/* Bottom note */}
      <footer className="py-4 text-center">
        <p className="text-xs text-gray-700">
          Your conversation is private and encrypted.
        </p>
      </footer>
    </div>
  );
}

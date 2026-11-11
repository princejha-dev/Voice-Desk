"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ControlBar,
  RoomAudioRenderer,
  useSession,
  SessionProvider,
  useAgent,
  BarVisualizer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { TokenSource } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceWidgetProps {
  /** LiveKit server URL */
  livekitUrl: string;
  /** Connection token from our API */
  token: string;
  /** Called when the user ends the call */
  onDisconnect?: () => void;
  /** Compact mode for embedded test widget */
  compact?: boolean;
  className?: string;
}

export function VoiceWidget({
  livekitUrl,
  token,
  onDisconnect,
  compact = false,
  className,
}: VoiceWidgetProps) {
  const tokenSource = useCallback(() => {
    return TokenSource.fromString(token, livekitUrl);
  }, [token, livekitUrl]);

  const session = useSession(tokenSource);

  useEffect(() => {
    session.start();
    return () => {
      session.end();
    };
  }, [session]);

  return (
    <SessionProvider session={session}>
      <div
        data-lk-theme="default"
        className={cn(
          "flex flex-col items-center justify-center rounded-xl bg-gray-950 text-white",
          compact ? "p-6" : "p-10",
          className
        )}
      >
        <AgentView compact={compact} onDisconnect={onDisconnect} />
        <RoomAudioRenderer />
      </div>
    </SessionProvider>
  );
}

function AgentView({
  compact,
  onDisconnect,
}: {
  compact: boolean;
  onDisconnect?: () => void;
}) {
  const agent = useAgent();
  const [muted, setMuted] = useState(false);

  const stateLabel: Record<string, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    initializing: "Initializing...",
    listening: "Listening",
    thinking: "Thinking...",
    speaking: "Speaking",
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Visualizer */}
      <div className={cn("w-full", compact ? "h-[120px]" : "h-[180px]")}>
        {agent.microphoneTrack ? (
          <BarVisualizer
            track={agent.microphoneTrack}
            state={agent.state}
            barCount={5}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex gap-1.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 rounded-full bg-indigo-500/30"
                  style={{ height: `${20 + Math.random() * 40}px` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* State label */}
      <p className="text-sm text-gray-400 font-medium">
        {stateLabel[agent.state] || agent.state}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "h-12 w-12 rounded-full border-gray-700 bg-gray-800 hover:bg-gray-700",
            muted && "bg-red-900/30 border-red-700 hover:bg-red-900/50"
          )}
          onClick={() => setMuted(!muted)}
        >
          {muted ? (
            <MicOff className="h-5 w-5 text-red-400" />
          ) : (
            <Mic className="h-5 w-5 text-white" />
          )}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={onDisconnect}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Simplified pre-connect state — shows a "Start Call" button
 * before the user has connected to a LiveKit room.
 */
interface VoiceCallButtonProps {
  onStart: () => void;
  loading?: boolean;
  agentName?: string;
  className?: string;
}

export function VoiceCallButton({
  onStart,
  loading = false,
  agentName,
  className,
}: VoiceCallButtonProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 rounded-xl bg-gray-950 p-10 text-white",
        className
      )}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600/20 ring-2 ring-indigo-500/30">
        <Phone className="h-8 w-8 text-indigo-400" />
      </div>
      {agentName && (
        <p className="text-lg font-semibold text-white">{agentName}</p>
      )}
      <p className="text-sm text-gray-400 text-center max-w-xs">
        Click below to start a voice conversation with the AI agent.
      </p>
      <Button
        size="lg"
        className="gap-2 rounded-full px-8 bg-indigo-600 hover:bg-indigo-700"
        onClick={onStart}
        disabled={loading}
      >
        {loading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Phone className="h-4 w-4" />
        )}
        Start Call
      </Button>
    </div>
  );
}


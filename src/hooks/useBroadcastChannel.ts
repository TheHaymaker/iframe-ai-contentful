import { useEffect, useRef, useCallback } from "react";
import type { HubMessage } from "../types";

interface UseBroadcastChannelOptions {
  /** Channel name (e.g. "cms-hub") */
  channelName: string;
  /** Handler called for every incoming message */
  onMessage: (msg: HubMessage) => void;
  /** If false, the channel is not opened (useful for conditional usage) */
  enabled?: boolean;
}

/**
 * React hook that wraps the BroadcastChannel lifecycle.
 *
 * - Opens the channel on mount (or when enabled becomes true)
 * - Subscribes to incoming messages and forwards them to `onMessage`
 * - Returns a `postMessage` function to send messages
 * - Closes the channel on unmount or when disabled
 */
export function useBroadcastChannel({
  channelName,
  onMessage,
  enabled = true,
}: UseBroadcastChannelOptions) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<HubMessage>) => {
      onMessageRef.current(event.data);
    };

    // Clean up on beforeunload (page close/navigation)
    const handleUnload = () => {
      channel.close();
      channelRef.current = null;
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      channel.close();
      channelRef.current = null;
    };
  }, [channelName, enabled]);

  const postMessage = useCallback((msg: HubMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

  return { postMessage };
}

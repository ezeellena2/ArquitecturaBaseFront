import {
  AssistantRuntimeProvider as RuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { projectMessages } from "../../assistant/model";
import type { AssistantTurn, AssistantConversationSummary } from "../../api/assistant";
export function AssistantRuntimeProvider({
  turns,
  running,
  onSubmit,
  onCancel,
  onClear,
  conversationId,
  conversations,
  onChoose,
  children,
}: {
  turns: readonly AssistantTurn[];
  running: boolean;
  onSubmit: (question: string) => Promise<boolean>;
  onCancel: () => Promise<void>;
  onClear: () => void;
  conversationId?: string;
  conversations: readonly AssistantConversationSummary[];
  onChoose: (id: string | null) => void;
  children: ReactNode;
}) {
  const runtimeRef = useRef<ReturnType<typeof useExternalStoreRuntime> | null>(
    null,
  );
  const threads = useMemo(
    () => conversations.map(item => ({
      id: item.conversationId,
      title: item.title,
      status: "regular" as const,
    })),
    [conversations],
  );
  const runtime = useExternalStoreRuntime({
    messages: projectMessages(turns),
    convertMessage: (message) => message,
    isRunning: running,
    onNew: async (message) => {
      const question = message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      const success = await onSubmit(question);
      if (success) onClear();
      else runtimeRef.current?.thread.composer.setText(question);
    },
    onCancel,
    // Pinned 0.15.23 external-store thread-list API: keep its experimental boundary here.
    // These callbacks request guarded navigation; the server creates/deletes conversations.
    adapters: {
      threadList: {
        threadId: conversationId,
        threads,
        onSwitchToThread: id => onChoose(id),
        onSwitchToNewThread: () => onChoose(null),
      },
    },
  });
  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);
  return <RuntimeProvider runtime={runtime}>{children}</RuntimeProvider>;
}

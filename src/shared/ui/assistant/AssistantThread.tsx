import { ThreadPrimitive, useAuiState } from "@assistant-ui/react";
import type { ComponentType, ReactNode } from "react";

export function AssistantThread({ label, welcome, composer, suggestions, availability, operation, UserMessage, AssistantMessage }: {
  label: string;
  welcome?: ReactNode;
  composer: ReactNode;
  suggestions?: ReactNode;
  availability?: ReactNode;
  operation?: ReactNode;
  UserMessage: ComponentType;
  AssistantMessage: ComponentType;
}) {
  const isEmpty = useAuiState(state => state.thread.messages.length === 0);
  return (
    <ThreadPrimitive.Root data-slot="assistant-thread" className="assistant-thread">
      <ThreadPrimitive.Viewport aria-label={label} className="assistant-viewport" autoScroll
        scrollToBottomOnRunStart={false} scrollToBottomOnInitialize scrollToBottomOnThreadSwitch>
        <div className="assistant-thread-content" data-empty={isEmpty}>
          {isEmpty ? welcome : null}
          <div className="assistant-messages">
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
            {operation}
          </div>
          <ThreadPrimitive.ViewportFooter className="assistant-footer" data-empty={isEmpty}>
            {!isEmpty ? suggestions : null}
            {composer}
            {availability}
            {isEmpty ? suggestions : null}
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

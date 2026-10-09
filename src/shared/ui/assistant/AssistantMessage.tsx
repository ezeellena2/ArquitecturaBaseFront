import { ActionBarPrimitive, MessagePrimitive } from "@assistant-ui/react";
import type { ReactNode } from "react";
import { IconButton } from "../IconButton";
import { CopyIcon } from "../icons";
export function AssistantMessage({
  role,
  label,
  timeLabel,
  timestamp,
  copyLabel,
  children,
}: {
  role: "user" | "assistant";
  label: string;
  timeLabel: string;
  timestamp: string;
  copyLabel?: string;
  children?: ReactNode;
}) {
  return (
    <MessagePrimitive.Root
      data-role={role}
      className="assistant-message"
    >
      <div
        className={role === "user" ? "min-w-0 max-w-[90%]" : "min-w-0 w-full"}
      >
        {role === "user" ? (
          <div className="assistant-user-bubble">
            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              <MessagePrimitive.Parts />
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            <MessagePrimitive.Parts />
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-content-muted)]">
          <span>{label}</span>
          <time dateTime={timestamp}>{timeLabel}</time>
          {copyLabel ? (
            <ActionBarPrimitive.Root>
              <ActionBarPrimitive.Copy asChild>
                <IconButton label={copyLabel}><CopyIcon /></IconButton>
              </ActionBarPrimitive.Copy>
            </ActionBarPrimitive.Root>
          ) : null}
        </div>
        {children}
      </div>
    </MessagePrimitive.Root>
  );
}

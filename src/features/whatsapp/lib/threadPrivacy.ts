import type { Thread } from "../api/chat";

// Authorization is independent of the historical value schema. The HTTP adapter owns that schema.
export function withoutFormReplyValues(thread: Thread): Thread {
  return { ...thread, canReadFormRecords: false, messages: thread.messages.map(message => {
    const reply = message.formReply;
    return { ...message,
      body: message.kind === "FlowReply" || message.origin === "FormAction" ? null : message.body,
      ...(reply !== null && typeof reply === "object" && !Array.isArray(reply)
        ? { formReply: { ...reply, values: null } } : {}),
    };
  }), outgoing: thread.outgoing.map(operation => operation.origin === "FormAction" ? { ...operation, body: null } : operation) };
}

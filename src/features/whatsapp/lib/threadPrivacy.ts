import type { Thread } from "../api/chat";

// Authorization is independent of the historical value schema. The HTTP adapter owns that schema.
// «Prellenado con» of a resend (W3) goes like «Por qué lo mandó»: it carries the values that went into the form.
export function withoutFormReplyValues(thread: Thread): Thread {
  return { ...thread, canReadFormRecords: false, messages: thread.messages.map(({ prefill: _prefill, ...message }) => {
    const reply = message.formReply;
    return { ...message, assistant: null,
      body: message.kind === "FlowReply" || message.origin === "FormAction" ? null : message.body,
      ...(reply !== null && typeof reply === "object" && !Array.isArray(reply)
        ? { formReply: { ...reply, values: null } } : {}),
    };
  }), outgoing: thread.outgoing.map(({ prefill: _prefill, ...operation }) => ({ ...operation, assistant: null, ...(operation.origin === "FormAction" ? { body: null } : {}) })) };
}

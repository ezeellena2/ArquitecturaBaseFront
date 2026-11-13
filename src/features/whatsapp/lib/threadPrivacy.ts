import type { ReceivedDocument, Thread } from "../api/chat";

// What the assistant read of a received document (task 9) is a value of a response; why it proposed or asked, and its doubts, stay.
function withoutReadValues(document: ReceivedDocument): ReceivedDocument {
  if (document.why === undefined || !("fields" in document.why)) return document;
  const { fields: _fields, ...why } = document.why;
  return { ...document, why };
}

// Authorization is independent of the historical value schema. The HTTP adapter owns that schema.
// «Prellenado con» of a resend (W3) goes like «Por qué lo mandó»: it carries the values that went into the form. The body of what the
// assistant sent for a file the person sent (`loadsFile`, task 9) may say what it read: it goes like a notice's.
export function withoutFormReplyValues(thread: Thread): Thread {
  return { ...thread, canReadFormRecords: false, messages: thread.messages.map(({ prefill: _prefill, ...message }) => {
    const reply = message.formReply;
    return { ...message, assistant: null,
      body: message.kind === "FlowReply" || message.origin === "FormAction" || message.loadsFile === true ? null : message.body,
      ...(reply !== null && typeof reply === "object" && !Array.isArray(reply)
        ? { formReply: { ...reply, values: null } } : {}),
      ...(message.document === undefined ? {} : { document: withoutReadValues(message.document) }),
    };
  }), outgoing: thread.outgoing.map(({ prefill: _prefill, ...operation }) => ({ ...operation, assistant: null, ...(operation.origin === "FormAction" || operation.loadsFile === true ? { body: null } : {}) })) };
}

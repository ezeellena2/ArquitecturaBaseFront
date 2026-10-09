import { createContext } from "react";

export const ConversationActions = createContext<{ disabled: boolean; requestDelete: (id: string) => void }>({
  disabled: false, requestDelete: () => {},
});

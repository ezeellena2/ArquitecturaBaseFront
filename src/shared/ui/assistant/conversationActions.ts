import { createContext } from "react";

export const ConversationActions = createContext<{
  disabled: boolean; genericTitle: string; moreLabel: (title: string) => string;
  deleteLabel: string; requestDelete: (id: string) => void;
}>({
  disabled: false,
  genericTitle: "",
  moreLabel: (_title: string) => "",
  deleteLabel: "",
  requestDelete: (_id: string) => {},
});

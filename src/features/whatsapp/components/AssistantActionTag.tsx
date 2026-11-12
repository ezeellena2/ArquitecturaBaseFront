import { Badge } from "@/shared/ui/badge";
import type { AgentActionKind } from "../api/assistantAgent";
import { actionIcons } from "./assistantAgentParts";

/** What a case or a test does, as a tag with its icon; a long name goes on to the next line on the phone. */
export function AssistantActionTag({ kind, label }: { kind: AgentActionKind | null; label: string }) {
  const Icon = kind ? actionIcons[kind] : null;
  return <Badge variant="outline" className="max-w-full">{Icon ? <Icon className="size-3" /> : null}<span className="min-w-0 whitespace-normal break-words text-left">{label}</span></Badge>;
}

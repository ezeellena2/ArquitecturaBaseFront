// Interactive Flow bodies have a separate, shorter limit than ordinary chat text.
export function formMessageIssue(message: string): "required" | "tooLong" | undefined {
  if (!message.trim()) return "required";
  if (message.length > 1024) return "tooLong";
  return undefined;
}

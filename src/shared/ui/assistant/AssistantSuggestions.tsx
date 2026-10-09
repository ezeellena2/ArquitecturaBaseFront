import { Button } from "../button";
import { ChevronRightIcon } from "../icons";

export function AssistantSuggestions({ items, disabled, onChoose }: {
  items: readonly { id: string; question: string }[];
  disabled: boolean;
  onChoose: (question: string) => void;
}) {
  return (
    <div data-slot="assistant-suggestions" className="assistant-suggestions">
      {items.map(item => <Button className="assistant-suggestion" key={item.id} variant="ghost"
        disabled={disabled} type="button" onClick={() => onChoose(item.question)}>
        <ChevronRightIcon /><span>{item.question}</span>
      </Button>)}
    </div>
  );
}

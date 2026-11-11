import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";

export interface SelectionRange {
  minimum: number | null;
  maximum: number | null;
}

// The helps say what each bound means (the minimum of a multiple choice, the WhatsApp rows of a block): in the (i) next to
// its label, never as a note under the pair.
export function SelectionRangeFields({ value, limit, minimumLabel, minimumHelp, maximumLabel, maximumHelp, readOnly, disabledReason, error, onChange }: {
  value: SelectionRange;
  limit: number;
  minimumLabel: string;
  minimumHelp?: string;
  maximumLabel: string;
  maximumHelp?: string;
  readOnly: boolean;
  /** Why the range does not change (a question a library standard needs, BI1-A): both fields stay off with that reason. */
  disabledReason?: string | null;
  error?: string;
  onChange: (value: SelectionRange) => void;
}) {
  return <div className="grid max-w-sm grid-cols-2 gap-4">
    <FormField label={minimumLabel} help={minimumHelp} error={error}><DisabledReason reason={disabledReason}><Input type="number" step={1} required min={0} max={limit} readOnly={readOnly} disabled={!!disabledReason} value={value.minimum ?? ""} onChange={event => onChange({ ...value, minimum: event.target.value === "" ? null : event.target.valueAsNumber })}/></DisabledReason></FormField>
    <FormField label={maximumLabel} help={maximumHelp} error={error}><DisabledReason reason={disabledReason}><Input type="number" step={1} required min={1} max={limit} readOnly={readOnly} disabled={!!disabledReason} value={value.maximum ?? ""} onChange={event => onChange({ ...value, maximum: event.target.value === "" ? null : event.target.valueAsNumber })}/></DisabledReason></FormField>
  </div>;
}

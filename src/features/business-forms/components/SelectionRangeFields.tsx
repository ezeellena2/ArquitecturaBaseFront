import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";

export interface SelectionRange {
  minimum: number | null;
  maximum: number | null;
}

export function SelectionRangeFields({ value, limit, minimumLabel, maximumLabel, readOnly, error, onChange }: {
  value: SelectionRange;
  limit: number;
  minimumLabel: string;
  maximumLabel: string;
  readOnly: boolean;
  error?: string;
  onChange: (value: SelectionRange) => void;
}) {
  return <div className="grid max-w-sm grid-cols-2 gap-4">
    <FormField label={minimumLabel} error={error}><Input type="number" step={1} required min={0} max={limit} readOnly={readOnly} value={value.minimum ?? ""} onChange={event => onChange({ ...value, minimum: event.target.value === "" ? null : event.target.valueAsNumber })}/></FormField>
    <FormField label={maximumLabel} error={error}><Input type="number" step={1} required min={1} max={limit} readOnly={readOnly} value={value.maximum ?? ""} onChange={event => onChange({ ...value, maximum: event.target.value === "" ? null : event.target.valueAsNumber })}/></FormField>
  </div>;
}

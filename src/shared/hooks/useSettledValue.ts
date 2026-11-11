import { useEffect, useState } from "react";

/// The value once it stops changing for `delay` milliseconds (300 by default): a search or a calculation asked when the person
/// pauses, never on each keystroke. While it changes, the last settled value stays.
export function useSettledValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

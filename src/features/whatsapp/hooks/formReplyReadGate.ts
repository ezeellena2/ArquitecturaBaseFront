export function createFormReplyReadGate(owner: string) {
  let allowed = false;
  let denied = false;
  let wasGranted = false;
  let revision = 0;
  const listeners = new Set<() => void>();
  return {
    owner,
    get revision() { return revision; },
    get wasGranted() { return wasGranted; },
    getSnapshot: () => allowed,
    subscribe: (notify: () => void) => {
      listeners.add(notify);
      return () => { listeners.delete(notify); };
    },
    deny: () => {
      allowed = false;
      if (denied) return false;
      denied = true;
      revision++;
      return true;
    },
    grant: (requestRevision: number) => {
      if (requestRevision !== revision) return;
      allowed = true;
      wasGranted = true;
      denied = false;
    },
    notify: () => { listeners.forEach(notify => notify()); },
  };
}

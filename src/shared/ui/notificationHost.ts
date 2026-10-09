// The one global Toaster belongs to the active modal's focus scope while it is open.
const hosts: HTMLElement[] = [];
const listeners = new Set<() => void>();

export function registerNotificationHost(host: HTMLElement) {
  hosts.push(host);
  listeners.forEach(listener => listener());
  return () => {
    const index = hosts.indexOf(host);
    if (index !== -1) hosts.splice(index, 1);
    listeners.forEach(listener => listener());
  };
}

export function subscribeNotificationHost(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notificationHost() { return hosts.at(-1) ?? null; }

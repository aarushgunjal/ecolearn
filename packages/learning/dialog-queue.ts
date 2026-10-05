// A single active dialog prevents overlapping confirmations and lost actions.
export function createDialogQueue<T>() {
  let nextId = 0;
  let entries: { id: number; value: T }[] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  return {
    get: () => entries[0] ?? null,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    add: (value: T) => { const id = ++nextId; entries = [...entries, { id, value }]; emit(); return id; },
    take: (id: number) => {
      if (entries[0]?.id !== id) return null;
      const first = entries[0];
      entries = entries.slice(1);
      emit();
      return first.value;
    },
  };
}

export type ActivityScope = {
  scope: "community" | "classroom";
  id: string;
  name: string;
} | null;

// Each device chooses its own learning context. Never persist another account's
// context or let a teacher preview set the student's earning context.
export function createActivityScopeStore() {
  let current: ActivityScope = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next: ActivityScope) => {
      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    params: () => ({
      p_scope: current?.scope ?? null,
      p_scope_id: current?.id ?? null,
    }),
  };
}

import { createDialogQueue } from "../../../../packages/learning/dialog-queue";
export type Request = { title: string; message?: string; confirm: string; destructive?: boolean; input?: { choices?: string[]; maxLength?: number }; resolve: (value: string | null) => void };
export const queue = createDialogQueue<Request>();
export const appDialog = {
  confirm(message: string, title = "Confirm change", confirm = "Continue", destructive = false) {
    return new Promise<boolean>(resolve => queue.add({ title, message, confirm, destructive, resolve: value => resolve(value !== null) }));
  },
  prompt(title: string, choices?: string[], maxLength = 500) {
    return new Promise<string | null>(resolve => queue.add({ title, confirm: "Continue", input: { choices, maxLength }, resolve }));
  },
};

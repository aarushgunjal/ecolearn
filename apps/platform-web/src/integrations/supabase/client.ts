import { createClient } from "@supabase/supabase-js";

const REMEMBER_KEY = "ecolearn-remember-me";
const authStorage = {
  getItem: (key: string) => (localStorage.getItem(REMEMBER_KEY) === "true" ? localStorage : sessionStorage).getItem(key),
  setItem: (key: string, value: string) => { const selected = localStorage.getItem(REMEMBER_KEY) === "true" ? localStorage : sessionStorage; selected.setItem(key, value); (selected === localStorage ? sessionStorage : localStorage).removeItem(key); },
  removeItem: (key: string) => { localStorage.removeItem(key); sessionStorage.removeItem(key); },
};
export const setRememberMe = (remember: boolean) => localStorage.setItem(REMEMBER_KEY, String(remember));

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

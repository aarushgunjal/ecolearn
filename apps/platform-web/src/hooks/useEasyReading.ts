import { useState } from "react";

export function useEasyReading() {
  const [easy, setEasy] = useState(() => {
    try { return localStorage.getItem("ecolearn.easyReading") === "true"; }
    catch { return false; }
  });
  const change = (value: boolean) => {
    setEasy(value);
    try { localStorage.setItem("ecolearn.easyReading", String(value)); }
    catch { /* Reading support still works when browser storage is unavailable. */ }
  };
  return [easy, change] as const;
}

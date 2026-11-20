"use client";
import { useSyncExternalStore } from "react";

// Masa Kitchen's payout week: the one order only the owner can answer ("1 order needs you", Oak Park, UE 9QX4).
// The same card is in the email, the chat and the dashboard's unmatched list, so the answer lives here, outside any
// provider (the demo inbox has none): answering in one place updates the others. In memory only.

export type OrderAnswer = "yes" | "no" | null;
let answer: OrderAnswer = null;
const listeners = new Set<() => void>();

export function setOrderAnswer(a: OrderAnswer) {
  answer = a;
  listeners.forEach((l) => l());
}

export function useOrderAnswer(): [OrderAnswer, (a: OrderAnswer) => void] {
  const a = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => answer,
    () => null,
  );
  return [a, setOrderAnswer];
}

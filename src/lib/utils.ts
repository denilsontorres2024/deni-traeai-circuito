import { type ClassValue, clsx } from "clsx";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date, pattern = "dd/MM/yyyy") {
  return format(new Date(value), pattern, { locale: ptBR });
}

export function formatRelative(value: string | Date) {
  return formatDistanceToNowStrict(new Date(value), {
    locale: ptBR,
    addSuffix: true,
  });
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function toPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

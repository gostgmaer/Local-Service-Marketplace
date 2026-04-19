import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isAfter, subDays } from "date-fns";
import { enIN } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string = "INR",
): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "INR" ? 0 : 2,
  }).format(amount);
}

export function parseRating(
  value: number | string | null | undefined,
): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const rating = typeof value === "string" ? Number(value) : value;
  return typeof rating === "number" && !Number.isNaN(rating)
    ? rating
    : undefined;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd MMM yyyy", { locale: enIN });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd MMM yyyy, hh:mm a", { locale: enIN });
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Within the last 7 days: show relative ("2 hours ago", "3 days ago")
  // Older than 7 days: show full datetime
  if (isAfter(d, subDays(new Date(), 7))) {
    return formatDistanceToNow(d, { addSuffix: true, locale: enIN });
  }
  return formatDateTime(d);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function kebabToTitle(str: string): string {
  return str
    .split("-")
    .map((word) => capitalize(word))
    .join(" ");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function debounce<T extends (..._args: any[]) => any>(
  func: T,
  wait: number,
): (..._args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhone(phone: string): boolean {
  // Removed useless escapes for ( ) and - inside square brackets
  const re = /^\+?[\d\s-()]+$/;
  return re.test(phone) && phone.replace(/\D/g, "").length >= 10;
}

export function getStatusColor(
  status: string,
): "blue" | "green" | "yellow" | "red" | "gray" {
  const statusColors: Record<string, any> = {
    open: "blue",
    pending: "yellow",
    in_progress: "blue",
    scheduled: "blue",
    accepted: "green",
    completed: "green",
    verified: "green",
    cancelled: "red",
    rejected: "red",
    failed: "red",
    disputed: "red",
    escalated: "red",
    investigating: "yellow",
    resolved: "green",
    processing: "yellow",
    active: "green",
    suspended: "red",
  };
  return statusColors[status] || "gray";
}

export function getStatusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => capitalize(word))
    .join(" ");
}

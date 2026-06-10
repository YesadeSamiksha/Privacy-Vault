import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const normalized = dateString.endsWith("Z") || dateString.includes("+")
      ? dateString
      : dateString.replace(" ", "T") + "Z";
    return format(parseISO(normalized), "MMM d, yyyy");
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const normalized = dateString.endsWith("Z") || dateString.includes("+")
      ? dateString
      : dateString.replace(" ", "T") + "Z";
    return format(parseISO(normalized), "MMM d, yyyy h:mm a");
  } catch {
    return dateString;
  }
}

export function getStatusTheme(status: string) {
  switch (status.toLowerCase()) {
    case "completed": return "bg-green-50 text-green-800 border-green-200";
    case "rejected": return "bg-red-50 text-red-800 border-red-200";
    default: return "bg-blue-50 text-blue-800 border-blue-200";
  }
}

export function formatStatus(status: string) {
  return status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function getDaysRemainingTheme(days: number | null | undefined) {
  if (days == null) return "text-muted-foreground";
  if (days < 7) return "text-red-600 font-bold";
  if (days <= 15) return "text-amber-600 font-medium";
  return "text-green-600";
}

export function getDaysRemaining(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function formatPhoneToE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  
  const digits = trimmed.replace(/[^\d]/g, "");
  
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  
  return `+${digits}`;
}


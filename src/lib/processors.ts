import { readFileSync } from "fs";
import { join } from "path";

export interface ProcessorRecord {
  id: string;
  name: string;
  type: string;
  records: Record<string, any>;
}

export interface MatchedProcessorResult {
  processorId: string;
  processorName: string;
  type: string;
  found: boolean;
  data: any | null;
}

// Normalize phone number to last 10 digits for matching
function matchPhone(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  if (!phone1 || !phone2) return false;
  const digits1 = phone1.replace(/[^\d]/g, "");
  const digits2 = phone2.replace(/[^\d]/g, "");
  
  if (digits1.length >= 10 && digits2.length >= 10) {
    return digits1.slice(-10) === digits2.slice(-10);
  }
  return digits1 === digits2 && digits1 !== "";
}

// Load and parse processors JSON
export function loadProcessors(): ProcessorRecord[] {
  const filePath = join(process.cwd(), "data", "processors.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// Perform advanced lookup by email and phone
export function findProcessorRecord(
  processor: ProcessorRecord,
  email: string,
  phone: string | null | undefined
): { found: boolean; data: any | null; key?: string } {
  const cleanEmail = email.trim().toLowerCase();
  
  // 1. Direct key matching by email
  if (processor.records[cleanEmail]) {
    return { found: true, data: processor.records[cleanEmail], key: cleanEmail };
  }
  
  // 2. Scan records for nested matching (case-insensitive email or normalized phone)
  for (const [key, record] of Object.entries(processor.records)) {
    if (!record || typeof record !== "object") continue;
    
    // Check key case insensitivity
    if (key.trim().toLowerCase() === cleanEmail) {
      return { found: true, data: record, key };
    }
    
    // Check explicit email fields
    if (record.email && String(record.email).trim().toLowerCase() === cleanEmail) {
      return { found: true, data: record, key };
    }
    
    // Check explicit phone fields
    if (phone && record.phone && matchPhone(phone, String(record.phone))) {
      return { found: true, data: record, key };
    }
  }
  
  return { found: false, data: null };
}

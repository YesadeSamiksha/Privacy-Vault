"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ---------- types ----------
type ProcessorRecord = {
  processorId: string;
  processorName: string;
  type: string;
  found: boolean;
  data: Record<string, unknown> | null;
  deleted?: boolean;
  modified?: boolean;
};

type ProcessorState = ProcessorRecord & {
  status: "pending" | "loading" | "done" | "actioning";
  selected: boolean;
  deleted: boolean;
  modified: boolean;
  corrections: Record<string, string>;
};

// ---------- helpers ----------
function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
  if (typeof value === "boolean") return <span className={value ? "text-green-600 font-medium" : "text-red-500 font-medium"}>{value ? "Yes" : "No"}</span>;
  if (typeof value === "string" || typeof value === "number") {
    return <span className="text-gray-800">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">None</span>;
    if (typeof value[0] !== "object") {
      return (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {value.map((v, i) => (
            <span key={i} className="inline-block bg-blue-50 text-blue-700 border border-blue-100 text-xs px-2 py-0.5 rounded-full">
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2 mt-1">
        {value.map((item, i) => (
          <div key={i} className="bg-gray-50 rounded border border-gray-100 p-2">
            {renderValue(item, depth + 1)}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className={`space-y-1 ${depth > 0 ? "pl-2" : ""}`}>
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[40%_60%] gap-x-2 items-start text-xs">
            <span className="text-gray-500 capitalize font-medium truncate" title={k.replace(/_/g, " ")}>
              {k.replace(/_/g, " ")}
            </span>
            <span>{renderValue(v, depth + 1)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// ---------- icons ----------
function Spinner({ color = "text-blue-500" }: { color?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

// ---------- main component ----------
type Props = {
  requestId: string;
  requestType: string;
  userEmail: string;
  userName: string;
  requestedCorrections?: Record<string, string>;
};

export function ProcessorPropagation({ requestId, requestType, userEmail, userName, requestedCorrections }: Props) {
  const [processorStates, setProcessorStates] = useState<ProcessorState[]>([]);
  const [phase, setPhase] = useState<"idle" | "fetching" | "done">("idle");
  const [isActioning, setIsActioning] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const isErasure = requestType === "erasure";
  const isModify = requestType === "correction";
  const isActionable = isErasure || isModify;
  const anySelected = processorStates.some((p) => p.selected && !p.deleted && !p.modified);
  const allDone = processorStates.length > 0 && processorStates.every((p) => p.status === "done");

  async function handleFetch() {
    setPhase("fetching");
    setProcessorStates([]);
    setActionError("");

    const res = await fetch(`/api/admin/requests/${requestId}/processors`);
    if (!res.ok) { setPhase("idle"); return; }
    const { processors }: { processors: ProcessorRecord[] } = await res.json();

    const initial: ProcessorState[] = processors.map((p) => ({
      ...p,
      status: "pending",
      selected: false,
      deleted: p.deleted || false,
      modified: p.modified || false,
      corrections: requestedCorrections ?? {},
    }));
    setProcessorStates(initial);

    for (let i = 0; i < processors.length; i++) {
      setProcessorStates((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "loading" } : p));
      await delay(randomBetween(400, 700));
      setProcessorStates((prev) => prev.map((p, idx) => idx === i ? { ...p, ...processors[i], status: "done", corrections: p.corrections } : p));
    }

    setPhase("done");
  }

  async function handleAction() {
    const toAction = processorStates.filter((p) => p.selected && !p.deleted && !p.modified && p.found);
    if (toAction.length === 0) return;

    setIsActioning(true);
    setActionError("");

    // Mark selected cards as actioning for visual feedback
    setProcessorStates((prev) =>
      prev.map((p) => toAction.some((t) => t.processorId === p.processorId) ? { ...p, status: "actioning" } : p)
    );

    const actionEndpoint = isErasure ? "delete" : "modify";
    const corrections = isModify
      ? Object.fromEntries(
          toAction.map((p) => [
            p.processorId,
            // Only include fields where admin actually typed a new value
            Object.fromEntries(
              Object.entries(p.corrections).filter(([, v]) => v.trim() !== "")
            ),
          ])
        )
      : undefined;

    const res = await fetch(`/api/admin/requests/${requestId}/processors/${actionEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processorIds: toAction.map((p) => p.processorId), corrections }),
    });

    const data = await res.json();
    if (!res.ok) {
      setActionError(data.message || `${isErasure ? "Deletion" : "Modification"} failed.`);
      setProcessorStates((prev) => prev.map((p) => p.status === "actioning" ? { ...p, status: "done" } : p));
      setIsActioning(false);
      return;
    }

    const actionedSet = new Set<string>(data.deleted || data.modified);
    setProcessorStates((prev) =>
      prev.map((p) => {
        if (!actionedSet.has(p.processorId)) return p;
        return {
          ...p,
          status: "done",
          deleted: isErasure ? true : p.deleted,
          modified: isModify ? true : p.modified,
          data: isErasure ? null : p.data,
          selected: false,
        };
      })
    );
    setIsActioning(false);
  }

  async function handleDownloadPdf() {
    setIsPdfLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = margin;

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text("PrivacyVault – DSAR Processor Report", margin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, margin, y);
      y += 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Citizen & Request Details", margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
        head: [["Field", "Value"]],
        body: [
          ["Name", userName],
          ["Email", userEmail],
          ["Request ID", requestId],
          ["Request Type", requestType.charAt(0).toUpperCase() + requestType.slice(1)],
          ["Report Generated At", new Date().toISOString()],
        ],
        margin: { left: margin, right: margin },
      });

      y = (doc as InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Processor Fetch Results", margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
        head: [["Processor", "Type", "Data Status", "Action Taken"]],
        body: processorStates.map((p) => [
          p.processorName,
          p.type,
          p.found ? "Found" : "Not Found",
          p.deleted ? "Deleted" : p.modified ? "Modified" : p.found ? "Retained" : "N/A",
        ]),
        margin: { left: margin, right: margin },
      });

      y = (doc as InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

      const actionedProcessors = processorStates.filter((p) => p.deleted || p.modified);
      if (actionedProcessors.length > 0) {
        if (y > 250) { doc.addPage(); y = margin; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(isErasure ? 185 : 217, isErasure ? 28 : 119, isErasure ? 28 : 6);
        doc.text(`${isErasure ? "Erasure" : "Modification"} Summary`, margin, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: isErasure ? [185, 28, 28] : [217, 119, 6], textColor: 255, fontStyle: "bold" },
          head: [["Processor", "Type", "Action Logged At"]],
          body: actionedProcessors.map((p) => [
            p.processorName,
            p.type,
            new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST",
          ]),
          margin: { left: margin, right: margin },
        });
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `PrivacyVault DPDP Act Compliance Platform | Page ${i} of ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      doc.save(`DSAR-Processor-Report-${requestId.slice(0, 8)}.pdf`);
    } catch (e) {
      console.error("PDF generation error:", e);
    } finally {
      setIsPdfLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between py-4 gap-4">
        <div>
          <CardTitle>Third-Party Processor Propagation</CardTitle>
          <CardDescription>
            Fetch and review personal data held by third-party data processors for this citizen.
          </CardDescription>
          {requestedCorrections && Object.keys(requestedCorrections).length > 0 && (
            <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Correction inputs pre-filled from citizen&apos;s request
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {allDone && (
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isPdfLoading} className="text-xs">
              {isPdfLoading ? "Generating..." : "⬇ Download PDF Report"}
            </Button>
          )}
          <Button size="sm" onClick={handleFetch} disabled={phase === "fetching"} className="text-xs">
            {phase === "fetching" ? "Fetching..." : phase === "done" ? "Refresh" : "Fetch Data from All Processors"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {phase === "idle" && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Click the button above to query all registered data processors for this citizen&apos;s records.
          </p>
        )}

        {processorStates.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {processorStates.map((p) => (
              <ProcessorCard
                key={p.processorId}
                processor={p}
                isErasure={isErasure}
                isModify={isModify}
                onToggle={() =>
                  setProcessorStates((prev) =>
                    prev.map((x) => x.processorId === p.processorId ? { ...x, selected: !x.selected } : x)
                  )
                }
                onCorrectionChange={(field, value) =>
                  setProcessorStates((prev) =>
                    prev.map((x) =>
                      x.processorId === p.processorId
                        ? { ...x, corrections: { ...x.corrections, [field]: value } }
                        : x
                    )
                  )
                }
              />
            ))}
          </div>
        )}

        {/* Action bar */}
        {allDone && isActionable && (
          <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {processorStates.filter((p) => p.selected).length} processor(s) selected for {isErasure ? "erasure" : "correction"}
            </p>
            <div className="flex items-center gap-3">
              {actionError && <p className="text-xs text-destructive">{actionError}</p>}
              <Button
                size="sm"
                variant={isErasure ? "destructive" : "default"}
                onClick={handleAction}
                disabled={!anySelected || isActioning}
                className="flex items-center gap-1.5"
              >
                {isErasure && <TrashIcon />}
                {isErasure
                  ? isActioning ? "Deleting..." : "Delete Selected"
                  : isActioning ? "Updating..." : "Apply Corrections"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- sub-component ----------
type ProcessorCardProps = {
  processor: ProcessorState;
  isErasure: boolean;
  isModify: boolean;
  onToggle: () => void;
  onCorrectionChange: (field: string, value: string) => void;
};

function ProcessorCard({ processor: p, isErasure, isModify, onToggle, onCorrectionChange }: ProcessorCardProps) {
  const isPending = p.status === "pending";
  const isLoading = p.status === "loading";
  const isDone = p.status === "done";
  const isActioning = p.status === "actioning";
  const isActionable = isErasure || isModify;

  return (
    <div
      className={`relative border rounded-lg p-3 transition-all duration-300 ${
        isActioning
          ? isErasure
            ? "border-red-300 bg-red-50/50 animate-pulse"
            : "border-amber-300 bg-amber-50/50 animate-pulse"
          : p.deleted
          ? "border-red-200 bg-red-50/30 opacity-80"
          : p.modified
          ? "border-amber-200 bg-amber-50/30 opacity-80"
          : p.found && isDone
          ? "border-green-100 bg-green-50/20"
          : "border-border bg-background"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {isPending && <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />}
            {isLoading && <Spinner />}
            {isActioning && <Spinner color={isErasure ? "text-red-500" : "text-amber-500"} />}
            {isDone && <CheckIcon />}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold truncate ${p.deleted ? "line-through text-red-500" : ""}`}>
              {p.processorName}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{p.type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isActioning && (
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
              isErasure ? "text-red-600 border-red-200 bg-red-50" : "text-amber-700 border-amber-200 bg-amber-50"
            }`}>
              {isErasure ? "Deleting..." : "Updating..."}
            </span>
          )}
          {!isActioning && p.deleted && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 border border-red-200 bg-red-50 px-1.5 py-0.5 rounded">
              Deleted
            </span>
          )}
          {!isActioning && p.modified && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 border border-amber-200 bg-amber-50 px-1.5 py-0.5 rounded">
              Updated
            </span>
          )}
          {isDone && p.found && !p.deleted && !p.modified && (
            <span className="text-[10px] font-medium text-green-700 border border-green-200 bg-green-50 px-1.5 py-0.5 rounded">
              Data Found
            </span>
          )}
          {isDone && !p.found && (
            <span className="text-[10px] font-medium text-gray-500 border border-gray-200 bg-gray-50 px-1.5 py-0.5 rounded">
              No Records
            </span>
          )}
          {isActionable && isDone && p.found && !p.deleted && !p.modified && (
            <input
              type="checkbox"
              checked={p.selected}
              onChange={onToggle}
              className={`w-3.5 h-3.5 cursor-pointer flex-shrink-0 ${isErasure ? "accent-red-600" : "accent-amber-600"}`}
              title={`Select for ${isErasure ? "erasure" : "correction"}`}
            />
          )}
        </div>
      </div>

      {/* Actioning message */}
      {isActioning && (
        <p className={`text-xs mt-1 pl-7 font-medium ${isErasure ? "text-red-600" : "text-amber-700"}`}>
          {isErasure ? "Permanently removing data from this processor…" : "Applying corrections to this processor…"}
        </p>
      )}

      {/* Deleted state */}
      {isDone && p.deleted && (
        <div className="mt-2 pt-2 border-t border-red-100">
          <p className="text-xs text-red-500 italic">Data has been permanently removed from this processor.</p>
        </div>
      )}

      {/* Data content */}
      {(isDone || isActioning) && p.found && p.data && !p.deleted && (
        <div className={`mt-2 pt-2 border-t border-gray-100 ${isActioning || p.modified ? "opacity-50 pointer-events-none" : ""}`}>
          {/* Correction inputs — shown only when selected for modify */}
          {isModify && isDone && p.selected && !p.modified && (
            <div className="mb-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Enter corrections (leave blank to keep):</p>
              {([
                { key: "full_name", label: "Full Name" },
                { key: "email",     label: "Email" },
                { key: "phone",     label: "Phone" },
                { key: "address",   label: "Address" },
                { key: "location",  label: "Location" },
                { key: "city",      label: "City" },
              ] as const)
                .filter(({ key }) => key in (p.data as Record<string, unknown>))
                .map(({ key, label }) => (
                  <div key={key} className="grid grid-cols-[40%_60%] gap-x-2 items-center text-xs">
                    <span className="text-gray-500 font-medium">{label}</span>
                    <input
                      type="text"
                      placeholder={String((p.data as Record<string, unknown>)[key])}
                      value={p.corrections[key] ?? ""}
                      onChange={(e) => onCorrectionChange(key, e.target.value)}
                      className="border border-amber-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                    />
                  </div>
                ))}
            </div>
          )}
          <div className="max-h-48 overflow-y-auto pr-1">
            {renderValue(p.data)}
          </div>
        </div>
      )}

      {isDone && !p.found && (
        <p className="text-xs text-muted-foreground mt-1 pl-7">
          No records found for this citizen in {p.processorName}.
        </p>
      )}

      {isLoading && (
        <p className="text-xs text-blue-500 mt-1 pl-7 animate-pulse">Querying processor…</p>
      )}
    </div>
  );
}

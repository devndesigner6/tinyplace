"use client";

import { useState } from "react";
import type { FunctionComponent } from "@src/common/types";

export interface MidnightProofProps {
  network: string;
  status: "pending" | "submitted" | "indexed" | "finalized" | "confirmed" | "failed" | "unverified";
  contractAddress?: string;
  txHash?: string;
  timestamp?: string;
  error?: string;
  isDark?: boolean;
}

export const MidnightProofCard = ({
  network,
  status,
  contractAddress,
  txHash,
  timestamp,
  error,
  isDark = true,
}: MidnightProofProps): FunctionComponent => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string): void => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isPreprod = network.toLowerCase().includes("preprod");
  const explorerBase = isPreprod
    ? "https://explorer.preprod.midnight.network"
    : null;

  const isConfirmed = status === "confirmed" || status === "finalized";
  const isPending = status === "pending" || status === "submitted" || status === "indexed";

  const statusColor = isConfirmed
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    : isPending
    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
    : "bg-rose-500/10 text-rose-400 border-rose-500/30";

  return (
    <div
      className={`rounded-lg border p-3.5 space-y-2.5 text-xs font-mono transition-all ${
        isDark
          ? "border-neutral-800 bg-neutral-950/80 text-neutral-300"
          : "border-neutral-200 bg-neutral-50 text-neutral-800"
      }`}
    >
      <div className="flex items-center justify-between border-b pb-2 border-neutral-800/60">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isConfirmed
                ? "bg-emerald-400"
                : isPending
                ? "bg-amber-400 animate-pulse"
                : "bg-rose-400"
            }`}
          />
          <span className="font-semibold tracking-wider text-[11px] uppercase text-indigo-400">
            Midnight Settlement State
          </span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Network:</span>
          <span className="font-medium text-neutral-300">{network || "unspecified"}</span>
        </div>

        {contractAddress ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-500">Contract:</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-neutral-300">
                {contractAddress.slice(0, 10)}…{contractAddress.slice(-8)}
              </span>
              <button
                type="button"
                className="text-[10px] text-neutral-400 hover:text-white px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800"
                onClick={() => copyToClipboard(contractAddress, "contract")}
              >
                {copiedField === "contract" ? "✓" : "copy"}
              </button>
              {explorerBase ? (
                <a
                  href={`${explorerBase}/contract/${contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-indigo-400 hover:underline px-1 py-0.5 rounded bg-indigo-950/40 border border-indigo-900/40"
                >
                  explorer ↗
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {txHash ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-500">Transaction:</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-neutral-300">
                {txHash.slice(0, 10)}…{txHash.slice(-8)}
              </span>
              <button
                type="button"
                className="text-[10px] text-neutral-400 hover:text-white px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800"
                onClick={() => copyToClipboard(txHash, "tx")}
              >
                {copiedField === "tx" ? "✓" : "copy"}
              </button>
              {explorerBase ? (
                <a
                  href={`${explorerBase}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-indigo-400 hover:underline px-1 py-0.5 rounded bg-indigo-950/40 border border-indigo-900/40"
                >
                  explorer ↗
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {timestamp && isConfirmed ? (
          <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
            <span>Confirmed:</span>
            <span>{new Date(timestamp).toLocaleTimeString()}</span>
          </div>
        ) : null}

        {error ? (
          <div className="rounded bg-rose-500/10 border border-rose-500/20 p-2 text-rose-400 text-[10px]">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
};

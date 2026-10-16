import React from "react";

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-paper-sunken text-[11px] uppercase tracking-wider text-ink-500 border-b border-border">
      {children}
    </thead>
  );
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border bg-paper-raised">{children}</tbody>;
}

export function Tr({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? "cursor-pointer hover:bg-paper-sunken transition-colors" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

export function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`text-left font-semibold px-4 py-3 ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 text-ink-900 ${className}`}>{children}</td>;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="px-4 py-3 bg-paper-sunken border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-500">
      <span>
        {totalItems} total · page {page} of {Math.max(totalPages, 1)}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-border bg-paper-raised font-semibold disabled:opacity-40 hover:border-border-strong transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-border bg-paper-raised font-semibold disabled:opacity-40 hover:border-border-strong transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

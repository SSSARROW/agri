"use client";

import { Button } from "./primitives";
import { Icon } from "./Icon";

export function Pagination({
  page, totalPages, total, pageSize, onPage,
}: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total === 0 || totalPages <= 1) {
    return total > 0 ? <p className="mt-4 text-xs text-ink-mute">{total} result{total === 1 ? "" : "s"}</p> : null;
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-xs text-ink-mute">Showing {from}–{to} of {total}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <Icon name="chevronLeft" size={14} /> Prev
        </Button>
        <span className="text-xs text-ink-soft tabular-nums">{page} / {totalPages}</span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          Next <Icon name="chevronRight" size={14} />
        </Button>
      </div>
    </nav>
  );
}

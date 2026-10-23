"use client";

import { useState } from "react";
import { api, parseError } from "@/lib/api";
import { fmtDate, titleCase } from "@/lib/format";
import type { Page, User } from "@/lib/types";
import { useDebounced } from "@/hooks/useDebounced";
import { useFetch } from "@/hooks/useFetch";
import { Alert, Badge, Button, EmptyState, ErrorState, ListSkeleton, Modal, PageHeader, Pagination, SearchInput, SelectField, StatusBadge, DefList, useConfirm, useToast } from "@/components/ui";

const PAGE_SIZE = 10;

export default function UsersPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<User | null>(null);

  const list = useFetch(() => api.get<Page<User>>("/actors", { params: { search: q || undefined, role: role || undefined, page, page_size: PAGE_SIZE } }).then((r) => r.data), [q, role, page]);

  const toggle = (u: User) => {
    const next = !(u.is_active ?? true);
    confirm({
      title: `${next ? "Activate" : "Deactivate"} ${u.name || u.email}?`,
      tone: next ? "primary" : "danger",
      confirmLabel: next ? "Activate" : "Deactivate",
      body: next ? "The account is marked active." : <>The account is marked inactive. <strong>Note:</strong> sign-in doesn’t check this flag yet, so the person can still use the app until that is enforced on the server.</>,
      onConfirm: async () => {
        try { await api.patch(`/actors/${u.id}`, { is_active: next }); } catch (e) { throw new Error(parseError(e).message); }
        toast.success(`Account set to ${next ? "Active" : "Inactive"}`); list.reload(); setOpen(null);
      },
    });
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Every account on Origo. Sensitive identifiers such as NIC hashes are never shown." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-60 flex-1 sm:max-w-sm"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, phone or email" /></div>
        <div className="w-40"><SelectField aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">All roles</option><option value="farmer">Farmers</option><option value="exporter">Exporters</option><option value="admin">Admins</option></SelectField></div>
      </div>

      {list.loading && !list.data ? <ListSkeleton /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data && list.data.items.length === 0 ? (
        <EmptyState icon="search" title="No users match" body="Try a different search or role." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-sunken/60 text-xs tracking-wide text-ink-mute uppercase">
              <tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Contact</th><th className="px-4 py-3 font-medium">District</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Joined</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data?.items.map((u) => (
                <tr key={u.id} className="hover:bg-sunken/40">
                  <td className="px-4 py-3 font-medium">{u.name || "—"}</td>
                  <td className="px-4 py-3"><Badge tone={u.role === "admin" ? "bark" : u.role === "exporter" ? "info" : "neutral"}>{titleCase(u.role)}</Badge></td>
                  <td className="px-4 py-3"><p>{u.email}</p><p className="text-xs text-ink-mute">{u.phone}</p></td>
                  <td className="px-4 py-3">{u.district || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={(u.is_active ?? true) ? "active" : "inactive"} /></td>
                  <td className="px-4 py-3 text-ink-mute">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setOpen(u)}>Details</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pagination page={list.data.page} totalPages={list.data.total_pages} total={list.data.total} pageSize={PAGE_SIZE} onPage={setPage} />}

      <Modal open={!!open} onClose={() => setOpen(null)} wide title={open?.name || open?.email || "User"}
        footer={open && <><Button variant="secondary" onClick={() => setOpen(null)}>Close</Button><Button variant={(open.is_active ?? true) ? "danger" : "primary"} onClick={() => toggle(open)}>{(open.is_active ?? true) ? "Deactivate account" : "Activate account"}</Button></>}>
        {open && (
          <div className="space-y-4">
            <Alert tone="info">Deactivating currently only sets the flag; it doesn’t block sign-in.</Alert>
            <DefList items={[
              { label: "Role", value: titleCase(open.role) }, { label: "Email", value: open.email }, { label: "Phone", value: open.phone }, { label: "District", value: open.district },
              ...(open.role === "farmer" ? [{ label: "DSD / GN", value: [open.dsd, open.gn_division].filter(Boolean).join(" / ") }, { label: "Farm address", value: open.farm_address }, { label: "Farm size", value: open.farm_size_ha != null ? `${open.farm_size_ha} ha` : "" }] : []),
              ...(open.role === "exporter" ? [{ label: "Company", value: open.business_name }, { label: "Registration no.", value: open.business_reg_no }, { label: "Licence no.", value: open.export_license_no }, { label: "Business address", value: open.business_address }] : []),
              { label: "Account ID", value: <code className="text-xs break-all">{open.id}</code> },
            ]} />
          </div>
        )}
      </Modal>
      {dialog}
    </>
  );
}

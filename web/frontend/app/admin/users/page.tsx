"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchActors, Actor } from "@/lib/api";
import {
  PageHeader,
  Alert,
  Badge,
  Input,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Pagination,
  EmptyState,
  SectionSpinner,
  UsersIcon,
  SearchIcon,
} from "@/components/ui";
import type { Tone } from "@/components/ui/badge";

const ROLE_TONE: Record<string, Tone> = {
  admin: "gold",
  exporter: "info",
  farmer: "brand",
};

export default function AdminUsersListPage() {
  const router = useRouter();

  const [actors, setActors] = useState<Actor[]>([]);
  const [loadingActors, setLoadingActors] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Fetch actors list
  const loadActors = useCallback(async () => {
    setLoadingActors(true);
    setError(null);
    try {
      const res = await fetchActors({
        search: searchTerm,
        role: selectedRole,
        page,
        page_size: 10,
      });
      setActors(res.items);
      setTotalPages(res.total_pages);
      setTotalItems(res.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load actor registry.");
    } finally {
      setLoadingActors(false);
    }
  }, [searchTerm, selectedRole, page]);

  useEffect(() => {
    loadActors();
  }, [loadActors]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value);
    setPage(1);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Admin"
        title="Actor Registry"
        subtitle="Manage platform users, roles, and account statuses."
      />

      <div className="space-y-5">
        {/* Controls Bar: Search & Role Filter */}
        <div className="bg-paper-raised border border-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-80 relative">
            <SearchIcon className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              aria-label="Search actors"
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <label className="text-xs text-ink-500 font-medium whitespace-nowrap">Filter role:</label>
            <Select value={selectedRole} onChange={handleRoleChange} className="w-auto">
              <option value="all">All roles</option>
              <option value="farmer">Farmer</option>
              <option value="exporter">Exporter</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
        </div>

        {error && <Alert tone="danger" title={error} />}

        {loadingActors ? (
          <SectionSpinner />
        ) : actors.length === 0 ? (
          <EmptyState icon={<UsersIcon className="w-6 h-6" />} title="No matching actors found" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Actor / Name</Th>
                <Th>Role</Th>
                <Th>Phone</Th>
                <Th>District</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </Thead>
            <Tbody>
              {actors.map((actor) => (
                <Tr key={actor.id} onClick={() => router.push(`/admin/users/${actor.id}`)}>
                  <Td>
                    <div className="font-semibold text-ink-900">{actor.name || actor.email}</div>
                    <div className="text-xs text-ink-500">{actor.email}</div>
                  </Td>
                  <Td>
                    <Badge tone={ROLE_TONE[actor.role] ?? "neutral"}>{actor.role}</Badge>
                  </Td>
                  <Td className="font-mono text-xs">{actor.phone || <span className="text-ink-400">—</span>}</Td>
                  <Td>{actor.district || <span className="text-ink-400">—</span>}</Td>
                  <Td>
                    <Badge tone={actor.is_active ? "success" : "danger"}>
                      {actor.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <span className="text-xs text-brand-700 font-semibold">View details →</span>
                  </Td>
                </Tr>
              ))}
            </Tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="p-0">
                  <Pagination page={page} totalPages={totalPages} totalItems={totalItems} onChange={setPage} />
                </td>
              </tr>
            </tfoot>
          </Table>
        )}
      </div>
    </div>
  );
}

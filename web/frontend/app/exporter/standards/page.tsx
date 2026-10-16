"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchStandards,
  createStandard,
  StandardData,
} from "@/lib/standardsApi";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Toast, ToastState } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { SectionSpinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardIcon } from "@/components/ui/icons";

const CROP_TABS = [
  { key: "", label: "All Crops" },
  { key: "tea", label: "Tea" },
  { key: "cinnamon", label: "Cinnamon" },
];

export default function ExporterStandardsListPage() {
  const router = useRouter();

  const [standards, setStandards] = useState<StandardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Filters & Pagination
  const [cropFilter, setCropFilter] = useState<string>("");
  const [archiveFilter, setArchiveFilter] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newCrop, setNewCrop] = useState<string>("tea");
  const [newName, setNewName] = useState<string>("v1 Premium Standard");
  const [creating, setCreating] = useState<boolean>(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStandardsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStandards({
        crop: cropFilter || undefined,
        is_archived: archiveFilter,
        page,
        page_size: 9,
      });
      setStandards(res.items);
      setTotalPages(res.total_pages);
      setTotalItems(res.total);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load quality standards.");
    } finally {
      setLoading(false);
    }
  }, [cropFilter, archiveFilter, page]);

  useEffect(() => {
    loadStandardsData();
  }, [loadStandardsData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast("Standard name is required", "error");
      return;
    }
    setCreating(true);
    try {
      const newStd = await createStandard({
        crop: newCrop,
        name: newName.trim(),
        grade_spec: {},
        stages: [],
      });
      showToast(`Created new quality standard for ${newCrop}`);
      setShowCreateModal(false);
      // Navigate to version editor
      router.push(`/exporter/standards/${newStd.id}/versions/1`);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to create quality standard", "error");
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (std: StandardData) => {
    const versions = std.versions || [];
    const publishedVer = versions.find((v) => v.status === "published");
    const draftVer = versions.find((v) => v.status === "draft");

    if (publishedVer && draftVer) {
      return (
        <Badge tone="success">
          v{publishedVer.version_number} Published · Draft v{draftVer.version_number}
        </Badge>
      );
    }
    if (publishedVer) {
      return <Badge tone="success">v{publishedVer.version_number} Published</Badge>;
    }
    if (draftVer) {
      return <Badge tone="warning">v{draftVer.version_number} Draft</Badge>;
    }
    return <Badge tone="neutral">No Versions</Badge>;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Toast toast={toast} />

      <PageHeader
        eyebrow="Exporter Portal"
        title="Quality Standards"
        subtitle="Define crop grading specifications, cultivation stages, and proof requirements for your farmers."
        action={<Button onClick={() => setShowCreateModal(true)}>Create New Standard</Button>}
      />

      <div className="space-y-6">
        {/* Filters & Controls */}
        <Card padded={false} className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-paper-sunken p-1 rounded-lg border border-border w-full sm:w-auto">
              {CROP_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setCropFilter(tab.key);
                    setPage(1);
                  }}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    cropFilter === tab.key
                      ? "bg-paper-raised text-brand-700 shadow-sm"
                      : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setArchiveFilter(!archiveFilter);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                archiveFilter
                  ? "bg-gold-50 text-gold-700 border-gold-200"
                  : "bg-paper-sunken text-ink-500 border-border hover:text-ink-900"
              }`}
            >
              {archiveFilter ? "Showing Archived" : "View Archive"}
            </button>
          </div>
        </Card>

        {/* Error State */}
        {error && (
          <Alert
            tone="danger"
            title={error}
            action={
              <button onClick={loadStandardsData} className="text-xs font-semibold underline text-danger">
                Retry
              </button>
            }
          />
        )}

        {/* Standards List / Grid */}
        {loading ? (
          <SectionSpinner />
        ) : standards.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardIcon className="w-6 h-6" />}
              title="No quality standards found"
              description={
                archiveFilter
                  ? "You do not have any archived quality standards."
                  : cropFilter
                  ? `No standards found for crop '${cropFilter}'. Create one to get started!`
                  : "You haven't defined any crop quality standards yet. Create your first standard to start."
              }
              action={
                !archiveFilter ? (
                  <Button onClick={() => setShowCreateModal(true)}>Create First Standard</Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {standards.map((std) => {
              const versions = std.versions || [];
              const latestVer = versions[0];
              return (
                <Card key={std.id} className="flex flex-col justify-between hover:border-border-strong transition-colors space-y-4">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-display font-semibold text-sm text-ink-900">
                        {latestVer?.name || `${std.crop.toUpperCase()} Standard`}
                      </h3>
                      <p className="text-[11px] text-ink-500 capitalize mt-0.5">Crop: {std.crop}</p>
                    </div>

                    <div>{getStatusBadge(std)}</div>

                    <div className="bg-paper-sunken p-3 rounded-lg border border-border text-[11px] text-ink-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Versions count:</span>
                        <span className="font-bold text-ink-700">{versions.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span className="text-ink-700">{new Date(std.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    <Link
                      href={`/exporter/standards/${std.id}`}
                      className="flex-1 text-center py-2 px-3 bg-paper-sunken hover:bg-paper-raised border border-border text-ink-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      View Versions
                    </Link>

                    {latestVer && (
                      <Link
                        href={`/exporter/standards/${std.id}/versions/${latestVer.version_number}`}
                        className="py-2 px-3 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-xs font-semibold rounded-lg transition-colors"
                      >
                        {latestVer.status === "draft" ? "Edit Draft" : "View Spec"}
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>
              Page {page} of {totalPages} ({totalItems} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── CREATE STANDARD MODAL ── */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Quality Standard"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Target Crop">
            <Select value={newCrop} onChange={(e) => setNewCrop(e.target.value)} className="capitalize">
              <option value="tea">Tea</option>
              <option value="cinnamon">Cinnamon</option>
            </Select>
          </Field>

          <Field label="Standard Name (Draft v1)">
            <Input
              type="text"
              placeholder="e.g. Export Grade A Black Tea Specification"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={creating}
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create & Open Editor"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

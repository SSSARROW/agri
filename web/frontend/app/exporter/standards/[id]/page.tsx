"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  fetchStandard,
  createNewDraft,
  duplicateStandard,
  archiveStandard,
  unarchiveStandard,
  StandardData,
  VersionSummary,
} from "@/lib/standardsApi";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Toast, ToastState } from "@/components/ui/toast";
import { SectionSpinner } from "@/components/ui/spinner";

export default function ExporterStandardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [standard, setStandard] = useState<StandardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStandardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStandard(id);
      setStandard(data);
    } catch (err: any) {
      if (err.status === 404) {
        setError("Quality standard not found or access denied.");
      } else {
        setError(err.detail || err.message || "Failed to fetch standard details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadStandardData();
    }
  }, [id, loadStandardData]);

  const handleCreateDraft = async () => {
    if (!standard) return;
    setActionLoading(true);
    try {
      const newVer = await createNewDraft(id);
      showToast(`Created new draft version v${newVer.version_number}`);
      router.push(`/exporter/standards/${id}/versions/${newVer.version_number}`);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to create draft version", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!standard) return;
    setActionLoading(true);
    try {
      const duplicated = await duplicateStandard(id);
      showToast("Standard duplicated successfully!");
      router.push(`/exporter/standards/${duplicated.id}`);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to duplicate standard", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!standard) return;
    setActionLoading(true);
    try {
      if (standard.is_archived) {
        await unarchiveStandard(id);
        showToast("Standard unarchived.");
      } else {
        await archiveStandard(id);
        showToast("Standard archived.");
      }
      loadStandardData();
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to update archive status", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <SectionSpinner />;
  }

  if (error || !standard) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link href="/exporter/standards" className="text-xs font-semibold text-brand-700 hover:text-brand-800">
          ← Back to Quality Standards
        </Link>
        <Alert tone="danger" title={error || "Standard not found"} />
      </div>
    );
  }

  const versions = standard.versions || [];
  const hasDraft = versions.some((v) => v.status === "draft");
  const hasPublished = versions.some((v) => v.status === "published");

  return (
    <div className="max-w-6xl mx-auto">
      <Toast toast={toast} />

      <div className="mb-4">
        <Link
          href="/exporter/standards"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          ← Back to Standards List
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Badge tone="neutral" className="capitalize">{standard.crop}</Badge>
        {standard.is_archived && <Badge tone="warning">Archived</Badge>}
        <span className="text-xs text-ink-400">ID: {standard.id}</span>
      </div>

      <PageHeader
        title={<span className="capitalize">{standard.crop} Quality Standard</span>}
        action={
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="secondary"
              disabled={actionLoading || hasDraft || !hasPublished}
              onClick={handleCreateDraft}
              title={
                hasDraft
                  ? "A draft version already exists. Edit the current draft first."
                  : !hasPublished
                  ? "Must have at least one published version before creating a new draft."
                  : "Create a new draft version by copying latest published version"
              }
            >
              + New Draft Version
            </Button>

            <Button variant="secondary" disabled={actionLoading} onClick={handleDuplicate}>
              Duplicate Standard
            </Button>

            <Button variant="secondary" disabled={actionLoading} onClick={handleToggleArchive}>
              {standard.is_archived ? "Unarchive" : "Archive"}
            </Button>
          </div>
        }
      />

      {/* Main Content: Versions Table / Timeline */}
      <Card>
        <CardHeader
          title="Versions History"
          action={<span className="text-xs text-ink-500">{versions.length} total versions</span>}
        />

        {versions.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-500">No version records found.</div>
        ) : (
          <div className="space-y-3">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="p-4 bg-paper-sunken border border-border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-border-strong transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-sm text-ink-900">
                      Version {ver.version_number}: {ver.name}
                    </span>
                    <Badge tone={ver.status === "published" ? "success" : "warning"}>
                      {ver.status}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-ink-500 flex items-center gap-4">
                    <span>Created: {new Date(ver.created_at).toLocaleString()}</span>
                    {ver.published_at && (
                      <span className="text-success">
                        Published: {new Date(ver.published_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    href={`/exporter/standards/${id}/versions/${ver.version_number}`}
                    variant={ver.status === "draft" ? "primary" : "secondary"}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    {ver.status === "draft" ? "Edit Draft" : "View Read-Only Spec"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

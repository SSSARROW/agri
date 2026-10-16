"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import {
  fetchApplicants,
  approveApplicant,
  declineApplicant,
  ApplicantItem,
  AdApplicantsResponse,
} from "@/lib/adsApi";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionSpinner } from "@/components/ui/spinner";
import { Toast, ToastState } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { ChevronRightIcon, UsersIcon } from "@/components/ui/icons";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdApplicantsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const adId = resolvedParams.id;

  const [data, setData] = useState<AdApplicantsResponse | null>(null);
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Approve Modal State
  const [approvingApplicant, setApprovingApplicant] = useState<ApplicantItem | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Decline Modal State
  const [decliningApplicant, setDecliningApplicant] = useState<ApplicantItem | null>(null);
  const [declineReason, setDeclineReason] = useState<string>("Capacity fulfilled / ineligible");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, profRes] = await Promise.all([
        fetchApplicants(adId, {
          status: statusFilter || undefined,
          search: searchQuery || undefined,
          page,
          page_size: 10,
        }),
        fetchExporterProfile().catch(() => null),
      ]);
      setData(appsRes);
      if (profRes) setProfile(profRes);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load advertisement applicants.");
    } finally {
      setLoading(false);
    }
  }, [adId, statusFilter, searchQuery, page]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  const handleApprove = async () => {
    if (!approvingApplicant) return;
    setActionLoading(true);
    try {
      await approveApplicant(adId, approvingApplicant.acceptance_id);
      showToast(`Approved ${approvingApplicant.farmer_name} for ${approvingApplicant.supply_quantity_kg}kg.`);
      setApprovingApplicant(null);
      loadApplicants();
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to approve applicant.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!decliningApplicant) return;
    setActionLoading(true);
    try {
      await declineApplicant(adId, decliningApplicant.acceptance_id, declineReason);
      showToast(`Declined application from ${decliningApplicant.farmer_name}.`);
      setDecliningApplicant(null);
      loadApplicants();
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to decline applicant.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const isVerified = profile?.status === "verified";

  const STATUS_LABELS: Record<ApplicantItem["derived_status"], string> = {
    approved: "Approved",
    pending: "Pending Review",
    declined: "Declined",
    withdrawn: "Withdrawn",
    removed: "Removed",
  };

  const progressPercent = data && data.target_quantity_kg > 0
    ? Math.min(100, Math.round((data.approved_quantity_kg / data.target_quantity_kg) * 100))
    : 0;

  const STATUS_TABS = [
    { id: "", label: "All Applicants" },
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "declined", label: "Declined" },
    { id: "withdrawn", label: "Withdrawn" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <Toast toast={toast} />

      {/* Header */}
      <div className="pb-6 border-b border-border mb-6">
        <Link
          href={`/exporter/ads/${adId}`}
          className="text-xs font-semibold text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 transition-colors"
        >
          <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" /> Back to Advertisement
        </Link>

        <div className="mt-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider bg-paper-sunken text-ink-700 border border-border">
                {data?.crop || "Ad"}
              </span>
              <h1 className="font-display text-2xl font-semibold text-ink-900">
                Purchase Request Applicants
              </h1>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Review and approve supply proposals from local smallholder farmers.
            </p>
          </div>

          {data?.is_filled && <Badge tone="success">Target Capacity Fulfilled (100%)</Badge>}
        </div>

        {/* Capacity Summary Progress Card */}
        {data && (
          <Card className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-ink-500 block mb-0.5">Target Volume</span>
                <span className="text-base font-display font-semibold text-ink-900">
                  {Number(data.target_quantity_kg).toLocaleString()} kg
                </span>
              </div>
              <div>
                <span className="text-ink-500 block mb-0.5">Approved Volume</span>
                <span className="text-base font-display font-semibold text-brand-700">
                  {Number(data.approved_quantity_kg).toLocaleString()} kg
                </span>
              </div>
              <div>
                <span className="text-ink-500 block mb-0.5">Pending Proposals</span>
                <span className="text-base font-display font-semibold text-gold-600">
                  {Number(data.pending_quantity_kg).toLocaleString()} kg
                </span>
              </div>
              <div>
                <span className="text-ink-500 block mb-0.5">Remaining Capacity</span>
                <span className="text-base font-display font-semibold text-ink-900">
                  {Number(data.remaining_quantity_kg).toLocaleString()} kg
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-ink-500 mb-1.5 font-medium">
                <span>Progress: {progressPercent}% of target</span>
                <span>{Number(data.remaining_quantity_kg).toLocaleString()} kg remaining</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-paper-sunken overflow-hidden border border-border">
                <div
                  className="h-full bg-brand-700 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Unverified Exporter Warning */}
      {!isVerified && profile && (
        <div className="mb-6">
          <Alert tone="warning" title="Account verification required for approvals">
            You can review applicant submissions in read-only mode. Approving
            supply commitments requires an approved and verified exporter
            profile.
          </Alert>
        </div>
      )}

      {/* Filters & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-paper-sunken border border-border text-xs overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? "bg-paper-raised text-brand-700 shadow-sm"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="max-w-xs w-full">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by farmer name..."
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SectionSpinner />
      ) : error ? (
        <Card className="text-center">
          <p className="text-danger font-semibold text-sm mb-2">Error loading applicants</p>
          <p className="text-ink-500 text-xs mb-4">{error}</p>
          <Button variant="secondary" size="sm" onClick={loadApplicants}>
            Retry
          </Button>
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<UsersIcon className="w-6 h-6" />}
            title="No applicants found"
            description={
              statusFilter || searchQuery
                ? "No applicants match your current filters. Try resetting status or search."
                : "No farmers have accepted this advertisement yet. Eligible farmers can accept via the farmer API."
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {data.items.map((app) => {
            const isPending = app.derived_status === "pending";
            const acceptedDate = new Date(app.accepted_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <Card key={app.acceptance_id} className="hover:border-border-strong transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Farmer Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-base font-semibold text-ink-900">
                        {app.farmer_name}
                      </h3>
                      <Badge tone={{ approved: "success" as const, pending: "warning" as const, declined: "danger" as const, withdrawn: "neutral" as const, removed: "neutral" as const }[app.derived_status]}>
                        {STATUS_LABELS[app.derived_status]}
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                      <span>
                        District: <strong className="text-ink-700">{app.farmer_district || "Not specified"}</strong>
                      </span>
                      {app.dsd && <span>DSD: {app.dsd}</span>}
                      {app.farm_size_ha && <span>Farm Size: {app.farm_size_ha} ha</span>}
                      <span>Accepted: {acceptedDate}</span>
                    </div>

                    {/* Plots snippet */}
                    {app.plots.length > 0 && (
                      <div className="mt-2 text-xs text-ink-500">
                        Plots:{" "}
                        {app.plots.map((p) => `${p.name} (${p.area_ha ? p.area_ha + " ha" : "N/A"})`).join(", ")}
                      </div>
                    )}

                    {/* Phone Privacy Section */}
                    <div className="mt-3 text-xs">
                      {app.derived_status === "approved" ? (
                        <span className="inline-flex items-center gap-1.5 text-success font-mono bg-success-bg px-2.5 py-1 rounded-lg border border-success-border">
                          {app.phone || "No phone on profile"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-ink-500 bg-paper-sunken px-2.5 py-1 rounded-lg border border-border">
                          Phone hidden until approved
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Supply Quantity & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-border">
                    <div className="text-right">
                      <span className="text-ink-500 text-xs block">Offered Supply</span>
                      <span className="text-lg font-display font-semibold text-brand-700">
                        {Number(app.supply_quantity_kg).toLocaleString()} kg
                      </span>
                    </div>

                    {/* Decision Actions */}
                    {isPending && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDecliningApplicant(app)}
                          disabled={!isVerified || actionLoading}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setApprovingApplicant(app)}
                          disabled={!isVerified || actionLoading}
                        >
                          Approve Supply
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-ink-500">
            Page <span className="font-semibold text-ink-700">{page}</span> of{" "}
            <span className="font-semibold text-ink-700">{data.total_pages}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
              disabled={page >= data.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        open={!!approvingApplicant && !!data}
        onClose={() => setApprovingApplicant(null)}
        onConfirm={handleApprove}
        title="Confirm Supply Approval"
        confirmLabel="Confirm & Approve"
        loading={actionLoading}
      >
        {approvingApplicant && data && (
          <>
            <p className="text-xs text-ink-500 leading-relaxed">
              You are approving <strong className="text-ink-900">{approvingApplicant.farmer_name}</strong> to supply{" "}
              <strong className="text-brand-700">{Number(approvingApplicant.supply_quantity_kg).toLocaleString()} kg</strong> of harvest.
              This will create an approved farmer link and disclose the farmer's contact phone number.
            </p>

            <div className="mt-4 p-3 rounded-lg bg-paper-sunken border border-border space-y-1.5 text-xs">
              <div className="flex justify-between text-ink-500">
                <span>Current Approved:</span>
                <span className="font-semibold text-ink-900">{Number(data.approved_quantity_kg).toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>New Approval:</span>
                <span className="font-semibold text-brand-700">+{Number(approvingApplicant.supply_quantity_kg).toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 text-ink-700 font-bold">
                <span>Remaining Capacity:</span>
                <span className="text-success">
                  {Math.max(0, data.remaining_quantity_kg - approvingApplicant.supply_quantity_kg).toLocaleString()} kg
                </span>
              </div>
            </div>
          </>
        )}
      </ConfirmModal>

      {/* Decline Reason Modal */}
      <ConfirmModal
        open={!!decliningApplicant}
        onClose={() => setDecliningApplicant(null)}
        onConfirm={handleDecline}
        title="Decline Application"
        confirmLabel="Confirm Decline"
        confirmVariant="danger"
        loading={actionLoading}
      >
        {decliningApplicant && (
          <>
            <p className="text-xs text-ink-500">
              Decline supply application from <strong className="text-ink-900">{decliningApplicant.farmer_name}</strong>.
              You may provide an optional reason.
            </p>

            <div className="mt-4">
              <Field label="Reason for Declining (Optional)">
                <Textarea
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g. Sourcing capacity filled, logistics outside range..."
                />
              </Field>
            </div>
          </>
        )}
      </ConfirmModal>
    </div>
  );
}

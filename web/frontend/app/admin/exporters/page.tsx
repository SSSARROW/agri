"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  fetchAdminExporters,
  fetchAdminExporterDetails,
  approveExporter,
  rejectExporter,
  reopenExporter,
  ExporterAdminProfile,
} from "@/lib/adminExporterApi";
import {
  PageHeader,
  Alert,
  Badge,
  StatusBadge,
  Button,
  Input,
  Textarea,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Pagination,
  EmptyState,
  SectionSpinner,
  Spinner,
  Toast,
  ToastState,
  Modal,
  ConfirmModal,
  BuildingIcon,
  SearchIcon,
} from "@/components/ui";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

export default function AdminExporterVerificationPage() {
  // List State
  const [exporters, setExporters] = useState<ExporterAdminProfile[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Filters & Pagination
  const [activeTab, setActiveTab] = useState<"pending" | "verified" | "rejected" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, verified: 0, rejected: 0 });

  // Drawer / Selection State
  const [selectedExporter, setSelectedExporter] = useState<ExporterAdminProfile | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modal Dialog States
  const [confirmApproveModal, setConfirmApproveModal] = useState<ExporterAdminProfile | null>(null);
  const [confirmReopenModal, setConfirmReopenModal] = useState<ExporterAdminProfile | null>(null);
  const [rejectModal, setRejectModal] = useState<ExporterAdminProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Toast Helper
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load exporters list
  const loadExporters = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetchAdminExporters({
        status: activeTab,
        search: searchTerm,
        page,
        pageSize: 10,
      });
      setExporters(res.items);
      setTotalPages(res.total_pages);
      setTotalItems(res.total);
      setCounts(res.counts);
    } catch (err: any) {
      setError(err.message || "Failed to load exporter applications.");
    } finally {
      setLoadingList(false);
    }
  }, [activeTab, searchTerm, page]);

  useEffect(() => {
    loadExporters();
  }, [loadExporters]);

  // Inspect details
  const handleSelectExporter = async (id: string) => {
    setLoadingDetails(true);
    try {
      const details = await fetchAdminExporterDetails(id);
      setSelectedExporter(details);
    } catch (err: any) {
      showToast(err.message || "Failed to fetch detailed profile", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Actions
  const handleApprove = async () => {
    if (!confirmApproveModal) return;
    setSubmittingAction(true);
    try {
      await approveExporter(confirmApproveModal.id);
      showToast(`Approved ${confirmApproveModal.company_name || "Exporter"}`);
      setConfirmApproveModal(null);
      if (selectedExporter?.id === confirmApproveModal.id) {
        handleSelectExporter(confirmApproveModal.id);
      }
      loadExporters();
    } catch (err: any) {
      showToast(err.message || "Approve failed", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      showToast("Please provide a rejection reason.", "error");
      return;
    }
    setSubmittingAction(true);
    try {
      await rejectExporter(rejectModal.id, rejectReason.trim());
      showToast(`Rejected ${rejectModal.company_name || "Exporter"}`);
      setRejectModal(null);
      setRejectReason("");
      if (selectedExporter?.id === rejectModal.id) {
        handleSelectExporter(rejectModal.id);
      }
      loadExporters();
    } catch (err: any) {
      showToast(err.message || "Reject failed", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReopen = async () => {
    if (!confirmReopenModal) return;
    setSubmittingAction(true);
    try {
      await reopenExporter(confirmReopenModal.id);
      showToast(`Reopened verification for ${confirmReopenModal.company_name || "Exporter"}`);
      setConfirmReopenModal(null);
      if (selectedExporter?.id === confirmReopenModal.id) {
        handleSelectExporter(confirmReopenModal.id);
      }
      loadExporters();
    } catch (err: any) {
      showToast(err.message || "Reopen failed", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Toast toast={toast} />

      <PageHeader
        eyebrow="Admin"
        title="Exporter Verification"
        subtitle="Review, approve or reject exporter business applications."
        action={
          counts.pending > 0 ? (
            <Badge tone="warning">{counts.pending} pending</Badge>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List & Controls */}
        <div className={`${selectedExporter ? "lg:col-span-7" : "lg:col-span-12"} space-y-5 transition-all duration-300`}>
          {/* Controls Bar: Tabs & Search */}
          <div className="bg-paper-raised border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-paper-sunken p-1 rounded-lg border border-border w-full md:w-auto overflow-x-auto">
              {TABS.map((tab) => {
                const count = tab.key === "all" ? null : counts[tab.key];
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setPage(1);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? "bg-paper-raised text-ink-900 shadow-sm border border-border"
                        : "text-ink-500 hover:text-ink-700"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {count !== null && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive ? "bg-brand-50 text-brand-700" : "bg-paper-raised text-ink-500"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="w-full md:w-64 relative">
              <SearchIcon className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                aria-label="Search exporters"
                placeholder="Search company, email, reg no..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          {error && (
            <Alert
              tone="danger"
              title={error}
              action={
                <button onClick={loadExporters} className="text-xs font-semibold text-danger underline">
                  Retry
                </button>
              }
            />
          )}

          {loadingList ? (
            <SectionSpinner />
          ) : exporters.length === 0 ? (
            <EmptyState
              icon={<BuildingIcon className="w-6 h-6" />}
              title="No exporter applications found"
              description={
                searchTerm
                  ? `No matching records for "${searchTerm}".`
                  : `There are currently no exporter accounts with status '${activeTab}'.`
              }
            />
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Reg / Licence</Th>
                  <Th>Contact</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </Thead>
              <Tbody>
                {exporters.map((item) => {
                  const isSelected = selectedExporter?.id === item.id;
                  return (
                    <Tr
                      key={item.id}
                      onClick={() => handleSelectExporter(item.id)}
                      className={isSelected ? "bg-brand-50" : ""}
                    >
                      <Td>
                        <div className="font-semibold text-ink-900">{item.company_name || "(No Company Name)"}</div>
                        <div className="text-xs text-ink-500">{item.email || item.users?.email || "—"}</div>
                      </Td>
                      <Td>
                        <div className="font-mono text-xs text-ink-700">Reg: {item.business_reg_no || "—"}</div>
                        <div className="font-mono text-xs text-ink-500">Lic: {item.export_licence_no || "—"}</div>
                      </Td>
                      <Td>
                        <div>{item.contact_person || item.users?.name || "—"}</div>
                        <div className="text-xs text-ink-500">{item.phone || item.users?.phone || "—"}</div>
                      </Td>
                      <Td>
                        <StatusBadge status={item.status} />
                      </Td>
                      <Td className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectExporter(item.id);
                          }}
                        >
                          View
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
              {totalPages > 1 && (
                <tfoot>
                  <tr>
                    <td colSpan={5} className="p-0">
                      <Pagination page={page} totalPages={totalPages} totalItems={totalItems} onChange={setPage} />
                    </td>
                  </tr>
                </tfoot>
              )}
            </Table>
          )}
        </div>

        {/* Right Column: Detail Drawer */}
        {selectedExporter && (
          <div className="lg:col-span-5 bg-paper-raised border border-border rounded-xl p-6 flex flex-col justify-between gap-6 h-fit">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold text-ink-900">
                      {selectedExporter.company_name || "Exporter Details"}
                    </h2>
                    <StatusBadge status={selectedExporter.status} />
                  </div>
                  <p className="text-xs text-ink-500 mt-1">ID: {selectedExporter.id}</p>
                </div>
                <button
                  onClick={() => setSelectedExporter(null)}
                  aria-label="Close"
                  className="text-ink-400 hover:text-ink-700 transition-colors p-1 shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {loadingDetails ? (
                <SectionSpinner />
              ) : (
                <div className="space-y-5 text-sm">
                  {selectedExporter.status === "rejected" && (
                    <Alert tone="danger" title="Rejection reason">
                      {selectedExporter.rejection_reason || "No reason specified."}
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-3 bg-paper-sunken p-4 rounded-xl border border-border">
                    <div>
                      <p className="text-ink-500 text-[10px] uppercase font-bold">Business Reg No</p>
                      <p className="font-mono text-ink-900 font-medium">{selectedExporter.business_reg_no || "—"}</p>
                    </div>
                    <div>
                      <p className="text-ink-500 text-[10px] uppercase font-bold">Export Licence No</p>
                      <p className="font-mono text-ink-900 font-medium">{selectedExporter.export_licence_no || "—"}</p>
                    </div>
                    <div>
                      <p className="text-ink-500 text-[10px] uppercase font-bold">Contact Person</p>
                      <p className="text-ink-900 font-medium">
                        {selectedExporter.contact_person || selectedExporter.users?.name || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-500 text-[10px] uppercase font-bold">Phone</p>
                      <p className="text-ink-900 font-medium">
                        {selectedExporter.phone || selectedExporter.users?.phone || "—"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-ink-500 text-[10px] uppercase font-bold">Email</p>
                      <p className="text-ink-900 font-medium">
                        {selectedExporter.email || selectedExporter.users?.email || "—"}
                      </p>
                    </div>
                  </div>

                  {selectedExporter.description && (
                    <div>
                      <p className="text-ink-500 text-[10px] uppercase font-bold mb-1">Company Overview</p>
                      <p className="p-3 bg-paper-sunken rounded-xl border border-border text-ink-700 leading-relaxed">
                        {selectedExporter.description}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <p className="text-ink-500 text-[10px] uppercase font-bold mb-1.5">Crops Bought</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedExporter.crops_bought && selectedExporter.crops_bought.length > 0 ? (
                          selectedExporter.crops_bought.map((crop) => (
                            <Badge key={crop} tone="brand" className="capitalize">
                              {crop}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-ink-400 text-xs">None listed</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-ink-500 text-[10px] uppercase font-bold mb-1.5">Districts Served</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedExporter.districts_served && selectedExporter.districts_served.length > 0 ? (
                          selectedExporter.districts_served.map((district) => (
                            <Badge key={district} tone="info" className="capitalize">
                              {district}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-ink-400 text-xs">None listed</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-ink-500 text-[10px] uppercase font-bold mb-1.5">Certifications</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedExporter.certifications && selectedExporter.certifications.length > 0 ? (
                          selectedExporter.certifications.map((cert) => (
                            <Badge key={cert} tone="gold" className="capitalize">
                              {cert.replace("_", " ")}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-ink-400 text-xs">None uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-ink-700 text-xs font-bold mb-3">Verification Audit History</p>
                    {selectedExporter.history && selectedExporter.history.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedExporter.history.map((log) => (
                          <div key={log.id} className="p-3 bg-paper-sunken rounded-xl border border-border space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold capitalize text-brand-700">Action: {log.action}</span>
                              <span className="text-ink-500 text-[10px]">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-ink-500">
                              Status:{" "}
                              <span className="text-ink-700 font-mono">
                                {log.previous_status} → {log.new_status}
                              </span>
                            </div>
                            {log.reason && (
                              <div className="text-xs text-danger italic">Reason: "{log.reason}"</div>
                            )}
                            <div className="text-[10px] text-ink-400">
                              By Admin: {log.admin_user?.email || log.admin_user_id || "System / CLI"}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-ink-400 text-xs italic">No verification actions recorded yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!loadingDetails && selectedExporter && (
              <div className="pt-4 border-t border-border flex items-center gap-3">
                {selectedExporter.status === "pending" && (
                  <>
                    <Button variant="primary" className="flex-1" onClick={() => setConfirmApproveModal(selectedExporter)}>
                      Approve exporter
                    </Button>
                    <Button variant="danger" className="flex-1" onClick={() => setRejectModal(selectedExporter)}>
                      Reject...
                    </Button>
                  </>
                )}

                {selectedExporter.status === "verified" && (
                  <>
                    <Button variant="danger" className="flex-1" onClick={() => setRejectModal(selectedExporter)}>
                      Revoke / Reject...
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmReopenModal(selectedExporter)}>
                      Reopen
                    </Button>
                  </>
                )}

                {selectedExporter.status === "rejected" && (
                  <>
                    <Button variant="primary" className="flex-1" onClick={() => setConfirmApproveModal(selectedExporter)}>
                      Re-approve exporter
                    </Button>
                    <Button variant="gold" onClick={() => setConfirmReopenModal(selectedExporter)}>
                      Reopen to pending
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approve confirm modal */}
      <ConfirmModal
        open={!!confirmApproveModal}
        onClose={() => setConfirmApproveModal(null)}
        onConfirm={handleApprove}
        title="Approve Exporter Account"
        confirmLabel="Confirm approval"
        confirmVariant="primary"
        loading={submittingAction}
      >
        Are you sure you want to approve{" "}
        <span className="font-semibold text-ink-900">{confirmApproveModal?.company_name}</span>? This will set their
        status to <span className="font-semibold text-brand-700">verified</span> and unlock export features.
      </ConfirmModal>

      {/* Reject dialog modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => {
          setRejectModal(null);
          setRejectReason("");
        }}
        title="Reject Exporter Application"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={submittingAction}
              onClick={() => {
                setRejectModal(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={submittingAction || !rejectReason.trim()}
              onClick={handleReject}
            >
              {submittingAction ? (
                <>
                  <Spinner size={14} /> Processing...
                </>
              ) : (
                "Confirm rejection"
              )}
            </Button>
          </>
        }
      >
        <p className="mb-3">
          Please specify the reason for rejecting{" "}
          <span className="font-semibold text-ink-900">{rejectModal?.company_name}</span>. The exporter will see
          this message in their account banner.
        </p>
        <Textarea
          rows={3}
          placeholder="e.g. Invalid export licence number provided..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      {/* Reopen confirm modal */}
      <ConfirmModal
        open={!!confirmReopenModal}
        onClose={() => setConfirmReopenModal(null)}
        onConfirm={handleReopen}
        title="Reopen Verification"
        confirmLabel="Confirm reopen"
        confirmVariant="primary"
        loading={submittingAction}
      >
        Are you sure you want to reset status for{" "}
        <span className="font-semibold text-ink-900">{confirmReopenModal?.company_name}</span> back to{" "}
        <span className="font-semibold text-gold-600">pending</span>?
      </ConfirmModal>
    </div>
  );
}

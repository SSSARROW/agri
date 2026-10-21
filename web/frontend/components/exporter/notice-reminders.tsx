"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  fetchNoticeReminders,
  retryFailedReminders,
  NoticeRemindersResponse,
  SlotStats,
  DeliveryItem,
} from "@/lib/remindersApi";
import { fetchExporterProfile } from "@/lib/exporterApi";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td, Pagination } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Toast, ToastState } from "@/components/ui/toast";
import { SectionSpinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";

interface NoticeRemindersProps {
  noticeId: string;
  isDraft?: boolean;
}

const STATUS_TONE: Record<string, Tone> = {
  sent: "success",
  read: "info",
  pending: "warning",
  sending: "warning",
  failed: "danger",
  skipped: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  sent: "Sent",
  read: "Read",
  pending: "Pending",
  sending: "Sending",
  failed: "Failed",
  skipped: "Skipped",
};

const SKIP_REASON_LABEL: Record<string, string> = {
  already_replied: "Already replied",
  no_longer_approved: "Link not approved",
  ineligible_district: "Ineligible district",
  district_unknown: "District unknown",
  missed: "Earlier slot missed",
  notice_cancelled: "Notice cancelled",
  month_started: "Target month started",
};

export function NoticeReminders({ noticeId, isDraft }: NoticeRemindersProps) {
  // Flag check: if disabled, do not render
  const flagEnabled = process.env.NEXT_PUBLIC_ENABLE_NOTICE_REMINDERS !== "false";
  if (!flagEnabled) return null;

  const [data, setData] = useState<NoticeRemindersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [isVerified, setIsVerified] = useState(true);

  // Filters & pagination
  const [slotFilter, setSlotFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState(false);

  // Check exporter verification status
  useEffect(() => {
    fetchExporterProfile()
      .then((p) => {
        setIsVerified(p.status === "verified");
      })
      .catch(() => {
        setIsVerified(false);
      });
  }, []);

  const loadData = useCallback(async () => {
    if (isDraft) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetchNoticeReminders(noticeId, {
        slot: slotFilter,
        status: statusFilter || undefined,
        page,
        pageSize: 10,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load reminder deliveries.");
    } finally {
      setLoading(false);
    }
  }, [noticeId, slotFilter, statusFilter, page, isDraft]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetryFailed = async () => {
    if (!isVerified) return;
    try {
      setRetrying(true);
      const res = await retryFailedReminders(noticeId);
      setToast({
        message: res.message || `Reset ${res.retried_count} failed reminder(s).`,
        type: "success",
      });
      loadData();
    } catch (err: any) {
      setToast({
        message: err.message || "Could not reset failed reminders.",
        type: "error",
      });
    } finally {
      setRetrying(false);
    }
  };

  // Safe draft rendering
  if (isDraft) {
    return (
      <Card className="mt-8 border-ink-100">
        <CardHeader
          title="Farmer Planting Reminders"
          subtitle="Automated dispatch at 30, 14, and 7 days prior to target planting month"
        />
        <div className="p-6">
          <EmptyState
            title="Reminders start after the notice is published"
            description="Once published, eligible farmers who haven't replied will receive automated reminder notices at scheduled intervals."
          />
        </div>
      </Card>
    );
  }

  const hasFailedItems = (data?.slots || []).some((s) => s.failed > 0);

  return (
    <Card className="mt-8 border-ink-100">
      <CardHeader
        title="Farmer Planting Reminders"
        subtitle="Automated dispatch tracking at 30, 14, and 7 days prior to target planting month"
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={!isVerified || !hasFailedItems || retrying}
              onClick={handleRetryFailed}
              title={!isVerified ? "Only verified exporters can retry failed reminders" : undefined}
            >
              {retrying ? "Retrying..." : "Retry Failed"}
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Simulation note if mock provider */}
        {data?.provider === "mock" && (
          <Alert
            tone="info"
            title="Simulated Delivery Active"
          >
            Reminders are sent by a scheduled job. Currently delivery is simulated via the mock provider.
          </Alert>
        )}

        {!isVerified && hasFailedItems && (
          <Alert tone="warning" title="Verification Required">
            Your exporter account is not yet verified. Failed reminders can only be retried by verified exporters.
          </Alert>
        )}

        {/* 3 Slot Cards */}
        {loading && !data ? (
          <SectionSpinner />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(data?.slots || []).map((slot: SlotStats) => (
              <div
                key={slot.slot}
                className="p-4 rounded-lg border border-ink-100 bg-ink-50/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-900">
                    {slot.slot} Days Before
                  </span>
                  <Badge tone="neutral">
                    {slot.scheduled_date ? new Date(slot.scheduled_date).toLocaleDateString() : "Scheduled"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white p-2 rounded border border-ink-100">
                    <span className="text-ink-500 block">Sent</span>
                    <span className="text-base font-semibold text-emerald-700">
                      {slot.sent}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-ink-100">
                    <span className="text-ink-500 block">Failed</span>
                    <span className={`text-base font-semibold ${slot.failed > 0 ? "text-rose-600" : "text-ink-700"}`}>
                      {slot.failed}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-ink-100">
                    <span className="text-ink-500 block">Skipped</span>
                    <span className="text-base font-semibold text-ink-700">
                      {slot.skipped}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-ink-100">
                    <span className="text-ink-500 block">Pending</span>
                    <span className="text-base font-semibold text-amber-600">
                      {slot.pending}
                    </span>
                  </div>
                </div>

                {slot.skipped > 0 && Object.keys(slot.skipped_reasons).length > 0 && (
                  <div className="text-[11px] text-ink-500 pt-1 border-t border-ink-100/80">
                    <span className="font-medium text-ink-700">Skip breakdown:</span>{" "}
                    {Object.entries(slot.skipped_reasons)
                      .map(([reason, count]) => `${SKIP_REASON_LABEL[reason] || reason}: ${count}`)
                      .join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Deliveries Outbox Table */}
        <div className="pt-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-ink-900">
              Delivery Outbox
            </h4>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by reminder slot"
                className="text-xs border border-ink-200 rounded px-2.5 py-1.5 bg-white text-ink-800"
                value={slotFilter || ""}
                onChange={(e) => {
                  setSlotFilter(e.target.value ? Number(e.target.value) : undefined);
                  setPage(1);
                }}
              >
                <option value="">All Slots</option>
                <option value="30">30 Days</option>
                <option value="14">14 Days</option>
                <option value="7">7 Days</option>
              </select>

              <select
                aria-label="Filter by reminder delivery status"
                className="text-xs border border-ink-200 rounded px-2.5 py-1.5 bg-white text-ink-800"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="sent">Sent</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
          </div>

          {error && <Alert tone="danger" title="Error">{error}</Alert>}

          {loading ? (
            <SectionSpinner />
          ) : !data || data.deliveries.length === 0 ? (
            <EmptyState
              title="No reminder deliveries recorded"
              description="Deliveries will appear here as scheduled reminder jobs evaluate your linked farmers."
            />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Farmer</Th>
                  <Th>Slot</Th>
                  <Th>Channel</Th>
                  <Th>Status</Th>
                  <Th>Reason / Error</Th>
                  <Th>Sent At</Th>
                  <Th>Attempts</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data.deliveries.map((item: DeliveryItem) => (
                  <Tr key={item.id}>
                    <Td className="font-medium text-ink-900">
                      {item.farmer_name}
                    </Td>
                    <Td className="text-ink-700">
                      {item.reminder_slot}d
                    </Td>
                    <Td className="text-ink-600 uppercase text-xs">
                      {item.channel}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[item.status] || "neutral"}>
                        {STATUS_LABEL[item.status] || item.status}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-ink-600">
                      {item.skip_reason
                        ? SKIP_REASON_LABEL[item.skip_reason] || item.skip_reason
                        : item.last_error
                        ? item.last_error
                        : "—"}
                    </Td>
                    <Td className="text-xs text-ink-500">
                      {item.sent_at ? new Date(item.sent_at).toLocaleString() : "—"}
                    </Td>
                    <Td className="text-xs text-ink-600">
                      {item.attempts}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {data && data.total_pages > 1 && (
            <Pagination
              page={page}
              totalPages={data.total_pages}
              totalItems={data.total}
              onChange={setPage}
            />
          )}
        </div>
      </div>

      <Toast toast={toast} />
    </Card>
  );
}

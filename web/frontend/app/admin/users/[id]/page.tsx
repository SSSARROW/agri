"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { fetchActorById, updateActorActiveStatus, clearAuthToken, Actor } from "@/lib/api";
import {
  PageHeader,
  Alert,
  Badge,
  Button,
  Card,
  SectionSpinner,
  Spinner,
} from "@/components/ui";
import type { Tone } from "@/components/ui/badge";

const ROLE_TONE: Record<string, Tone> = {
  admin: "gold",
  exporter: "info",
  farmer: "brand",
};

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border last:border-b-0">
      <span className="text-ink-500">{label}</span>
      <span className={`font-medium text-ink-900 text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const actorId = resolvedParams.id;
  const router = useRouter();

  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const actorData = await fetchActorById(actorId);
        setActor(actorData);
      } catch (err: any) {
        if (err.response?.status === 401) {
          clearAuthToken();
          router.push("/");
        } else {
          setError(err.response?.data?.detail || "Failed to load actor profile.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [actorId, router]);

  const handleToggleActive = async () => {
    if (!actor) return;
    setUpdating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateActorActiveStatus(actor.id, !actor.is_active);
      setActor(updated);
      setSuccessMessage(`Actor status successfully set to ${updated.is_active ? "Active" : "Inactive"}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update actor status.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <SectionSpinner />;
  }

  if (error && !actor) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert
          tone="danger"
          title={error}
          action={
            <Button href="/admin/users" variant="secondary" size="sm">
              Back to registry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Admin"
        title="Actor Profile Detail"
        subtitle={actor?.id ? `ID: ${actor.id}` : undefined}
        action={
          <Button href="/admin/users" variant="secondary" size="sm">
            Back to registry
          </Button>
        }
      />

      <div className="space-y-5">
        {error && <Alert tone="danger" title={error} />}
        {successMessage && <Alert tone="success" title={successMessage} />}

        <Card>
          {/* Header banner inside card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-paper-sunken border border-border flex items-center justify-center font-display font-semibold text-2xl text-brand-700">
                {(actor?.name || actor?.email || "U")[0].toUpperCase()}
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-ink-900">{actor?.name || "Unnamed Actor"}</h2>
                <p className="text-sm text-ink-500">{actor?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone={ROLE_TONE[actor?.role ?? ""] ?? "neutral"}>{actor?.role}</Badge>
              <Badge tone={actor?.is_active ? "success" : "danger"}>{actor?.is_active ? "Active" : "Inactive"}</Badge>
            </div>
          </div>

          {/* Account activation control */}
          <div className="my-6 p-4 bg-paper-sunken border border-border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700">Account Activation Control</h4>
              <p className="text-xs text-ink-500 mt-0.5">
                Toggle actor access authorization across the Origo ecosystem.
              </p>
            </div>

            <Button
              variant={actor?.is_active ? "danger" : "primary"}
              size="sm"
              onClick={handleToggleActive}
              disabled={updating}
            >
              {updating && <Spinner size={14} />}
              {actor?.is_active ? "Deactivate account" : "Activate account"}
            </Button>
          </div>

          {/* Core profile fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700">Basic Information</h3>
              <div className="text-sm bg-paper-sunken p-4 rounded-xl border border-border">
                <InfoRow label="Full Name" value={actor?.name || "N/A"} />
                <InfoRow label="Email Address" value={actor?.email} />
                <InfoRow label="Phone Number" value={actor?.phone || "N/A"} mono />
                <InfoRow label="District" value={actor?.district || "N/A"} />
                <InfoRow
                  label="Registered Date"
                  value={actor?.created_at ? new Date(actor.created_at).toLocaleDateString() : "N/A"}
                />
              </div>
            </div>

            {/* Role specific details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-info">Role Specific Details</h3>
              <div className="text-sm bg-paper-sunken p-4 rounded-xl border border-border">
                {actor?.role === "farmer" && (
                  <>
                    <InfoRow label="DS Division" value={actor?.dsd || "N/A"} />
                    <InfoRow label="GN Division" value={actor?.gn_division || "N/A"} />
                    <InfoRow label="Farm Address" value={actor?.farm_address || "N/A"} />
                    <InfoRow label="Farm Size (ha)" value={actor?.farm_size_ha ? `${actor.farm_size_ha} ha` : "N/A"} />
                  </>
                )}

                {actor?.role === "exporter" && (
                  <>
                    <InfoRow label="Business Name" value={actor?.business_name || "N/A"} />
                    <InfoRow label="Reg. Number" value={actor?.business_reg_no || "N/A"} mono />
                    <InfoRow label="Business Address" value={actor?.business_address || "N/A"} />
                    <InfoRow label="Export License No" value={actor?.export_license_no || "N/A"} mono />
                  </>
                )}

                {actor?.role === "admin" && (
                  <p className="py-6 text-center text-ink-500">
                    System administrator account with full management privileges.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

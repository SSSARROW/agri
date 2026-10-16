"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { StatTile } from "@/components/ui/card";
import { SectionSpinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  ClipboardIcon,
  MegaphoneIcon,
  UsersIcon,
  SproutIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";

function StatusAlert({ profile }: { profile: ExporterProfile }) {
  if (profile.status === "verified") {
    return (
      <Alert tone="success" title="Account verified">
        Your exporter account is verified. You have full access to the
        Paramparā platform.
      </Alert>
    );
  }
  if (profile.status === "rejected") {
    return (
      <Alert tone="danger" title="Account rejected">
        Your application was not approved.
        {profile.rejection_reason ? (
          <>
            {" "}
            Reason: <span className="font-medium">{profile.rejection_reason}</span>
          </>
        ) : null}{" "}
        Please update your company profile and contact the platform
        administrator.
      </Alert>
    );
  }
  return (
    <Alert
      tone="warning"
      title="Awaiting verification"
      action={
        <Link
          href="/exporter/profile"
          className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
        >
          Review your company profile <ChevronRightIcon className="w-3.5 h-3.5" />
        </Link>
      }
    >
      Your account is under review. The Paramparā team will verify your
      business registration and export licence — this usually takes 1–2
      business days.
    </Alert>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  href,
  comingSoon,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  comingSoon?: boolean;
}) {
  const content = (
    <>
      <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
        {icon}
      </div>
      <p className="font-display font-semibold text-ink-900 text-sm mt-3">{title}</p>
      <p className="text-ink-500 text-xs leading-relaxed mt-1">{description}</p>
    </>
  );

  if (comingSoon || !href) {
    return (
      <div className="relative bg-paper-raised border border-border rounded-xl p-5 opacity-70">
        <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-ink-400 bg-paper-sunken border border-border px-2 py-0.5 rounded-full">
          Coming soon
        </span>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="bg-paper-raised border border-border hover:border-brand-300 rounded-xl p-5 transition-colors group"
    >
      {content}
    </Link>
  );
}

export default function ExporterDashboardPage() {
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExporterProfile()
      .then(setProfile)
      .catch(() => setError("Failed to load dashboard data. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SectionSpinner />;

  if (error || !profile) {
    return <Alert tone="danger" title={error || "No profile found."} />;
  }

  const statusLabel = profile.status.charAt(0).toUpperCase() + profile.status.slice(1);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Exporter Portal"
        title={
          <>
            Welcome,{" "}
            <span className="text-brand-700">
              {profile.company_name || profile.contact_person || "Exporter"}
            </span>
          </>
        }
        subtitle="Manage your export operations, connect with verified farmers, and track your agricultural supply chain."
      />

      <div className="space-y-8">
        <StatusAlert profile={profile} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile label="Account status" value={statusLabel} tone={profile.status === "verified" ? "brand" : profile.status === "rejected" ? "danger" : "gold"} />
          <StatTile label="Crops bought" value={profile.crops_bought.length} tone="brand" />
          <StatTile label="Districts" value={profile.districts_served.length || "—"} />
          <StatTile label="Certifications" value={profile.certifications.length || "—"} />
        </div>

        <div>
          <h2 className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-4">
            Platform features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeatureCard
              icon={<ClipboardIcon className="w-5 h-5" />}
              title="Quality Standards"
              description="Define and publish the crop quality standards and certifications you accept from farmers."
              href="/exporter/standards"
            />
            <FeatureCard
              icon={<MegaphoneIcon className="w-5 h-5" />}
              title="Advertisements"
              description="Post buying advertisements to notify farmers of your current crop requirements and prices."
              href="/exporter/ads"
            />
            <FeatureCard
              icon={<UsersIcon className="w-5 h-5" />}
              title="My Farmers"
              description="Browse and connect with verified farmers in your districts who grow your required crops."
              href="/exporter/farmers"
            />
            <FeatureCard
              icon={<SproutIcon className="w-5 h-5" />}
              title="Planting Notices"
              description="View upcoming planting schedules and harvest forecasts from farmers in your network."
              href="/exporter/planting-notices"
            />
          </div>
        </div>

        <div className="bg-paper-raised border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-ink-900 text-sm">
              Complete your company profile
            </p>
            <p className="text-ink-500 text-xs mt-0.5">
              A complete profile speeds up verification and builds trust with
              farmers.
            </p>
          </div>
          <Button href="/exporter/profile" className="shrink-0">
            Edit profile
          </Button>
        </div>
      </div>
    </div>
  );
}

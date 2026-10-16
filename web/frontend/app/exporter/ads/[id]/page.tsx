"use client";

import React, { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { fetchAd } from "@/lib/adsApi";
import { SectionSpinner } from "@/components/ui/spinner";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const adId = resolvedParams.id;

  useEffect(() => {
    fetchAd(adId)
      .then((ad) => {
        const sortedVersions = [...ad.versions].sort((a, b) => b.version_number - a.version_number);
        const latestVer = sortedVersions[0]?.version_number || 1;
        router.replace(`/exporter/ads/${adId}/versions/${latestVer}`);
      })
      .catch(() => {
        router.replace("/exporter/ads");
      });
  }, [adId, router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
      <SectionSpinner />
      <p className="text-ink-500 text-sm font-medium">Redirecting to advertisement…</p>
    </div>
  );
}

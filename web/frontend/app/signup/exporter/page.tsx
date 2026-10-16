"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signupExporter } from "@/lib/api";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function ExporterSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    business_name: "",
    business_reg_no: "",
    business_address: "",
    export_license_no: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signupExporter(formData);
      router.push("/exporter/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Registration failed. Please check your inputs.";
      setError(typeof msg === "string" ? msg : "Exporter Registration Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-paper flex flex-col items-center justify-center p-4 sm:p-6 py-12">
      <div className="w-full max-w-2xl bg-paper-raised border border-border shadow-xl shadow-ink-900/5 rounded-2xl p-8 sm:p-10">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-semibold text-brand-700 hover:text-brand-800 mb-6"
        >
          ← Back to sign in
        </Link>

        <div className="mb-8">
          <p className="text-xs font-bold text-brand-700 uppercase tracking-widest mb-3">
            Exporter registration
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 tracking-tight">
            Register business / exporter account
          </h1>
          <p className="text-sm text-ink-500 mt-1.5">
            Connect directly with verified regional crop producers &amp; track export
            supply chains.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <Alert tone="danger" title={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Representative Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Representative name" required>
              <Input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Nimal Silva"
              />
            </Field>
            <Field label="Work email" required>
              <Input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="exports@agritrade.lk"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Password" required>
              <Input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </Field>
            <Field label="Contact phone" required>
              <Input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="+94 11 234 5678"
              />
            </Field>
          </div>

          {/* Business Details */}
          <div className="border-t border-border pt-5">
            <h2 className="text-xs font-bold text-brand-700 uppercase tracking-widest mb-3">
              Corporate &amp; license verification
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Business / company name" required>
                <Input
                  type="text"
                  name="business_name"
                  required
                  value={formData.business_name}
                  onChange={handleChange}
                  placeholder="Lanka Agri Exports Ltd"
                />
              </Field>
              <Field label="Business registration no" required>
                <Input
                  type="text"
                  name="business_reg_no"
                  required
                  value={formData.business_reg_no}
                  onChange={handleChange}
                  placeholder="PV-123456"
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Field label="Business address" required>
                <Input
                  type="text"
                  name="business_address"
                  required
                  value={formData.business_address}
                  onChange={handleChange}
                  placeholder="Level 5, Trade Tower, Colombo 03"
                />
              </Field>
            </div>
            <Field label="Export license no" required>
              <Input
                type="text"
                name="export_license_no"
                required
                value={formData.export_license_no}
                onChange={handleChange}
                placeholder="EXP-2026-987"
              />
            </Field>
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
            {loading ? "Registering exporter…" : "Complete exporter registration"}
          </Button>
        </form>
      </div>
    </main>
  );
}

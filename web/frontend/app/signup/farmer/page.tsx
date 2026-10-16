"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signupFarmer } from "@/lib/api";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function FarmerSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    nic: "",
    district: "",
    dsd: "",
    gn_division: "",
    farm_address: "",
    farm_size_ha: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signupFarmer({
        ...formData,
        farm_size_ha: parseFloat(formData.farm_size_ha) || 0.0,
      });
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Registration failed. Please check your inputs.";
      setError(typeof msg === "string" ? msg : "Farmer Registration Error");
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
            Farmer registration
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 tracking-tight">
            Create your farmer account
          </h1>
          <p className="text-sm text-ink-500 mt-1.5">
            Register your agricultural land and access verified buyers &amp; export
            networks.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <Alert tone="danger" title={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Account Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name" required>
              <Input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Kamal Perera"
              />
            </Field>
            <Field label="Email address" required>
              <Input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="kamal@farm.lk"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <Field label="Phone number" required>
              <Input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="+94 77 123 4567"
              />
            </Field>
            <Field label="NIC number" required>
              <Input
                type="text"
                name="nic"
                required
                value={formData.nic}
                onChange={handleChange}
                placeholder="199012345678"
              />
            </Field>
          </div>

          {/* Regional Details */}
          <div className="border-t border-border pt-5">
            <h2 className="text-xs font-bold text-brand-700 uppercase tracking-widest mb-3">
              Farm location &amp; administrative info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="District" required>
                <Input
                  type="text"
                  name="district"
                  required
                  value={formData.district}
                  onChange={handleChange}
                  placeholder="Anuradhapura"
                />
              </Field>
              <Field label="DSD" required>
                <Input
                  type="text"
                  name="dsd"
                  required
                  value={formData.dsd}
                  onChange={handleChange}
                  placeholder="Thambuttegama"
                />
              </Field>
              <Field label="GN division" required>
                <Input
                  type="text"
                  name="gn_division"
                  required
                  value={formData.gn_division}
                  onChange={handleChange}
                  placeholder="GN 482"
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Field label="Farm address" required>
                <Input
                  type="text"
                  name="farm_address"
                  required
                  value={formData.farm_address}
                  onChange={handleChange}
                  placeholder="No. 45, Main Canal Road, Thambuttegama"
                />
              </Field>
            </div>
            <Field label="Farm size (hectares)" required>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                name="farm_size_ha"
                required
                value={formData.farm_size_ha}
                onChange={handleChange}
                placeholder="2.5"
              />
            </Field>
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
            {loading ? "Registering farmer…" : "Complete farmer registration"}
          </Button>
        </form>
      </div>
    </main>
  );
}

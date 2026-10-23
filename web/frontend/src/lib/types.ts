import type { Role } from "./api";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type Multilingual = { en?: string; si?: string; ta?: string };

export interface User {
  id: string;
  email: string;
  role: Role;
  name?: string | null;
  phone?: string | null;
  district?: string | null;
  dsd?: string | null;
  gn_division?: string | null;
  farm_address?: string | null;
  farm_size_ha?: number | null;
  business_name?: string | null;
  business_reg_no?: string | null;
  business_address?: string | null;
  export_license_no?: string | null;
  is_active?: boolean;
  created_at?: string | null;
}

export type ExporterStatus = "pending" | "verified" | "rejected";

export interface ExporterProfile {
  id: string;
  user_id: string;
  company_name: string;
  business_reg_no: string;
  export_licence_no?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  logo_url?: string | null;
  districts_served: string[];
  crops_bought: string[];
  certifications: string[];
  status: ExporterStatus;
  rejection_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/* ── Standards ─────────────────────────────────────────────────────────── */

export interface MultiList { en: string[]; si: string[]; ta: string[] }
export interface BannedInput { name: string; min_days_before_harvest: number }
export interface RequiredProof { photo_count: number; photo_descriptions: string[]; quick_fields: string[] }

export interface Stage {
  id?: string;
  position: number;
  name: string;
  timing_type: "one_time" | "recurring";
  start_offset_days: number;
  repeat_interval_days?: number | null;
  end_offset_days?: number | null;
  instructions: { en: string; si: string; ta: string };
  dos: MultiList;
  donts: MultiList;
  allowed_inputs: string[];
  banned_inputs: BannedInput[];
  required_proof: RequiredProof;
}

export interface VersionSummary {
  id: string;
  standard_id: string;
  version_number: number;
  name: string;
  status: "draft" | "published";
  grade_spec: Record<string, string>;
  published_at?: string | null;
  created_at: string;
}
export interface VersionDetail extends VersionSummary { stages: Stage[] }

export interface Standard {
  id: string;
  exporter_profile_id: string;
  crop: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  versions: VersionSummary[];
}

export interface GradeSpecField { key: string; label: string; hint: string; input_type: string }
export interface StandardTemplate {
  id: string;
  name: string;
  crop: string;
  description: string;
  grade_spec: Record<string, string>;
  stages: Stage[];
}
export interface TemplatesResponse {
  templates: StandardTemplate[];
  grade_spec_fields: Record<string, GradeSpecField[]>;
}

/* ── Ads ───────────────────────────────────────────────────────────────── */

export type AdState = "draft" | "live" | "expired" | "closed";

export interface Terms {
  payment_timing?: string;
  rejection_handling?: string;
  other?: string;
}

export interface AdVersionSummary {
  id: string;
  ad_id: string;
  version_number: number;
  status: "draft" | "published";
  standard_version_id: string;
  title: Multilingual;
  grade_tier: string;
  quantity_kg: number;
  price_type: "fixed" | "range";
  price_fixed?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  collection_window_start: string;
  collection_window_end: string;
  pickup_location: string;
  eligible_districts: string[];
  expires_at: string;
  published_at?: string | null;
  created_at: string;
}
export interface AdVersionDetail extends AdVersionSummary {
  description: Multilingual;
  terms: Terms;
  standard_name?: string | null;
  standard_crop?: string | null;
}

export interface AdListItem {
  id: string;
  crop: string;
  status: string;
  computed_status: AdState;
  closed_at?: string | null;
  closed_reason?: string | null;
  created_at: string;
  current_version_number: number;
  latest_version_number: number;
  title: Multilingual;
  latest_title: Multilingual;
  grade_tier: string;
  quantity_kg: number;
  latest_quantity_kg: number;
  price_type: "fixed" | "range";
  latest_price_type: "fixed" | "range";
  price_fixed?: number | null;
  latest_price_fixed?: number | null;
  price_min?: number | null;
  latest_price_min?: number | null;
  price_max?: number | null;
  latest_price_max?: number | null;
  expires_at?: string | null;
  latest_expires_at?: string | null;
  collection_window_start?: string | null;
  latest_collection_start?: string | null;
  collection_window_end?: string | null;
  latest_collection_end?: string | null;
  latest_standard_name?: string | null;
}

export interface AdDetail {
  id: string;
  crop: string;
  status: string;
  computed_status: AdState;
  closed_at?: string | null;
  closed_reason?: string | null;
  created_at: string;
  updated_at: string;
  versions: AdVersionSummary[];
}

export interface ApplicantPlot { id: string; name: string; area_ha?: number | null; district?: string | null; crops: string[] }
export interface Applicant {
  acceptance_id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_district?: string | null;
  dsd?: string | null;
  gn_division?: string | null;
  farm_size_ha?: number | null;
  plots: ApplicantPlot[];
  supply_quantity_kg: number;
  accepted_at: string;
  withdrawn_at?: string | null;
  derived_status: "pending" | "approved" | "declined" | "removed" | "withdrawn";
  link_status: string;
  ad_version_number: number;
  terms_hash: string;
  phone?: string | null;
}
export interface ApplicantsResponse extends Page<Applicant> {
  ad_id: string;
  crop: string;
  ad_title: Record<string, string>;
  target_quantity_kg: number;
  approved_quantity_kg: number;
  pending_quantity_kg: number;
  remaining_quantity_kg: number;
  is_filled: boolean;
}

export interface AdStats {
  ad_id: string;
  computed_status: string;
  total_views: number;
  unique_viewers: number;
  accepts: { total: number; pending: number; approved: number; declined: number; withdrawn: number };
  view_to_accept_rate: number;
  target_quantity_kg: number;
  approved_quantity_kg: number;
  pending_quantity_kg: number;
  filled_percentage: number;
  pending_count: number;
  views_per_day?: { date: string; views: number }[] | null;
}

/* ── Farmer network ────────────────────────────────────────────────────── */

export interface FarmerSummary {
  id: string;
  name: string;
  district?: string | null;
  dsd?: string | null;
  gn_division?: string | null;
  farm_address?: string | null;
  farm_size_ha?: number | null;
  phone?: string | null;
  crops: string[];
  total_plots: number;
  total_plot_area_ha: number;
}
export type LinkStatus = "requested" | "approved" | "declined" | "removed" | "cancelled";
export interface FarmerLink {
  id: string;
  farmer_id: string;
  exporter_profile_id: string;
  status: LinkStatus;
  requested_at: string;
  decided_at?: string | null;
  decision_reason?: string | null;
  farmer: FarmerSummary;
}
export interface FarmerLinkPage extends Page<FarmerLink> { pending_count: number }
export interface PlotSummary {
  id: string;
  name?: string | null;
  area_ha?: number | null;
  district?: string | null;
  dsd?: string | null;
  gn_division?: string | null;
  plot_type?: string | null;
  boundary_source?: string | null;
}
export interface FarmerLinkDetail extends FarmerLink { plots: PlotSummary[] }

/* ── Planting notices ──────────────────────────────────────────────────── */

export type NoticeState = "draft" | "upcoming" | "past" | "cancelled";
export interface NoticeCounts { ready: number; cannot: number; no_reply: number; eligible_total: number }
export interface NoticeListItem {
  id: string;
  crop: string;
  status: string;
  computed_state: NoticeState;
  standard_version_id: string;
  standard_name?: string | null;
  standard_version_number?: number | null;
  target_month: string;
  volume_needed_kg: number;
  total_expected_volume_kg: number;
  volume_percentage: number;
  eligible_districts: string[];
  title: Record<string, string>;
  created_at: string;
  published_at?: string | null;
  cancelled_at?: string | null;
  counts: NoticeCounts;
}
export interface NoticeDetail extends NoticeListItem {
  message: Record<string, string>;
  cancelled_reason?: string | null;
  updated_at: string;
}
export interface NoticeResponseItem {
  farmer_id: string;
  farmer_name: string;
  district?: string | null;
  phone?: string | null;
  response: "ready" | "cannot" | "no_reply";
  expected_volume_kg?: number | null;
  plot_id?: string | null;
  plot_name?: string | null;
  plot_area_ha?: number | null;
  responded_at?: string | null;
}
export interface NoticeResponses extends Page<NoticeResponseItem> {
  notice_id: string;
  volume_needed_kg: number;
  total_expected_volume_kg: number;
  volume_percentage: number;
  counts: NoticeCounts;
}
export interface ReminderSlot {
  slot: number;
  scheduled_date: string;
  sent: number;
  failed: number;
  skipped: number;
  skipped_reasons: Record<string, number>;
  pending: number;
}
export interface ReminderDelivery {
  id: string;
  farmer_name: string;
  reminder_slot: number;
  channel: string;
  status: string;
  skip_reason?: string | null;
  sent_at?: string | null;
  attempts: number;
  last_error?: string | null;
  created_at: string;
}
export interface Reminders extends Omit<Page<ReminderDelivery>, "items"> {
  deliveries: ReminderDelivery[];
  notice_id: string;
  provider: string;
  slots: ReminderSlot[];
}

/* ── Stage proofs ──────────────────────────────────────────────────────── */

export interface ProofListItem {
  id: string;
  link_id: string;
  farmer_id: string;
  farmer_name: string;
  stage_id: string;
  stage_name: string;
  plot_name?: string | null;
  photo_count: number;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  needs_attention: boolean;
}
export interface ProofPage extends Page<ProofListItem> { pending_count: number }
export interface ProofDetail {
  id: string;
  link_id: string;
  farmer_id: string;
  farmer_name: string;
  stage_id: string;
  stage_name: string;
  stage_instructions: Multilingual;
  plot_name?: string | null;
  photo_urls: string[];
  quick_field_answers: Record<string, unknown>;
  note?: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at?: string | null;
  review_notes?: string | null;
  reopened_at?: string | null;
}

/* ── Admin ─────────────────────────────────────────────────────────────── */

export interface AdminExporterRow extends ExporterProfile {
  users?: { id: string; email: string; name?: string | null; phone?: string | null } | null;
}
export interface AdminExporterPage extends Page<AdminExporterRow> {
  counts: { pending: number; verified: number; rejected: number };
}
export interface VerificationLogEntry {
  id: string;
  action: string;
  previous_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
  created_at: string;
  admin_user?: { email?: string; name?: string } | null;
}
export interface AdminExporterDetail extends AdminExporterRow {
  users?: (AdminExporterRow["users"] & { district?: string; dsd?: string; gn_division?: string; created_at?: string }) | null;
  history: VerificationLogEntry[];
}

export type AdminAdState = "live" | "draft" | "expired" | "closed" | "taken_down" | "filled";
export interface AdminAdRow {
  id: string;
  crop: string;
  status: string;
  admin_state: AdminAdState;
  closed_reason?: string | null;
  created_at: string;
  title: Multilingual;
  version_number?: number | null;
  expires_at?: string | null;
  exporter_profile_id: string;
  exporter_company: string;
  open_report_count: number;
  total_views: number;
  total_accepts: number;
}
export interface AdReport {
  id: string;
  ad_id: string;
  reason: string;
  details?: string | null;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
  farmer?: { id: string; name?: string | null; district?: string | null } | null;
}
export interface ModerationEntry {
  id: string;
  action: "takedown" | "restore";
  reason?: string | null;
  created_at: string;
  admin_user?: { email?: string; name?: string } | null;
}
export interface AdminAdDetail {
  id: string;
  crop: string;
  status: string;
  admin_state: AdminAdState;
  closed_reason?: string | null;
  closed_at?: string | null;
  created_at: string;
  live_version?: (AdVersionSummary & { description?: Multilingual; terms?: Terms }) | null;
  all_versions: AdVersionSummary[];
  exporter: { id: string; company_name: string; status: string; email?: string; phone?: string; contact_person?: string };
  stats: { total_views: number; unique_viewers: number; total_accepts: number; active_accepts: number };
  reports: AdReport[];
  moderation_log: ModerationEntry[];
}

/* ── Public provenance ─────────────────────────────────────────────────── */

export interface ProvStage {
  sequence: number;
  title: string;
  instructions: string;
  day_offset: number | null;
  due_date: string | null;
  required_event_types: string[] | null;
  satisfied: boolean | null;
  status: string;
}
export interface Provenance {
  batch: { code: string; crop: string; created_at: string; parent_codes: string[] };
  plot: { district?: string | null; dsd?: string | null; gn_division?: string | null; area_ha?: number | null; plot_type?: string | null; boundary_source?: string | null; registered_at?: string | null; crops?: string[] } | null;
  protocol: {
    protocol_id: string;
    protocol_name: string;
    protocol_tier: string;
    protocol_source: string;
    stages: ProvStage[];
    required_total: number;
    required_satisfied: number;
    tier_achieved: boolean;
  } | null;
  planted_at: string | null;
  timeline: { batch_code: string | null; event_type: string; occurred_at: string; payload: Record<string, unknown> }[];
  lineage: { code: string; crop: string; created_at: string; parent_codes: string[]; weight_kg?: number | null; district?: string | null }[];
  scan_warning?: string | null;
  exporters?: { company_name: string; description?: string | null; logo_url?: string | null; certifications: string[] }[];
  exporter_standards?: { exporter: string; name: string; version: number; stages_total: number; stages_approved: number; growers: number }[];
  summary?: {
    weight_kg?: number | null; weight_source?: string | null; grade?: string | null; packages?: number | null; condition?: string | null; condition_note?: string | null;
    steps_done: string[]; planted_at?: string | null; harvested_at?: string | null; days_to_harvest?: number | null;
    first_event_at?: string | null; last_event_at?: string | null; event_count: number; photo_count: number; growers: number; scan_count: number;
  };
}

/* ── Farmer progress (exporter) ────────────────────────────────────────── */

export type StageState = "approved" | "pending" | "rejected" | "reopened" | "overdue" | "upcoming" | "waiting";
export type ProgressState = "needs_attention" | "waiting_review" | "on_track" | "not_started";

export interface ProgressTotals { approved: number; pending: number; rejected: number; overdue: number; upcoming: number; waiting: number; reopened: number }
export interface ProgressFarmer { id: string; name: string; district?: string | null; dsd?: string | null; gn_division?: string | null; phone?: string | null; farm_size_ha?: number | null }

export interface ProgressSummaryRow {
  link_id: string;
  farmer: ProgressFarmer;
  state: ProgressState;
  crops: string[];
  totals: ProgressTotals;
  harvested_kg: number;
  last_activity_at?: string | null;
  stages_approved: number;
  stages_total: number;
  days_since_planting?: number | null;
  n_plots: number;
  n_batches: number;
}
export interface NetworkProgress {
  items: ProgressSummaryRow[];
  summary: { farmers: number; needs_attention: number; waiting_review: number; on_track: number; not_started: number; harvested_kg: number };
}

export interface ProgressStage {
  id: string; position: number; name: string; timing_type: string; start_offset_days: number;
  due_date?: string | null; status: StageState; submission_id?: string | null; submitted_at?: string | null;
  reviewed_at?: string | null; review_notes?: string | null; photo_count: number; photos_required: number;
}
export interface ProgressStandard {
  standard_id: string; name: string; version: number; crop: string; planted_at?: string | null; days_since_planting?: number | null;
  stages: ProgressStage[]; approved: number; total: number; applies: boolean;
}
export interface ProgressPlot {
  id: string; name?: string | null; area_ha?: number | null; district?: string | null; dsd?: string | null; gn_division?: string | null;
  plot_type?: string | null; boundary_source?: string | null; photo_count: number; last_photo_at?: string | null; has_registration_photo: boolean;
  plantings: { plot_id: string; crop: string; planted_at: string; area_ha?: number | null; protocol_name?: string | null }[];
}
export interface ProgressBatch {
  id: string; code: string; crop: string; created_at: string; latest_status: string; latest_at: string; weight_kg?: number | null; grade?: string | null; steps: string[];
}
export interface FarmerProgress {
  link_id: string; farmer: ProgressFarmer; state: ProgressState; crops: string[]; plots: ProgressPlot[]; standards: ProgressStandard[];
  totals: ProgressTotals; batches: ProgressBatch[]; harvested_kg: number; last_activity_at?: string | null;
  recent_activity: { event_type: string; occurred_at: string; plot_id: string; photo_url?: string | null; caption?: string | null; crop?: string | null }[];
}

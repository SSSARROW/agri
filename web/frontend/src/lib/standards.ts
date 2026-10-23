import { CROP_LABEL } from "./constants";
import type { Standard, Stage } from "./types";

export function standardTitle(s: Standard): string {
  const latest = [...s.versions].sort((a, b) => b.version_number - a.version_number)[0];
  const pub = [...s.versions].filter((v) => v.status === "published").sort((a, b) => b.version_number - a.version_number)[0];
  return (pub ?? latest)?.name || `${CROP_LABEL[s.crop] ?? s.crop} standard`;
}

export function timingText(s: Pick<Stage, "timing_type" | "start_offset_days" | "repeat_interval_days" | "end_offset_days">): string {
  if (s.timing_type === "recurring") {
    const base = `Every ${s.repeat_interval_days ?? "?"}d from day ${s.start_offset_days}`;
    return s.end_offset_days != null ? `${base} to day ${s.end_offset_days}` : base;
  }
  return `Day ${s.start_offset_days}`;
}

export function emptyStage(position: number): Stage {
  return {
    position,
    name: "",
    timing_type: "one_time",
    start_offset_days: 0,
    repeat_interval_days: null,
    end_offset_days: null,
    instructions: { en: "", si: "", ta: "" },
    dos: { en: [], si: [], ta: [] },
    donts: { en: [], si: [], ta: [] },
    allowed_inputs: [],
    banned_inputs: [],
    required_proof: { photo_count: 0, photo_descriptions: [], quick_fields: [] },
  };
}

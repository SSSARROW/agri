export const DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha",
  "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala",
  "Mannar", "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya",
] as const;

export const CROPS = ["tea", "cinnamon"] as const;
export type Crop = (typeof CROPS)[number];

/** The farmer-network filter also offers crops farmers record themselves. */
export const NETWORK_CROPS = ["tea", "cinnamon", "pepper", "coffee", "cardamom"] as const;

export const CERTIFICATIONS = ["Organic", "Rainforest Alliance", "Fairtrade", "Other"] as const;

export const CROP_LABEL: Record<string, string> = {
  tea: "Tea",
  cinnamon: "Cinnamon",
  pepper: "Pepper",
  coffee: "Coffee",
  cardamom: "Cardamom",
};

export const LANGS = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
] as const;
export type LangCode = (typeof LANGS)[number]["code"];

"""
templates.py — Crop quality-standard templates and grade-spec field definitions.

IMPORTANT: All template content is PLACEHOLDER / SAMPLE DATA ONLY.
Review every stage, instruction, input list and grade-spec value with a
qualified agronomist before publishing.  Nothing here is authoritative.

Design constraints (Step 2C):
  • Templates and field definitions live entirely in code — no DB, no migration.
  • The stage shape matches StageCreateUpdate exactly so templates can be
    validated through the existing Pydantic schema.
  • Sinhala (si) and Tamil (ta) fields are left empty intentionally.
    Do NOT machine-translate agronomic instructions.
  • Chemical names, dosages and numeric limits use clearly editable sample
    values or are left blank — never presented as authoritative.
"""

from typing import Any, Dict, List, Optional

# ──────────────────────────────────────────────────────────────────────────────
# Placeholder notice embedded in every stage
# ──────────────────────────────────────────────────────────────────────────────
_PLACEHOLDER = (
    "PLACEHOLDER: Sample values only. "
    "Review with an agronomist before publishing."
)


def _stage(
    position: int,
    name: str,
    timing_type: str,
    start_offset_days: int,
    instruction_en: str,
    *,
    repeat_interval_days: Optional[int] = None,
    end_offset_days: Optional[int] = None,
    dos_en: Optional[List[str]] = None,
    donts_en: Optional[List[str]] = None,
    allowed_inputs: Optional[List[str]] = None,
    banned_inputs: Optional[List[Dict[str, Any]]] = None,
    photo_count: int = 0,
    photo_descriptions: Optional[List[str]] = None,
    quick_fields: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Build a stage dict that matches StageCreateUpdate shape."""
    return {
        "position": position,
        "name": name,
        "timing_type": timing_type,
        "start_offset_days": start_offset_days,
        "repeat_interval_days": repeat_interval_days,
        "end_offset_days": end_offset_days,
        "instructions": {
            "en": f"{instruction_en} [{_PLACEHOLDER}]",
            "si": "",
            "ta": "",
        },
        "dos": {
            "en": dos_en or [],
            "si": [],
            "ta": [],
        },
        "donts": {
            "en": donts_en or [],
            "si": [],
            "ta": [],
        },
        "allowed_inputs": allowed_inputs or [],
        "banned_inputs": banned_inputs or [],
        "required_proof": {
            "photo_count": photo_count,
            "photo_descriptions": photo_descriptions or [],
            "quick_fields": quick_fields or [],
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
# TEA TEMPLATE
# ──────────────────────────────────────────────────────────────────────────────
_TEA_STAGES: List[Dict[str, Any]] = [
    _stage(
        position=1,
        name="Land Preparation",
        timing_type="one_time",
        start_offset_days=0,
        instruction_en=(
            "Clear the land of weeds and debris. Carry out soil testing "
            "to determine pH and nutrient status. Correct soil pH to the "
            "recommended range for tea cultivation."
        ),
        dos_en=[
            "Conduct soil pH and nutrient tests before planting.",
            "Remove all weed roots and stones.",
            "Prepare contour drains or terraces on slopes.",
        ],
        donts_en=[
            "Do not burn crop residues unless absolutely necessary.",
            "Do not disturb deep subsoil layers unnecessarily.",
        ],
        photo_count=1,
        photo_descriptions=["Photo of cleared and prepared land"],
        quick_fields=["soil_ph_reading"],
    ),
    _stage(
        position=2,
        name="Planting",
        timing_type="one_time",
        start_offset_days=30,
        instruction_en=(
            "Plant selected tea cultivar seedlings or vegetatively propagated "
            "cuttings at the recommended spacing. Water immediately after planting."
        ),
        dos_en=[
            "Use certified or approved planting material.",
            "Plant at the recommended row and plant spacing.",
            "Water thoroughly immediately after planting.",
        ],
        donts_en=[
            "Do not use diseased planting material.",
            "Do not plant during periods of extreme heat without shade.",
        ],
        photo_count=2,
        photo_descriptions=["Planting material close-up", "Planted rows overview"],
        quick_fields=["cultivar_name", "plants_per_hectare"],
    ),
    _stage(
        position=3,
        name="Establishment / Shade Management",
        timing_type="one_time",
        start_offset_days=60,
        instruction_en=(
            "Establish temporary shade to protect young plants. Remove shade "
            "gradually as plants become established."
        ),
        dos_en=[
            "Provide temporary shade during the first growing season.",
            "Monitor for transplant shock and water stress.",
        ],
        donts_en=[
            "Do not allow competing vegetation to suppress young plants.",
        ],
        photo_count=1,
        photo_descriptions=["Young plants with shade structure"],
    ),
    _stage(
        position=4,
        name="Fertilizer Application",
        timing_type="recurring",
        start_offset_days=90,
        repeat_interval_days=90,
        end_offset_days=1800,
        instruction_en=(
            "Apply balanced fertilizer according to soil test recommendations. "
            "Sample fertilizer rate: [INSERT RATE — consult agronomist]. "
            "Do not apply during heavy rainfall."
        ),
        dos_en=[
            "Follow soil-test-based fertilizer rates.",
            "Apply in split doses to minimise leaching.",
            "Keep records of all fertilizer applications.",
        ],
        donts_en=[
            "Do not apply unapproved synthetic fertilizers.",
            "Do not apply immediately before heavy rain.",
        ],
        allowed_inputs=["Approved organic compost", "Approved inorganic fertilizer (rate TBD)"],
        photo_count=1,
        photo_descriptions=["Fertilizer application in progress"],
        quick_fields=["fertilizer_type", "rate_kg_per_ha"],
    ),
    _stage(
        position=5,
        name="Pruning",
        timing_type="recurring",
        start_offset_days=365,
        repeat_interval_days=365,
        instruction_en=(
            "Prune plants to the recommended pruning height to stimulate new "
            "lateral shoot growth. Remove dead and diseased wood."
        ),
        dos_en=[
            "Prune to the recommended height for the cultivar.",
            "Dispose of pruned material hygienically.",
            "Record pruning date and height.",
        ],
        donts_en=[
            "Do not prune more than the recommended proportion of the bush.",
            "Do not prune during active pest or disease outbreak without treatment.",
        ],
        photo_count=1,
        photo_descriptions=["Pruned tea rows"],
        quick_fields=["pruning_height_cm", "pruning_date"],
    ),
    _stage(
        position=6,
        name="Pest & Disease Control",
        timing_type="recurring",
        start_offset_days=30,
        repeat_interval_days=30,
        instruction_en=(
            "Scout regularly for pests and diseases. Apply only approved "
            "inputs at recommended rates. Record all spray operations."
        ),
        dos_en=[
            "Scout at least once per month.",
            "Use approved pesticides only — check the approved list.",
            "Observe pre-harvest intervals for any pesticide used.",
        ],
        donts_en=[
            "Do not apply pesticides outside the approved list.",
            "Do not spray during windy or rainy conditions.",
        ],
        banned_inputs=[
            {"name": "[SAMPLE — replace with actual banned chemical]", "min_days_before_harvest": 14}
        ],
        photo_count=1,
        photo_descriptions=["Pest or disease symptom observed (if any)"],
        quick_fields=["pest_observed", "treatment_applied"],
    ),
    _stage(
        position=7,
        name="Plucking Cycle",
        timing_type="recurring",
        start_offset_days=180,
        repeat_interval_days=14,
        instruction_en=(
            "Pluck two leaves and a bud (fine plucking standard) or as "
            "specified by this quality standard. Collect in clean, ventilated "
            "bags. Deliver to factory within the specified timeframe."
        ),
        dos_en=[
            "Pluck two leaves and a bud for fine-grade standard.",
            "Use clean, ventilated containers.",
            "Transport leaf quickly to avoid heat build-up.",
        ],
        donts_en=[
            "Do not pluck coarser than the agreed plucking round.",
            "Do not press or compact leaf in bags.",
            "Do not harvest from recently sprayed plots within the PHI.",
        ],
        photo_count=2,
        photo_descriptions=["Plucked leaf sample", "Filled collection bags"],
        quick_fields=["leaf_weight_kg", "plucking_round"],
    ),
    _stage(
        position=8,
        name="Post-Harvest Withering / Hand-off",
        timing_type="one_time",
        start_offset_days=180,
        instruction_en=(
            "Deliver fresh leaf to the processing facility within the agreed "
            "time window. Record delivery weight and batch details."
        ),
        dos_en=[
            "Record batch weight at delivery.",
            "Ensure leaf is not heated or wetted in transit.",
        ],
        donts_en=[
            "Do not mix leaf from different plucking rounds.",
        ],
        photo_count=1,
        photo_descriptions=["Delivery receipt or weighbridge slip"],
        quick_fields=["delivery_weight_kg", "factory_batch_ref"],
    ),
]

TEA_TEMPLATE: Dict[str, Any] = {
    "id": "tea_default",
    "name": "Tea — Generic Sample Template",
    "crop": "tea",
    "description": (
        "A generic starting point for tea quality standards. "
        f"{_PLACEHOLDER}"
    ),
    "grade_spec": {
        "plucking_standard": "Two leaves and a bud [SAMPLE — review with agronomist]",
        "leaf_quality_notes": "No damaged, diseased or over-mature leaf [SAMPLE]",
        "moisture_max_pct": "75 [SAMPLE — typical fresh leaf range; verify]",
        "other": "",
    },
    "stages": _TEA_STAGES,
}


# ──────────────────────────────────────────────────────────────────────────────
# CINNAMON TEMPLATE
# ──────────────────────────────────────────────────────────────────────────────
_CINNAMON_STAGES: List[Dict[str, Any]] = [
    _stage(
        position=1,
        name="Land Preparation",
        timing_type="one_time",
        start_offset_days=0,
        instruction_en=(
            "Clear land of existing vegetation. Test soil and correct pH "
            "to the recommended range for cinnamon. Prepare planting pits."
        ),
        dos_en=[
            "Test soil pH and nutrient levels before planting.",
            "Prepare planting holes of adequate size.",
            "Ensure good drainage to prevent waterlogging.",
        ],
        donts_en=[
            "Do not plant in waterlogged or poorly drained areas.",
        ],
        photo_count=1,
        photo_descriptions=["Prepared planting area"],
        quick_fields=["soil_ph_reading"],
    ),
    _stage(
        position=2,
        name="Planting",
        timing_type="one_time",
        start_offset_days=30,
        instruction_en=(
            "Plant cinnamon seedlings or grafted planting material at the "
            "recommended spacing. Water immediately after planting."
        ),
        dos_en=[
            "Use certified or approved planting material.",
            "Plant at recommended spacing.",
            "Irrigate or water after planting.",
        ],
        donts_en=[
            "Do not use diseased or substandard planting material.",
        ],
        photo_count=2,
        photo_descriptions=["Planting material", "Planted seedlings in field"],
        quick_fields=["cultivar_or_selection", "plants_per_hectare"],
    ),
    _stage(
        position=3,
        name="Establishment & Weed Control",
        timing_type="one_time",
        start_offset_days=60,
        instruction_en=(
            "Control weeds around young plants to reduce competition. "
            "Monitor for pest and disease pressure during establishment."
        ),
        dos_en=[
            "Remove weeds regularly during the first year.",
            "Apply mulch around plants to conserve moisture.",
        ],
        donts_en=[
            "Do not allow weeds to shade or suppress young plants.",
        ],
        photo_count=1,
        photo_descriptions=["Young cinnamon plants with weed control"],
    ),
    _stage(
        position=4,
        name="Fertilizer Application",
        timing_type="recurring",
        start_offset_days=90,
        repeat_interval_days=120,
        end_offset_days=1800,
        instruction_en=(
            "Apply fertilizer at soil-test-based rates. "
            "Sample rate: [INSERT RATE — consult agronomist]. "
            "Keep records of all applications."
        ),
        dos_en=[
            "Follow soil-test-based fertilizer recommendations.",
            "Keep fertilizer application records.",
        ],
        donts_en=[
            "Do not apply immediately before heavy rain.",
            "Do not use unapproved synthetic fertilizers.",
        ],
        allowed_inputs=["Approved organic compost", "Approved inorganic fertilizer (rate TBD)"],
        photo_count=1,
        photo_descriptions=["Fertilizer application"],
        quick_fields=["fertilizer_type", "rate_kg_per_ha"],
    ),
    _stage(
        position=5,
        name="Pruning / Coppicing",
        timing_type="recurring",
        start_offset_days=365,
        repeat_interval_days=365,
        instruction_en=(
            "Coppice or prune plants to encourage multi-stem growth suitable "
            "for bark harvest. Remove dead and diseased stems."
        ),
        dos_en=[
            "Coppice at the recommended height for the variety.",
            "Dispose of cut material hygienically.",
            "Record coppicing date.",
        ],
        donts_en=[
            "Do not coppice stressed or diseased plants without treatment first.",
        ],
        photo_count=1,
        photo_descriptions=["Coppiced cinnamon plants"],
        quick_fields=["coppice_height_cm", "coppice_date"],
    ),
    _stage(
        position=6,
        name="Pest & Disease Control",
        timing_type="recurring",
        start_offset_days=30,
        repeat_interval_days=30,
        instruction_en=(
            "Scout regularly for pests and diseases. Apply only approved "
            "inputs. Record all spray operations and observe PHI requirements."
        ),
        dos_en=[
            "Scout at least once per month.",
            "Use approved pesticides only — check the approved list.",
            "Observe pre-harvest intervals.",
        ],
        donts_en=[
            "Do not apply unapproved pesticides.",
            "Do not spray within the restricted pre-harvest interval.",
        ],
        banned_inputs=[
            {"name": "[SAMPLE — replace with actual banned chemical]", "min_days_before_harvest": 21}
        ],
        photo_count=1,
        photo_descriptions=["Pest or disease symptom if observed"],
        quick_fields=["pest_observed", "treatment_applied"],
    ),
    _stage(
        position=7,
        name="Harvesting (Bark Strip)",
        timing_type="recurring",
        start_offset_days=730,
        repeat_interval_days=365,
        instruction_en=(
            "Harvest stems that have reached the required maturity (typically "
            "[X] years — verify with agronomist). Cut stems at ground level "
            "and transport quickly to the peeling area."
        ),
        dos_en=[
            "Harvest only stems meeting the maturity criteria.",
            "Handle harvested stems carefully to avoid bark damage.",
            "Record harvest date and weight.",
        ],
        donts_en=[
            "Do not harvest immature stems.",
            "Do not leave cut stems exposed to sun for extended periods.",
        ],
        photo_count=2,
        photo_descriptions=["Harvested stems ready for peeling", "Harvest weight record"],
        quick_fields=["stem_age_years", "harvest_weight_kg"],
    ),
    _stage(
        position=8,
        name="Peeling & Drying",
        timing_type="one_time",
        start_offset_days=731,
        instruction_en=(
            "Peel bark from harvested stems and form quills. Dry quills "
            "under shade or in a well-ventilated area to the target moisture "
            "content. Grade quills according to the grade specification below."
        ),
        dos_en=[
            "Peel bark promptly after harvest.",
            "Dry quills to the target moisture content.",
            "Grade and sort quills according to the grade specification.",
        ],
        donts_en=[
            "Do not dry quills in direct harsh sunlight if it causes cracking.",
            "Do not mix quills of different grades.",
        ],
        photo_count=2,
        photo_descriptions=["Peeled quills drying", "Graded quills sample"],
        quick_fields=["moisture_pct_at_packing", "quill_grade"],
    ),
]

CINNAMON_TEMPLATE: Dict[str, Any] = {
    "id": "cinnamon_default",
    "name": "Cinnamon — Generic Sample Template",
    "crop": "cinnamon",
    "description": (
        "A generic starting point for cinnamon quality standards. "
        f"{_PLACEHOLDER}"
    ),
    "grade_spec": {
        "stem_maturity": "[SAMPLE — e.g. minimum 2-year-old stems; verify]",
        "quill_grade": "[SAMPLE — e.g. C5 or above; verify with buyer spec]",
        "moisture_max_pct": "13 [SAMPLE — dried quill; verify]",
        "other": "",
    },
    "stages": _CINNAMON_STAGES,
}


# ──────────────────────────────────────────────────────────────────────────────
# GRADE-SPEC FIELD DEFINITIONS  (per crop)
# Keys match the template grade_spec keys above.
# Unknown / legacy keys are preserved in the UI under "Other".
# ──────────────────────────────────────────────────────────────────────────────
GRADE_SPEC_FIELDS: Dict[str, List[Dict[str, str]]] = {
    "tea": [
        {
            "key": "plucking_standard",
            "label": "Plucking Standard",
            "hint": "e.g. 'Two leaves and a bud'",
            "input_type": "text",
        },
        {
            "key": "leaf_quality_notes",
            "label": "Leaf Quality Notes",
            "hint": "e.g. 'No damaged or over-mature leaf'",
            "input_type": "text",
        },
        {
            "key": "moisture_max_pct",
            "label": "Max Moisture (% fresh leaf)",
            "hint": "e.g. 75",
            "input_type": "text",
        },
    ],
    "cinnamon": [
        {
            "key": "stem_maturity",
            "label": "Stem Maturity Requirement",
            "hint": "e.g. 'Minimum 2-year-old stems'",
            "input_type": "text",
        },
        {
            "key": "quill_grade",
            "label": "Quill Grade",
            "hint": "e.g. 'C5 or above'",
            "input_type": "text",
        },
        {
            "key": "moisture_max_pct",
            "label": "Max Moisture (% dried quill)",
            "hint": "e.g. 13",
            "input_type": "text",
        },
    ],
}


# ──────────────────────────────────────────────────────────────────────────────
# Public accessor
# ──────────────────────────────────────────────────────────────────────────────
_ALL_TEMPLATES = [TEA_TEMPLATE, CINNAMON_TEMPLATE]


def get_templates(crop: Optional[str] = None) -> Dict[str, Any]:
    """
    Return templates and grade-spec field definitions.
    If crop is provided, filter templates to that crop.
    """
    templates = _ALL_TEMPLATES
    if crop and crop.strip():
        crop_lower = crop.strip().lower()
        templates = [t for t in _ALL_TEMPLATES if t["crop"] == crop_lower]

    return {
        "templates": templates,
        "grade_spec_fields": GRADE_SPEC_FIELDS,
    }

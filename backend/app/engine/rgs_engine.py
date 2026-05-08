from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

GRAVITY = 9.80665
PASSAT_GAMMA_G = 10.0  # калибровка под примеры Пассат/ВСП в предоставленных файлах
STEEL_DENSITY_DEFAULT = 7850.0
WATER_DENSITY = 1000.0
ATMOSPHERIC_HORIZONTAL_LIMIT_MPA = 0.07

MATERIALS: dict[str, dict[str, float | str]] = {
    "09G2S": {
        "label": "09Г2С",
        "sigma_work": 196.0,
        "sigma_test": 250.0,
        "E": 1.99e5,
        "density": 7850.0,
    },
    "St3": {
        "label": "Ст3",
        "sigma_work": 154.0,
        "sigma_test": 227.3,
        "E": 1.99e5,
        "density": 7850.0,
    },
}

SOIL_PRESETS: dict[str, dict[str, float | str]] = {
    "sand_coarse": {"label": "Пески гравелистые и крупные", "density": 1800.0, "phi": 40.0, "e": 0.45},
    "sand_medium": {"label": "Пески средней крупности", "density": 1700.0, "phi": 35.0, "e": 0.55},
    "sand_fine": {"label": "Пески мелкие", "density": 1650.0, "phi": 30.0, "e": 0.60},
    "loam": {"label": "Суглинок", "density": 1850.0, "phi": 24.0, "e": 0.65},
    "clay": {"label": "Глина", "density": 1900.0, "phi": 18.0, "e": 0.75},
}

STANDARD_STRAP_THICKNESS_MM = [6, 8, 10, 12, 14]
STANDARD_STRAP_WIDTH_MM = [40, 50, 60, 80, 100, 120, 140, 160, 180, 200]
DEFAULT_RING_SECTION_CM2 = 10.34  # калибровка по примеру Пассат РГСП-15
DEFAULT_RING_MASS_FACTOR = 1.0
DEFAULT_SHELL_COURSE_MM = 1490.0
DEFAULT_RING_END_CLEARANCE_MM = 500.0


@dataclass(slots=True)
class CheckItem:
    code: str
    title: str
    result: str
    value: float | None
    limit: float | None
    unit: str = ""
    note: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "title": self.title,
            "result": self.result,
            "value": self.value,
            "limit": self.limit,
            "unit": self.unit,
            "note": self.note,
        }


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def circle_area(d_m: float) -> float:
    return math.pi * d_m * d_m / 4.0


def circular_segment_area(radius_m: float, fill_height_m: float) -> float:
    h = clamp(fill_height_m, 0.0, 2.0 * radius_m)
    if h <= 0:
        return 0.0
    if h >= 2.0 * radius_m:
        return math.pi * radius_m * radius_m
    theta = 2.0 * math.acos((radius_m - h) / radius_m)
    return 0.5 * radius_m * radius_m * (theta - math.sin(theta))


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def material_props(code: str) -> dict[str, float | str]:
    return MATERIALS.get(code, MATERIALS["09G2S"])


def effective_thickness_mm(nominal_mm: float, corr_mm: float, minus_tol_mm: float) -> float:
    return max(0.1, nominal_mm - corr_mm - minus_tol_mm)


def horizontal_fill_fraction(d_m: float, fill_mode: str, fill_value: float) -> tuple[float, float]:
    if fill_mode == "level":
        fill_height = clamp(fill_value, 0.0, d_m)
    else:
        fill_height = clamp(d_m * fill_value / 100.0, 0.0, d_m)
    frac = circular_segment_area(d_m / 2.0, fill_height) / circle_area(d_m)
    return fill_height, clamp(frac, 0.0, 1.0)


def head_geometry(head_type: str, diameter_m: float, projection_m: float, small_diameter_m: float) -> dict[str, float]:
    r1 = diameter_m / 2.0
    r2 = max(0.0, small_diameter_m / 2.0)
    h = max(0.0, projection_m)

    if head_type == "flat":
        return {
            "internal_volume_each_m3": 0.0,
            "outer_surface_each_m2": circle_area(diameter_m),
            "projection_m": 0.0,
            "small_diameter_m": 0.0,
            "slant_height_m": 0.0,
            "plate_area_each_m2": circle_area(diameter_m),
        }

    if head_type == "cone":
        if h <= 0:
            return head_geometry("flat", diameter_m, 0.0, 0.0)
        slant = math.hypot(r1, h)
        return {
            "internal_volume_each_m3": math.pi * r1 * r1 * h / 3.0,
            "outer_surface_each_m2": math.pi * r1 * slant,
            "projection_m": h,
            "small_diameter_m": 0.0,
            "slant_height_m": slant,
            "plate_area_each_m2": 0.0,
        }

    if head_type == "truncated_cone":
        if h <= 0:
            return head_geometry("flat", diameter_m, 0.0, 0.0)
        r2 = clamp(r2, 0.0, r1)
        slant = math.hypot(r1 - r2, h)
        return {
            "internal_volume_each_m3": math.pi * h * (r1 * r1 + r1 * r2 + r2 * r2) / 3.0,
            "outer_surface_each_m2": math.pi * (r1 + r2) * slant + math.pi * r2 * r2,
            "projection_m": h,
            "small_diameter_m": 2.0 * r2,
            "slant_height_m": slant,
            "plate_area_each_m2": math.pi * r2 * r2,
        }

    # запасной вариант: эквивалент эллиптическому/другому головному участку не делаем — используем плоское.
    return head_geometry("flat", diameter_m, 0.0, 0.0)


def flat_head_rib_properties(head_effective_mm: float, rib_height_mm: float, rib_width_mm: float, rib_thickness_mm: float) -> dict[str, float]:
    area_mm2 = rib_thickness_mm * rib_height_mm + rib_width_mm * rib_thickness_mm
    area_cm2 = area_mm2 / 100.0
    if area_mm2 <= 0:
        return {
            "area_mm2": 0.0,
            "area_cm2": 0.0,
            "centroid_to_mid_mm": 0.0,
            "centroid_to_surface_mm": 0.0,
            "inertia_cm4": 0.0,
        }
    centroid_to_mid = (
        (rib_thickness_mm * rib_height_mm * rib_height_mm)
        + (rib_width_mm * rib_thickness_mm * (2.0 * rib_height_mm + rib_thickness_mm))
    ) / (2.0 * area_mm2) + head_effective_mm / 2.0
    centroid_to_surface = centroid_to_mid - head_effective_mm / 2.0
    inertia_mm4 = (
        (rib_thickness_mm / 3.0) * (centroid_to_surface ** 3 + (rib_height_mm - centroid_to_surface) ** 3)
        + (rib_width_mm * rib_thickness_mm / 12.0)
        * (rib_thickness_mm ** 2 + 12.0 * (rib_height_mm - centroid_to_surface + rib_thickness_mm / 2.0) ** 2)
    )
    return {
        "area_mm2": area_mm2,
        "area_cm2": area_cm2,
        "centroid_to_mid_mm": centroid_to_mid,
        "centroid_to_surface_mm": centroid_to_surface,
        "inertia_cm4": inertia_mm4 / 1e4,
    }


def flat_head_allowable_external_pressure_mpa(
    diameter_mm: float,
    head_nominal_mm: float,
    allowances_mm: float,
    sigma_head_mpa: float,
    rib_count: int,
    rib_height_mm: float,
    rib_width_mm: float,
    rib_thickness_mm: float,
) -> dict[str, float]:
    s_eff = effective_thickness_mm(head_nominal_mm, allowances_mm, 0.0)
    rib_props = flat_head_rib_properties(s_eff, rib_height_mm, rib_width_mm, rib_thickness_mm)
    area_cm2 = rib_props["area_cm2"]
    if diameter_mm <= 0 or s_eff <= 0 or rib_count <= 0 or area_cm2 <= 0:
        return {
            "effective_thickness_mm": s_eff,
            "p_allow_whole_mpa": 0.0,
            "p_allow_between_mpa": 0.0,
            "p_allow_mpa": 0.0,
            "y_mm": 0.0,
            "m_sum_kn": 0.0,
            "rib_area_cm2": area_cm2,
            **rib_props,
        }
    y_mm = rib_count * area_cm2 * 100.0 / (2.0 * math.pi * diameter_mm)
    m_head_kn = sigma_head_mpa * (y_mm * y_mm + (s_eff / 2.0) ** 2) / 1000.0
    m_rib_kn = (
        sigma_head_mpa * rib_count * area_cm2 * 100.0 / (math.pi * diameter_mm)
        * (rib_props["centroid_to_surface_mm"] - y_mm + s_eff / 2.0)
        / 1000.0
    )
    m_sum_kn = m_head_kn + m_rib_kn
    p_allow_whole = 12.0 * (2.0 * math.pi * m_sum_kn) / (math.pi * diameter_mm * diameter_mm) * 1000.0
    sin_term = math.sin(math.pi / rib_count)
    if abs(sin_term) < 1e-9:
        p_allow_between = 0.0
    else:
        p_allow_between = (
            12.0
            * sigma_head_mpa
            * s_eff * s_eff
            * (1.0 + sin_term) ** 2
            / (math.pi * diameter_mm * diameter_mm * sin_term * sin_term)
        )
    return {
        "effective_thickness_mm": s_eff,
        "p_allow_whole_mpa": p_allow_whole,
        "p_allow_between_mpa": p_allow_between,
        "p_allow_mpa": min(p_allow_whole, p_allow_between) if p_allow_between > 0 else p_allow_whole,
        "y_mm": y_mm,
        "m_sum_kn": m_sum_kn,
        "rib_area_cm2": area_cm2,
        **rib_props,
    }


def shell_external_allowable_mpa(
    diameter_mm: float,
    nominal_mm: float,
    allowances_mm: float,
    sigma_mpa: float,
    e_mpa: float,
    unsupported_length_mm: float,
) -> dict[str, float]:
    t_eff = effective_thickness_mm(nominal_mm, allowances_mm, 0.0)
    l = max(50.0, unsupported_length_mm)
    if diameter_mm <= 0 or t_eff <= 0:
        return {
            "effective_thickness_mm": t_eff,
            "lambda": 0.0,
            "p_elastic_mpa": 0.0,
            "p_strength_mpa": 0.0,
            "p_allow_mpa": 0.0,
            "spacing_mm": l,
        }
    p_elastic = 2.08e-5 * e_mpa * diameter_mm / (2.4 * l) * (100.0 * t_eff / diameter_mm) ** 2.5
    lam = (l * l) / (diameter_mm * t_eff)
    p_strength = 2.0 * sigma_mpa * t_eff / (diameter_mm + t_eff) * (2.0 + lam) / (1.0 + lam)
    if p_elastic <= 0:
        p_allow = 0.0
    else:
        p_allow = p_strength / math.sqrt(1.0 + (p_strength / p_elastic) ** 2)
    return {
        "effective_thickness_mm": t_eff,
        "lambda": lam,
        "p_elastic_mpa": p_elastic,
        "p_strength_mpa": p_strength,
        "p_allow_mpa": p_allow,
        "spacing_mm": l,
    }


def shell_internal_allowable_mpa(diameter_mm: float, nominal_mm: float, allowances_mm: float, sigma_mpa: float) -> dict[str, float]:
    t_eff = effective_thickness_mm(nominal_mm, allowances_mm, 0.0)
    if diameter_mm <= 0 or t_eff <= 0:
        return {"effective_thickness_mm": t_eff, "p_allow_mpa": 0.0}
    p_allow = 2.0 * sigma_mpa * t_eff / (diameter_mm + t_eff)
    return {"effective_thickness_mm": t_eff, "p_allow_mpa": p_allow}


def shell_required_internal_nominal_mm(diameter_mm: float, pressure_mpa: float, sigma_mpa: float, allowances_mm: float) -> float:
    if pressure_mpa <= 0:
        return allowances_mm
    return pressure_mpa * diameter_mm / max(1e-6, (2.0 * sigma_mpa - pressure_mpa)) + allowances_mm


def min_distance_between_single_nozzles_mm(diameter_mm: float, nominal_mm: float, allowances_mm: float) -> float:
    t_eff = effective_thickness_mm(nominal_mm, allowances_mm, 0.0)
    return 2.0 * math.sqrt(max(0.0, diameter_mm * t_eff))


def nozzle_pipe_allowable_external_mpa(nozzle_d_mm: float, nozzle_t_mm: float, nozzle_length_mm: float, sigma_mpa: float, e_mpa: float) -> dict[str, float]:
    t_eff = max(0.1, nozzle_t_mm)
    l = max(10.0, nozzle_length_mm)
    if nozzle_d_mm <= 0:
        return {"p_allow_mpa": 0.0, "p_elastic_mpa": 0.0, "p_strength_mpa": 0.0}
    p_elastic = 20.8e-6 * e_mpa * nozzle_d_mm / (2.4 * l) * (100.0 * t_eff / nozzle_d_mm) ** 2.5
    p_strength = 2.0 * sigma_mpa * t_eff / (nozzle_d_mm + t_eff)
    p_allow = p_strength / math.sqrt(1.0 + (p_strength / max(p_elastic, 1e-9)) ** 2)
    return {"p_allow_mpa": p_allow, "p_elastic_mpa": p_elastic, "p_strength_mpa": p_strength}


def select_strap_configuration(required_area_mm2: float) -> tuple[int, int]:
    for thickness in STANDARD_STRAP_THICKNESS_MM:
        for width in STANDARD_STRAP_WIDTH_MM:
            if thickness * width >= required_area_mm2:
                return thickness, width
    return STANDARD_STRAP_THICKNESS_MM[-1], STANDARD_STRAP_WIDTH_MM[-1]


def infer_ring_count(shell_length_m: float, offset_m: float, t_nominal_mm: float, allowances_mm: float, diameter_mm: float, sigma_mpa: float, e_mpa: float, p_required_mpa: float) -> tuple[int, dict[str, float]]:
    if p_required_mpa <= 0:
        evaluation = shell_external_allowable_mpa(diameter_mm, t_nominal_mm, allowances_mm, sigma_mpa, e_mpa, shell_length_m * 1000.0)
        return 0, evaluation
    shell_length_mm = max(10.0, shell_length_m * 1000.0)
    offset_mm = clamp(offset_m * 1000.0, 0.0, max(0.0, shell_length_mm / 2.0 - 10.0))
    best_eval = shell_external_allowable_mpa(diameter_mm, t_nominal_mm, allowances_mm, sigma_mpa, e_mpa, shell_length_mm)
    max_ring_count = min(6, max(0, int(math.floor((max(shell_length_mm - 2.0 * offset_mm, 0.0) / 1000.0) - 1.0))))
    for ring_count in range(0, max_ring_count + 1):
        if ring_count <= 0:
            spacing = shell_length_mm
        else:
            spacing = max(50.0, (shell_length_mm - 2.0 * offset_mm) / (ring_count + 1))
        evaluation = shell_external_allowable_mpa(diameter_mm, t_nominal_mm, allowances_mm, sigma_mpa, e_mpa, spacing)
        best_eval = evaluation
        if evaluation["p_allow_mpa"] >= p_required_mpa:
            return ring_count, evaluation
    return max_ring_count, best_eval


def fabrication_ring_layout(shell_length_m: float, shell_course_mm: float, end_clearance_mm: float) -> dict[str, Any]:
    shell_length_mm = max(0.0, shell_length_m * 1000.0)
    pitch_mm = max(100.0, shell_course_mm)
    clearance_mm = clamp(end_clearance_mm, 0.0, max(0.0, shell_length_mm / 2.0))
    positions_mm: list[float] = []
    position_mm = pitch_mm
    while position_mm < shell_length_mm:
        if position_mm >= clearance_mm and shell_length_mm - position_mm >= clearance_mm:
            positions_mm.append(position_mm)
        position_mm += pitch_mm
    return {
        "shell_course_mm": pitch_mm,
        "end_clearance_mm": clearance_mm,
        "ring_count": len(positions_mm),
        "positions_mm": positions_mm,
        "note": "Fabrication layout: rings/diaphragms at shell course joints; joints close to heads are skipped.",
    }


def evaluate_ring_count(shell_length_m: float, offset_m: float, ring_count: int, t_nominal_mm: float, allowances_mm: float, diameter_mm: float, sigma_mpa: float, e_mpa: float) -> dict[str, float]:
    shell_length_mm = max(10.0, shell_length_m * 1000.0)
    if ring_count <= 0:
        spacing = shell_length_mm
    else:
        spacing = max(50.0, (shell_length_mm - 2.0 * offset_m * 1000.0) / (ring_count + 1))
    return shell_external_allowable_mpa(diameter_mm, t_nominal_mm, allowances_mm, sigma_mpa, e_mpa, spacing)


def recommended_shell_solution(
    diameter_mm: float,
    shell_length_m: float,
    allowances_mm: float,
    sigma_mpa: float,
    e_mpa: float,
    p_internal_required_mpa: float,
    p_external_required_mpa: float,
    ring_mode: str,
    manual_ring_count: int,
    ring_offset_m: float,
    min_nominal_mm: int,
) -> dict[str, float | int | None]:
    for candidate in range(max(4, min_nominal_mm), 41):
        int_eval = shell_internal_allowable_mpa(diameter_mm, candidate, allowances_mm, sigma_mpa)
        if int_eval["p_allow_mpa"] + 1e-9 < p_internal_required_mpa:
            continue
        if p_external_required_mpa <= 0:
            return {"shell_nominal_mm": candidate, "ring_count": max(0, manual_ring_count if ring_mode == "manual" else 0), "spacing_mm": shell_length_m * 1000.0}
        if ring_mode == "manual":
            ring_count = max(0, manual_ring_count)
            if ring_count <= 0:
                spacing = shell_length_m * 1000.0
            else:
                spacing = max(50.0, (shell_length_m * 1000.0 - 2.0 * ring_offset_m * 1000.0) / (ring_count + 1))
            ext_eval = shell_external_allowable_mpa(diameter_mm, candidate, allowances_mm, sigma_mpa, e_mpa, spacing)
            if ext_eval["p_allow_mpa"] + 1e-9 >= p_external_required_mpa:
                return {"shell_nominal_mm": candidate, "ring_count": ring_count, "spacing_mm": spacing}
            continue
        ring_count, ext_eval = infer_ring_count(shell_length_m, ring_offset_m, candidate, allowances_mm, diameter_mm, sigma_mpa, e_mpa, p_external_required_mpa)
        if ext_eval["p_allow_mpa"] + 1e-9 >= p_external_required_mpa:
            return {"shell_nominal_mm": candidate, "ring_count": ring_count, "spacing_mm": ext_eval["spacing_mm"]}
    return {"shell_nominal_mm": None, "ring_count": None, "spacing_mm": None}


def recommended_flat_head_thickness_mm(
    diameter_mm: float,
    allowances_mm: float,
    sigma_head_mpa: float,
    p_external_required_mpa: float,
    rib_count: int,
    rib_height_mm: float,
    rib_width_mm: float,
    rib_thickness_mm: float,
    minimum_nominal_mm: int,
) -> int | None:
    if p_external_required_mpa <= 0:
        return max(minimum_nominal_mm, math.ceil(allowances_mm))
    for candidate in range(max(4, minimum_nominal_mm), 41):
        evaluation = flat_head_allowable_external_pressure_mpa(
            diameter_mm,
            candidate,
            allowances_mm,
            sigma_head_mpa,
            rib_count,
            rib_height_mm,
            rib_width_mm,
            rib_thickness_mm,
        )
        if evaluation["p_allow_mpa"] + 1e-9 >= p_external_required_mpa:
            return candidate
    return None


def approximate_conical_head_allowable_mpa(
    large_diameter_mm: float,
    small_diameter_mm: float,
    projection_m: float,
    nominal_mm: float,
    allowances_mm: float,
    sigma_head_mpa: float,
    e_mpa: float,
    pressure_mode: str,
) -> dict[str, float]:
    mean_d = max(100.0, (large_diameter_mm + max(0.0, small_diameter_mm)) / 2.0)
    slant_mm = max(50.0, math.hypot(max(0.0, (large_diameter_mm - max(0.0, small_diameter_mm)) / 2.0), projection_m * 1000.0))
    if pressure_mode == "external":
        return shell_external_allowable_mpa(mean_d, nominal_mm, allowances_mm, sigma_head_mpa, e_mpa, slant_mm)
    return shell_internal_allowable_mpa(mean_d, nominal_mm, allowances_mm, sigma_head_mpa)


def calculate_rgs(payload: dict[str, Any]) -> dict[str, Any]:
    tank_type = str(payload.get("tank_type", "rgsn")).lower()
    is_underground = tank_type in {"rgsp", "rgspd"}
    is_double_wall = tank_type in {"rgsnd", "rgspd"}

    material_code = str(payload.get("material") or "09G2S")
    material = material_props(material_code)
    sigma_work = safe_float(payload.get("sigma_work_mpa"), safe_float(material["sigma_work"]))
    sigma_test = safe_float(payload.get("sigma_test_mpa"), safe_float(material["sigma_test"]))
    e_mpa = safe_float(payload.get("e_mpa"), safe_float(material["E"]))
    steel_density = safe_float(payload.get("steel_density_kg_m3"), safe_float(material["density"]))

    product_name = str(payload.get("product_name") or "Продукт")
    d_m = max(0.2, safe_float(payload.get("D"), 2.0))
    total_length_m = max(0.5, safe_float(payload.get("total_length_m"), safe_float(payload.get("L"), 4.5)))
    head_type = str(payload.get("head_type") or "flat")
    head_projection_m = max(0.0, safe_float(payload.get("head_projection_m"), 0.0 if head_type == "flat" else 0.3))
    head_small_diameter_m = max(0.0, safe_float(payload.get("head_small_diameter_m"), 0.0))

    shell_nominal_mm = max(3.0, safe_float(payload.get("shell_nominal_mm"), safe_float(payload.get("t_shell_mm"), 8.0)))
    head_nominal_mm = max(3.0, safe_float(payload.get("head_nominal_mm"), shell_nominal_mm))
    corr_mm = max(0.0, safe_float(payload.get("corr_mm"), 2.0 if is_underground else 0.0))
    minus_tol_mm = max(0.0, safe_float(payload.get("minus_tolerance_mm"), 0.8))
    allowances_shell_mm = corr_mm + minus_tol_mm
    allowances_head_mm = max(0.0, safe_float(payload.get("head_allowances_mm"), minus_tol_mm))

    support_count = max(2, safe_int(payload.get("support_count"), 2))
    saddle_width_m = max(0.1, safe_float(payload.get("saddle_width_m"), safe_float(payload.get("saddle_w"), 0.6)))

    fill_mode = str(payload.get("fill_mode") or "percent")
    fill_value = safe_float(payload.get("fill_value"), 100.0)
    rho = max(1.0, safe_float(payload.get("rho"), 1000.0))
    temperature_c = safe_float(payload.get("temperature_c"), 20.0)
    internal_pressure_mpa = max(0.0, safe_float(payload.get("design_pressure_mpa"), 0.0))
    vacuum_mpa = max(0.0, safe_float(payload.get("vacuum_mpa"), 0.0))
    extra_liquid_head_m = max(0.0, safe_float(payload.get("extra_liquid_head_m"), 0.0))

    ring_mode = str(payload.get("ring_mode") or ("auto" if is_underground else "manual")).lower()
    manual_ring_count = max(0, safe_int(payload.get("ring_count"), 0))
    ring_offset_m = max(0.0, safe_float(payload.get("ring_offset_m"), 0.2 if is_underground else 0.0))
    ring_shell_course_mm = max(100.0, safe_float(payload.get("ring_shell_course_mm"), DEFAULT_SHELL_COURSE_MM))
    ring_end_clearance_mm = max(0.0, safe_float(payload.get("ring_end_clearance_mm"), DEFAULT_RING_END_CLEARANCE_MM))
    ring_section_cm2 = max(0.0, safe_float(payload.get("ring_section_cm2"), DEFAULT_RING_SECTION_CM2))

    rib_count = max(1, safe_int(payload.get("rib_count"), 8))
    rib_height_mm = max(1.0, safe_float(payload.get("rib_height_mm"), 50.0))
    rib_width_mm = max(1.0, safe_float(payload.get("rib_width_mm"), 50.0))
    rib_thickness_mm = max(1.0, safe_float(payload.get("rib_thickness_mm"), 7.0))

    nozzle_count = max(0, safe_int(payload.get("nozzle_count"), 0))
    nozzle_dn_mm = max(0.0, safe_float(payload.get("nozzle_dn_mm"), 0.0))
    nozzle_length_mm = max(0.0, safe_float(payload.get("nozzle_length_mm"), 0.0))
    nozzle_thickness_mm = max(0.0, safe_float(payload.get("nozzle_thickness_mm"), shell_nominal_mm))

    insulation_enabled = bool(payload.get("insulation_enabled", False))
    insulation_thickness_mm = max(0.0, safe_float(payload.get("insulation_thickness_mm"), 0.0))
    insulation_density = max(0.0, safe_float(payload.get("insulation_density_kg_m3"), 120.0))
    coating_thickness_mm = max(0.0, safe_float(payload.get("coating_thickness_mm"), 0.0))
    coating_density = max(0.0, safe_float(payload.get("coating_density_kg_m3"), 1200.0))

    ladder = bool(payload.get("ladder", False))
    platform = bool(payload.get("platform", False))
    manhole_count = max(0, safe_int(payload.get("manhole_count"), 1 if safe_float(payload.get("neck_height_m"), 0.0) > 0 else 0))
    neck_height_m = max(0.0, safe_float(payload.get("neck_height_m"), 0.0))

    soil_preset = str(payload.get("soil_preset") or "sand_coarse")
    soil_defaults = SOIL_PRESETS.get(soil_preset, SOIL_PRESETS["sand_coarse"])
    burial_depth_top_m = max(0.0, safe_float(payload.get("burial_depth_top_m"), 3.0 if is_underground else 0.0))
    soil_density = max(1000.0, safe_float(payload.get("soil_density_kg_m3"), safe_float(soil_defaults["density"])))
    soil_phi_deg = clamp(safe_float(payload.get("soil_phi_deg"), safe_float(soil_defaults["phi"])), 5.0, 45.0)
    soil_void_ratio = clamp(safe_float(payload.get("soil_void_ratio"), safe_float(soil_defaults["e"])), 0.1, 1.0)
    gamma_f = clamp(safe_float(payload.get("gamma_f"), 1.15), 1.0, 1.6)
    groundwater = bool(payload.get("groundwater", False))
    groundwater_density = max(500.0, safe_float(payload.get("groundwater_density_kg_m3"), WATER_DENSITY))

    strap_spacing_m = max(0.5, safe_float(payload.get("strap_spacing_m"), 2.5))
    strap_allowable_mpa = max(20.0, safe_float(payload.get("strap_allowable_mpa"), 140.0))
    outer_shell_gap_m = max(0.0, safe_float(payload.get("outer_shell_gap_m"), 0.03 if is_double_wall else 0.0))
    outer_shell_nominal_mm = max(3.0, safe_float(payload.get("outer_shell_nominal_mm"), shell_nominal_mm if is_double_wall else 0.0)) if is_double_wall else 0.0

    head_geo = head_geometry(head_type, d_m, head_projection_m, head_small_diameter_m)
    shell_length_m = total_length_m - 2.0 * head_geo["projection_m"]
    if shell_length_m <= 0.1:
        raise ValueError("Общая длина должна быть больше суммы вылетов днищ.")

    fabrication_layout = fabrication_ring_layout(shell_length_m, ring_shell_course_mm, ring_end_clearance_mm)
    fabrication_ring_count = safe_int(fabrication_layout["ring_count"], 0)

    fill_height_m, fill_fraction = horizontal_fill_fraction(d_m, fill_mode, fill_value)
    full_shell_volume_m3 = circle_area(d_m) * shell_length_m
    full_head_volume_each_m3 = head_geo["internal_volume_each_m3"]
    full_volume_m3 = full_shell_volume_m3 + 2.0 * full_head_volume_each_m3

    shell_partial_volume_m3 = circular_segment_area(d_m / 2.0, fill_height_m) * shell_length_m
    product_volume_m3 = shell_partial_volume_m3 + 2.0 * full_head_volume_each_m3 * fill_fraction

    product_mass_kg = product_volume_m3 * rho
    hydrotest_mass_kg = full_volume_m3 * WATER_DENSITY

    shell_mass_kg = math.pi * d_m * shell_length_m * (shell_nominal_mm / 1000.0) * steel_density
    if head_type == "flat":
        head_plate_mass_each_kg = circle_area(d_m) * (head_nominal_mm / 1000.0) * steel_density
        rib_area_mm2 = rib_thickness_mm * rib_height_mm + rib_width_mm * rib_thickness_mm
        rib_mass_each_kg = rib_count * (rib_area_mm2 * 1e-6) * (d_m / 2.0) * steel_density
        head_mass_each_kg = head_plate_mass_each_kg + rib_mass_each_kg
    else:
        head_mass_each_kg = head_geo["outer_surface_each_m2"] * (head_nominal_mm / 1000.0) * steel_density
    total_head_mass_kg = 2.0 * head_mass_each_kg

    nozzle_mass_kg = 0.0
    if nozzle_count > 0 and nozzle_dn_mm > 0 and nozzle_length_mm > 0 and nozzle_thickness_mm > 0:
        nozzle_cylinder_area_m2 = math.pi * (nozzle_dn_mm / 1000.0) * (nozzle_length_mm / 1000.0)
        nozzle_mass_kg = nozzle_count * nozzle_cylinder_area_m2 * (nozzle_thickness_mm / 1000.0) * steel_density

    manhole_mass_kg = manhole_count * 85.0
    ladder_mass_kg = 120.0 if ladder else 0.0
    platform_mass_kg = 180.0 if platform else 0.0
    support_mass_kg = support_count * (85.0 if not is_underground else 45.0)

    current_ring_count = max(0, manual_ring_count if ring_mode == "manual" else fabrication_ring_count)
    ring_mass_kg = 0.0
    if is_underground and ring_mode == "manual" and current_ring_count > 0:
        shell_od_m = d_m + 2.0 * shell_nominal_mm / 1000.0
        ring_mass_kg = current_ring_count * (ring_section_cm2 / 1e4) * math.pi * shell_od_m * steel_density * DEFAULT_RING_MASS_FACTOR

    outer_wall_mass_kg = 0.0
    annular_volume_m3 = 0.0
    outer_d_m = 0.0
    if is_double_wall:
        inner_outer_d_m = d_m + 2.0 * shell_nominal_mm / 1000.0
        outer_d_m = inner_outer_d_m + 2.0 * outer_shell_gap_m
        outer_head_geo = head_geometry(head_type, outer_d_m, head_projection_m, head_small_diameter_m + 2.0 * outer_shell_gap_m)
        outer_shell_area_m2 = math.pi * outer_d_m * shell_length_m
        outer_wall_mass_kg = outer_shell_area_m2 * (outer_shell_nominal_mm / 1000.0) * steel_density + 2.0 * outer_head_geo["outer_surface_each_m2"] * (outer_shell_nominal_mm / 1000.0) * steel_density
        outer_internal_volume = circle_area(outer_d_m) * shell_length_m + 2.0 * outer_head_geo["internal_volume_each_m3"]
        annular_volume_m3 = max(0.0, outer_internal_volume - full_volume_m3)

    shell_outer_d_m = d_m + 2.0 * shell_nominal_mm / 1000.0
    external_head_geo = head_geometry(head_type, shell_outer_d_m, head_geo["projection_m"], head_small_diameter_m + 2.0 * shell_nominal_mm / 1000.0 if head_type == "truncated_cone" else 0.0)
    external_displaced_volume_m3 = circle_area(shell_outer_d_m) * shell_length_m + 2.0 * external_head_geo["internal_volume_each_m3"]

    external_surface_area_m2 = math.pi * shell_outer_d_m * shell_length_m + 2.0 * external_head_geo["outer_surface_each_m2"]
    insulation_mass_kg = external_surface_area_m2 * (insulation_thickness_mm / 1000.0) * insulation_density if insulation_enabled and insulation_thickness_mm > 0 else 0.0
    coating_mass_kg = external_surface_area_m2 * (coating_thickness_mm / 1000.0) * coating_density if coating_thickness_mm > 0 else 0.0

    steel_mass_kg = shell_mass_kg + total_head_mass_kg + nozzle_mass_kg + manhole_mass_kg + ladder_mass_kg + platform_mass_kg + support_mass_kg + ring_mass_kg + outer_wall_mass_kg
    dry_mass_kg = steel_mass_kg + insulation_mass_kg + coating_mass_kg
    operating_mass_kg = dry_mass_kg + product_mass_kg
    hydrotest_total_mass_kg = dry_mass_kg + hydrotest_mass_kg

    operating_load_kN = operating_mass_kg * GRAVITY / 1000.0
    dry_load_kN = dry_mass_kg * GRAVITY / 1000.0
    hydrotest_load_kN = hydrotest_total_mass_kg * GRAVITY / 1000.0

    hydro_support_head_m = fill_height_m + extra_liquid_head_m
    hydro_support_mpa = rho * PASSAT_GAMMA_G * hydro_support_head_m / 1_000_000.0
    internal_total_mpa = internal_pressure_mpa + hydro_support_mpa

    pv_kpa = 0.0
    ph_kpa = 0.0
    pavg_kpa = 0.0
    soil_note = ""
    if is_underground and burial_depth_top_m > 0:
        gamma_soil_kN_m3 = soil_density / 1000.0 * PASSAT_GAMMA_G
        pv_kpa = gamma_f * gamma_soil_kN_m3 * burial_depth_top_m
        ka = math.tan(math.radians(45.0 - soil_phi_deg / 2.0)) ** 2
        ph_kpa = pv_kpa * ka * (1.0 + soil_void_ratio / 3.0)
        pavg_kpa = 0.75 * pv_kpa + 0.5 * ph_kpa
        soil_note = "Предварительная калибровка под предоставленные расчёты Пассат/ВСП 34-01-03."

    pressure_required_external_mpa = max(0.0, pavg_kpa / 1000.0 + vacuum_mpa - hydro_support_mpa - internal_pressure_mpa)
    head_required_external_mpa = max(0.0, (0.75 * pv_kpa + 0.5 * ph_kpa) / 1000.0 + vacuum_mpa - hydro_support_mpa - internal_pressure_mpa)
    if not is_underground:
        pressure_required_external_mpa = max(0.0, vacuum_mpa)
        head_required_external_mpa = max(0.0, vacuum_mpa)

    shell_current_ring_count = max(0, current_ring_count)
    if shell_current_ring_count <= 0:
        spacing_mm = shell_length_m * 1000.0
    else:
        spacing_mm = max(50.0, (shell_length_m * 1000.0 - 2.0 * ring_offset_m * 1000.0) / (shell_current_ring_count + 1))
    shell_ext_eval = shell_external_allowable_mpa(d_m * 1000.0, shell_nominal_mm, allowances_shell_mm, sigma_work, e_mpa, spacing_mm)
    shell_int_eval = shell_internal_allowable_mpa(d_m * 1000.0, shell_nominal_mm, allowances_shell_mm, sigma_work)
    shell_required_internal_mm = shell_required_internal_nominal_mm(d_m * 1000.0, internal_total_mpa, sigma_work, allowances_shell_mm)
    recommended_shell = recommended_shell_solution(
        d_m * 1000.0,
        shell_length_m,
        allowances_shell_mm,
        sigma_work,
        e_mpa,
        internal_total_mpa,
        pressure_required_external_mpa,
        ring_mode,
        shell_current_ring_count,
        ring_offset_m,
        max(math.ceil(allowances_shell_mm), math.ceil(shell_nominal_mm if payload.get("use_current_as_min") else 4)),
    )
    if ring_mode != "manual" and recommended_shell["ring_count"] is not None:
        fabrication_eval = evaluate_ring_count(
            shell_length_m,
            ring_offset_m,
            fabrication_ring_count,
            safe_float(recommended_shell["shell_nominal_mm"], shell_nominal_mm),
            allowances_shell_mm,
            d_m * 1000.0,
            sigma_work,
            e_mpa,
        )
        if fabrication_ring_count >= safe_int(recommended_shell["ring_count"], 0) or fabrication_eval["p_allow_mpa"] >= pressure_required_external_mpa - 1e-9:
            recommended_shell["ring_count"] = fabrication_ring_count
            recommended_shell["spacing_mm"] = fabrication_eval["spacing_mm"]

    head_note = ""
    if head_type == "flat":
        head_eval = flat_head_allowable_external_pressure_mpa(
            d_m * 1000.0,
            head_nominal_mm,
            allowances_head_mm,
            sigma_work,
            rib_count,
            rib_height_mm,
            rib_width_mm,
            rib_thickness_mm,
        )
        recommended_head_mm = recommended_flat_head_thickness_mm(
            d_m * 1000.0,
            allowances_head_mm,
            sigma_work,
            head_required_external_mpa,
            rib_count,
            rib_height_mm,
            rib_width_mm,
            rib_thickness_mm,
            max(math.ceil(allowances_head_mm), 4),
        )
    else:
        head_eval = approximate_conical_head_allowable_mpa(
            d_m * 1000.0,
            head_small_diameter_m * 1000.0,
            head_geo["projection_m"],
            head_nominal_mm,
            allowances_head_mm,
            sigma_work,
            e_mpa,
            "external",
        )
        recommended_head_mm = None
        for candidate in range(max(4, math.ceil(allowances_head_mm)), 41):
            test_eval = approximate_conical_head_allowable_mpa(
                d_m * 1000.0,
                head_small_diameter_m * 1000.0,
                head_geo["projection_m"],
                candidate,
                allowances_head_mm,
                sigma_work,
                e_mpa,
                "external",
            )
            if test_eval["p_allow_mpa"] + 1e-9 >= head_required_external_mpa:
                recommended_head_mm = candidate
                break
        head_note = "Для конических/усечённо-конических днищ используется предварительная оценка по эквивалентной обечайке."

    nozzle_eval = nozzle_pipe_allowable_external_mpa(nozzle_dn_mm, nozzle_thickness_mm, nozzle_length_mm, sigma_work, e_mpa) if nozzle_count > 0 else {"p_allow_mpa": 0.0, "p_elastic_mpa": 0.0, "p_strength_mpa": 0.0}

    bearing_area_each_m2 = max(0.1, saddle_width_m * max(d_m, 0.8))
    reaction_each_kN = operating_load_kN / support_count
    support_pressure_kpa = reaction_each_kN / bearing_area_each_m2

    buoyancy_force_kN = 0.0
    net_uplift_kN = 0.0
    strap_count = 0
    strap_area_each_mm2 = 0.0
    strap_thickness_mm = 0
    strap_width_mm = 0
    if is_underground and groundwater:
        water_gamma_kN_m3 = groundwater_density / 1000.0 * GRAVITY
        buoyancy_force_kN = external_displaced_volume_m3 * water_gamma_kN_m3
        net_uplift_kN = max(0.0, buoyancy_force_kN * 1.10 - dry_load_kN)
        if net_uplift_kN > 0:
            strap_count = max(2, math.ceil(total_length_m / strap_spacing_m))
            strap_area_each_mm2 = net_uplift_kN * 1000.0 / (strap_count * strap_allowable_mpa)
            strap_thickness_mm, strap_width_mm = select_strap_configuration(strap_area_each_mm2)

    checks: list[CheckItem] = []
    shell_internal_ok = shell_int_eval["p_allow_mpa"] >= internal_total_mpa - 1e-9
    checks.append(CheckItem(
        code="RGS_SHELL_INT",
        title="Обечайка: внутреннее давление",
        result="PASS" if shell_internal_ok else "FAIL",
        value=shell_int_eval["p_allow_mpa"],
        limit=internal_total_mpa,
        unit="МПа",
        note="Сравнение допускаемого внутреннего давления с рабочим внутренним давлением и гидростатической составляющей.",
    ))

    if pressure_required_external_mpa > 0:
        shell_external_ok = shell_ext_eval["p_allow_mpa"] >= pressure_required_external_mpa - 1e-9
        checks.append(CheckItem(
            code="RGS_SHELL_EXT",
            title="Обечайка: внешнее давление",
            result="PASS" if shell_external_ok else "FAIL",
            value=shell_ext_eval["p_allow_mpa"],
            limit=pressure_required_external_mpa,
            unit="МПа",
            note="Проверка устойчивости между кольцами/участками по калиброванной схеме предварительного расчёта.",
        ))
    else:
        shell_external_ok = True

    head_ok = True
    if head_required_external_mpa > 0:
        head_allow = safe_float(head_eval.get("p_allow_mpa"), 0.0)
        head_ok = head_allow >= head_required_external_mpa - 1e-9
        checks.append(CheckItem(
            code="RGS_HEAD_EXT",
            title="Днище: внешнее давление",
            result="PASS" if head_ok else "FAIL",
            value=head_allow,
            limit=head_required_external_mpa,
            unit="МПа",
            note=head_note or "Проверка днища под действием внешнего давления.",
        ))

    bearing_ok = support_pressure_kpa <= safe_float(payload.get("R0_kPa"), safe_float(payload.get("R0"), 200.0)) + 1e-9
    foundation_limit = safe_float(payload.get("R0_kPa"), safe_float(payload.get("R0"), 200.0))
    checks.append(CheckItem(
        code="RGS_SUPPORT_BEARING",
        title="Основание/седла: давление под опорами",
        result="PASS" if bearing_ok else "FAIL",
        value=support_pressure_kpa,
        limit=foundation_limit,
        unit="кПа",
        note="Предварительная оценка контактного давления под опорами/седлами.",
    ))

    if nozzle_count > 0 and pressure_required_external_mpa > 0:
        nozzle_ok = nozzle_eval["p_allow_mpa"] >= pressure_required_external_mpa - 1e-9
        checks.append(CheckItem(
            code="RGS_NOZZLE_PIPE_EXT",
            title="Патрубок: устойчивость под внешним давлением",
            result="PASS" if nozzle_ok else "FAIL",
            value=nozzle_eval["p_allow_mpa"],
            limit=pressure_required_external_mpa,
            unit="МПа",
            note="Проверка патрубка как отдельного цилиндрического элемента. Укрепление отверстия оценивается упрощённо.",
        ))

    if is_underground and groundwater:
        buoyancy_ok = net_uplift_kN <= 0.0
        checks.append(CheckItem(
            code="RGS_FLOTATION",
            title="Всплытие резервуара",
            result="PASS" if buoyancy_ok else "WARN",
            value=net_uplift_kN,
            limit=0.0,
            unit="кН",
            note="Если значение больше нуля — требуются удерживающие хомуты/анкеровка.",
        ))

    warnings: list[str] = []
    if internal_pressure_mpa > ATMOSPHERIC_HORIZONTAL_LIMIT_MPA:
        warnings.append("Расчётное внутреннее давление выше типового диапазона наливной ёмкости. Проверьте необходимость расчёта как сосуда, работающего под давлением.")
    if head_type != "flat":
        warnings.append("Для конических и усечённо-конических днищ прочностная проверка выполнена в предварительной эквивалентной постановке.")
    if is_double_wall:
        warnings.append("Для двустенного исполнения прочностные проверки выполняются по внутренней оболочке; наружная оболочка учитывается по массе и геометрии.")
    if is_underground and soil_note:
        warnings.append(soil_note)

    summary = {
        "tank_type": tank_type,
        "product_name": product_name,
        "material": str(material["label"]),
        "temperature_c": temperature_c,
        "full_volume_m3": full_volume_m3,
        "product_volume_m3": product_volume_m3,
        "fill_fraction": fill_fraction,
        "fill_height_m": fill_height_m,
        "shell_length_m": shell_length_m,
        "total_length_m": total_length_m,
        "steel_mass_kg": steel_mass_kg,
        "dry_mass_kg": dry_mass_kg,
        "product_mass_kg": product_mass_kg,
        "operating_mass_kg": operating_mass_kg,
        "hydrotest_mass_kg": hydrotest_total_mass_kg,
        "operating_load_kN": operating_load_kN,
        "recommended_shell_mm": recommended_shell["shell_nominal_mm"],
        "recommended_head_mm": recommended_head_mm,
        "recommended_ring_count": recommended_shell["ring_count"],
        "current_shell_ok": shell_internal_ok and shell_external_ok,
        "current_head_ok": head_ok,
        "current_nozzle_ok": None if nozzle_count <= 0 or pressure_required_external_mpa <= 0 else nozzle_eval["p_allow_mpa"] >= pressure_required_external_mpa - 1e-9,
        "net_uplift_kN": net_uplift_kN,
    }

    details = {
        "geometry": {
            "diameter_m": d_m,
            "total_length_m": total_length_m,
            "shell_length_m": shell_length_m,
            "head_type": head_type,
            "head_projection_m": head_geo["projection_m"],
            "head_small_diameter_m": head_geo["small_diameter_m"],
            "head_volume_each_m3": full_head_volume_each_m3,
            "external_surface_area_m2": external_surface_area_m2,
            "double_wall_outer_diameter_m": outer_d_m,
            "annular_volume_m3": annular_volume_m3,
        },
        "masses": {
            "shell_mass_kg": shell_mass_kg,
            "head_mass_each_kg": head_mass_each_kg,
            "head_total_mass_kg": total_head_mass_kg,
            "nozzle_mass_kg": nozzle_mass_kg,
            "ladder_mass_kg": ladder_mass_kg,
            "platform_mass_kg": platform_mass_kg,
            "manhole_mass_kg": manhole_mass_kg,
            "supports_mass_kg": support_mass_kg,
            "ring_mass_kg": ring_mass_kg,
            "outer_wall_mass_kg": outer_wall_mass_kg,
            "insulation_mass_kg": insulation_mass_kg,
            "coating_mass_kg": coating_mass_kg,
        },
        "pressures": {
            "internal_design_mpa": internal_pressure_mpa,
            "hydro_support_mpa": hydro_support_mpa,
            "internal_total_mpa": internal_total_mpa,
            "vacuum_mpa": vacuum_mpa,
            "soil_vertical_kpa": pv_kpa,
            "soil_horizontal_kpa": ph_kpa,
            "soil_average_kpa": pavg_kpa,
            "external_required_mpa": pressure_required_external_mpa,
            "head_external_required_mpa": head_required_external_mpa,
        },
        "shell": {
            "nominal_mm": shell_nominal_mm,
            "effective_mm": shell_int_eval["effective_thickness_mm"],
            "allow_internal_mpa": shell_int_eval["p_allow_mpa"],
            "allow_external_mpa": shell_ext_eval["p_allow_mpa"],
            "elastic_external_mpa": shell_ext_eval.get("p_elastic_mpa"),
            "strength_external_mpa": shell_ext_eval.get("p_strength_mpa"),
            "lambda": shell_ext_eval.get("lambda"),
            "spacing_mm": shell_ext_eval.get("spacing_mm"),
            "required_internal_nominal_mm": shell_required_internal_mm,
            "recommended_nominal_mm": recommended_shell["shell_nominal_mm"],
            "ring_count": shell_current_ring_count,
            "recommended_ring_count": recommended_shell["ring_count"],
            "recommended_spacing_mm": recommended_shell["spacing_mm"],
            "minimum_nozzle_spacing_mm": min_distance_between_single_nozzles_mm(d_m * 1000.0, shell_nominal_mm, allowances_shell_mm),
            "fabrication_ring_count": fabrication_ring_count,
            "fabrication_shell_course_mm": fabrication_layout["shell_course_mm"],
            "fabrication_end_clearance_mm": fabrication_layout["end_clearance_mm"],
            "fabrication_ring_positions_mm": fabrication_layout["positions_mm"],
            "fabrication_note": fabrication_layout["note"],
        },
        "head": {
            "nominal_mm": head_nominal_mm,
            "allow_external_mpa": safe_float(head_eval.get("p_allow_mpa"), 0.0),
            "allow_between_mpa": safe_float(head_eval.get("p_allow_between_mpa"), 0.0),
            "allow_whole_mpa": safe_float(head_eval.get("p_allow_whole_mpa"), 0.0),
            "recommended_nominal_mm": recommended_head_mm,
            "rib_count": rib_count,
            "rib_height_mm": rib_height_mm,
            "rib_width_mm": rib_width_mm,
            "rib_thickness_mm": rib_thickness_mm,
            "rib_area_cm2": safe_float(head_eval.get("rib_area_cm2"), 0.0),
            "rib_centroid_to_surface_mm": safe_float(head_eval.get("centroid_to_surface_mm"), 0.0),
            "note": head_note,
        },
        "supports": {
            "support_count": support_count,
            "reaction_each_kN": reaction_each_kN,
            "bearing_area_each_m2": bearing_area_each_m2,
            "foundation_pressure_kpa": support_pressure_kpa,
            "foundation_limit_kpa": foundation_limit,
        },
        "soil": {
            "preset": SOIL_PRESETS.get(soil_preset, SOIL_PRESETS["sand_coarse"])["label"],
            "burial_depth_top_m": burial_depth_top_m,
            "soil_density_kg_m3": soil_density,
            "soil_phi_deg": soil_phi_deg,
            "soil_void_ratio": soil_void_ratio,
            "gamma_f": gamma_f,
            "vertical_kpa": pv_kpa,
            "horizontal_kpa": ph_kpa,
            "average_kpa": pavg_kpa,
            "note": soil_note,
        },
        "nozzles": {
            "count": nozzle_count,
            "diameter_mm": nozzle_dn_mm,
            "length_mm": nozzle_length_mm,
            "thickness_mm": nozzle_thickness_mm,
            "pipe_allow_external_mpa": nozzle_eval["p_allow_mpa"],
            "pipe_elastic_mpa": nozzle_eval["p_elastic_mpa"],
            "pipe_strength_mpa": nozzle_eval["p_strength_mpa"],
        },
        "flotation": {
            "groundwater": groundwater,
            "buoyancy_force_kN": buoyancy_force_kN,
            "dry_load_kN": dry_load_kN,
            "net_uplift_kN": net_uplift_kN,
            "strap_count": strap_count,
            "required_area_each_mm2": strap_area_each_mm2,
            "recommended_thickness_mm": strap_thickness_mm,
            "recommended_width_mm": strap_width_mm,
            "allowable_stress_mpa": strap_allowable_mpa,
        },
    }

    return {
        "summary": summary,
        "details": details,
        "checks": [item.as_dict() for item in checks],
        "warnings": warnings,
        "normative": [
            "ГОСТ 34233.2-2017 — цилиндрические и конические обечайки, плоские днища и крышки",
            "ГОСТ 34233.3-2017 — отверстия и патрубки",
            "ГОСТ 34347-2017 — сосуды и аппараты стальные сварные",
            "ВСП 34-01-03 МО РФ — расчёт подземных резервуаров на давление грунта (предварительная калибровка)",
        ],
    }

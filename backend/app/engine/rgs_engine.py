from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

GRAVITY = 9.80665
STEEL_DENSITY_DEFAULT = 7850.0
WATER_DENSITY = 1000.0
ATMOSPHERIC_HORIZONTAL_LIMIT_MPA = 0.07

RGS_NORMATIVE_BASE = [
    {
        "id": "GOST_17032",
        "title": "ГОСТ 17032 — резервуары стальные горизонтальные для нефтепродуктов",
        "role": "Базовый стандарт изделия РГС: состав, исполнение, технические требования и привязка к проектной документации.",
    },
    {
        "id": "GOST_34233_1",
        "title": "ГОСТ 34233.1 — сосуды и аппараты. Общие требования к расчётам на прочность",
        "role": "Общие расчётные положения, допускаемые напряжения, расчётные температуры и нагрузки.",
    },
    {
        "id": "GOST_34233_2",
        "title": "ГОСТ 34233.2 — цилиндрические и конические обечайки, выпуклые и плоские днища",
        "role": "Расчёт обечаек, конических элементов, плоских днищ и устойчивости от внешнего давления.",
    },
    {
        "id": "GOST_14249",
        "title": "ГОСТ 14249 — сосуды и аппараты. Нормы и методы расчёта на прочность",
        "role": "Переходная расчётная база для сверки с ранее применявшимися методиками.",
    },
    {
        "id": "GOST_R_52857_5",
        "title": "ГОСТ Р 52857.5 — расчёт обечаек и днищ от воздействия опорных нагрузок",
        "role": "Опорные реакции, седловые нагрузки и будущая локальная проверка корпуса в зоне опор.",
    },
    {
        "id": "GOST_34347",
        "title": "ГОСТ 34347 — сосуды и аппараты стальные сварные. Общие технические условия",
        "role": "Конструктивные требования к сварным сосудам и опорам.",
    },
    {
        "id": "SP_20",
        "title": "СП 20.13330 — Нагрузки и воздействия",
        "role": "Коэффициенты надёжности, сочетания нагрузок, снеговые и ветровые воздействия.",
    },
    {
        "id": "SP_14",
        "title": "СП 14.13330 — Строительство в сейсмических районах",
        "role": "Сейсмичность площадки и исходные данные для дальнейших сейсмических проверок.",
    },
    {
        "id": "SP_22",
        "title": "СП 22.13330 — Основания зданий и сооружений",
        "role": "Грунтовые нагрузки, расчётные характеристики грунта, подземная установка и уровень грунтовых вод.",
    },
]

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
DEFAULT_RING_SECTION_CM2 = 10.34
DEFAULT_RING_MASS_FACTOR = 1.0
DEFAULT_SHELL_COURSE_MM = 1490.0
DEFAULT_RING_END_CLEARANCE_MM = 500.0
INSULATION_BAND_WIDTH_MM = 40.0
INSULATION_BAND_THICKNESS_MM = 4.0
INSULATION_STAND_PLATE_MM = 50.0
INSULATION_STAND_PLATE_THICKNESS_MM = 4.0
INSULATION_STAND_PITCH_MAX_MM = 300.0
INSULATION_RING_STEP_MM = 500.0


@dataclass(slots=True)
class CheckItem:
    code: str
    title: str
    result: str
    value: float | None
    limit: float | None
    unit: str = ""
    note: str = ""
    formula: str = ""
    reference: str = ""
    inputs: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        margin = None
        if self.value is not None and self.limit not in (None, 0):
            margin = self.value / self.limit
        return {
            "code": self.code,
            "title": self.title,
            "result": self.result,
            "value": self.value,
            "limit": self.limit,
            "margin": margin,
            "unit": self.unit,
            "note": self.note,
            "formula": self.formula,
            "reference": self.reference,
            "inputs": self.inputs or {},
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


def flat_head_allowable_internal_pressure_mpa(diameter_mm: float, head_nominal_mm: float, allowances_mm: float, sigma_head_mpa: float, rib_count: int) -> dict[str, float]:
    s_eff = effective_thickness_mm(head_nominal_mm, allowances_mm, 0.0)
    if diameter_mm <= 0 or s_eff <= 0:
        return {"effective_thickness_mm": s_eff, "p_allow_mpa": 0.0}
    rib_factor = 1.0 + min(0.35, max(0, rib_count) * 0.015)
    p_allow = 4.0 * sigma_head_mpa * (s_eff / diameter_mm) ** 2 * rib_factor
    return {"effective_thickness_mm": s_eff, "p_allow_mpa": p_allow, "rib_factor": rib_factor}


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


def ring_profile_geometry(profile: str, height_mm: float, width_mm: float, web_mm: float, flange_mm: float, flat_bar_on_edge: bool = True) -> dict[str, Any]:
    profile = (profile or "angle_equal").lower()
    h = max(1.0, height_mm)
    b = max(1.0, width_mm)
    tw = max(0.1, web_mm)
    tf = max(0.1, flange_mm)

    y_max_mm = max(h, b) / 2.0
    orientation = None
    if profile == "flat_bar":
        flat_bar_on_edge = True
        area_mm2 = b * tf
        if flat_bar_on_edge:
            inertia_mm4 = tf * b**3 / 12.0
            y_max_mm = b / 2.0
            orientation = "торцом"
        else:
            inertia_mm4 = b * tf**3 / 12.0
            y_max_mm = tf / 2.0
            orientation = "плашмя"
        label = "Полоса"
    elif profile == "channel":
        web_h = max(0.1, h - 2.0 * tf)
        area_mm2 = 2.0 * b * tf + web_h * tw
        inertia_mm4 = tw * web_h**3 / 12.0 + 2.0 * (b * tf**3 / 12.0 + b * tf * ((h - tf) / 2.0) ** 2)
        y_max_mm = h / 2.0
        label = "Швеллер"
    elif profile == "ibeam":
        web_h = max(0.1, h - 2.0 * tf)
        area_mm2 = 2.0 * b * tf + web_h * tw
        inertia_mm4 = tw * web_h**3 / 12.0 + 2.0 * (b * tf**3 / 12.0 + b * tf * ((h - tf) / 2.0) ** 2)
        y_max_mm = h / 2.0
        label = "Двутавр"
    else:
        leg = max(h, b)
        t = max(tw, tf)
        area_mm2 = 2.0 * leg * t - t * t
        inertia_mm4 = (t * leg**3 + leg * t**3 - t**4) / 12.0
        y_max_mm = leg / 2.0
        profile = "angle_equal"
        label = "Уголок равнополочный"
    section_modulus_cm3 = (inertia_mm4 / max(y_max_mm, 1e-9)) / 1000.0

    return {
        "profile": profile,
        "label": label,
        "height_mm": h,
        "width_mm": b,
        "web_mm": tw,
        "flange_mm": tf,
        "flat_bar_on_edge": flat_bar_on_edge if profile == "flat_bar" else None,
        "orientation": orientation if profile == "flat_bar" else None,
        "area_mm2": area_mm2,
        "area_cm2": area_mm2 / 100.0,
        "inertia_cm4": inertia_mm4 / 10000.0,
        "section_modulus_cm3": section_modulus_cm3,
    }


def ring_required_values(ring_count: int, spacing_mm: float | None, diameter_mm: float, required_external_mpa: float, sigma_mpa: float, e_mpa: float) -> dict[str, float | None]:
    if ring_count <= 0 or not spacing_mm or required_external_mpa <= 0:
        return {
            "tributary_width_mm": spacing_mm,
            "line_load_n_mm": 0.0,
            "ring_radius_mm": diameter_mm / 2.0,
            "hoop_force_n": 0.0,
            "bending_moment_n_mm": 0.0,
            "required_area_cm2": None,
            "required_section_modulus_cm3": None,
            "required_inertia_cm4": None,
        }
    spacing = max(1.0, spacing_mm)
    radius = max(1.0, diameter_mm / 2.0)
    line_load = required_external_mpa * spacing
    hoop_force_n = line_load * radius
    bending_moment_n_mm = line_load * radius**2 / 8.0
    sigma = max(1.0, sigma_mpa)
    required_area_cm2 = hoop_force_n / sigma / 100.0
    required_section_modulus_cm3 = bending_moment_n_mm / sigma / 1000.0
    d_m = max(0.001, diameter_mm / 1000.0)
    spacing_m = spacing / 1000.0
    p_kpa = required_external_mpa * 1000.0
    e_kpa = max(1.0, e_mpa * 1000.0)
    inertia_m4 = p_kpa * d_m**3 * spacing_m / (24.0 * e_kpa)
    return {
        "tributary_width_mm": spacing,
        "line_load_n_mm": line_load,
        "ring_radius_mm": radius,
        "hoop_force_n": hoop_force_n,
        "bending_moment_n_mm": bending_moment_n_mm,
        "required_area_cm2": required_area_cm2,
        "required_section_modulus_cm3": required_section_modulus_cm3,
        "required_inertia_cm4": inertia_m4 * 1e8,
    }


def stiffener_single_mass_kg(profile_data: dict[str, Any], diameter_mm: float, shell_nominal_mm: float, steel_density: float, stiffener_type: str, brace_count: int) -> dict[str, float]:
    area_m2 = max(0.0, safe_float(profile_data.get("area_cm2"), 0.0)) / 10000.0
    shell_od_m = max(0.001, (diameter_mm + 2.0 * shell_nominal_mm) / 1000.0)
    ring_mass = area_m2 * math.pi * shell_od_m * steel_density * DEFAULT_RING_MASS_FACTOR
    diaphragm_brace_mass = 0.0
    if stiffener_type == "diaphragm":
        brace_length_m = max(0.001, diameter_mm / 1000.0)
        diaphragm_brace_mass = max(0, brace_count) * area_m2 * brace_length_m * steel_density * DEFAULT_RING_MASS_FACTOR
    return {
        "ring_part_mass_kg": ring_mass,
        "diaphragm_brace_mass_kg": diaphragm_brace_mass,
        "single_stiffener_mass_kg": ring_mass + diaphragm_brace_mass,
    }


def ring_effective_section(
    profile_data: dict[str, Any],
    stiffener_type: str,
    brace_count: int,
    spacing_mm: float | None,
    diameter_mm: float,
    shell_effective_mm: float,
) -> dict[str, Any]:
    base_area_mm2 = max(0.0, safe_float(profile_data.get("area_mm2"), 0.0))
    base_inertia_cm4 = max(0.0, safe_float(profile_data.get("inertia_cm4"), 0.0))
    base_section_modulus_cm3 = max(0.0, safe_float(profile_data.get("section_modulus_cm3"), 0.0))
    result = {
        **profile_data,
        "stiffener_type": "diaphragm" if stiffener_type == "diaphragm" else "ring",
        "stiffener_type_label": "Диафрагма" if stiffener_type == "diaphragm" else "Кольцо жесткости",
        "base_area_cm2": base_area_mm2 / 100.0,
        "base_inertia_cm4": base_inertia_cm4,
        "base_section_modulus_cm3": base_section_modulus_cm3,
        "diaphragm_brace_count": 0,
        "diaphragm_brace_length_mm": 0.0,
        "diaphragm_brace_area_cm2": 0.0,
        "diaphragm_equivalent_depth_mm": 0.0,
        "diaphragm_equivalent_inertia_cm4": 0.0,
        "shell_effective_width_mm": 0.0,
        "shell_effective_area_cm2": 0.0,
        "shell_effective_inertia_cm4": 0.0,
        "shell_effective_thickness_mm": max(0.0, shell_effective_mm),
        "composite_note": "",
    }
    if stiffener_type != "diaphragm":
        return result

    count = max(3, min(12, safe_int(brace_count, 3)))
    spacing = max(0.0, safe_float(spacing_mm, 0.0))
    shell_t = max(0.0, shell_effective_mm)
    shell_width = 0.0
    shell_area_mm2 = 0.0
    shell_inertia_cm4 = 0.0
    if shell_t > 0:
        shell_width = min(spacing if spacing > 0 else diameter_mm, 1.56 * math.sqrt(max(1.0, diameter_mm * shell_t)))
        shell_area_mm2 = shell_width * shell_t
        shell_inertia_cm4 = (shell_width * shell_t**3 / 12.0) / 10000.0

    effective_depth_mm = max(safe_float(profile_data.get("height_mm"), 0.0), 0.28 * max(1.0, diameter_mm))
    y_mm = max(1.0, effective_depth_mm / 2.0)
    brace_area_mm2 = count * base_area_mm2
    brace_equivalent_inertia_cm4 = (brace_area_mm2 * y_mm**2 * 0.35) / 10000.0
    total_area_mm2 = base_area_mm2 + brace_area_mm2 + shell_area_mm2
    total_inertia_cm4 = base_inertia_cm4 + brace_equivalent_inertia_cm4 + shell_inertia_cm4
    total_section_modulus_cm3 = (total_inertia_cm4 * 10000.0 / y_mm) / 1000.0

    result.update({
        "area_mm2": total_area_mm2,
        "area_cm2": total_area_mm2 / 100.0,
        "inertia_cm4": total_inertia_cm4,
        "section_modulus_cm3": max(base_section_modulus_cm3, total_section_modulus_cm3),
        "diaphragm_brace_count": count,
        "diaphragm_brace_length_mm": diameter_mm,
        "diaphragm_brace_area_cm2": brace_area_mm2 / 100.0,
        "diaphragm_equivalent_depth_mm": effective_depth_mm,
        "diaphragm_equivalent_inertia_cm4": brace_equivalent_inertia_cm4,
        "shell_effective_width_mm": shell_width,
        "shell_effective_area_cm2": shell_area_mm2 / 100.0,
        "shell_effective_inertia_cm4": shell_inertia_cm4,
        "composite_note": "Диафрагма учтена как кольцевой профиль, 3 раскоса тем же профилем и эффективная полоса обечайки.",
    })
    return result


def calculation_cases(tank_type: str, is_underground: bool, is_double_wall: bool, groundwater: bool, vacuum_mpa: float) -> list[dict[str, Any]]:
    cases = [
        {"id": "installation", "title": "Тип установки", "active": True, "basis": "ГОСТ 17032", "note": "Наземное или подземное исполнение РГС."},
        {"id": "working_fill", "title": "Рабочее заполнение", "active": True, "basis": "ГОСТ 34233.1/2", "note": "Масса продукта, гидростатическая составляющая и рабочее давление."},
        {"id": "hydrotest", "title": "Гидроиспытание", "active": True, "basis": "ГОСТ 34233.1", "note": "Полное заполнение водой для массы и опорных реакций."},
        {"id": "vacuum", "title": "Вакуум / внешнее давление", "active": vacuum_mpa > 0 or is_underground, "basis": "ГОСТ 34233.2", "note": "Устойчивость обечайки и днищ при внешнем давлении."},
        {"id": "soil", "title": "Грунт", "active": is_underground, "basis": "СП 20, СП 22", "note": "Вертикальное и боковое давление засыпки для подземного исполнения."},
        {"id": "flotation", "title": "Всплытие", "active": is_underground and groundwater, "basis": "СП 20, СП 22", "note": "Подъёмная сила воды и необходимость удерживающих хомутов."},
        {"id": "straps", "title": "Хомуты", "active": is_underground and groundwater, "basis": "СП 20, проектная серия", "note": "Подбор сечения удерживающих хомутов по усилию всплытия."},
        {"id": "double_wall", "title": "Двустенное исполнение", "active": is_double_wall, "basis": "ГОСТ 17032, ГОСТ 34233.2", "note": "Наружная оболочка, межстенный объём и масса."},
    ]
    for item in cases:
        if item["id"] == "installation":
            item["note"] = f"{tank_type.upper()}: {'подземное' if is_underground else 'наземное'} исполнение."
    return cases


def ring_section_check(profile_data: dict[str, Any], ring_count: int, spacing_mm: float | None, diameter_mm: float, required_external_mpa: float, shell_allow_external_mpa: float, sigma_mpa: float, e_mpa: float, stiffener_type: str = "ring", brace_count: int = 3, shell_effective_mm: float = 0.0) -> dict[str, Any]:
    effective_profile = ring_effective_section(profile_data, stiffener_type, brace_count, spacing_mm, diameter_mm, shell_effective_mm)
    area_cm2 = safe_float(effective_profile.get("area_cm2"), 0.0)
    inertia_cm4 = safe_float(effective_profile.get("inertia_cm4"), 0.0)
    section_modulus_cm3 = safe_float(effective_profile.get("section_modulus_cm3"), 0.0)
    required = ring_required_values(ring_count, spacing_mm, diameter_mm, required_external_mpa, sigma_mpa, e_mpa)
    required_area_cm2 = required.get("required_area_cm2")
    required_section_modulus_cm3 = required.get("required_section_modulus_cm3")
    required_inertia_cm4 = required.get("required_inertia_cm4")
    stability_ok = shell_allow_external_mpa + 1e-9 >= required_external_mpa
    area_ok = required_area_cm2 is None or area_cm2 + 1e-9 >= safe_float(required_area_cm2, 0.0)
    section_modulus_ok = required_section_modulus_cm3 is None or section_modulus_cm3 + 1e-9 >= safe_float(required_section_modulus_cm3, 0.0)
    inertia_ok = required_inertia_cm4 is None or inertia_cm4 + 1e-9 >= required_inertia_cm4
    section_status = "NOT_REQUIRED" if ring_count <= 0 else ("PASS" if stability_ok and area_ok and section_modulus_ok and inertia_ok else "FAIL")
    return {
        **effective_profile,
        **required,
        "area_cm2": area_cm2,
        "area_mm2": area_cm2 * 100.0,
        "inertia_cm4": inertia_cm4,
        "section_modulus_cm3": section_modulus_cm3,
        "required_area_cm2": required_area_cm2,
        "required_section_modulus_cm3": required_section_modulus_cm3,
        "required_inertia_cm4": required_inertia_cm4,
        "spacing_mm": spacing_mm,
        "stability_ok": stability_ok,
        "area_ok": area_ok,
        "section_modulus_ok": section_modulus_ok,
        "inertia_ok": inertia_ok,
        "area_margin": area_cm2 / safe_float(required_area_cm2, area_cm2) if required_area_cm2 else None,
        "section_modulus_margin": section_modulus_cm3 / safe_float(required_section_modulus_cm3, section_modulus_cm3) if required_section_modulus_cm3 else None,
        "inertia_margin": inertia_cm4 / safe_float(required_inertia_cm4, inertia_cm4) if required_inertia_cm4 else None,
        "section_check_status": section_status,
        "note": (
            f"Профиль {profile_data.get('label', 'кольца')}: проверены площадь, момент сопротивления, момент инерции и устойчивость обечайки между кольцами."
            if ring_count > 0
            else "Кольца/диафрагмы расчётом не требуются или не заданы."
        ),
    }


def insulation_support_layout(
    shell_length_m: float,
    diameter_m: float,
    insulation_thickness_mm: float,
    steel_density: float,
) -> dict[str, Any]:
    if shell_length_m <= 0 or diameter_m <= 0 or insulation_thickness_mm <= 0:
        return {
            "enabled": False,
            "shell_ring_count": 0,
            "shell_ring_positions_mm": [],
            "stands_per_ring": 0,
            "stand_count": 0,
            "head_ray_count_each": 0,
            "head_ray_count_total": 0,
            "steel_mass_kg": 0.0,
            "note": "Крепление теплоизоляции не требуется или толщина ТИ не задана.",
        }

    shell_length_mm = shell_length_m * 1000.0
    outer_diameter_mm = diameter_m * 1000.0 + 2.0 * insulation_thickness_mm
    circumference_mm = math.pi * outer_diameter_mm
    stands_per_ring = max(3, math.ceil(circumference_mm / INSULATION_STAND_PITCH_MAX_MM))

    positions_mm = [0.0]
    position_mm = INSULATION_RING_STEP_MM
    while position_mm < shell_length_mm:
        positions_mm.append(position_mm)
        position_mm += INSULATION_RING_STEP_MM
    if not positions_mm or abs(positions_mm[-1] - shell_length_mm) > 1e-6:
        positions_mm.append(shell_length_mm)

    shell_ring_count = len(positions_mm)
    stand_count = shell_ring_count * stands_per_ring
    head_ray_count_each = 8 if diameter_m * 1000.0 >= 2400.0 else 6
    head_ray_count_total = head_ray_count_each * 2
    stands_per_ray = max(1, math.ceil((diameter_m * 1000.0 / 2.0) / INSULATION_STAND_PITCH_MAX_MM))
    head_ray_stand_count = head_ray_count_total * stands_per_ray

    band_area_m2 = (INSULATION_BAND_WIDTH_MM / 1000.0) * (INSULATION_BAND_THICKNESS_MM / 1000.0)
    ring_mass_kg = shell_ring_count * (circumference_mm / 1000.0) * band_area_m2 * steel_density
    stand_mass_kg = stand_count * (insulation_thickness_mm / 1000.0) * band_area_m2 * steel_density
    plate_volume_m3 = (INSULATION_STAND_PLATE_MM / 1000.0) ** 2 * (INSULATION_STAND_PLATE_THICKNESS_MM / 1000.0)
    plate_mass_kg = (stand_count + head_ray_stand_count) * plate_volume_m3 * steel_density
    head_ray_stand_mass_kg = head_ray_stand_count * (insulation_thickness_mm / 1000.0) * band_area_m2 * steel_density
    head_ray_mass_kg = head_ray_count_total * (diameter_m / 2.0) * band_area_m2 * steel_density

    return {
        "enabled": True,
        "outer_diameter_mm": outer_diameter_mm,
        "shell_ring_step_mm": INSULATION_RING_STEP_MM,
        "shell_ring_count": shell_ring_count,
        "shell_ring_positions_mm": positions_mm,
        "stands_per_ring": stands_per_ring,
        "stand_pitch_mm": circumference_mm / stands_per_ring,
        "stand_count": stand_count,
        "stand_plate_mm": INSULATION_STAND_PLATE_MM,
        "stand_band_mm": f"{int(INSULATION_BAND_WIDTH_MM)}x{int(INSULATION_BAND_THICKNESS_MM)}",
        "head_ray_count_each": head_ray_count_each,
        "head_ray_count_total": head_ray_count_total,
        "stands_per_head_ray": stands_per_ray,
        "head_ray_stand_count": head_ray_stand_count,
        "ring_mass_kg": ring_mass_kg,
        "stand_mass_kg": stand_mass_kg + plate_mass_kg + head_ray_stand_mass_kg,
        "head_ray_mass_kg": head_ray_mass_kg,
        "steel_mass_kg": ring_mass_kg + stand_mass_kg + plate_mass_kg + head_ray_stand_mass_kg + head_ray_mass_kg,
        "note": "Кольца из полосы 40x4 по наружному диаметру ТИ, Т-образные проставки с шагом по окружности и по лучам не более 300 мм.",
    }


def saddle_support_unit(
    diameter_m: float,
    saddle_width_m: float,
    shell_nominal_mm: float,
    steel_density: float,
    min_height_m: float = 0.0,
    requested_height_m: float = 0.2,
) -> dict[str, float]:
    saddle_width_m = max(0.1, saddle_width_m)
    diameter_m = max(0.2, diameter_m)
    shell_nominal_mm = max(3.0, shell_nominal_mm)
    contact_angle_deg = 120.0
    base_length_m = max(0.75, 0.55 * diameter_m)
    saddle_height_m = max(0.0, min_height_m, requested_height_m)
    base_plate_t_m = max(8.0, shell_nominal_mm + 2.0) / 1000.0
    web_t_m = max(8.0, shell_nominal_mm) / 1000.0
    pad_t_m = max(6.0, shell_nominal_mm) / 1000.0
    arc_length_m = math.pi * diameter_m * contact_angle_deg / 360.0

    base_plate_volume_m3 = base_length_m * saddle_width_m * base_plate_t_m
    web_volume_m3 = 2.0 * saddle_width_m * saddle_height_m * web_t_m
    rib_volume_m3 = 3.0 * base_length_m * saddle_height_m * web_t_m / 2.0
    pad_volume_m3 = arc_length_m * saddle_width_m * pad_t_m
    gusset_volume_m3 = 4.0 * 0.5 * saddle_height_m * min(0.25, saddle_width_m / 2.0) * web_t_m
    total_volume_m3 = base_plate_volume_m3 + web_volume_m3 + rib_volume_m3 + pad_volume_m3 + gusset_volume_m3

    return {
        "requested_height_m": requested_height_m,
        "minimum_height_m": min_height_m,
        "contact_angle_deg": contact_angle_deg,
        "base_length_m": base_length_m,
        "saddle_height_m": saddle_height_m,
        "base_plate_t_mm": base_plate_t_m * 1000.0,
        "web_t_mm": web_t_m * 1000.0,
        "pad_t_mm": pad_t_m * 1000.0,
        "base_plate_mass_kg": base_plate_volume_m3 * steel_density,
        "web_mass_kg": web_volume_m3 * steel_density,
        "rib_mass_kg": rib_volume_m3 * steel_density,
        "pad_mass_kg": pad_volume_m3 * steel_density,
        "gusset_mass_kg": gusset_volume_m3 * steel_density,
        "weight_each_kg": total_volume_m3 * steel_density,
    }


def saddle_support_solution(
    diameter_m: float,
    shell_length_m: float,
    saddle_width_m: float,
    shell_nominal_mm: float,
    steel_density: float,
    foundation_limit_kpa: float,
    operating_mass_without_support_kg: float,
    hydrotest_mass_without_support_kg: float,
    user_support_count: int,
    user_support_weight_each_kg: float,
    min_height_m: float,
    requested_height_m: float,
) -> dict[str, Any]:
    unit = saddle_support_unit(diameter_m, saddle_width_m, shell_nominal_mm, steel_density, min_height_m, requested_height_m)
    calculated_weight_each_kg = safe_float(unit["weight_each_kg"], 0.0)
    actual_weight_each_kg = user_support_weight_each_kg if user_support_weight_each_kg > 0 else calculated_weight_each_kg
    bearing_area_each_m2 = max(0.1, saddle_width_m * max(diameter_m, 0.8))
    span_count = max(2, math.ceil(max(shell_length_m, 0.1) / 6.0) + 1)
    foundation_limit_kpa = max(1.0, foundation_limit_kpa)

    recommended_count = span_count
    for candidate in range(span_count, 21):
        operating_load_kN = (operating_mass_without_support_kg + candidate * actual_weight_each_kg) * GRAVITY / 1000.0
        hydrotest_load_kN = (hydrotest_mass_without_support_kg + candidate * actual_weight_each_kg) * GRAVITY / 1000.0
        pressure_kpa = max(operating_load_kN, hydrotest_load_kN) / candidate / bearing_area_each_m2
        if pressure_kpa <= foundation_limit_kpa + 1e-9:
            recommended_count = candidate
            break
    else:
        recommended_count = 20

    actual_count = user_support_count if user_support_count > 0 else recommended_count
    total_mass_kg = actual_count * actual_weight_each_kg
    operating_load_kN = (operating_mass_without_support_kg + total_mass_kg) * GRAVITY / 1000.0
    hydrotest_load_kN = (hydrotest_mass_without_support_kg + total_mass_kg) * GRAVITY / 1000.0
    governing_load_kN = max(operating_load_kN, hydrotest_load_kN)
    reaction_each_kN = governing_load_kN / max(1, actual_count)
    support_pressure_kpa = reaction_each_kN / bearing_area_each_m2

    return {
        **unit,
        "recommended_support_count": recommended_count,
        "user_support_count": user_support_count,
        "support_count": actual_count,
        "calculated_weight_each_kg": calculated_weight_each_kg,
        "user_weight_each_kg": user_support_weight_each_kg,
        "actual_weight_each_kg": actual_weight_each_kg,
        "total_mass_kg": total_mass_kg,
        "bearing_area_each_m2": bearing_area_each_m2,
        "operating_load_kN": operating_load_kN,
        "hydrotest_load_kN": hydrotest_load_kN,
        "governing_load_kN": governing_load_kN,
        "reaction_each_kN": reaction_each_kN,
        "foundation_pressure_kpa": support_pressure_kpa,
        "foundation_limit_kpa": foundation_limit_kpa,
        "basis": "Расчётное седло: опорная плита, две стенки, ребра, накладной лист по дуге 120° и косынки.",
    }


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


def conical_head_allowable_mpa(
    large_diameter_mm: float,
    small_diameter_mm: float,
    projection_m: float,
    nominal_mm: float,
    allowances_mm: float,
    sigma_head_mpa: float,
    e_mpa: float,
    pressure_mode: str,
) -> dict[str, float]:
    small_diameter_mm = clamp(small_diameter_mm, 0.0, large_diameter_mm)
    delta_radius_mm = max(0.0, (large_diameter_mm - small_diameter_mm) / 2.0)
    slant_mm = max(50.0, math.hypot(delta_radius_mm, projection_m * 1000.0))
    sin_alpha = clamp(projection_m * 1000.0 / slant_mm, 0.05, 1.0)
    equivalent_diameter_mm = max(100.0, (large_diameter_mm + small_diameter_mm) / 2.0)
    cone_factor = 1.0 / sin_alpha
    if pressure_mode == "external":
        evaluation = shell_external_allowable_mpa(equivalent_diameter_mm, nominal_mm, allowances_mm, sigma_head_mpa, e_mpa, slant_mm)
        evaluation["p_allow_mpa"] = evaluation["p_allow_mpa"] / cone_factor
        evaluation["cone_half_angle_sin"] = sin_alpha
        evaluation["cone_factor"] = cone_factor
        evaluation["equivalent_diameter_mm"] = equivalent_diameter_mm
        evaluation["slant_mm"] = slant_mm
        return evaluation
    evaluation = shell_internal_allowable_mpa(equivalent_diameter_mm, nominal_mm, allowances_mm, sigma_head_mpa)
    evaluation["p_allow_mpa"] = evaluation["p_allow_mpa"] / cone_factor
    evaluation["cone_half_angle_sin"] = sin_alpha
    evaluation["cone_factor"] = cone_factor
    evaluation["equivalent_diameter_mm"] = equivalent_diameter_mm
    evaluation["slant_mm"] = slant_mm
    return evaluation


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
    head_type = str(payload.get("head_type") or "truncated_cone")
    head_projection_m = max(0.0, safe_float(payload.get("head_projection_m"), 0.0 if head_type == "flat" else 0.3))
    head_small_diameter_m = max(0.0, safe_float(payload.get("head_small_diameter_m"), 0.0))

    shell_nominal_mm = max(3.0, safe_float(payload.get("shell_nominal_mm"), safe_float(payload.get("t_shell_mm"), 8.0)))
    head_nominal_mm = max(3.0, safe_float(payload.get("head_nominal_mm"), shell_nominal_mm))
    corr_mm = max(0.0, safe_float(payload.get("corr_mm"), 0.0))
    minus_tol_mm = max(0.0, safe_float(payload.get("minus_tolerance_mm"), 0.8))
    allowances_shell_mm = corr_mm + minus_tol_mm
    head_corr_mm = max(0.0, safe_float(payload.get("head_allowances_mm"), 0.0))
    allowances_head_mm = head_corr_mm + minus_tol_mm

    user_support_count = max(0, safe_int(payload.get("support_count"), 0))
    user_support_weight_each_kg = max(0.0, safe_float(payload.get("support_weight_each_kg"), 0.0))
    requested_support_height_m = max(0.0, safe_float(payload.get("support_height_m"), 0.2))
    saddle_width_m = max(0.1, safe_float(payload.get("saddle_width_m"), safe_float(payload.get("saddle_w"), 0.4)))

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
    ring_stiffener_type = "diaphragm" if str(payload.get("ring_stiffener_type") or "ring").lower() == "diaphragm" else "ring"
    diaphragm_brace_count = max(3, min(12, safe_int(payload.get("diaphragm_brace_count"), 3)))
    ring_profile_data = ring_profile_geometry(
        str(payload.get("ring_profile") or "angle_equal"),
        max(0.0, safe_float(payload.get("ring_profile_height_mm"), 75.0)),
        max(0.0, safe_float(payload.get("ring_profile_width_mm"), 75.0)),
        max(0.0, safe_float(payload.get("ring_profile_web_mm"), 6.0)),
        max(0.0, safe_float(payload.get("ring_profile_flange_mm"), 6.0)),
        bool(payload.get("ring_flat_bar_on_edge", True)),
    )
    ring_section_cm2 = safe_float(ring_profile_data.get("area_cm2"), ring_section_cm2)

    rib_count = max(1, safe_int(payload.get("rib_count"), 8))
    rib_height_mm = max(1.0, safe_float(payload.get("rib_height_mm"), 50.0))
    rib_width_mm = max(1.0, safe_float(payload.get("rib_width_mm"), 50.0))
    rib_thickness_mm = max(1.0, safe_float(payload.get("rib_thickness_mm"), 7.0))

    nozzle_items: list[dict[str, Any]] = []
    for raw_item in payload.get("nozzles") or []:
        if not isinstance(raw_item, dict):
            continue
        item_count = max(0, safe_int(raw_item.get("count"), 0))
        item_dn_mm = max(0.0, safe_float(raw_item.get("dn_mm"), 0.0))
        item_length_mm = max(0.0, safe_float(raw_item.get("length_mm"), 0.0))
        item_thickness_mm = max(0.0, safe_float(raw_item.get("thickness_mm"), shell_nominal_mm))
        if item_count <= 0 or item_dn_mm <= 0 or item_length_mm <= 0 or item_thickness_mm <= 0:
            continue
        nozzle_items.append({
            "name": str(raw_item.get("name") or f"Патрубок {len(nozzle_items) + 1}"),
            "count": item_count,
            "dn_mm": item_dn_mm,
            "length_mm": item_length_mm,
            "thickness_mm": item_thickness_mm,
        })
    if not nozzle_items:
        fallback_count = max(0, safe_int(payload.get("nozzle_count"), 0))
        fallback_dn_mm = max(0.0, safe_float(payload.get("nozzle_dn_mm"), 0.0))
        fallback_length_mm = max(0.0, safe_float(payload.get("nozzle_length_mm"), 0.0))
        fallback_thickness_mm = max(0.0, safe_float(payload.get("nozzle_thickness_mm"), shell_nominal_mm))
        if fallback_count > 0 and fallback_dn_mm > 0 and fallback_length_mm > 0 and fallback_thickness_mm > 0:
            nozzle_items.append({
                "name": "Патрубки",
                "count": fallback_count,
                "dn_mm": fallback_dn_mm,
                "length_mm": fallback_length_mm,
                "thickness_mm": fallback_thickness_mm,
            })
    nozzle_count = sum(safe_int(item["count"], 0) for item in nozzle_items)
    nozzle_dn_mm = safe_float(nozzle_items[0]["dn_mm"], 0.0) if nozzle_items else 0.0
    nozzle_length_mm = safe_float(nozzle_items[0]["length_mm"], 0.0) if nozzle_items else 0.0
    nozzle_thickness_mm = safe_float(nozzle_items[0]["thickness_mm"], 0.0) if nozzle_items else 0.0

    insulation_enabled = bool(payload.get("insulation_enabled", False))
    insulation_thickness_mm = max(0.0, safe_float(payload.get("insulation_thickness_mm"), 0.0))
    insulation_density = max(0.0, safe_float(payload.get("insulation_density_kg_m3"), 120.0))
    coating_thickness_mm = max(0.0, safe_float(payload.get("coating_thickness_mm"), 0.0))
    coating_density = max(0.0, safe_float(payload.get("coating_density_kg_m3"), 1200.0))

    ladder = bool(payload.get("ladder", False))
    platform = bool(payload.get("platform", False)) and not is_underground
    if is_underground:
        coating_thickness_mm = 0.0
        coating_density = 0.0
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
    groundwater_level_m = max(0.0, safe_float(payload.get("groundwater_level_m"), 0.0))
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
    nozzle_details: list[dict[str, Any]] = []
    for item in nozzle_items:
        item_count = safe_int(item["count"], 0)
        item_dn_mm = safe_float(item["dn_mm"], 0.0)
        item_length_mm = safe_float(item["length_mm"], 0.0)
        item_thickness_mm = safe_float(item["thickness_mm"], 0.0)
        nozzle_cylinder_area_m2 = math.pi * (item_dn_mm / 1000.0) * (item_length_mm / 1000.0)
        item_mass_kg = item_count * nozzle_cylinder_area_m2 * (item_thickness_mm / 1000.0) * steel_density
        nozzle_mass_kg += item_mass_kg
        nozzle_details.append({
            **item,
            "mass_kg": item_mass_kg,
        })

    manhole_mass_kg = manhole_count * 85.0
    ladder_mass_kg = 120.0 if ladder else 0.0
    platform_mass_kg = 180.0 if platform else 0.0

    current_ring_count = max(0, manual_ring_count if ring_mode == "manual" else fabrication_ring_count)
    ring_mass_kg = 0.0
    stiffener_mass = stiffener_single_mass_kg(ring_profile_data, d_m * 1000.0, shell_nominal_mm, steel_density, ring_stiffener_type, diaphragm_brace_count)
    if current_ring_count > 0:
        ring_mass_kg = current_ring_count * safe_float(stiffener_mass.get("single_stiffener_mass_kg"), 0.0)

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
    if is_underground and insulation_enabled and insulation_thickness_mm > 0:
        insulation_supports = {
            "enabled": False,
            "system": "ppu",
            "outer_diameter_mm": shell_outer_d_m * 1000.0 + 2.0 * insulation_thickness_mm,
            "shell_ring_count": 0,
            "shell_ring_positions_mm": [],
            "stands_per_ring": 0,
            "stand_count": 0,
            "head_ray_count_each": 0,
            "head_ray_count_total": 0,
            "head_ray_stand_count": 0,
            "steel_mass_kg": 0.0,
            "note": "Для подземного исполнения принята ППУ изоляция без металлических колец, проставок и покрытия.",
        }
    else:
        insulation_supports = insulation_support_layout(shell_length_m, shell_outer_d_m, insulation_thickness_mm, steel_density) if insulation_enabled else insulation_support_layout(shell_length_m, shell_outer_d_m, 0.0, steel_density)
    coating_mass_kg = external_surface_area_m2 * (coating_thickness_mm / 1000.0) * coating_density if coating_thickness_mm > 0 else 0.0

    steel_mass_without_support_kg = shell_mass_kg + total_head_mass_kg + nozzle_mass_kg + manhole_mass_kg + ladder_mass_kg + platform_mass_kg + ring_mass_kg + outer_wall_mass_kg + safe_float(insulation_supports.get("steel_mass_kg"), 0.0)
    dry_mass_without_support_kg = steel_mass_without_support_kg + insulation_mass_kg + coating_mass_kg
    support_solution = saddle_support_solution(
        d_m,
        shell_length_m,
        saddle_width_m,
        shell_nominal_mm,
        steel_density,
        safe_float(payload.get("R0_kPa"), safe_float(payload.get("R0"), 200.0)),
        dry_mass_without_support_kg + product_mass_kg,
        dry_mass_without_support_kg + hydrotest_mass_kg,
        user_support_count,
        user_support_weight_each_kg,
        0.0 if is_underground else ((insulation_thickness_mm + 50.0) / 1000.0 if insulation_enabled else 0.0),
        requested_support_height_m,
    )
    support_count = safe_int(support_solution["support_count"], 2)
    recommended_support_count = safe_int(support_solution["recommended_support_count"], support_count)
    calculated_support_weight_each_kg = safe_float(support_solution["calculated_weight_each_kg"], 0.0)
    support_weight_each_kg = safe_float(support_solution["actual_weight_each_kg"], calculated_support_weight_each_kg)
    support_mass_kg = safe_float(support_solution["total_mass_kg"], 0.0)

    steel_mass_kg = shell_mass_kg + total_head_mass_kg + nozzle_mass_kg + manhole_mass_kg + ladder_mass_kg + platform_mass_kg + support_mass_kg + ring_mass_kg + outer_wall_mass_kg + safe_float(insulation_supports.get("steel_mass_kg"), 0.0)
    dry_mass_kg = steel_mass_kg + insulation_mass_kg + coating_mass_kg
    operating_mass_kg = dry_mass_kg + product_mass_kg
    hydrotest_total_mass_kg = dry_mass_kg + hydrotest_mass_kg

    operating_load_kN = operating_mass_kg * GRAVITY / 1000.0
    dry_load_kN = dry_mass_kg * GRAVITY / 1000.0
    hydrotest_load_kN = hydrotest_total_mass_kg * GRAVITY / 1000.0

    hydro_support_head_m = fill_height_m + extra_liquid_head_m
    hydro_support_mpa = rho * GRAVITY * hydro_support_head_m / 1_000_000.0
    internal_total_mpa = internal_pressure_mpa + hydro_support_mpa

    pv_kpa = 0.0
    ph_kpa = 0.0
    pavg_kpa = 0.0
    soil_note = ""
    gamma_soil_kN_m3 = 0.0
    ka = 0.0
    if is_underground and burial_depth_top_m > 0:
        gamma_soil_kN_m3 = soil_density / 1000.0 * GRAVITY
        pv_kpa = gamma_f * gamma_soil_kN_m3 * burial_depth_top_m
        ka = math.tan(math.radians(45.0 - soil_phi_deg / 2.0)) ** 2
        ph_kpa = pv_kpa * ka * (1.0 + soil_void_ratio / 3.0)
        pavg_kpa = 0.75 * pv_kpa + 0.5 * ph_kpa
        soil_note = (
            "Давление грунта рассчитано по прозрачной схеме: вертикальное давление от засыпки, "
            "коэффициент бокового давления Ka по углу внутреннего трения и внутренний коэффициент надёжности по нагрузке."
        )

    groundwater_external_kpa = 0.0
    if is_underground and groundwater:
        water_gamma_kN_m3_for_pressure = groundwater_density / 1000.0 * GRAVITY
        groundwater_head_at_axis_m = max(0.0, burial_depth_top_m + d_m / 2.0 - groundwater_level_m)
        groundwater_external_kpa = water_gamma_kN_m3_for_pressure * groundwater_head_at_axis_m
    if is_underground:
        empty_shell_external_mpa = (pavg_kpa + groundwater_external_kpa) / 1000.0 + vacuum_mpa
        empty_head_external_mpa = (0.75 * pv_kpa + 0.5 * ph_kpa + groundwater_external_kpa) / 1000.0 + vacuum_mpa
        operating_shell_external_mpa = max(0.0, empty_shell_external_mpa - hydro_support_mpa - internal_pressure_mpa)
        operating_head_external_mpa = max(0.0, empty_head_external_mpa - hydro_support_mpa - internal_pressure_mpa)
        pressure_required_external_mpa = max(empty_shell_external_mpa, operating_shell_external_mpa)
        head_required_external_mpa = max(empty_head_external_mpa, operating_head_external_mpa)
    else:
        pressure_required_external_mpa = max(0.0, vacuum_mpa)
        head_required_external_mpa = max(0.0, vacuum_mpa)
    constructive_min_mm = 5 if is_underground else 4

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
        max(math.ceil(allowances_shell_mm), math.ceil(shell_nominal_mm if payload.get("use_current_as_min") else constructive_min_mm)),
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

    ring_eval = ring_section_check(
        ring_profile_data,
        shell_current_ring_count,
        shell_ext_eval.get("spacing_mm"),
        d_m * 1000.0,
        pressure_required_external_mpa,
        shell_ext_eval["p_allow_mpa"],
        sigma_work,
        e_mpa,
        ring_stiffener_type,
        diaphragm_brace_count,
        shell_int_eval["effective_thickness_mm"],
    )
    ring_eval.update(stiffener_mass)

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
            max(math.ceil(allowances_head_mm), constructive_min_mm),
        )
    else:
        head_eval = conical_head_allowable_mpa(
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
        for candidate in range(max(constructive_min_mm, math.ceil(allowances_head_mm)), 101):
            test_eval = conical_head_allowable_mpa(
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
        head_note = "Коническое/усечённо-коническое днище рассчитано отдельной конической схемой по образующей, среднему диаметру и углу конуса."

    if head_type == "flat":
        head_internal_eval = flat_head_allowable_internal_pressure_mpa(
            d_m * 1000.0,
            head_nominal_mm,
            allowances_head_mm,
            sigma_work,
            rib_count,
        )
    else:
        head_internal_eval = conical_head_allowable_mpa(
            d_m * 1000.0,
            head_small_diameter_m * 1000.0,
            head_geo["projection_m"],
            head_nominal_mm,
            allowances_head_mm,
            sigma_work,
            e_mpa,
            "internal",
        )
    recommended_head_int_mm = None
    for candidate in range(max(constructive_min_mm, math.ceil(allowances_head_mm)), 101):
        if head_type == "flat":
            test_eval = flat_head_allowable_internal_pressure_mpa(d_m * 1000.0, candidate, allowances_head_mm, sigma_work, rib_count)
        else:
            test_eval = conical_head_allowable_mpa(d_m * 1000.0, head_small_diameter_m * 1000.0, head_geo["projection_m"], candidate, allowances_head_mm, sigma_work, e_mpa, "internal")
        if test_eval["p_allow_mpa"] + 1e-9 >= internal_total_mpa:
            recommended_head_int_mm = candidate
            break
    if recommended_head_int_mm is not None:
        recommended_head_mm = max(recommended_head_mm or 0, recommended_head_int_mm)

    nozzle_eval = {"p_allow_mpa": 0.0, "p_elastic_mpa": 0.0, "p_strength_mpa": 0.0, "name": ""}
    for item in nozzle_details:
        item_eval = nozzle_pipe_allowable_external_mpa(
            safe_float(item["dn_mm"]),
            safe_float(item["thickness_mm"]),
            safe_float(item["length_mm"]),
            sigma_work,
            e_mpa,
        )
        item["pipe_allow_external_mpa"] = item_eval["p_allow_mpa"]
        item["pipe_elastic_mpa"] = item_eval["p_elastic_mpa"]
        item["pipe_strength_mpa"] = item_eval["p_strength_mpa"]
        if nozzle_eval["p_allow_mpa"] <= 0 or item_eval["p_allow_mpa"] < nozzle_eval["p_allow_mpa"]:
            nozzle_eval = {**item_eval, "name": item["name"]}

    bearing_area_each_m2 = safe_float(support_solution["bearing_area_each_m2"], max(0.1, saddle_width_m * max(d_m, 0.8)))
    reaction_each_kN = safe_float(support_solution["reaction_each_kN"], operating_load_kN / support_count)
    support_pressure_kpa = safe_float(support_solution["foundation_pressure_kpa"], reaction_each_kN / bearing_area_each_m2)

    buoyancy_force_kN = 0.0
    net_uplift_kN = 0.0
    submerged_height_m = 0.0
    submerged_fraction = 0.0
    strap_count = 0
    strap_area_each_mm2 = 0.0
    strap_thickness_mm = 0
    strap_width_mm = 0
    if is_underground and groundwater:
        water_gamma_kN_m3 = groundwater_density / 1000.0 * GRAVITY
        bottom_depth_m = burial_depth_top_m + shell_outer_d_m
        submerged_height_m = clamp(bottom_depth_m - groundwater_level_m, 0.0, shell_outer_d_m)
        _, submerged_fraction = horizontal_fill_fraction(shell_outer_d_m, "level", submerged_height_m)
        buoyancy_force_kN = external_displaced_volume_m3 * submerged_fraction * water_gamma_kN_m3
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
        formula="p_allow = 2 * [sigma] * t_eff / (D + t_eff); p_req = p_design + rho * g * h / 1e6",
        reference="ГОСТ 34233.1, ГОСТ 34233.2",
        inputs={
            "D_mm": d_m * 1000.0,
            "t_nominal_mm": shell_nominal_mm,
            "corrosion_allowance_mm": corr_mm,
            "minus_tolerance_mm": minus_tol_mm,
            "t_eff_mm": shell_int_eval["effective_thickness_mm"],
            "sigma_mpa": sigma_work,
            "p_design_mpa": internal_pressure_mpa,
            "p_hydro_mpa": hydro_support_mpa,
        },
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
            note="Проверка устойчивости обечайки между кольцами/диафрагмами по расчётному внешнему давлению.",
            formula="lambda = L^2 / (D * t_eff); p_allow = p_strength / sqrt(1 + (p_strength / p_elastic)^2)",
            reference="ГОСТ 34233.2, переходная сверка с ГОСТ 14249",
            inputs={
                "D_mm": d_m * 1000.0,
                "L_free_mm": spacing_mm,
                "t_nominal_mm": shell_nominal_mm,
                "corrosion_allowance_mm": corr_mm,
                "minus_tolerance_mm": minus_tol_mm,
                "t_eff_mm": shell_ext_eval["effective_thickness_mm"],
                "p_required_mpa": pressure_required_external_mpa,
                "ring_count": shell_current_ring_count,
            },
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
            formula=(
                "Плоское днище: проверка по усиленному круглому днищу с рёбрами; "
                "коническое/усечённо-коническое: отдельная коническая схема по среднему диаметру и образующей."
            ),
            reference="ГОСТ 34233.2",
            inputs={
                "head_type": head_type,
                "D_mm": d_m * 1000.0,
                "projection_m": head_geo["projection_m"],
                "small_diameter_m": head_geo["small_diameter_m"],
                "t_nominal_mm": head_nominal_mm,
                "corrosion_allowance_mm": head_corr_mm,
                "minus_tolerance_mm": minus_tol_mm,
                "p_required_mpa": head_required_external_mpa,
            },
        ))

    head_internal_allow = safe_float(head_internal_eval.get("p_allow_mpa"), 0.0)
    head_internal_ok = head_internal_allow >= internal_total_mpa - 1e-9
    checks.append(CheckItem(
        code="RGS_HEAD_INT",
        title="Днище: внутреннее давление",
        result="PASS" if head_internal_ok else "FAIL",
        value=head_internal_allow,
        limit=internal_total_mpa,
        unit="МПа",
        note="Проверка днища по внутреннему давлению и гидростатической составляющей.",
        formula="p_allow_head >= p_design + rho * g * h / 1e6",
        reference="ГОСТ 34233.1, ГОСТ 34233.2",
        inputs={
            "head_type": head_type,
            "D_mm": d_m * 1000.0,
            "projection_m": head_geo["projection_m"],
            "small_diameter_m": head_geo["small_diameter_m"],
            "t_nominal_mm": head_nominal_mm,
            "corrosion_allowance_mm": head_corr_mm,
            "minus_tolerance_mm": minus_tol_mm,
            "p_required_mpa": internal_total_mpa,
        },
    ))

    foundation_limit = safe_float(payload.get("R0_kPa"), safe_float(payload.get("R0"), 200.0))

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
            formula="p_allow патрубка считается как цилиндрический элемент при внешнем давлении",
            reference="ГОСТ 34233.3, ГОСТ 34233.2",
            inputs={
                "critical_nozzle": nozzle_eval.get("name", ""),
                "nozzle_d_mm": nozzle_dn_mm,
                "nozzle_t_mm": nozzle_thickness_mm,
                "nozzle_length_mm": nozzle_length_mm,
                "nozzle_count_total": nozzle_count,
            },
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
            formula="h_sub = clamp(H_bottom - H_water, 0, D_out); F_up = gamma_water * V_displaced * phi_sub; N_net = 1.10 * F_up - G_dry",
            reference="СП 20.13330, СП 22.13330",
            inputs={
                "external_displaced_volume_m3": external_displaced_volume_m3,
                "groundwater_level_m": groundwater_level_m,
                "submerged_height_m": submerged_height_m,
                "submerged_fraction": submerged_fraction,
                "buoyancy_force_kN": buoyancy_force_kN,
                "dry_load_kN": dry_load_kN,
                "strap_spacing_m": strap_spacing_m,
            },
        ))

    if shell_current_ring_count > 0:
        checks.append(CheckItem(
            code="RGS_RING_SECTION",
            title="Кольца/диафрагмы: сечение профиля",
            result="PASS" if ring_eval["section_check_status"] == "PASS" else "FAIL",
            value=ring_eval["inertia_cm4"],
            limit=ring_eval.get("required_inertia_cm4"),
            unit="см⁴",
            note=ring_eval["note"],
            formula="q = p_ext * L; N = q * R; M = q * R^2 / 8; A_req = N / [sigma]; W_req = M / [sigma]; I_req = p_ext * D^3 * L / (24 * E).",
            reference="ГОСТ 34233.2",
            inputs={
                "ring_count": shell_current_ring_count,
                "stiffener_type": ring_eval.get("stiffener_type_label"),
                "profile": ring_eval.get("label"),
                "base_area_cm2": ring_eval.get("base_area_cm2"),
                "diaphragm_brace_count": ring_eval.get("diaphragm_brace_count"),
                "diaphragm_equivalent_inertia_cm4": ring_eval.get("diaphragm_equivalent_inertia_cm4"),
                "shell_effective_width_mm": ring_eval.get("shell_effective_width_mm"),
                "shell_effective_area_cm2": ring_eval.get("shell_effective_area_cm2"),
                "tributary_width_mm": ring_eval.get("tributary_width_mm"),
                "line_load_n_mm": ring_eval.get("line_load_n_mm"),
                "hoop_force_n": ring_eval.get("hoop_force_n"),
                "bending_moment_n_mm": ring_eval.get("bending_moment_n_mm"),
                "ring_area_cm2": ring_eval.get("area_cm2"),
                "required_area_cm2": ring_eval.get("required_area_cm2"),
                "ring_section_modulus_cm3": ring_eval.get("section_modulus_cm3"),
                "required_section_modulus_cm3": ring_eval.get("required_section_modulus_cm3"),
                "ring_inertia_cm4": ring_eval.get("inertia_cm4"),
                "required_inertia_cm4": ring_eval.get("required_inertia_cm4"),
                "spacing_mm": shell_ext_eval.get("spacing_mm"),
                "required_external_mpa": pressure_required_external_mpa,
                "area_margin": ring_eval.get("area_margin"),
                "section_modulus_margin": ring_eval.get("section_modulus_margin"),
                "inertia_margin": ring_eval.get("inertia_margin"),
            },
        ))

    warnings: list[str] = []
    if internal_pressure_mpa > ATMOSPHERIC_HORIZONTAL_LIMIT_MPA:
        warnings.append("Расчётное внутреннее давление выше типового диапазона наливной ёмкости. Проверьте необходимость расчёта как сосуда, работающего под давлением.")
    if is_double_wall:
        warnings.append("Для двустенного исполнения прочностные проверки выполняются по внутренней оболочке; наружная оболочка учитывается по массе и геометрии.")

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
        "current_head_ok": head_ok and head_internal_ok,
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
            "insulation_supports_mass_kg": safe_float(insulation_supports.get("steel_mass_kg"), 0.0),
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
            "groundwater_external_kpa": groundwater_external_kpa,
            "external_required_mpa": pressure_required_external_mpa,
            "head_external_required_mpa": head_required_external_mpa,
        },
        "shell": {
            "nominal_mm": shell_nominal_mm,
            "corrosion_allowance_mm": corr_mm,
            "minus_tolerance_mm": minus_tol_mm,
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
            "corrosion_allowance_mm": head_corr_mm,
            "minus_tolerance_mm": minus_tol_mm,
            "allow_internal_mpa": safe_float(head_internal_eval.get("p_allow_mpa"), 0.0),
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
            "recommended_support_count": recommended_support_count,
            "user_support_count": user_support_count,
            "calculated_weight_each_kg": calculated_support_weight_each_kg,
            "user_weight_each_kg": user_support_weight_each_kg,
            "actual_weight_each_kg": support_weight_each_kg,
            "total_mass_kg": support_mass_kg,
            "base_length_m": support_solution["base_length_m"],
            "saddle_height_m": support_solution["saddle_height_m"],
            "requested_height_m": support_solution["requested_height_m"],
            "minimum_height_m": support_solution["minimum_height_m"],
            "contact_angle_deg": support_solution["contact_angle_deg"],
            "base_plate_t_mm": support_solution["base_plate_t_mm"],
            "web_t_mm": support_solution["web_t_mm"],
            "pad_t_mm": support_solution["pad_t_mm"],
            "base_plate_mass_kg": support_solution["base_plate_mass_kg"],
            "web_mass_kg": support_solution["web_mass_kg"],
            "rib_mass_kg": support_solution["rib_mass_kg"],
            "pad_mass_kg": support_solution["pad_mass_kg"],
            "gusset_mass_kg": support_solution["gusset_mass_kg"],
            "basis": support_solution["basis"],
            "reaction_each_kN": reaction_each_kN,
            "bearing_area_each_m2": bearing_area_each_m2,
            "foundation_pressure_kpa": support_pressure_kpa,
            "foundation_limit_kpa": foundation_limit,
        },
        "soil": {
            "preset": SOIL_PRESETS.get(soil_preset, SOIL_PRESETS["sand_coarse"])["label"],
            "burial_depth_top_m": burial_depth_top_m,
            "soil_density_kg_m3": soil_density,
            "gamma_soil_kN_m3": gamma_soil_kN_m3,
            "soil_phi_deg": soil_phi_deg,
            "soil_void_ratio": soil_void_ratio,
            "ka": ka,
            "gamma_f": gamma_f,
            "vertical_kpa": pv_kpa,
            "horizontal_kpa": ph_kpa,
            "average_kpa": pavg_kpa,
            "note": soil_note,
        },
        "rings": ring_eval,
        "insulation_supports": insulation_supports,
        "nozzles": {
            "count": nozzle_count,
            "diameter_mm": nozzle_dn_mm,
            "length_mm": nozzle_length_mm,
            "thickness_mm": nozzle_thickness_mm,
            "items": nozzle_details,
            "critical_name": nozzle_eval.get("name", ""),
            "pipe_allow_external_mpa": nozzle_eval["p_allow_mpa"],
            "pipe_elastic_mpa": nozzle_eval["p_elastic_mpa"],
            "pipe_strength_mpa": nozzle_eval["p_strength_mpa"],
        },
        "flotation": {
            "groundwater": groundwater,
            "groundwater_level_m": groundwater_level_m,
            "submerged_height_m": submerged_height_m,
            "submerged_fraction": submerged_fraction,
            "buoyancy_force_kN": buoyancy_force_kN,
            "dry_load_kN": dry_load_kN,
            "net_uplift_kN": net_uplift_kN,
            "strap_count": strap_count,
            "strap_spacing_m": strap_spacing_m,
            "required_area_each_mm2": strap_area_each_mm2,
            "recommended_thickness_mm": strap_thickness_mm,
            "recommended_width_mm": strap_width_mm,
            "allowable_stress_mpa": strap_allowable_mpa,
        },
    }
    check_dicts = [item.as_dict() for item in checks]

    return {
        "summary": summary,
        "details": details,
        "checks": check_dicts,
        "calculation_cases": calculation_cases(tank_type, is_underground, is_double_wall, groundwater, vacuum_mpa),
        "protocol": [
            {
                "code": item["code"],
                "title": item["title"],
                "formula": item.get("formula", ""),
                "inputs": item.get("inputs", {}),
                "value": item.get("value"),
                "limit": item.get("limit"),
                "unit": item.get("unit", ""),
                "margin": item.get("margin"),
                "result": item.get("result"),
                "reference": item.get("reference", ""),
                "note": item.get("note", ""),
            }
            for item in check_dicts
        ],
        "warnings": warnings,
        "normative": [f"{item['title']} — {item['role']}" for item in RGS_NORMATIVE_BASE],
        "normative_base": RGS_NORMATIVE_BASE,
    }

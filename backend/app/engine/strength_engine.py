from __future__ import annotations

from dataclasses import asdict, dataclass
from math import pi
from typing import Any

G = 9.80665
STEEL_DENSITY = 7850.0
DEFAULT_ALLOWABLE_MPA = 160.0
DEFAULT_FOUNDATION_RESISTANCE_KPA = 200.0
DEFAULT_FRICTION = 0.35
DEFAULT_WIND_SHAPE_COEFF = 1.2

CURRENT_NORMATIVE = [
    "ГОСТ 31385-2023 «Резервуары вертикальные цилиндрические стальные для нефти и нефтепродуктов. Общие технические условия»",
    "СП 20.13330.2016 «Нагрузки и воздействия» (с Изм. № 1-6)",
    "СП 16.13330.2017 «Стальные конструкции» (с Изм. № 1-6)",
    "СП 22.13330.2016 «Основания зданий и сооружений» (с Изм. № 1-5)",
    "СП 14.13330.2018 «Строительство в сейсмических районах» (с Изм. № 2-4)",
]


@dataclass
class BeltCalc:
    belt: int
    height_mm: float
    z_bottom_mm: float
    z_top_mm: float
    z_mid_mm: float
    liquid_head_oper_m: float
    liquid_head_test_m: float
    pressure_service_pa: float
    pressure_design_oper_pa: float
    pressure_design_test_pa: float
    thickness_nominal_mm: float
    thickness_minus_mm: float
    thickness_corrosion_mm: float
    thickness_effective_mm: float
    thickness_required_oper_mm: float
    thickness_required_test_mm: float
    thickness_required_nominal_mm: float
    stress_service_mpa: float
    reserve_ratio: float
    min_constructive_mm: float
    ok: bool


@dataclass
class ReviewFlag:
    level: str
    title: str
    note: str


@dataclass
class CompletenessItem:
    field: str
    title: str
    value: str
    filled: bool
    critical: bool


@dataclass
class CheckItem:
    code: str
    title: str
    status: str
    value: float | None = None
    limit: float | None = None
    unit: str = ""
    note: str = ""


def _num(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        if isinstance(value, str):
            value = value.replace(",", ".").strip()
        return float(value)
    except Exception:
        return default


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _unwrap_model(payload: dict) -> dict:
    if isinstance(payload, dict) and isinstance(payload.get("model"), dict):
        return payload["model"]
    return payload if isinstance(payload, dict) else {}


def _bool_status(value: bool) -> str:
    return "PASS" if value else "FAIL"


def _norm_text(value: str) -> str:
    return " ".join(value.lower().replace("ё", "е").split())


def _fmt(value: Any, digits: int = 2) -> str:
    if value in (None, ""):
        return ""
    try:
        return f"{float(value):.{digits}f}".replace(".", ",")
    except Exception:
        return str(value)


def _gost31385_min_shell_mm(diameter_m: float) -> float:
    if diameter_m <= 10:
        return 4.0
    if diameter_m <= 16:
        return 5.0
    if diameter_m <= 25:
        return 6.0
    if diameter_m <= 40:
        return 8.0
    if diameter_m <= 65:
        return 10.0
    return 12.0


def _auto_reservoir_class(volume_m3: float) -> str:
    if volume_m3 > 50000:
        return "КС-3а"
    if volume_m3 >= 20000:
        return "КС-3б"
    if volume_m3 >= 1000:
        return "КС-2а"
    return "КС-2б"


def _belt_required_thickness_mm(pressure_pa: float, radius_m: float, allowable_mpa: float) -> float:
    allowable_pa = max(allowable_mpa, 1e-9) * 1_000_000.0
    return pressure_pa * radius_m / allowable_pa * 1000.0


def _product_type_review(medium: str, gas_balance_system: str) -> list[ReviewFlag]:
    medium_n = _norm_text(medium)
    gas_n = _norm_text(gas_balance_system)
    flags: list[ReviewFlag] = []
    has_go = "го" in gas_n or "ulf" in gas_n or "улф" in gas_n or "инерт" in gas_n
    if "бенз" in medium_n:
        if not has_go:
            flags.append(ReviewFlag(
                level="critical",
                title="Тип резервуара не подтвержден для бензина",
                note=(
                    "Для автомобильных бензинов ГОСТ 31385-2023 допускает РВСПК, РВСП и РВС с ГО/УЛФ; "
                    "РВС без ГО/УЛФ для такой среды не следует принимать без отдельного нормативного обоснования."
                ),
            ))
    if "диз" in medium_n:
        if not has_go:
            flags.append(ReviewFlag(
                level="important",
                title="Для дизельного топлива желательно подтвердить ГО/УЛФ или иной допустимый тип резервуара",
                note=(
                    "По таблице 2 ГОСТ 31385-2023 для дизельного топлива применимы РВСП и РВС с ГО/УЛФ; "
                    "вариант РВС без ГО/УЛФ должен быть отдельно подтвержден проектом."
                ),
            ))
    return flags


def _collect_completeness(model: dict, auto_class: str) -> dict:
    geometry = model.get("geometry", {})
    product = model.get("product", {})
    site = model.get("site", {})
    shell = model.get("shell", {})
    bottom = model.get("bottom", {})
    roof = model.get("roof", {})
    design = model.get("design_basis", {})
    insulation = model.get("insulation", {})

    def item(field: str, title: str, value: Any, critical: bool = True) -> CompletenessItem:
        text = _text(value)
        return CompletenessItem(field=field, title=title, value=text, filled=bool(text), critical=critical)

    items = [
        item("design_basis.reservoir_class", "Класс резервуара", design.get("reservoir_class") or auto_class),
        item("design_basis.service_life_years", "Расчетный срок службы, лет", design.get("service_life_years")),
        item("design_basis.cycles_per_year", "Оборачиваемость, циклов/год", design.get("cycles_per_year")),
        item("design_basis.tank_type", "Тип резервуара", design.get("tank_type") or "РВС"),
        item("site.region", "Регион", site.get("region")),
        item("site.city", "Город / площадка", site.get("city")),
        item("product.medium", "Хранимый продукт", product.get("medium")),
        item("product.density_kg_m3", "Плотность продукта", product.get("density_kg_m3")),
        item("geometry.diameter_mm", "Внутренний диаметр стенки", geometry.get("diameter_mm")),
        item("geometry.height_mm", "Высота стенки", geometry.get("height_mm")),
        item("geometry.fill_level_mm", "Рабочий уровень налива", geometry.get("fill_level_mm")),
        item("shell.p_gas_mpa", "Избыточное давление в газовом пространстве", shell.get("p_gas_mpa")),
        item("design_basis.vacuum_kpa", "Относительный вакуум", design.get("vacuum_kpa")),
        item("site.wind_pressure_kpa", "Расчетное ветровое давление", site.get("wind_pressure_kpa")),
        item("site.snow_pressure_kpa", "Расчетная снеговая нагрузка", site.get("snow_pressure_kpa")),
        item("site.ice_region", "Гололедный район / гололедная нагрузка", site.get("ice_region"), critical=False),
        item("site.seismic", "Сейсмичность площадки", site.get("seismic"), critical=False),
        item("site.t5_c", "Температура наиболее холодной пятидневки", site.get("t5_c")),
        item("site.tmin_abs_c", "Абсолютный минимум температуры наружного воздуха", site.get("tmin_abs_c")),
        item("design_basis.product_temp_min_c", "Минимальная температура продукта", design.get("product_temp_min_c"), critical=False),
        item("design_basis.product_temp_max_c", "Максимальная температура продукта", design.get("product_temp_max_c"), critical=False),
        item("design_basis.ambient_temp_max_c", "Максимальная температура наружного воздуха", design.get("ambient_temp_max_c"), critical=False),
        item("site.foundation_limit_kpa", "Допускаемое давление на основание", site.get("foundation_limit_kpa")),
        item("site.friction_coeff", "Коэффициент трения основание/днище", site.get("friction_coeff"), critical=False),
        item("design_basis.gas_balance_system", "ГО/УЛФ или инертирование", design.get("gas_balance_system"), critical=False),
    ]

    shell_corr = [row.get("corr_mm") for row in shell.get("courses", []) if isinstance(row, dict)]
    items.append(item("shell.courses[*].corr_mm", "Припуск на коррозию стенки", any(_num(v, 0) > 0 for v in shell_corr) and "задан" or "", critical=False))
    items.append(item("bottom.bottom_corr_mm", "Припуск на коррозию днища", bottom.get("bottom_corr_mm"), critical=False))
    items.append(item("roof.deck_corr_mm", "Припуск на коррозию крыши", roof.get("deck_corr_mm"), critical=False))

    if insulation.get("enabled"):
        items.append(item("insulation.wall_density_kg_m3", "Плотность теплоизоляции стенки", insulation.get("wall_density_kg_m3"), critical=False))
        items.append(item("insulation.wall_thickness_mm", "Толщина теплоизоляции стенки", insulation.get("wall_thickness_mm"), critical=False))
        items.append(item("insulation.roof_density_kg_m3", "Плотность теплоизоляции крыши", insulation.get("roof_density_kg_m3"), critical=False))
        items.append(item("insulation.roof_thickness_mm", "Толщина теплоизоляции крыши", insulation.get("roof_thickness_mm"), critical=False))

    total = len(items)
    filled = sum(1 for entry in items if entry.filled)
    missing = [asdict(entry) for entry in items if not entry.filled]
    return {
        "filled": filled,
        "total": total,
        "percent": round(100.0 * filled / total, 1) if total else 100.0,
        "items": [asdict(entry) for entry in items],
        "missing": missing,
    }


def calculate_strength(payload: dict) -> dict:
    model = _unwrap_model(payload)

    geometry = model.get("geometry", {})
    product = model.get("product", {})
    site = model.get("site", {})
    shell = model.get("shell", {})
    bottom = model.get("bottom", {})
    roof = model.get("roof", {})
    metal = model.get("metal", {})
    insulation = model.get("insulation", {})
    masses = model.get("masses", {})
    design = model.get("design_basis", {})

    d_mm = _num(geometry.get("diameter_mm"))
    h_mm = _num(geometry.get("height_mm"))
    fill_mm = _num(geometry.get("fill_level_mm"), h_mm)
    d_m = _num(geometry.get("diameter_m"), d_mm / 1000.0)
    h_m = _num(geometry.get("height_m"), h_mm / 1000.0)
    radius_m = d_m / 2.0
    plan_area_m2 = _num(geometry.get("plan_area_m2"), pi * radius_m * radius_m if radius_m > 0 else 0.0)
    circumference_m = _num(geometry.get("circumference_m"), pi * d_m if d_m > 0 else 0.0)
    nominal_volume_m3 = _num(geometry.get("full_volume_m3"), 0.0)
    useful_volume_m3 = _num(geometry.get("useful_volume_m3"), 0.0)

    rho = _num(product.get("density_kg_m3"), 1000.0)
    medium = _text(product.get("medium") or "Продукт")

    p_gas_mpa = _num(shell.get("p_gas_mpa"), 0.0)
    p_test_mpa = _num(shell.get("p_test_mpa"), max(p_gas_mpa * 1.25, 0.0))
    p_gas_pa = max(p_gas_mpa, 0.0) * 1_000_000.0
    p_test_pa = max(p_test_mpa, 0.0) * 1_000_000.0

    wind_kpa = _num(site.get("wind_pressure_kpa"), 0.0)
    snow_kpa = _num(site.get("snow_pressure_kpa"), 0.0)
    seismic = _text(site.get("seismic") or "")
    terrain_type = _text(site.get("terrain_type") or design.get("terrain_type") or "A")
    foundation_limit_kpa = _num(site.get("foundation_limit_kpa"), DEFAULT_FOUNDATION_RESISTANCE_KPA)
    friction_coeff = _num(site.get("friction_coeff"), DEFAULT_FRICTION)

    reservoir_class_auto = _auto_reservoir_class(nominal_volume_m3)
    reservoir_class = _text(design.get("reservoir_class") or reservoir_class_auto)
    service_life_years = _num(design.get("service_life_years"), 0.0)
    cycles_per_year = _num(design.get("cycles_per_year"), 0.0)
    tank_type = _text(design.get("tank_type") or "РВС")
    gas_balance_system = _text(design.get("gas_balance_system"))
    product_temp_min_c = _num(design.get("product_temp_min_c"), 0.0)
    product_temp_max_c = _num(design.get("product_temp_max_c"), 0.0)
    ambient_temp_min_c = _num(site.get("tmin_abs_c"), 0.0)
    ambient_temp_max_c = _num(design.get("ambient_temp_max_c"), 0.0)
    vacuum_kpa = _num(design.get("vacuum_kpa"), 0.0)

    allowable_mpa = _num(shell.get("allowable_mpa"), _num(design.get("allowable_mpa"), DEFAULT_ALLOWABLE_MPA))

    shell_mass_kg = _num(masses.get("shell_kg"), _num(shell.get("mass_kg"), 0.0))
    bottom_mass_kg = _num(masses.get("bottom_kg"), _num(bottom.get("mass_kg"), 0.0))
    roof_mass_kg = _num(masses.get("roof_kg"), _num(roof.get("used_mass_kg"), 0.0))
    metal_mass_kg = _num(masses.get("metal_kg"), _num(metal.get("total_mass_kg"), 0.0))
    insulation_mass_kg = _num(masses.get("insulation_kg"), _num(insulation.get("total_mass_kg"), 0.0))
    product_mass_kg = _num(masses.get("product_kg"), _num(product.get("product_mass_kg"), 0.0))
    snow_mass_kg = _num(masses.get("snow_kg"), _num(roof.get("snow_mass_kg"), 0.0))
    steel_mass_kg = _num(masses.get("steel_kg"), shell_mass_kg + bottom_mass_kg + roof_mass_kg + metal_mass_kg + insulation_mass_kg)
    total_mass_kg = _num(masses.get("total_kg"), steel_mass_kg + product_mass_kg + snow_mass_kg)
    total_load_kn = total_mass_kg * G / 1000.0

    bottom_execution = _text(bottom.get("execution") or "—")
    bottom_t_mm = _num(bottom.get("bottom_t_final_mm"), 0.0)
    ring_t_mm = _num(bottom.get("ring_t_final_mm"), 0.0)
    bottom_diameter_mm = _num(bottom.get("bottom_diameter_mm"), d_mm)
    ring_width_mm = _num(bottom.get("ring_width_mm"), 0.0)
    center_diameter_mm = _num(bottom.get("center_diameter_mm"), 0.0)
    ring_mass_kg = _num(bottom.get("ring_mass_kg"), 0.0)
    center_mass_kg = _num(bottom.get("center_mass_kg"), 0.0)
    bottom_corr_mm = _num(bottom.get("bottom_corr_mm"), 0.0)

    roof_type = _text(roof.get("type_label") or roof.get("type_code") or "—")
    roof_angle_deg = _num(roof.get("alpha_deg"), 0.0)
    roof_t_mm = _num(roof.get("deck_t_final_mm"), 0.0)
    roof_corr_mm = _num(roof.get("deck_corr_mm"), 0.0)

    belts_raw = shell.get("courses", []) if isinstance(shell.get("courses"), list) else []
    belts: list[BeltCalc] = []
    z_cursor_mm = 0.0
    fill_m = fill_mm / 1000.0
    min_constructive_mm = _gost31385_min_shell_mm(d_m)
    for idx, row in enumerate(belts_raw, start=1):
        belt_h_mm = _num(row.get("height_mm"), 0.0)
        z_bottom_mm = z_cursor_mm
        z_top_mm = z_bottom_mm + belt_h_mm
        z_mid_mm = z_bottom_mm + belt_h_mm / 2.0
        z_cursor_mm = z_top_mm

        t_nominal_mm = _num(row.get("t_final_mm"), 0.0)
        minus_mm = max(0.0, _num(row.get("minus_tolerance_mm"), 0.0))
        corr_mm = max(0.0, _num(row.get("corr_mm"), 0.0))
        t_effective_mm = max(t_nominal_mm - corr_mm - minus_mm, 0.1)

        liquid_head_oper_m = max(fill_m - z_mid_mm / 1000.0, 0.0)
        liquid_head_test_m = max(h_m - z_mid_mm / 1000.0, 0.0)

        pressure_service_pa = rho * G * liquid_head_oper_m + p_gas_pa
        pressure_design_oper_pa = rho * G * liquid_head_oper_m + 1.2 * p_gas_pa
        pressure_design_test_pa = 1000.0 * G * liquid_head_test_m + 1.25 * p_test_pa

        t_required_oper_mm = _belt_required_thickness_mm(pressure_design_oper_pa, radius_m, allowable_mpa)
        t_required_test_mm = _belt_required_thickness_mm(pressure_design_test_pa, radius_m, allowable_mpa)
        t_required_nominal_mm = max(
            min_constructive_mm,
            t_required_oper_mm + corr_mm + minus_mm,
            t_required_test_mm + corr_mm + minus_mm,
        )

        stress_service_mpa = pressure_service_pa * radius_m / max(t_effective_mm / 1000.0, 1e-9) / 1_000_000.0
        reserve_ratio = t_nominal_mm / t_required_nominal_mm if t_required_nominal_mm > 1e-9 else 999.0
        ok = t_nominal_mm + 1e-9 >= t_required_nominal_mm

        belts.append(BeltCalc(
            belt=idx,
            height_mm=belt_h_mm,
            z_bottom_mm=z_bottom_mm,
            z_top_mm=z_top_mm,
            z_mid_mm=z_mid_mm,
            liquid_head_oper_m=liquid_head_oper_m,
            liquid_head_test_m=liquid_head_test_m,
            pressure_service_pa=pressure_service_pa,
            pressure_design_oper_pa=pressure_design_oper_pa,
            pressure_design_test_pa=pressure_design_test_pa,
            thickness_nominal_mm=t_nominal_mm,
            thickness_minus_mm=minus_mm,
            thickness_corrosion_mm=corr_mm,
            thickness_effective_mm=t_effective_mm,
            thickness_required_oper_mm=t_required_oper_mm,
            thickness_required_test_mm=t_required_test_mm,
            thickness_required_nominal_mm=t_required_nominal_mm,
            stress_service_mpa=stress_service_mpa,
            reserve_ratio=reserve_ratio,
            min_constructive_mm=min_constructive_mm,
            ok=ok,
        ))

    sigma_max = max((b.stress_service_mpa for b in belts), default=0.0)
    controlling_belt = min(belts, key=lambda b: b.reserve_ratio, default=None)
    min_reserve = min((b.reserve_ratio for b in belts), default=999.0)

    avg_foundation_kpa = total_load_kn / plan_area_m2 if plan_area_m2 > 0 else 0.0
    wind_force_kn = wind_kpa * max(d_m * h_m, 0.0) * DEFAULT_WIND_SHAPE_COEFF
    overturning_moment_knm = wind_force_kn * h_m / 2.0
    resisting_moment_knm = total_load_kn * radius_m
    sliding_capacity_kn = friction_coeff * total_load_kn
    e_m = overturning_moment_knm / total_load_kn if total_load_kn > 0 else 0.0
    pmax_kpa = avg_foundation_kpa * (1.0 + 4.0 * min(abs(e_m) / max(d_m, 1e-9), 0.25)) if total_load_kn > 0 and d_m > 0 else avg_foundation_kpa

    shell_strength_ok = all(b.ok for b in belts)
    shell_hydro_ok = all(b.thickness_nominal_mm + 1e-9 >= b.thickness_required_test_mm + b.thickness_corrosion_mm + b.thickness_minus_mm for b in belts)
    overturning_ok = resisting_moment_knm >= overturning_moment_knm
    sliding_ok = sliding_capacity_kn >= wind_force_kn
    foundation_ok = pmax_kpa <= foundation_limit_kpa if foundation_limit_kpa > 0 else False

    completeness = _collect_completeness(model, reservoir_class_auto)
    flags: list[ReviewFlag] = []

    flags.extend(_product_type_review(medium, gas_balance_system))

    if completeness["percent"] < 85:
        flags.append(ReviewFlag(
            level="critical",
            title="Исходные данные по ГОСТ 31385-2023 заполнены не полностью",
            note=(
                f"Полнота исходных данных составляет {completeness['percent']} %. "
                "Без обязательных исходных параметров итоговый отчет следует рассматривать как предварительную инженерную проверку, а не как окончательный проектный расчет."
            ),
        ))

    if not shell_strength_ok:
        flags.append(ReviewFlag(
            level="critical",
            title="Есть пояса стенки с недостаточной номинальной толщиной",
            note="Не все пояса удовлетворяют требуемой номинальной толщине с учетом коррозии и минусового допуска.",
        ))

    if p_gas_mpa > 0.005 + 1e-9:
        flags.append(ReviewFlag(
            level="critical",
            title="Избыточное давление выходит за область применения ГОСТ 31385-2023",
            note="Для области применения стандарта нормативное внутреннее избыточное давление не должно превышать 5000 Па (0,005 МПа).",
        ))

    if vacuum_kpa > 0.5 + 1e-9:
        flags.append(ReviewFlag(
            level="critical",
            title="Относительный вакуум выходит за область применения ГОСТ 31385-2023",
            note="Для области применения стандарта нормативное разрежение в газовом пространстве не должно превышать 500 Па (0,5 кПа).",
        ))

    if rho > 1600 + 1e-9:
        flags.append(ReviewFlag(
            level="critical",
            title="Плотность продукта выходит за область применения стандарта",
            note="ГОСТ 31385-2023 распространяется на продукты плотностью не более 1600 кг/м³.",
        ))

    if ambient_temp_min_c and ambient_temp_min_c < -65:
        flags.append(ReviewFlag(
            level="critical",
            title="Минимальная температура наружного воздуха ниже области применения стандарта",
            note="ГОСТ 31385-2023 распространяется на резервуары с минимальной температурой корпуса не ниже минус 65 °C.",
        ))

    if product_temp_max_c and product_temp_max_c > 160:
        flags.append(ReviewFlag(
            level="critical",
            title="Максимальная температура корпуса выше области применения стандарта",
            note="ГОСТ 31385-2023 распространяется на резервуары с максимальной температурой корпуса не выше 160 °C.",
        ))

    if _text(seismic) and _num(seismic, 0) > 9:
        flags.append(ReviewFlag(
            level="critical",
            title="Сейсмичность площадки выше области применения стандарта",
            note="ГОСТ 31385-2023 распространяется на площадки с сейсмичностью не более 9 баллов включительно.",
        ))

    if not any(_num(row.get("corr_mm"), 0) > 0 for row in belts_raw):
        flags.append(ReviewFlag(
            level="important",
            title="Для стенки не задан припуск на коррозию",
            note="В техническом задании и в отчетности рекомендуется явно задавать припуск на коррозию для стенки, днища и крыши, а не оставлять его нулевым по умолчанию.",
        ))

    if _num(bottom_corr_mm, 0) <= 0:
        flags.append(ReviewFlag(
            level="important",
            title="Для днища не задан припуск на коррозию",
            note="Для днища резервуара припуск на коррозию следует задавать явно в расчетной модели и выводить в отчете.",
        ))

    if _num(roof_corr_mm, 0) <= 0:
        flags.append(ReviewFlag(
            level="advice",
            title="Для настила крыши не задан припуск на коррозию",
            note="Это допустимо только при наличии отдельного обоснования по среде, сроку службы и системе защиты от коррозии.",
        ))

    if not _text(site.get("region")) or not _text(site.get("city")):
        flags.append(ReviewFlag(
            level="important",
            title="Нет однозначной привязки к площадке строительства",
            note="Без региона и города невозможно корректно проследить источник климатических и сейсмических нагрузок.",
        ))

    if _num(site.get("foundation_limit_kpa"), 0) <= 0:
        flags.append(ReviewFlag(
            level="critical",
            title="Не задано допускаемое давление на основание по ИГИ",
            note="Проверка по основанию без геотехнического допуска становится формальной и не должна считаться окончательной.",
        ))

    if cycles_per_year > 100:
        flags.append(ReviewFlag(
            level="important",
            title="Резервуар относится к циклически нагружаемым",
            note="При числе циклов заполнения-опорожнения более 100 в год следует учитывать малоцикловую усталость и режим циклического нагружения в расчетных проверках и диагностике.",
        ))

    if service_life_years <= 0:
        flags.append(ReviewFlag(
            level="important",
            title="Не задан расчетный срок службы",
            note="Срок службы влияет на выбор стали, защиту от коррозии, состав документации и программу диагностирования.",
        ))

    check_items = [
        CheckItem(
            code="SHELL_NOMINAL",
            title="Пояса стенки по требуемой номинальной толщине",
            status=_bool_status(shell_strength_ok),
            value=min_reserve,
            limit=1.0,
            unit="ratio",
            note="Учитывались статическая эксплуатация, гидроиспытание, припуск на коррозию и минусовой допуск.",
        ),
        CheckItem(
            code="SHELL_HYDROTEST",
            title="Пояса стенки при гидроиспытании",
            status=_bool_status(shell_hydro_ok),
            value=min((b.thickness_nominal_mm / (b.thickness_required_test_mm + b.thickness_corrosion_mm + b.thickness_minus_mm) if (b.thickness_required_test_mm + b.thickness_corrosion_mm + b.thickness_minus_mm) > 0 else 999.0 for b in belts), default=999.0),
            limit=1.0,
            unit="ratio",
            note="Проверка выполнена по введенному испытательному давлению и воде 1000 кг/м³.",
        ),
        CheckItem(
            code="OVERTURNING_SIMPLIFIED",
            title="Опрокидывание от ветра (укрупненно)",
            status=_bool_status(overturning_ok),
            value=resisting_moment_knm,
            limit=overturning_moment_knm,
            unit="кН·м",
            note="Укрупненная оценка по введенному расчетному ветровому давлению; не заменяет полный проверочный расчет по поясам и анкерам.",
        ),
        CheckItem(
            code="SLIDING_SIMPLIFIED",
            title="Сдвиг от ветра (укрупненно)",
            status=_bool_status(sliding_ok),
            value=sliding_capacity_kn,
            limit=wind_force_kn,
            unit="кН",
            note="Использован коэффициент трения, заданный в расчетной базе.",
        ),
        CheckItem(
            code="FOUNDATION_PRESSURE",
            title="Давление на основание (укрупненно)",
            status=_bool_status(foundation_ok),
            value=pmax_kpa,
            limit=foundation_limit_kpa,
            unit="кПа",
            note="Проверка носит укрупненный характер и должна подтверждаться расчетом основания и фундамента по ИГИ.",
        ),
    ]

    performed_scope = [
        "Проверка геометрии, объемов и массы продукта по расчетному уровню налива.",
        "Подбор поясов стенки по требуемой номинальной толщине с учетом минимальной конструктивной толщины, коррозии и минусового допуска.",
        "Проверка стенки при эксплуатации и гидроиспытании в укрупненном постановочном расчете.",
        "Определение масс днища, крыши, металлоконструкций, теплоизоляции и суммарной вертикальной нагрузки.",
        "Укрупненная оценка опрокидывания, сдвига и давления на основание по введенным нагрузкам.",
        "Контроль полноты исходных данных относительно перечня ГОСТ 31385-2023, п. 5.1.8.",
    ]
    pending_scope = [
        "Полный расчет сейсмостойкости резервуара (импульсивная и конвективная составляющие жидкости, гидродинамика, анкеровка).",
        "Расчет устойчивости стенки от ветровой потери устойчивости и вакуума по поясам и узлам жесткости.",
        "Расчет прочности и устойчивости элементов крыши, опорного кольца, каркаса, щитов, ребер и узлов сопряжения.",
        "Полный расчет анкеров, анкерных столиков, затяжки и узла стенка-днище.",
        "Геотехнический расчет основания и фундамента по данным инженерно-геологических изысканий.",
        "Подбор и проверка оборудования безопасной эксплуатации, пожарной защиты, КИПиА, дыхательной арматуры и эксплуатационной оснастки.",
        "Разработка комплекта обязательной документации по приложению Е ГОСТ 31385-2023 и технологической карты испытаний.",
    ]

    final_ok = shell_strength_ok and shell_hydro_ok and overturning_ok and sliding_ok and foundation_ok and not any(flag.level == "critical" for flag in flags)

    return {
        "meta": {
            "title": model.get("title") or "РВС",
            "generated_at": model.get("generated_at"),
            "tank_type": tank_type,
            "reservoir_class": reservoir_class,
            "reservoir_class_auto": reservoir_class_auto,
            "terrain_type": terrain_type,
        },
        "normative": CURRENT_NORMATIVE,
        "inputs": {
            "medium": medium,
            "density_kg_m3": rho,
            "diameter_mm": d_mm,
            "height_mm": h_mm,
            "fill_level_mm": fill_mm,
            "fill_percent": _num(geometry.get("fill_percent"), 0.0),
            "p_gas_mpa": p_gas_mpa,
            "p_test_mpa": p_test_mpa,
            "vacuum_kpa": vacuum_kpa,
            "wind_kpa": wind_kpa,
            "snow_kpa": snow_kpa,
            "seismic": seismic or "—",
            "allowable_mpa": allowable_mpa,
            "service_life_years": service_life_years,
            "cycles_per_year": cycles_per_year,
            "gas_balance_system": gas_balance_system or "не задано",
            "product_temp_min_c": product_temp_min_c,
            "product_temp_max_c": product_temp_max_c,
            "ambient_temp_min_c": ambient_temp_min_c,
            "ambient_temp_max_c": ambient_temp_max_c,
            "foundation_limit_kpa": foundation_limit_kpa,
            "friction_coeff": friction_coeff,
        },
        "geometry": {
            "diameter_m": d_m,
            "height_m": h_m,
            "radius_m": radius_m,
            "plan_area_m2": plan_area_m2,
            "circumference_m": circumference_m,
            "full_volume_m3": nominal_volume_m3,
            "useful_volume_m3": useful_volume_m3,
        },
        "belts": [asdict(b) for b in belts],
        "bottom": {
            "execution": bottom_execution,
            "bottom_t_mm": bottom_t_mm,
            "ring_t_mm": ring_t_mm,
            "bottom_diameter_mm": bottom_diameter_mm,
            "ring_width_mm": ring_width_mm,
            "center_diameter_mm": center_diameter_mm,
            "center_mass_kg": center_mass_kg,
            "ring_mass_kg": ring_mass_kg,
            "total_mass_kg": bottom_mass_kg,
            "bottom_corr_mm": bottom_corr_mm,
        },
        "roof": {
            "type": roof_type,
            "angle_deg": roof_angle_deg,
            "deck_t_mm": roof_t_mm,
            "deck_corr_mm": roof_corr_mm,
            "mass_kg": roof_mass_kg,
        },
        "masses": {
            "shell_kg": shell_mass_kg,
            "bottom_kg": bottom_mass_kg,
            "roof_kg": roof_mass_kg,
            "metal_kg": metal_mass_kg,
            "insulation_kg": insulation_mass_kg,
            "steel_kg": steel_mass_kg,
            "product_kg": product_mass_kg,
            "snow_kg": snow_mass_kg,
            "total_kg": total_mass_kg,
            "total_load_kn": total_load_kn,
        },
        "stability": {
            "wind_force_kn": wind_force_kn,
            "overturning_moment_knm": overturning_moment_knm,
            "resisting_moment_knm": resisting_moment_knm,
            "sliding_capacity_kn": sliding_capacity_kn,
            "avg_foundation_kpa": avg_foundation_kpa,
            "pmax_foundation_kpa": pmax_kpa,
            "foundation_limit_kpa": foundation_limit_kpa,
            "eccentricity_m": e_m,
        },
        "summary": {
            "sigma_max_mpa": sigma_max,
            "min_reserve": min_reserve,
            "controlling_belt": controlling_belt.belt if controlling_belt else None,
            "final_ok": final_ok,
        },
        "checks": {
            "shell_strength_ok": shell_strength_ok,
            "shell_hydrotest_ok": shell_hydro_ok,
            "overturning_ok": overturning_ok,
            "sliding_ok": sliding_ok,
            "foundation_ok": foundation_ok,
        },
        "check_items": [asdict(item) for item in check_items],
        "data_completeness": completeness,
        "review_flags": [asdict(flag) for flag in flags],
        "scope": {
            "performed": performed_scope,
            "pending": pending_scope,
        },
        "design_basis": {
            "reservoir_class": reservoir_class,
            "reservoir_class_auto": reservoir_class_auto,
            "tank_type": tank_type,
            "service_life_years": service_life_years,
            "cycles_per_year": cycles_per_year,
            "terrain_type": terrain_type,
            "gas_balance_system": gas_balance_system or "не задано",
            "vacuum_kpa": vacuum_kpa,
        },
        "notes": {
            "report_type": "Автоматизированная инженерная проверка расчетной модели резервуара",
            "calculation_scope": "Расчет не заменяет полный комплект КМ/КМД, геотехнику, расчет сейсмостойкости и обязательную документацию по приложению Е ГОСТ 31385-2023.",
        },
    }

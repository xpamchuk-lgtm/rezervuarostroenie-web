from __future__ import annotations

from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field

FillMode = Literal["percent", "height_m", "level"]
RoofType = Literal["flat", "cone", "spherical"]
RgsTankType = Literal["rgsn", "rgsp", "rgsnd", "rgspd"]
RgsHeadType = Literal["flat", "cone", "truncated_cone"]
RgsMaterial = Literal["09G2S", "St3"]
RgsSoilPreset = Literal["sand_coarse", "sand_medium", "sand_fine", "loam", "clay"]
RgsRingMode = Literal["auto", "manual"]


class RVSRequest(BaseModel):
    D: float = Field(..., description="Диаметр, м")
    H: float = Field(..., description="Высота стенки, м")
    roof_type: RoofType = "cone"
    courses_mm: List[float] = Field(default_factory=list, description="Толщины поясов, мм (снизу вверх)")
    t_bottom_mm: float = 6.0
    t_roof_mm: float = 5.0
    rho: float = 1000.0
    fill_mode: FillMode = "percent"
    fill_value: float = 100.0
    w0_kPa: float = 0.3
    R0_kPa: float = 200.0
    steel_Rd_MPa: float = 160.0
    corr_mm: float = 0.0
    mu: float = 0.35


class RGSRequest(BaseModel):
    tank_type: RgsTankType = "rgsn"
    product_name: str = "Продукт"
    D: float = Field(..., description="Внутренний диаметр, м")
    total_length_m: float = Field(..., description="Общая длина резервуара, м")
    head_type: RgsHeadType = "flat"
    head_projection_m: float = 0.0
    head_small_diameter_m: float = 0.0

    material: RgsMaterial = "09G2S"
    shell_nominal_mm: float = 8.0
    head_nominal_mm: float = 8.0
    corr_mm: float = 2.0
    minus_tolerance_mm: float = 0.8
    head_allowances_mm: float = 0.8
    sigma_work_mpa: float | None = None
    sigma_test_mpa: float | None = None
    e_mpa: float | None = None
    steel_density_kg_m3: float | None = None
    use_current_as_min: bool = False

    rho: float = 1000.0
    temperature_c: float = 20.0
    fill_mode: FillMode = "percent"
    fill_value: float = 100.0
    extra_liquid_head_m: float = 0.0
    design_pressure_mpa: float = 0.0
    vacuum_mpa: float = 0.0

    support_count: int = 2
    saddle_width_m: float = 0.6
    R0_kPa: float = 200.0

    ring_mode: RgsRingMode = "manual"
    ring_count: int = 0
    ring_offset_m: float = 0.2
    ring_section_cm2: float = 10.34

    rib_count: int = 8
    rib_height_mm: float = 50.0
    rib_width_mm: float = 50.0
    rib_thickness_mm: float = 7.0

    nozzle_count: int = 0
    nozzle_dn_mm: float = 0.0
    nozzle_length_mm: float = 0.0
    nozzle_thickness_mm: float = 0.0

    insulation_enabled: bool = False
    insulation_thickness_mm: float = 0.0
    insulation_density_kg_m3: float = 120.0
    coating_thickness_mm: float = 0.0
    coating_density_kg_m3: float = 1200.0

    ladder: bool = False
    platform: bool = False
    manhole_count: int = 0
    neck_height_m: float = 0.0

    soil_preset: RgsSoilPreset = "sand_coarse"
    burial_depth_top_m: float = 0.0
    soil_density_kg_m3: float | None = None
    soil_phi_deg: float | None = None
    soil_void_ratio: float | None = None
    gamma_f: float = 1.15
    groundwater: bool = False
    groundwater_density_kg_m3: float = 1000.0

    strap_spacing_m: float = 2.5
    strap_allowable_mpa: float = 140.0

    outer_shell_gap_m: float = 0.03
    outer_shell_nominal_mm: float = 6.0


class CalcResponse(BaseModel):
    ok: bool = True
    result: Dict[str, Any]

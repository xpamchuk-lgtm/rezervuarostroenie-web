import React, { useEffect, useMemo, useRef, useState } from "react";
import Seo from "../components/Seo";
import ProjectOrderButton from "../components/ProjectOrderButton";

type TankType = "РГСН" | "РГСП" | "РГСНД" | "РГСПД";
type FillMode = "percent" | "level";
type HeadType = "flat" | "cone" | "truncated_cone";
type Material = "09G2S" | "St3";
type RingMode = "auto" | "manual";
type RingProfile = "flat_bar" | "angle_equal" | "channel" | "ibeam";
type RingStiffenerType = "ring" | "diaphragm";
type SoilPreset = "sand_coarse" | "sand_medium" | "sand_fine" | "loam" | "clay";
type SectionId = "type" | "main" | "characteristics" | "equipment" | "results";
type SiteOptions = Record<string, string[]>;
type SiteLookupState = "idle" | "loading" | "done" | "error";

type SiteNormsResponse = {
  wind_region?: string;
  w0?: string;
  snow_region?: string;
  sg?: string;
  seismic?: string;
  t5?: string;
  tmin_abs?: string;
};

type CheckItem = {
  code: string;
  title: string;
  result: string;
  value: number | null;
  limit: number | null;
  margin?: number | null;
  unit: string;
  note?: string;
  formula?: string;
  reference?: string;
  inputs?: Record<string, unknown>;
};

type CalculationCase = {
  id: string;
  title: string;
  active: boolean;
  basis: string;
  note: string;
};

type ProtocolItem = {
  code: string;
  title: string;
  formula?: string;
  inputs?: Record<string, unknown>;
  value?: number | null;
  limit?: number | null;
  unit?: string;
  margin?: number | null;
  result?: string;
  reference?: string;
  note?: string;
};

type ReportRow = {
  name: string;
  value: string;
  unit?: string;
  note?: string;
};

type ReportSection = {
  title: string;
  rows: ReportRow[];
};

type SummaryResult = {
  tank_type?: string;
  product_name?: string;
  material?: string;
  temperature_c?: number;
  full_volume_m3?: number;
  product_volume_m3?: number;
  fill_fraction?: number;
  fill_height_m?: number;
  shell_length_m?: number;
  total_length_m?: number;
  steel_mass_kg?: number;
  dry_mass_kg?: number;
  product_mass_kg?: number;
  operating_mass_kg?: number;
  hydrotest_mass_kg?: number;
  operating_load_kN?: number;
  recommended_shell_mm?: number | null;
  recommended_head_mm?: number | null;
  recommended_ring_count?: number | null;
  current_shell_ok?: boolean;
  current_head_ok?: boolean;
  current_nozzle_ok?: boolean | null;
  net_uplift_kN?: number;
};

type DetailsResult = {
  geometry?: {
    diameter_m?: number;
    total_length_m?: number;
    shell_length_m?: number;
    head_type?: string;
    head_projection_m?: number;
    head_small_diameter_m?: number;
    head_volume_each_m3?: number;
    external_surface_area_m2?: number;
    double_wall_outer_diameter_m?: number;
    annular_volume_m3?: number;
  };
  masses?: {
    shell_mass_kg?: number;
    head_mass_each_kg?: number;
    head_total_mass_kg?: number;
    nozzle_mass_kg?: number;
    ladder_mass_kg?: number;
    platform_mass_kg?: number;
    manhole_mass_kg?: number;
    supports_mass_kg?: number;
    ring_mass_kg?: number;
    outer_wall_mass_kg?: number;
    insulation_mass_kg?: number;
    insulation_supports_mass_kg?: number;
    coating_mass_kg?: number;
  };
  pressures?: {
    internal_design_mpa?: number;
    hydro_support_mpa?: number;
    internal_total_mpa?: number;
    vacuum_mpa?: number;
    soil_vertical_kpa?: number;
    soil_horizontal_kpa?: number;
    soil_average_kpa?: number;
    groundwater_external_kpa?: number;
    external_required_mpa?: number;
    head_external_required_mpa?: number;
  };
  shell?: {
    nominal_mm?: number;
    effective_mm?: number;
    allow_internal_mpa?: number;
    allow_external_mpa?: number;
    elastic_external_mpa?: number;
    strength_external_mpa?: number;
    lambda?: number;
    spacing_mm?: number;
    required_internal_nominal_mm?: number;
    recommended_nominal_mm?: number | null;
    ring_count?: number;
    recommended_ring_count?: number | null;
    recommended_spacing_mm?: number | null;
    minimum_nozzle_spacing_mm?: number;
    fabrication_ring_count?: number;
    fabrication_shell_course_mm?: number;
    fabrication_end_clearance_mm?: number;
    fabrication_ring_positions_mm?: number[];
    fabrication_note?: string;
  };
  head?: {
    nominal_mm?: number;
    allow_external_mpa?: number;
    allow_between_mpa?: number;
    allow_whole_mpa?: number;
    recommended_nominal_mm?: number | null;
    rib_count?: number;
    rib_height_mm?: number;
    rib_width_mm?: number;
    rib_thickness_mm?: number;
    rib_area_cm2?: number;
    rib_centroid_to_surface_mm?: number;
    note?: string;
  };
  supports?: {
    support_count?: number;
    recommended_support_count?: number;
    user_support_count?: number;
    calculated_weight_each_kg?: number;
    user_weight_each_kg?: number;
    actual_weight_each_kg?: number;
    total_mass_kg?: number;
    base_length_m?: number;
    saddle_height_m?: number;
    requested_height_m?: number;
    minimum_height_m?: number;
    contact_angle_deg?: number;
    base_plate_t_mm?: number;
    web_t_mm?: number;
    pad_t_mm?: number;
    base_plate_mass_kg?: number;
    web_mass_kg?: number;
    rib_mass_kg?: number;
    pad_mass_kg?: number;
    gusset_mass_kg?: number;
    basis?: string;
    reaction_each_kN?: number;
    bearing_area_each_m2?: number;
    foundation_pressure_kpa?: number;
    foundation_limit_kpa?: number;
  };
  soil?: {
    preset?: string;
    burial_depth_top_m?: number;
    soil_density_kg_m3?: number;
    soil_phi_deg?: number;
    soil_void_ratio?: number;
    gamma_f?: number;
    vertical_kpa?: number;
    horizontal_kpa?: number;
    average_kpa?: number;
    note?: string;
  };
  nozzles?: {
    count?: number;
    diameter_mm?: number;
    length_mm?: number;
    thickness_mm?: number;
    items?: Array<{
      name?: string;
      count?: number;
      dn_mm?: number;
      length_mm?: number;
      thickness_mm?: number;
      mass_kg?: number;
      pipe_allow_external_mpa?: number;
    }>;
    critical_name?: string;
    pipe_allow_external_mpa?: number;
    pipe_elastic_mpa?: number;
    pipe_strength_mpa?: number;
  };
  rings?: {
    profile?: string;
    label?: string;
    height_mm?: number;
    width_mm?: number;
    web_mm?: number;
    flange_mm?: number;
    flat_bar_on_edge?: boolean | null;
    orientation?: string | null;
    area_cm2?: number;
    inertia_cm4?: number;
    section_modulus_cm3?: number;
    tributary_width_mm?: number;
    line_load_n_mm?: number;
    hoop_force_n?: number;
    bending_moment_n_mm?: number;
    required_area_cm2?: number | null;
    required_section_modulus_cm3?: number | null;
    required_inertia_cm4?: number | null;
    spacing_mm?: number;
    stability_ok?: boolean;
    area_ok?: boolean;
    section_modulus_ok?: boolean;
    inertia_ok?: boolean;
    area_margin?: number | null;
    section_modulus_margin?: number | null;
    inertia_margin?: number | null;
    section_check_status?: string;
    stiffener_type?: RingStiffenerType;
    stiffener_type_label?: string;
    base_area_cm2?: number;
    base_inertia_cm4?: number;
    base_section_modulus_cm3?: number;
    diaphragm_brace_count?: number;
    diaphragm_brace_length_mm?: number;
    diaphragm_brace_area_cm2?: number;
    diaphragm_equivalent_depth_mm?: number;
    diaphragm_equivalent_inertia_cm4?: number;
    shell_effective_width_mm?: number;
    shell_effective_area_cm2?: number;
    shell_effective_thickness_mm?: number;
    ring_part_mass_kg?: number;
    diaphragm_brace_mass_kg?: number;
    single_stiffener_mass_kg?: number;
    composite_note?: string;
    note?: string;
  };
  flotation?: {
    groundwater?: boolean;
    groundwater_level_m?: number;
    submerged_height_m?: number;
    submerged_fraction?: number;
    buoyancy_force_kN?: number;
    dry_load_kN?: number;
    net_uplift_kN?: number;
    strap_count?: number;
    strap_spacing_m?: number;
    required_area_each_mm2?: number;
    recommended_thickness_mm?: number;
    recommended_width_mm?: number;
    allowable_stress_mpa?: number;
  };
  insulation_supports?: {
    enabled?: boolean;
    outer_diameter_mm?: number;
    shell_ring_step_mm?: number;
    shell_ring_count?: number;
    shell_ring_positions_mm?: number[];
    stands_per_ring?: number;
    stand_pitch_mm?: number;
    stand_count?: number;
    stand_plate_mm?: number;
    stand_band_mm?: string;
    head_ray_count_each?: number;
    head_ray_count_total?: number;
    stands_per_head_ray?: number;
    head_ray_stand_count?: number;
    ring_mass_kg?: number;
    stand_mass_kg?: number;
    head_ray_mass_kg?: number;
    steel_mass_kg?: number;
    note?: string;
  };
};

type RgsResult = {
  summary?: SummaryResult;
  details?: DetailsResult;
  checks?: CheckItem[];
  calculation_cases?: CalculationCase[];
  protocol?: ProtocolItem[];
  warnings?: string[];
  normative?: string[];
};

type RgsForm = {
  standardSizeKey: string;
  productName: string;
  region: string;
  city: string;
  windRegion: string;
  w0: string;
  snowRegion: string;
  sg: string;
  t5: string;
  tminAbs: string;
  seismic: string;
  seisLevel: "A" | "B" | "C";
  D: string;
  totalLengthM: string;
  headType: HeadType;
  headProjectionM: string;
  headConeAngleDeg: string;
  headSmallDiameterM: string;
  material: Material;
  shellNominalMm: string;
  headNominalMm: string;
  corrMm: string;
  minusToleranceMm: string;
  headAllowancesMm: string;
  rho: string;
  temperatureC: string;
  fillMode: FillMode;
  fillValue: string;
  extraLiquidHeadM: string;
  designPressureMpa: string;
  vacuumMpa: string;
  supportCount: string;
  saddleWidthM: string;
  supportHeightM: string;
  supportWeightEachKg: string;
  R0Kpa: string;
  ringMode: RingMode;
  ringCount: string;
  ringOffsetM: string;
  ringSectionCm2: string;
  ringProfile: RingProfile;
  ringProfileSizeKey: string;
  ringProfileHeightMm: string;
  ringProfileWidthMm: string;
  ringProfileWebMm: string;
  ringProfileFlangeMm: string;
  ringFlatBarOnEdge: boolean;
  ringStiffenerType: RingStiffenerType;
  ribCount: string;
  ribHeightMm: string;
  ribWidthMm: string;
  ribThicknessMm: string;
  nozzleCount: string;
  nozzleDnMm: string;
  nozzleLengthMm: string;
  nozzleThicknessMm: string;
  nozzles: NozzleItem[];
  insulationEnabled: boolean;
  insulationThicknessMm: string;
  insulationDensityKgM3: string;
  coatingThicknessMm: string;
  coatingDensityKgM3: string;
  ladder: boolean;
  platform: boolean;
  manholeCount: string;
  neckHeightM: string;
  soilPreset: SoilPreset;
  burialDepthTopM: string;
  soilDensityKgM3: string;
  soilPhiDeg: string;
  soilVoidRatio: string;
  groundwater: boolean;
  groundwaterLevelM: string;
  groundwaterDensityKgM3: string;
  strapSpacingM: string;
  strapAllowableMpa: string;
  outerShellGapM: string;
  outerShellNominalMm: string;
};

type NozzleItem = {
  name: string;
  count: string;
  dnMm: string;
  lengthMm: string;
  thicknessMm: string;
};

type RingProfileSize = {
  key: string;
  label: string;
  heightMm: number;
  widthMm: number;
  webMm: number;
  flangeMm: number;
};

const TANK_TYPES: TankType[] = ["РГСН", "РГСП", "РГСНД", "РГСПД"];
const DISABLED_TANK_TYPES: TankType[] = ["РГСНД", "РГСПД"];

const PRODUCT_OPTIONS = [
  { name: "Вода", density: 1000 },
  { name: "Вода техническая", density: 1000 },
  { name: "Нефть", density: 850 },
  { name: "Дизельное топливо", density: 830 },
  { name: "Бензин", density: 740 },
  { name: "Керосин", density: 800 },
  { name: "Мазут", density: 950 },
  { name: "Масло индустриальное", density: 900 },
  { name: "Кислота/щелочь", density: 1200 },
  { name: "Другое", density: 1000 },
];

const RGS_SIZE_PRESETS = [
  { key: "custom", label: "Свои размеры", volumeM3: null, diameterMm: null, lengthMm: null, ringCount: null },
  { key: "rgs-3", label: "РГС 3 м³", volumeM3: 3, diameterMm: 1400, lengthMm: 2000, ringCount: 1 },
  { key: "rgs-5", label: "РГС 5 м³", volumeM3: 5, diameterMm: 1600, lengthMm: 2500, ringCount: 1 },
  { key: "rgs-10", label: "РГС 10 м³", volumeM3: 10, diameterMm: 2000, lengthMm: 3200, ringCount: 1 },
  { key: "rgs-15", label: "РГС 15 м³", volumeM3: 15, diameterMm: 2000, lengthMm: 4700, ringCount: 2 },
  { key: "rgs-25", label: "РГС 25 м³", volumeM3: 25, diameterMm: 2400, lengthMm: 5500, ringCount: 2 },
  { key: "rgs-50", label: "РГС 50 м³", volumeM3: 50, diameterMm: 2800, lengthMm: 8200, ringCount: 3 },
  { key: "rgs-75", label: "РГС 75 м³", volumeM3: 75, diameterMm: 3200, lengthMm: 9500, ringCount: 4 },
  { key: "rgs-100", label: "РГС 100 м³", volumeM3: 100, diameterMm: 3200, lengthMm: 12500, ringCount: 5 },
];

const RING_PROFILE_SIZES: Record<RingProfile, RingProfileSize[]> = {
  angle_equal: [
    { key: "angle-50x5", label: "Уголок 50x50x5", heightMm: 50, widthMm: 50, webMm: 5, flangeMm: 5 },
    { key: "angle-63x5", label: "Уголок 63x63x5", heightMm: 63, widthMm: 63, webMm: 5, flangeMm: 5 },
    { key: "angle-75x6", label: "Уголок 75x75x6", heightMm: 75, widthMm: 75, webMm: 6, flangeMm: 6 },
    { key: "angle-90x7", label: "Уголок 90x90x7", heightMm: 90, widthMm: 90, webMm: 7, flangeMm: 7 },
    { key: "angle-100x8", label: "Уголок 100x100x8", heightMm: 100, widthMm: 100, webMm: 8, flangeMm: 8 },
  ],
  flat_bar: [
    { key: "flat-40x4", label: "Полоса 40x4 торцом", heightMm: 40, widthMm: 40, webMm: 4, flangeMm: 4 },
    { key: "flat-50x5", label: "Полоса 50x5 торцом", heightMm: 50, widthMm: 50, webMm: 5, flangeMm: 5 },
    { key: "flat-60x6", label: "Полоса 60x6 торцом", heightMm: 60, widthMm: 60, webMm: 6, flangeMm: 6 },
    { key: "flat-80x8", label: "Полоса 80x8 торцом", heightMm: 80, widthMm: 80, webMm: 8, flangeMm: 8 },
    { key: "flat-100x10", label: "Полоса 100x10 торцом", heightMm: 100, widthMm: 100, webMm: 10, flangeMm: 10 },
  ],
  channel: [
    { key: "channel-65", label: "Швеллер 6.5П", heightMm: 65, widthMm: 36, webMm: 4.4, flangeMm: 7.2 },
    { key: "channel-80", label: "Швеллер 8П", heightMm: 80, widthMm: 40, webMm: 4.5, flangeMm: 7.4 },
    { key: "channel-100", label: "Швеллер 10П", heightMm: 100, widthMm: 46, webMm: 4.5, flangeMm: 7.6 },
    { key: "channel-120", label: "Швеллер 12П", heightMm: 120, widthMm: 52, webMm: 4.8, flangeMm: 7.8 },
    { key: "channel-140", label: "Швеллер 14П", heightMm: 140, widthMm: 58, webMm: 4.9, flangeMm: 8.1 },
  ],
  ibeam: [
    { key: "ibeam-10", label: "Двутавр 10Б1", heightMm: 100, widthMm: 55, webMm: 4.1, flangeMm: 5.7 },
    { key: "ibeam-12", label: "Двутавр 12Б1", heightMm: 117.6, widthMm: 64, webMm: 3.8, flangeMm: 5.1 },
    { key: "ibeam-14", label: "Двутавр 14Б1", heightMm: 137.4, widthMm: 73, webMm: 3.8, flangeMm: 5.6 },
    { key: "ibeam-16", label: "Двутавр 16Б1", heightMm: 157, widthMm: 82, webMm: 4, flangeMm: 5.9 },
    { key: "ibeam-18", label: "Двутавр 18Б1", heightMm: 177, widthMm: 91, webMm: 4.3, flangeMm: 6.5 },
  ],
};

const FALLBACK_SITE_OPTIONS: SiteOptions = {
  "Саратовская область": ["Саратов", "Энгельс", "Балаково"],
  "Москва": ["Москва"],
  "Санкт-Петербург": ["Санкт-Петербург"],
};

const TYPE_META: Record<TankType, { api: string; title: string; note: string }> = {
  "РГСН": {
    api: "rgsn",
    title: "Наземное исполнение",
    note: "Расчёт опор, масс, толщины обечайки и днищ для горизонтальной наземной ёмкости.",
  },
  "РГСП": {
    api: "rgsp",
    title: "Подземное исполнение",
    note: "Расчёт давления грунта, внешнего давления, всплытия и удерживающих хомутов для подземной ёмкости.",
  },
  "РГСНД": {
    api: "rgsnd",
    title: "Наземное двустенное исполнение",
    note: "Внутренняя оболочка проверяется по прочности, наружная — по массе и геометрии межстенного пространства.",
  },
  "РГСПД": {
    api: "rgspd",
    title: "Подземное двустенное исполнение",
    note: "Комбинация подземной схемы и двустенной компоновки с расчётом всплытия и межстенного объёма.",
  },
};

const SOIL_OPTIONS: Array<{ value: SoilPreset; label: string }> = [
  { value: "sand_coarse", label: "Пески гравелистые и крупные" },
  { value: "sand_medium", label: "Пески средней крупности" },
  { value: "sand_fine", label: "Пески мелкие" },
  { value: "loam", label: "Суглинок" },
  { value: "clay", label: "Глина" },
];

const RGS_SECTIONS: Array<{ id: SectionId; label: string; note: string }> = [
  { id: "type", label: "Тип исполнения", note: "РГСН, РГСП, РГСНД или РГСПД" },
  { id: "main", label: "Основные данные", note: "Типоразмер, объем, продукт и район" },
  { id: "characteristics", label: "Основные характеристики", note: "Толщины, днища, кольца и проверки" },
  { id: "equipment", label: "Комплектация", note: "Патрубки, опоры, хомуты и изоляция" },
  { id: "results", label: "Результаты", note: "Проверки, детализация и нормативы" },
];

const HEAD_LABELS: Record<HeadType, string> = {
  flat: "Плоские",
  cone: "Конические",
  truncated_cone: "Усечённо-конические",
};

function createDefaultNozzles(underground: boolean, burialDepthMm = 1000): NozzleItem[] {
  const manholeLengthMm = underground ? String(Math.max(0, burialDepthMm) + 250) : "250";
  return [
    { name: "Люк-лаз", count: underground ? "1" : "1", dnMm: underground ? "700" : "600", lengthMm: manholeLengthMm, thicknessMm: underground ? "7" : "6" },
    { name: "Налив", count: "0", dnMm: "100", lengthMm: "250", thicknessMm: "6" },
    { name: "Слив", count: "0", dnMm: "100", lengthMm: "250", thicknessMm: "6" },
    { name: "Дыхательный", count: "0", dnMm: "50", lengthMm: "200", thicknessMm: "5" },
    { name: "Замерный", count: "0", dnMm: "80", lengthMm: "200", thicknessMm: "5" },
  ];
}

function createDefaultForm(type: TankType): RgsForm {
  const underground = type === "РГСП" || type === "РГСПД";
  const doubleWall = type === "РГСНД" || type === "РГСПД";
  const burialDepthTopMm = underground ? 1000 : 0;

  return {
    standardSizeKey: underground ? "rgs-15" : "custom",
    productName: underground ? "Дизельное топливо" : "Вода",
    region: "",
    city: "",
    windRegion: "II",
    w0: "0.30",
    snowRegion: "III",
    sg: "1.80",
    t5: "-25",
    tminAbs: "-35",
    seismic: "6",
    seisLevel: "B",
    D: underground ? "2000" : "3200",
    totalLengthM: underground ? "4470" : "12000",
    headType: "truncated_cone",
    headProjectionM: underground ? "0" : "0",
    headConeAngleDeg: "75",
    headSmallDiameterM: "400",
    material: "09G2S",
    shellNominalMm: underground ? "7" : "8",
    headNominalMm: underground ? "7" : "8",
    corrMm: "0",
    minusToleranceMm: "0.8",
    headAllowancesMm: "0",
    rho: underground ? "830" : "1000",
    temperatureC: "20",
    fillMode: "percent",
    fillValue: "95",
    extraLiquidHeadM: "0",
    designPressureMpa: "0.0",
    vacuumMpa: "0.0",
    supportCount: "0",
    saddleWidthM: "400",
    supportHeightM: underground ? "0" : "200",
    supportWeightEachKg: "0",
    R0Kpa: "200",
    ringMode: "auto",
    ringCount: String(estimateRingCount(underground ? 4470 : 12000)),
    ringOffsetM: underground ? "200" : "0",
    ringSectionCm2: "10.34",
    ringProfile: "angle_equal",
    ringProfileSizeKey: "angle-75x6",
    ringProfileHeightMm: "75",
    ringProfileWidthMm: "75",
    ringProfileWebMm: "6",
    ringProfileFlangeMm: "6",
    ringFlatBarOnEdge: true,
    ringStiffenerType: "ring",
    ribCount: "8",
    ribHeightMm: "50",
    ribWidthMm: "50",
    ribThicknessMm: "7",
    nozzleCount: underground ? "1" : "0",
    nozzleDnMm: underground ? "700" : "80",
    nozzleLengthMm: underground ? String(burialDepthTopMm + 250) : "250",
    nozzleThicknessMm: underground ? "7" : "6",
    nozzles: createDefaultNozzles(underground, burialDepthTopMm),
    insulationEnabled: false,
    insulationThicknessMm: "50",
    insulationDensityKgM3: underground ? "60" : "120",
    coatingThicknessMm: "0",
    coatingDensityKgM3: "1200",
    ladder: !underground,
    platform: false,
    manholeCount: underground ? "1" : "1",
    neckHeightM: underground ? "400" : "0",
    soilPreset: "sand_coarse",
    burialDepthTopM: String(burialDepthTopMm),
    soilDensityKgM3: underground ? "1800" : "1800",
    soilPhiDeg: underground ? "40" : "40",
    soilVoidRatio: underground ? "0.45" : "0.45",
    groundwater: underground,
    groundwaterLevelM: underground ? "1500" : "0",
    groundwaterDensityKgM3: "1000",
    strapSpacingM: "2500",
    strapAllowableMpa: "140",
    outerShellGapM: doubleWall ? "30" : "30",
    outerShellNominalMm: doubleWall ? "6" : "6",
  };
}

function createResultMap<T>(value: T): Record<TankType, T> {
  return {
    "РГСН": value,
    "РГСП": value,
    "РГСНД": value,
    "РГСПД": value,
  };
}

function parseNumber(value: string, fallback = 0): number {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mmToM(value: string, fallback = 0): number {
  return parseNumber(value, fallback) / 1000;
}

function ceilWholeMm(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "";
  return String(Math.max(0, Math.ceil(value)));
}

function recommendedBaseMm(recommendedNominalMm: number | undefined | null, corrosionMm: number, constructiveMinMm = 4): number | null {
  if (recommendedNominalMm === undefined || recommendedNominalMm === null || !Number.isFinite(recommendedNominalMm)) return null;
  return Math.max(constructiveMinMm, Math.ceil(recommendedNominalMm - Math.max(0, corrosionMm)));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function circleAreaM2(diameterM: number): number {
  return Math.PI * diameterM * diameterM / 4;
}

function circularSegmentAreaM2(radiusM: number, fillHeightM: number): number {
  const h = clampNumber(fillHeightM, 0, 2 * radiusM);
  if (h <= 0) return 0;
  if (h >= 2 * radiusM) return Math.PI * radiusM * radiusM;
  const theta = 2 * Math.acos((radiusM - h) / radiusM);
  return 0.5 * radiusM * radiusM * (theta - Math.sin(theta));
}

function headVolumeEachM3(headType: HeadType, diameterM: number, projectionM: number, smallDiameterM: number): number {
  const r1 = diameterM / 2;
  const r2 = Math.max(0, smallDiameterM / 2);
  const h = Math.max(0, projectionM);
  if (headType === "flat" || h <= 0) return 0;
  if (headType === "cone") return Math.PI * r1 * r1 * h / 3;
  return Math.PI * h * (r1 * r1 + r1 * Math.min(r1, r2) + Math.min(r1, r2) ** 2) / 3;
}

function calculatedHeadProjectionMm(headType: HeadType, diameterMm: number, smallDiameterMm: number, coneAngleDeg: number): number {
  if (headType === "flat") return 0;
  const largeRadiusMm = Math.max(0, diameterMm / 2);
  const smallRadiusMm = headType === "truncated_cone" ? clampNumber(smallDiameterMm / 2, 0, largeRadiusMm) : 0;
  const deltaRadiusMm = Math.max(0, largeRadiusMm - smallRadiusMm);
  const angleRad = clampNumber(coneAngleDeg, 5, 85) * Math.PI / 180;
  return deltaRadiusMm / Math.tan(angleRad);
}

function estimateRingCount(lengthMm: number): number {
  if (lengthMm <= 0) return 0;
  const shellCourseMm = 1490;
  const endClearanceMm = 500;
  let count = 0;
  for (let position = shellCourseMm; position < lengthMm; position += shellCourseMm) {
    if (position >= endClearanceMm && lengthMm - position >= endClearanceMm) count += 1;
  }
  return count;
}

function formatNumber(value: number | undefined | null, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function ringStatusLabel(rings?: DetailsResult["rings"]): string {
  if (!rings) return "после расчёта";
  if (rings.section_check_status === "NOT_REQUIRED") return "не требуется";
  const ok = rings.stability_ok && rings.area_ok && rings.section_modulus_ok && rings.inertia_ok;
  return ok ? "проходит" : "не проходит";
}

function applyRingProfileSize(form: RgsForm, size: RingProfileSize): RgsForm {
  return {
    ...form,
    ringProfileSizeKey: size.key,
    ringProfileHeightMm: String(size.heightMm),
    ringProfileWidthMm: String(size.widthMm),
    ringProfileWebMm: String(size.webMm),
    ringProfileFlangeMm: String(size.flangeMm),
  };
}

function friendlyRequestError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err || "");
  if (!raw || raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("Load failed")) {
    return fallback;
  }
  return raw;
}

function checkClass(result?: string): string {
  const raw = String(result || "").toUpperCase();
  if (raw.includes("PASS") || raw.includes("OK")) return "pill pass";
  if (raw.includes("FAIL") || raw.includes("ERR")) return "pill fail";
  return "pill warn";
}

function checkLabel(result?: string): string {
  const raw = String(result || "").toUpperCase();
  if (raw.includes("PASS") || raw.includes("OK")) return "OK";
  if (raw.includes("FAIL") || raw.includes("ERR")) return "НЕ ОК";
  if (raw.includes("WARN")) return "ВНИМАНИЕ";
  return result || "—";
}

const CHECK_CODE_LABELS: Record<string, string> = {
  RGS_SHELL_INT: "Обечайка: внутреннее давление",
  RGS_SHELL_EXT: "Обечайка: внешнее давление",
  RGS_HEAD_INT: "Днище: внутреннее давление",
  RGS_HEAD_EXT: "Днище: внешнее давление",
  RGS_NOZZLE_PIPE_EXT: "Патрубки: внешнее давление",
  RGS_RING_SECTION: "Кольца жесткости: сечение",
  RGS_FLOTATION: "Всплытие подземного резервуара",
  RGS_STRAP_AREA: "Хомуты: площадь сечения",
  RGS_SUPPORT_BEARING: "Опоры: давление под седлом",
};

function checkTitle(item: { code?: string; title?: string }): string {
  return CHECK_CODE_LABELS[item.code || ""] || item.title || "Проверка";
}

function boolBadge(value?: boolean | null): string {
  if (value === true) return "OK";
  if (value === false) return "НЕ ОК";
  return "—";
}

function formatProtocolValue(value: unknown): string {
  if (typeof value === "number") return Number.isFinite(value) ? formatNumber(value, 4) : "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function estimateSupportUnit(diameterM: number, saddleWidthM: number, shellNominalMm: number, minHeightM = 0, requestedHeightM = 0.2) {
  const steelDensity = 7850;
  const d = Math.max(0.2, diameterM);
  const width = Math.max(0.1, saddleWidthM);
  const shellT = Math.max(3, shellNominalMm);
  const contactAngleDeg = 120;
  const baseLengthM = Math.max(0.75, 0.55 * d);
  const saddleHeightM = Math.max(0, minHeightM, requestedHeightM);
  const basePlateTM = Math.max(8, shellT + 2) / 1000;
  const webTM = Math.max(8, shellT) / 1000;
  const padTM = Math.max(6, shellT) / 1000;
  const arcLengthM = Math.PI * d * contactAngleDeg / 360;
  const basePlateVolumeM3 = baseLengthM * width * basePlateTM;
  const webVolumeM3 = 2 * width * saddleHeightM * webTM;
  const ribVolumeM3 = 3 * baseLengthM * saddleHeightM * webTM / 2;
  const padVolumeM3 = arcLengthM * width * padTM;
  const gussetVolumeM3 = 4 * 0.5 * saddleHeightM * Math.min(0.25, width / 2) * webTM;
  const weightEachKg = (basePlateVolumeM3 + webVolumeM3 + ribVolumeM3 + padVolumeM3 + gussetVolumeM3) * steelDensity;

  return { baseLengthM, saddleHeightM, contactAngleDeg, weightEachKg, minHeightM, requestedHeightM };
}

function useTypeFlags(type: TankType) {
  return {
    underground: type === "РГСП" || type === "РГСПД",
    doubleWall: type === "РГСНД" || type === "РГСПД",
  };
}

function useSiteOptions(): SiteOptions {
  const [options, setOptions] = useState<SiteOptions>(FALLBACK_SITE_OPTIONS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site/options")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("site options"))))
      .then((data) => {
        if (!cancelled && data && typeof data.regions === "object") {
          setOptions(data.regions as SiteOptions);
        }
      })
      .catch(() => setOptions(FALLBACK_SITE_OPTIONS));

    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}

export default function RgsCalc() {
  const siteOptions = useSiteOptions();
  const [activeType, setActiveType] = useState<TankType>("РГСН");
  const [activeSection, setActiveSection] = useState<SectionId>("type");
  const [forms, setForms] = useState<Record<TankType, RgsForm>>({
    "РГСН": createDefaultForm("РГСН"),
    "РГСП": createDefaultForm("РГСП"),
    "РГСНД": createDefaultForm("РГСНД"),
    "РГСПД": createDefaultForm("РГСПД"),
  });
  const [results, setResults] = useState<Record<TankType, RgsResult | null>>(createResultMap<RgsResult | null>(null));
  const [loadingType, setLoadingType] = useState<TankType | null>(null);
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  const [siteLookupState, setSiteLookupState] = useState<SiteLookupState>("idle");
  const [error, setError] = useState<string>("");
  const calculationRequestId = useRef(0);
  const autoThicknessRef = useRef<Partial<Record<TankType, { shell: string; head: string }>>>({});

  const form = forms[activeType];
  const result = results[activeType];
  const fillUnit = form.fillMode === "percent" ? "% диаметра" : "мм";
  const activeMeta = useMemo(() => TYPE_META[activeType], [activeType]);
  const flags = useMemo(() => useTypeFlags(activeType), [activeType]);
  const regionOptions = useMemo(() => Object.keys(siteOptions), [siteOptions]);
  const cityOptions = useMemo(() => (form.region ? siteOptions[form.region] ?? [] : []), [form.region, siteOptions]);
  const visibleSections = RGS_SECTIONS;
  const calculatedHeadDepthMm = useMemo(
    () => calculatedHeadProjectionMm(
      form.headType,
      parseNumber(form.D),
      parseNumber(form.headSmallDiameterM),
      parseNumber(form.headConeAngleDeg, 75),
    ),
    [form.D, form.headConeAngleDeg, form.headSmallDiameterM, form.headType],
  );

  function goToSection(sectionId: SectionId) {
    setActiveSection(sectionId);
  }

  function updateForm<K extends keyof RgsForm>(field: K, value: RgsForm[K]) {
    setForms((prev) => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        [field]: value,
      },
    }));
  }

  function updateFillMode(mode: FillMode) {
    setForms((prev) => {
      const current = prev[activeType];
      const diameterMm = parseNumber(current.D);
      const currentPercent = current.fillMode === "percent"
        ? parseNumber(current.fillValue, 95)
        : diameterMm > 0 ? parseNumber(current.fillValue) / diameterMm * 100 : 95;
      const nextPercent = clampNumber(currentPercent || 95, 0, 100);
      return {
        ...prev,
        [activeType]: {
          ...current,
          fillMode: mode,
          fillValue: mode === "level"
            ? formatNumber(diameterMm * nextPercent / 100, 0).replace(/\s/g, "")
            : formatNumber(nextPercent, 1).replace(",0", "").replace(/\s/g, ""),
        },
      };
    });
  }

  function updateNozzle(index: number, field: keyof NozzleItem, value: string) {
    setForms((prev) => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        nozzles: prev[activeType].nozzles.map((item, itemIndex) => (
          itemIndex === index ? { ...item, [field]: value } : item
        )),
      },
    }));
  }

  function updateBurialDepth(value: string) {
    setForms((prev) => {
      const current = prev[activeType];
      const isUnderground = activeType === "РГСП" || activeType === "РГСПД";
      const previousManholeLength = formatNumber(parseNumber(current.burialDepthTopM) + 250, 0).replace(/\s/g, "");
      const nextManholeLength = formatNumber(parseNumber(value) + 250, 0).replace(/\s/g, "");
      const shouldSyncManhole = isUnderground
        && current.nozzles[0]?.name === "Люк-лаз"
        && current.nozzles[0]?.lengthMm === previousManholeLength;

      return {
        ...prev,
        [activeType]: {
          ...current,
          burialDepthTopM: value,
          nozzleLengthMm: shouldSyncManhole ? nextManholeLength : current.nozzleLengthMm,
          nozzles: shouldSyncManhole
            ? current.nozzles.map((item, index) => (index === 0 ? { ...item, lengthMm: nextManholeLength } : item))
            : current.nozzles,
        },
      };
    });
  }

  function updateSupportHeight(value: string) {
    updateForm("supportHeightM", value);
  }

  function normalizeSupportHeight() {
    const minimumMm = !flags.underground && form.insulationEnabled ? parseNumber(form.insulationThicknessMm) + 50 : 0;
    const nextMm = Math.max(0, minimumMm, parseNumber(form.supportHeightM));
    updateForm("supportHeightM", formatNumber(nextMm, 0).replace(/\s/g, ""));
  }

  function updateProduct(productName: string) {
    const product = PRODUCT_OPTIONS.find((item) => item.name === productName);
    setForms((prev) => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        productName,
        rho: product ? String(product.density) : prev[activeType].rho,
      },
    }));
  }

  function updateRegion(region: string) {
    setSiteLookupState("idle");
    setForms((prev) => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        region,
        city: "",
      },
    }));
  }

  function updateCity(city: string) {
    setSiteLookupState("idle");
    updateForm("city", city);
  }

  async function applySiteNorms() {
    if (!form.region || !form.city) return;
    setSiteLookupState("loading");
    const query = new URLSearchParams({ region: form.region, city: form.city });

    try {
      const response = await fetch(`/api/site/norms?${query.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as SiteNormsResponse;
      setForms((prev) => ({
        ...prev,
        [activeType]: {
          ...prev[activeType],
          windRegion: data.wind_region || prev[activeType].windRegion,
          w0: data.w0 || prev[activeType].w0,
          snowRegion: data.snow_region || prev[activeType].snowRegion,
          sg: data.sg || prev[activeType].sg,
          seismic: data.seismic || prev[activeType].seismic,
          t5: data.t5 || prev[activeType].t5,
          tminAbs: data.tmin_abs || prev[activeType].tminAbs,
        },
      }));
      setSiteLookupState("done");
    } catch {
      setSiteLookupState("error");
    }
  }

  function updateTankType(tankType: TankType) {
    if (DISABLED_TANK_TYPES.includes(tankType)) return;
    setActiveType(tankType);
    setSiteLookupState("idle");
    setError("");
  }

  function updateStandardSize(sizeKey: string) {
    const preset = RGS_SIZE_PRESETS.find((item) => item.key === sizeKey);
    setForms((prev) => {
      const current = prev[activeType];
      return {
        ...prev,
        [activeType]: {
          ...current,
          standardSizeKey: sizeKey,
          D: preset?.diameterMm ? String(preset.diameterMm) : current.D,
          totalLengthM: preset?.lengthMm ? String(preset.lengthMm) : current.totalLengthM,
          fillValue: current.fillMode === "level" && preset?.diameterMm
            ? formatNumber(preset.diameterMm * 0.95, 0).replace(/\s/g, "")
            : current.fillValue,
          ringCount: current.ringMode === "auto" || preset?.lengthMm
            ? String(estimateRingCount(preset?.lengthMm ?? parseNumber(current.totalLengthM)))
            : current.ringCount,
        },
      };
    });
  }

  function updateDimension(field: "D" | "totalLengthM", value: string) {
    setForms((prev) => {
      const current = prev[activeType];
      const next: RgsForm = {
        ...current,
        standardSizeKey: "custom",
        [field]: value,
      };
      if (field === "totalLengthM" && current.ringMode === "auto") {
        next.ringCount = String(estimateRingCount(parseNumber(value)));
      }
      if (field === "D" && current.fillMode === "level") {
        next.fillValue = formatNumber(parseNumber(value) * 0.95, 0).replace(/\s/g, "");
      }
      return { ...prev, [activeType]: next };
    });
  }

  function updateRingCount(value: string) {
    setForms((prev) => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        ringMode: "manual",
        ringCount: value,
      },
    }));
  }

  function updateRingProfile(profile: RingProfile) {
    const firstSize = RING_PROFILE_SIZES[profile][0];
    setForms((prev) => ({
      ...prev,
      [activeType]: applyRingProfileSize({
        ...prev[activeType],
        ringProfile: profile,
      }, firstSize),
    }));
  }

  function updateRingProfileSize(sizeKey: string) {
    const size = RING_PROFILE_SIZES[form.ringProfile].find((item) => item.key === sizeKey);
    if (!size) return;
    setForms((prev) => ({
      ...prev,
      [activeType]: applyRingProfileSize(prev[activeType], size),
    }));
  }

  function updateRingMode(mode: RingMode) {
    setForms((prev) => {
      const current = prev[activeType];
      return {
        ...prev,
        [activeType]: {
          ...current,
          ringMode: mode,
          ringCount: mode === "auto" ? String(estimateRingCount(parseNumber(current.totalLengthM))) : current.ringCount,
        },
      };
    });
  }

  function resetCurrentForm() {
    setForms((prev) => ({
      ...prev,
      [activeType]: createDefaultForm(activeType),
    }));
    setResults((prev) => ({
      ...prev,
      [activeType]: null,
    }));
    setSiteLookupState("idle");
    setError("");
  }

  function loadPassatExample(thicknessMm: number) {
    if (!flags.underground) return;
    const next = createDefaultForm(activeType);
    next.shellNominalMm = String(thicknessMm);
    next.headNominalMm = String(thicknessMm);
    next.designPressureMpa = "0.0";
    next.vacuumMpa = "0.0";
    next.ringMode = "auto";
    next.ringCount = "2";
    next.fillMode = "percent";
    next.fillValue = "95";
    next.extraLiquidHeadM = "0";
    setForms((prev) => ({ ...prev, [activeType]: next }));
    setResults((prev) => ({ ...prev, [activeType]: null }));
    setSiteLookupState("idle");
    setError("");
  }

  function buildPayload() {
    return {
      tank_type: activeMeta.api,
      product_name: form.productName,
      site_region: form.region,
      site_city: form.city,
      wind_region: form.windRegion,
      w0_kpa: parseNumber(form.w0),
      snow_region: form.snowRegion,
      sg_kpa: parseNumber(form.sg),
      t5_c: parseNumber(form.t5),
      tmin_abs_c: parseNumber(form.tminAbs),
      seismic: form.seismic,
      seis_level: form.seisLevel,
      D: mmToM(form.D),
      total_length_m: mmToM(form.totalLengthM),
      head_type: form.headType,
      head_projection_m: calculatedHeadDepthMm / 1000,
      head_small_diameter_m: form.headType === "truncated_cone" ? mmToM(form.headSmallDiameterM) : 0,
      material: form.material,
      shell_nominal_mm: parseNumber(form.shellNominalMm),
      head_nominal_mm: parseNumber(form.headNominalMm),
      corr_mm: parseNumber(form.corrMm),
      minus_tolerance_mm: parseNumber(form.minusToleranceMm),
      head_allowances_mm: parseNumber(form.headAllowancesMm),
      rho: parseNumber(form.rho),
      temperature_c: parseNumber(form.temperatureC),
      fill_mode: form.fillMode,
      fill_value: form.fillMode === "level" ? mmToM(form.fillValue) : parseNumber(form.fillValue),
      extra_liquid_head_m: 0,
      design_pressure_mpa: parseNumber(form.designPressureMpa),
      vacuum_mpa: parseNumber(form.vacuumMpa),
      support_count: parseNumber(form.supportCount),
      saddle_width_m: mmToM(form.saddleWidthM),
      support_height_m: Math.max(
        mmToM(form.supportHeightM),
        !flags.underground && form.insulationEnabled ? (parseNumber(form.insulationThicknessMm) + 50) / 1000 : 0,
      ),
      support_weight_each_kg: parseNumber(form.supportWeightEachKg),
      R0_kPa: parseNumber(form.R0Kpa),
      ring_mode: form.ringMode,
      ring_count: parseNumber(form.ringCount),
      ring_offset_m: mmToM(form.ringOffsetM),
      ring_section_cm2: parseNumber(form.ringSectionCm2),
      ring_profile: form.ringProfile,
      ring_profile_height_mm: parseNumber(form.ringProfileHeightMm),
      ring_profile_width_mm: parseNumber(form.ringProfileWidthMm),
      ring_profile_web_mm: parseNumber(form.ringProfileWebMm),
      ring_profile_flange_mm: parseNumber(form.ringProfileFlangeMm),
      ring_flat_bar_on_edge: true,
      ring_stiffener_type: form.ringStiffenerType,
      diaphragm_brace_count: 3,
      rib_count: parseNumber(form.ribCount),
      rib_height_mm: parseNumber(form.ribHeightMm),
      rib_width_mm: parseNumber(form.ribWidthMm),
      rib_thickness_mm: parseNumber(form.ribThicknessMm),
      nozzle_count: form.nozzles.reduce((sum, item) => sum + Math.max(0, Math.trunc(parseNumber(item.count))), 0),
      nozzle_dn_mm: parseNumber(form.nozzles.find((item) => parseNumber(item.count) > 0)?.dnMm ?? form.nozzleDnMm),
      nozzle_length_mm: parseNumber(form.nozzles.find((item) => parseNumber(item.count) > 0)?.lengthMm ?? form.nozzleLengthMm),
      nozzle_thickness_mm: parseNumber(form.nozzles.find((item) => parseNumber(item.count) > 0)?.thicknessMm ?? form.nozzleThicknessMm),
      nozzles: form.nozzles.map((item) => ({
        name: item.name,
        count: Math.max(0, Math.trunc(parseNumber(item.count))),
        dn_mm: parseNumber(item.dnMm),
        length_mm: parseNumber(item.lengthMm),
        thickness_mm: parseNumber(item.thicknessMm),
      })),
      insulation_enabled: form.insulationEnabled,
      insulation_thickness_mm: parseNumber(form.insulationThicknessMm),
      insulation_density_kg_m3: parseNumber(form.insulationDensityKgM3),
      coating_thickness_mm: flags.underground ? 0 : parseNumber(form.coatingThicknessMm),
      coating_density_kg_m3: flags.underground ? 0 : parseNumber(form.coatingDensityKgM3),
      ladder: form.ladder,
      platform: flags.underground ? false : form.platform,
      manhole_count: parseNumber(form.manholeCount),
      neck_height_m: mmToM(form.neckHeightM),
      soil_preset: form.soilPreset,
      burial_depth_top_m: mmToM(form.burialDepthTopM),
      soil_density_kg_m3: parseNumber(form.soilDensityKgM3),
      soil_phi_deg: parseNumber(form.soilPhiDeg),
      soil_void_ratio: parseNumber(form.soilVoidRatio),
      gamma_f: 1.15,
      groundwater: form.groundwater,
      groundwater_level_m: mmToM(form.groundwaterLevelM),
      groundwater_density_kg_m3: parseNumber(form.groundwaterDensityKgM3),
      strap_spacing_m: mmToM(form.strapSpacingM),
      strap_allowable_mpa: parseNumber(form.strapAllowableMpa),
      outer_shell_gap_m: mmToM(form.outerShellGapM),
      outer_shell_nominal_mm: parseNumber(form.outerShellNominalMm),
    };
  }

  async function downloadRgsDocument(endpoint: string, filename: string) {
    setReportLoading(endpoint);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: buildPayload() }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось сформировать документ.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(friendlyRequestError(err, "Не удалось сформировать документ. Проверьте подключение к серверу расчёта."));
    } finally {
      setReportLoading(null);
    }
  }

  async function calculate() {
    const requestId = ++calculationRequestId.current;
    const targetType = activeType;
    setLoadingType(targetType);
    setError("");
    const payload = buildPayload();

    try {
      const response = await fetch("/api/calc/rgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (requestId !== calculationRequestId.current) return;
      setResults((prev) => ({
        ...prev,
        [targetType]: data?.result ?? null,
      }));
    } catch (err) {
      if (requestId !== calculationRequestId.current) return;
      const message = friendlyRequestError(err, "Сервер расчёта временно не ответил. Последние рассчитанные данные остаются на экране.");
      setError(results[targetType] ? "" : message);
    } finally {
      if (requestId === calculationRequestId.current) {
        setLoadingType(null);
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void calculate();
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeType, form]);

  const summary = result?.summary;
  const geometry = result?.details?.geometry;
  const masses = result?.details?.masses;
  const pressures = result?.details?.pressures;
  const shell = result?.details?.shell;
  const head = result?.details?.head;
  const supports = result?.details?.supports;
  const soil = result?.details?.soil;
  const nozzles = result?.details?.nozzles;
  const flotation = result?.details?.flotation;
  const insulationSupports = result?.details?.insulation_supports;
  const rings = result?.details?.rings;
  const checks = (result?.checks ?? []).filter((item) => item.code !== "RGS_SUPPORT_BEARING");
  const calculationCases = result?.calculation_cases ?? [];
  const protocol = (result?.protocol ?? []).filter((item) => item.code !== "RGS_SUPPORT_BEARING");
  const displayProtocol: ProtocolItem[] = protocol.length ? protocol : checks.map((check) => ({
    code: check.code,
    title: check.title,
    formula: check.formula || "Формула будет уточнена в инженерном протоколе backend.",
    inputs: check.inputs,
    value: check.value,
    limit: check.limit,
    unit: check.unit,
    margin: check.margin,
    result: check.result,
    reference: check.reference,
    note: check.note,
  }));
  const constructiveMinMm = flags.underground ? 5 : 4;
  const shellBaseMinMm = recommendedBaseMm(shell?.recommended_nominal_mm, parseNumber(form.corrMm), constructiveMinMm);
  const headBaseMinMm = recommendedBaseMm(head?.recommended_nominal_mm, parseNumber(form.headAllowancesMm), constructiveMinMm);

  useEffect(() => {
    const nextShell = shellBaseMinMm
      ? ceilWholeMm(shellBaseMinMm + parseNumber(form.corrMm))
      : "";
    const nextHead = headBaseMinMm
      ? ceilWholeMm(headBaseMinMm + parseNumber(form.headAllowancesMm))
      : "";
    if (!nextShell && !nextHead) return;

    const previousAuto = autoThicknessRef.current[activeType] ?? { shell: "", head: "" };
    let changed = false;

    setForms((prev) => {
      const current = prev[activeType];
      const updated = { ...current };

      if (nextShell) {
        const currentShell = parseNumber(current.shellNominalMm);
        const shellFirstAuto = previousAuto.shell === "";
        const shellWasAuto = !current.shellNominalMm || current.shellNominalMm === previousAuto.shell;
        if (shellFirstAuto || shellWasAuto || currentShell < parseNumber(nextShell)) {
          updated.shellNominalMm = nextShell;
          changed = changed || current.shellNominalMm !== nextShell;
        }
      }

      if (nextHead) {
        const currentHead = parseNumber(current.headNominalMm);
        const headFirstAuto = previousAuto.head === "";
        const headWasAuto = !current.headNominalMm || current.headNominalMm === previousAuto.head;
        if (headFirstAuto || headWasAuto || currentHead < parseNumber(nextHead)) {
          updated.headNominalMm = nextHead;
          changed = changed || current.headNominalMm !== nextHead;
        }
      }

      if (!changed) return prev;
      return { ...prev, [activeType]: updated };
    });

    autoThicknessRef.current[activeType] = {
      shell: nextShell || previousAuto.shell,
      head: nextHead || previousAuto.head,
    };
  }, [activeType, shellBaseMinMm, headBaseMinMm, form.corrMm, form.headAllowancesMm]);
  const warnings = result?.warnings ?? [];
  const normative = result?.normative ?? [];
  const activeNozzles = form.nozzles.filter((item) => parseNumber(item.count) > 0);
  const checkTotals = useMemo(() => {
    const failed = checks.filter((item) => String(item.result).toUpperCase().includes("FAIL")).length;
    const warned = checks.filter((item) => String(item.result).toUpperCase().includes("WARN")).length;
    const passed = checks.filter((item) => String(item.result).toUpperCase().includes("PASS") || String(item.result).toUpperCase().includes("OK")).length;
    return { failed, warned, passed, total: checks.length };
  }, [checks]);
  const headReinforcementStatus = useMemo(() => {
    if (form.headType === "flat") return "";
    if (!head || !pressures) return "после расчёта";
    return (head.allow_external_mpa ?? 0) + 1e-9 < (pressures.head_external_required_mpa ?? 0)
      ? "требуются"
      : "не требуются";
  }, [form.headType, head, pressures]);
  const livePreview = useMemo(() => {
    const diameterM = Math.max(0, mmToM(form.D));
    const totalLengthM = Math.max(0, mmToM(form.totalLengthM));
    const projectionM = calculatedHeadDepthMm / 1000;
    const shellLengthM = Math.max(0, totalLengthM - 2 * projectionM);
    const cylinderVolumeM3 = circleAreaM2(diameterM) * shellLengthM;
    const totalVolumeM3 = cylinderVolumeM3 + 2 * headVolumeEachM3(
      form.headType,
      diameterM,
      projectionM,
      form.headType === "truncated_cone" ? mmToM(form.headSmallDiameterM) : 0,
    );
    const rawFillValue = parseNumber(form.fillValue);
    const fillHeightM = form.fillMode === "level"
      ? clampNumber(rawFillValue / 1000, 0, diameterM)
      : clampNumber(diameterM * rawFillValue / 100, 0, diameterM);
    const cylinderFillFraction = diameterM > 0
      ? circularSegmentAreaM2(diameterM / 2, fillHeightM) / Math.max(circleAreaM2(diameterM), 1e-9)
      : 0;
    const productVolumeM3 = totalVolumeM3 * clampNumber(cylinderFillFraction, 0, 1);

    return {
      diameterM,
      totalLengthM,
      shellLengthM,
      totalVolumeM3,
      fillHeightM,
      productVolumeM3,
    };
  }, [form, calculatedHeadDepthMm, flags.underground]);
  const supportEstimate = useMemo(() => {
    const unit = estimateSupportUnit(
      livePreview.diameterM,
      mmToM(form.saddleWidthM),
      parseNumber(form.shellNominalMm),
      !flags.underground && form.insulationEnabled ? (parseNumber(form.insulationThicknessMm) + 50) / 1000 : 0,
      mmToM(form.supportHeightM, flags.underground ? 0 : 200),
    );
    const productMassKg = livePreview.productVolumeM3 * parseNumber(form.rho, 1000);
    const hydrotestMassKg = livePreview.totalVolumeM3 * 1000;
    const shellMassKg = Math.PI * livePreview.diameterM * livePreview.shellLengthM * (parseNumber(form.shellNominalMm) / 1000) * 7850;
    const dryMassWithoutSupportsKg = Math.max(0, shellMassKg);
    const userWeight = Math.max(0, parseNumber(form.supportWeightEachKg));
    const actualWeightEachKg = userWeight > 0 ? userWeight : unit.weightEachKg;
    const bearingAreaEachM2 = Math.max(0.1, mmToM(form.saddleWidthM) * Math.max(livePreview.diameterM, 0.8));
    const foundationLimitKpa = Math.max(1, parseNumber(form.R0Kpa, 200));
    const spanCount = Math.max(2, Math.ceil(Math.max(livePreview.shellLengthM, 0.1) / 6) + 1);
    let recommendedCount = spanCount;

    for (let candidate = spanCount; candidate <= 20; candidate += 1) {
      const operatingLoadKn = (dryMassWithoutSupportsKg + productMassKg + candidate * actualWeightEachKg) * 9.80665 / 1000;
      const hydrotestLoadKn = (dryMassWithoutSupportsKg + hydrotestMassKg + candidate * actualWeightEachKg) * 9.80665 / 1000;
      const pressureKpa = Math.max(operatingLoadKn, hydrotestLoadKn) / candidate / bearingAreaEachM2;
      if (pressureKpa <= foundationLimitKpa) {
        recommendedCount = candidate;
        break;
      }
    }

    const userCount = Math.max(0, Math.trunc(parseNumber(form.supportCount)));
    const actualCount = userCount > 0 ? userCount : recommendedCount;
    return {
      ...unit,
      recommendedCount,
      actualCount,
      actualWeightEachKg,
      totalMassKg: actualCount * actualWeightEachKg,
      bearingAreaEachM2,
      foundationLimitKpa,
    };
  }, [flags.underground, form, livePreview]);
  const reportSections = useMemo<ReportSection[]>(() => {
    const sections: ReportSection[] = [
      {
        title: "1. Исходные данные",
        rows: [
          { name: "Тип резервуара", value: activeType },
          { name: "Хранимый продукт", value: form.productName },
          { name: "Плотность продукта", value: formatNumber(parseNumber(form.rho), 0), unit: "кг/м³" },
          { name: "Район установки", value: [form.region, form.city].filter(Boolean).join(", ") || "не задан" },
          { name: "Ветровой район / w0", value: `${form.windRegion || "—"} / ${form.w0 || "—"}`, unit: "кПа" },
          { name: "Снеговой район / Sg", value: `${form.snowRegion || "—"} / ${form.sg || "—"}`, unit: "кПа" },
          { name: "Сейсмичность", value: form.seismic || "—" },
        ],
      },
      {
        title: "2. Геометрия резервуара",
        rows: [
          { name: "Внутренний диаметр D", value: formatNumber(parseNumber(form.D), 0), unit: "мм" },
          { name: "Общая длина", value: formatNumber(parseNumber(form.totalLengthM), 0), unit: "мм" },
          { name: "Длина обечайки", value: formatNumber((geometry?.shell_length_m ?? livePreview.shellLengthM) * 1000, 0), unit: "мм" },
          { name: "Тип днища", value: HEAD_LABELS[form.headType] },
          { name: "Геометрический объём", value: formatNumber(summary?.full_volume_m3 ?? livePreview.totalVolumeM3, 3), unit: "м³" },
          { name: "Объём продукта", value: formatNumber(summary?.product_volume_m3 ?? livePreview.productVolumeM3, 3), unit: "м³" },
          { name: "Уровень продукта", value: formatNumber((summary?.fill_height_m ?? livePreview.fillHeightM) * 1000, 0), unit: "мм" },
        ],
      },
      {
        title: "3. Материал и толщины",
        rows: [
          { name: "Материал", value: form.material },
          { name: "Обечайка, выбранная t", value: formatNumber(parseNumber(form.shellNominalMm), 0), unit: "мм" },
          { name: "Обечайка, эффективная t", value: formatNumber(shell?.effective_mm, 2), unit: "мм" },
          { name: "Обечайка, рекомендуемая t", value: formatNumber(shellBaseMinMm, 0), unit: "мм" },
          { name: "Обечайка, прибавка на коррозию", value: formatNumber(parseNumber(form.corrMm), 1), unit: "мм" },
          { name: "Днище, выбранная t", value: formatNumber(parseNumber(form.headNominalMm), 0), unit: "мм" },
          { name: "Днище, рекомендуемая t", value: formatNumber(headBaseMinMm, 0), unit: "мм" },
          { name: "Днище, прибавка на коррозию", value: formatNumber(parseNumber(form.headAllowancesMm), 1), unit: "мм" },
        ],
      },
      {
        title: "4. Кольца жесткости / диафрагмы",
        rows: [
          { name: "Рекомендованное количество", value: formatNumber(shell?.recommended_ring_count ?? shell?.fabrication_ring_count, 0), unit: "шт." },
          { name: "Желаемое количество", value: formatNumber(parseNumber(form.ringCount), 0), unit: "шт." },
          { name: "Тип элемента", value: rings?.stiffener_type_label || (form.ringStiffenerType === "diaphragm" ? "Диафрагма" : "Кольцо жесткости") },
          { name: "Профиль", value: rings?.label || "—" },
          { name: "Ориентация полосы", value: rings?.orientation || "—" },
          { name: "Площадь сечения", value: formatNumber(rings?.area_cm2, 2), unit: "см²" },
          { name: "Требуемая площадь", value: formatNumber(rings?.required_area_cm2 ?? undefined, 2), unit: "см²" },
          { name: "Момент сопротивления", value: formatNumber(rings?.section_modulus_cm3, 2), unit: "см³" },
          { name: "Требуемый момент сопротивления", value: formatNumber(rings?.required_section_modulus_cm3 ?? undefined, 2), unit: "см³" },
          { name: "Момент инерции", value: formatNumber(rings?.inertia_cm4, 2), unit: "см⁴" },
          { name: "Требуемый момент", value: formatNumber(rings?.required_inertia_cm4 ?? undefined, 2), unit: "см⁴" },
          { name: "Погонная нагрузка на кольцо", value: formatNumber(rings?.line_load_n_mm, 3), unit: "Н/мм" },
          { name: "Запас по площади / W / I", value: `${formatNumber(rings?.area_margin ?? undefined, 2)} / ${formatNumber(rings?.section_modulus_margin ?? undefined, 2)} / ${formatNumber(rings?.inertia_margin ?? undefined, 2)}` },
          { name: "Масса колец", value: formatNumber(masses?.ring_mass_kg, 1), unit: "кг" },
        ],
      },
      {
        title: "5. Нагрузки и давления",
        rows: [
          { name: "Рабочее внутреннее давление", value: formatNumber(pressures?.internal_design_mpa, 4), unit: "МПа" },
          { name: "Гидростатическая составляющая", value: formatNumber(pressures?.hydro_support_mpa, 4), unit: "МПа" },
          { name: "Итого внутреннее давление", value: formatNumber(pressures?.internal_total_mpa, 4), unit: "МПа" },
          { name: "Вакуум / внешнее давление", value: formatNumber(pressures?.vacuum_mpa, 4), unit: "МПа" },
          { name: "Требуемое внешнее давление обечайки", value: formatNumber(pressures?.external_required_mpa, 4), unit: "МПа" },
          { name: "Требуемое внешнее давление днища", value: formatNumber(pressures?.head_external_required_mpa, 4), unit: "МПа" },
        ],
      },
      {
        title: "6. Масса и комплектация",
        rows: [
          { name: "Масса обечайки", value: formatNumber(masses?.shell_mass_kg, 0), unit: "кг" },
          { name: "Масса днищ", value: formatNumber(masses?.head_total_mass_kg, 0), unit: "кг" },
          { name: "Масса патрубков", value: formatNumber(masses?.nozzle_mass_kg, 0), unit: "кг" },
          { name: "Масса опор", value: formatNumber(masses?.supports_mass_kg, 0), unit: "кг" },
          { name: "Масса крепления ТИ", value: formatNumber(masses?.insulation_supports_mass_kg, 0), unit: "кг" },
          { name: "Сухая масса", value: formatNumber(summary?.dry_mass_kg, 0), unit: "кг" },
          { name: "Рабочая масса", value: formatNumber(summary?.operating_mass_kg, 0), unit: "кг" },
        ],
      },
      {
        title: "7. Опоры и седла",
        rows: [
          { name: "Рекомендованное количество", value: formatNumber(supports?.recommended_support_count ?? supportEstimate.recommendedCount, 0), unit: "шт." },
          { name: "Принятое количество", value: formatNumber(supports?.support_count ?? supportEstimate.actualCount, 0), unit: "шт." },
          { name: "Высота седла", value: formatNumber((supports?.saddle_height_m ?? supportEstimate.saddleHeightM) * 1000, 0), unit: "мм" },
          { name: "Масса одной опоры", value: formatNumber(supports?.actual_weight_each_kg ?? supportEstimate.actualWeightEachKg, 1), unit: "кг" },
          { name: "Реакция на опору", value: formatNumber(supports?.reaction_each_kN, 2), unit: "кН" },
          { name: "Давление под седлом", value: formatNumber(supports?.foundation_pressure_kpa, 2), unit: "кПа" },
        ],
      },
    ];

    if (flags.underground) {
      sections.push({
        title: "8. Подземная установка",
        rows: [
          { name: "Глубина до верхней образующей", value: formatNumber((soil?.burial_depth_top_m ?? 0) * 1000, 0), unit: "мм" },
          { name: "Профиль грунта", value: soil?.preset || "—" },
          { name: "Вертикальное давление грунта", value: formatNumber(soil?.vertical_kpa, 2), unit: "кПа" },
          { name: "Боковое давление грунта", value: formatNumber(soil?.horizontal_kpa, 2), unit: "кПа" },
          { name: "Всплытие нетто", value: formatNumber(flotation?.net_uplift_kN, 2), unit: "кН" },
          { name: "Хомуты", value: formatNumber(flotation?.strap_count, 0), unit: "шт." },
        ],
      });
    }

    return sections;
  }, [activeType, flags.underground, flotation, form, geometry, head, livePreview, masses, pressures, rings, shell, soil, summary, supportEstimate, supports]);

  return (
    <div className="container">
      <Seo
        title="РГС калькулятор | Резервуаростроение"
        description="Инженерный расчёт горизонтальных стальных резервуаров РГСН, РГСП, РГСНД и РГСПД с подбором геометрии, толщин, колец жёсткости, опор, хомутов и комплектации."
        canonical="https://rezervuarostroenie.ru/calc/rgs"
      />

      <div className="grid" style={{ gap: 16 }}>
        <div className="card pad">
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>Калькулятор РГС</h1>
          <div className="muted" style={{ marginTop: 8 }}>
            Подбор и проверка горизонтальных стальных резервуаров для наземного и подземного исполнения.
            Калькулятор помогает оценить геометрию, толщины, кольца жёсткости, опоры, хомуты, комплектацию и
            сформировать расчётные материалы для дальнейшего проектирования.
          </div>
        </div>

        <div className="calc-layout">
          <aside className="card pad side sticky-side">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>РГС калькулятор</div>
            <div className="muted" style={{ marginBottom: 14 }}>
              {activeType} · {TYPE_META[activeType].title}
            </div>

            {visibleSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={activeSection === section.id ? "side-link active" : "side-link"}
                onClick={() => goToSection(section.id)}
              >
                <span>{section.label}</span>
                <small>{section.note}</small>
              </button>
            ))}

          </aside>

          <main className="grid" style={{ gap: 16 }}>
            <div id="rgs-type" className="card panel-card" style={{ scrollMarginTop: 96, display: activeSection === "type" ? undefined : "none" }}>
              <div className="panel-title">1. Тип исполнения</div>
              <div className="row4">
                {TANK_TYPES.map((tankType) => {
                  const isDisabled = DISABLED_TANK_TYPES.includes(tankType);
                  return (
                    <button
                      key={tankType}
                      type="button"
                      className={`${activeType === tankType ? "side-link active" : "side-link"}${isDisabled ? " disabled" : ""}`}
                      onClick={() => updateTankType(tankType)}
                      style={{ minHeight: 116 }}
                      disabled={isDisabled}
                    >
                      <span>{tankType}</span>
                      <small>{TYPE_META[tankType].title}</small>
                      {isDisabled ? <small className="status-note">В разработке</small> : null}
                    </button>
                  );
                })}
              </div>
              <div className="hint-block" style={{ marginTop: 14 }}>
                <b>{activeType}</b> — {TYPE_META[activeType].note}
              </div>
            </div>

            <div id="rgs-main" className="grid" style={{ gap: 16, scrollMarginTop: 96, display: activeSection === "main" ? undefined : "none" }}>
              <div className="card panel-card">
                <div className="panel-title">2. Основные данные</div>
                <div className="muted">Среда, район установки и типоразмер резервуара.</div>
              </div>

              <div className="card panel-card">
                <div className="panel-title">Среда</div>
                <div className="row2">
                  <div className="field">
                    <label>Продукт</label>
                    <select value={form.productName} onChange={(e) => updateProduct(e.target.value)}>
                      {PRODUCT_OPTIONS.map((product) => (
                        <option key={product.name} value={product.name}>{product.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Плотность продукта</label>
                    <div className="input-unit">
                      <input value={form.rho} onChange={(e) => updateForm("rho", e.target.value)} />
                      <span className="unit-chip">кг/м³</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card panel-card">
                <div className="panel-title">Регион установки</div>
                <div className="row2">
                  <div className="field">
                    <label>Регион / субъект РФ</label>
                    <select value={form.region} onChange={(e) => updateRegion(e.target.value)}>
                      <option value="">Не выбран</option>
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Город / населённый пункт</label>
                    <select value={form.city} onChange={(e) => updateCity(e.target.value)} disabled={!form.region}>
                      <option value="">Не выбран</option>
                      {cityOptions.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                  <button type="button" className="btn" onClick={applySiteNorms} disabled={!form.region || !form.city || siteLookupState === "loading"}>
                    {siteLookupState === "loading" ? "Подстановка..." : "Подставить нормативы по региону/городу"}
                  </button>
                  {siteLookupState === "done" && <span className="muted">Нормативы обновлены.</span>}
                  {siteLookupState === "error" && <span style={{ color: "#b42318", fontWeight: 700 }}>Не удалось найти нормативы для выбранного населённого пункта.</span>}
                </div>

                <div className="row3" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label>Ветровой район</label>
                    <select value={form.windRegion} onChange={(e) => updateForm("windRegion", e.target.value)}>
                      {["Iа", "I", "II", "III", "IV", "V", "VI", "VII"].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Ветровая нагрузка</label>
                    <div className="input-unit">
                      <input value={form.w0} onChange={(e) => updateForm("w0", e.target.value)} />
                      <span className="unit-chip">кПа</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Снеговой район</label>
                    <select value={form.snowRegion} onChange={(e) => updateForm("snowRegion", e.target.value)}>
                      {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                </div>

                <div className="row3" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label>Снеговая нагрузка</label>
                    <div className="input-unit">
                      <input value={form.sg} onChange={(e) => updateForm("sg", e.target.value)} />
                      <span className="unit-chip">кПа</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Минус пятидневки</label>
                    <div className="input-unit">
                      <input value={form.t5} onChange={(e) => updateForm("t5", e.target.value)} />
                      <span className="unit-chip">°C</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Абсолютный минус</label>
                    <div className="input-unit">
                      <input value={form.tminAbs} onChange={(e) => updateForm("tminAbs", e.target.value)} />
                      <span className="unit-chip">°C</span>
                    </div>
                  </div>
                </div>

                <div className="row2" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label>Сейсмичность района</label>
                    <select value={form.seismic} onChange={(e) => updateForm("seismic", e.target.value)}>
                      {["5", "6", "7", "8", "9"].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Степень сейсмоопасности ОСР-97</label>
                    <select value={form.seisLevel} onChange={(e) => updateForm("seisLevel", e.target.value as RgsForm["seisLevel"])}>
                      {["A", "B", "C"].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="card panel-card">
                <div className="panel-title">Типоразмеры</div>
                <div className="row2">
                  <div className="field">
                    <label>Типоразмер</label>
                    <select value={form.standardSizeKey} onChange={(e) => updateStandardSize(e.target.value)}>
                      {RGS_SIZE_PRESETS.map((preset) => (
                        <option key={preset.key} value={preset.key}>{preset.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Геометрический объём</label>
                    <div className="input-unit">
                      <input value={formatNumber(livePreview.totalVolumeM3, 3)} readOnly />
                      <span className="unit-chip">м³</span>
                    </div>
                  </div>
                </div>

                <div className="row2" style={{ marginTop: 14 }}>
                  <div className="field">
                    <label>Диаметр D</label>
                    <div className="input-unit">
                      <input value={form.D} onChange={(e) => updateDimension("D", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Общая длина</label>
                    <div className="input-unit">
                      <input value={form.totalLengthM} onChange={(e) => updateDimension("totalLengthM", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                </div>
              </div>

              {flags.underground ? (
                <>
                  <div className="card panel-card">
                    <div className="panel-title">Грунт и засыпка</div>
                    <div className="row4">
                      <div className="field">
                        <label>Профиль грунта</label>
                        <select value={form.soilPreset} onChange={(e) => updateForm("soilPreset", e.target.value as SoilPreset)}>
                          {SOIL_OPTIONS.map((soil) => (
                            <option key={soil.value} value={soil.value}>{soil.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Глубина засыпки</label>
                        <div className="input-unit">
                          <input value={form.burialDepthTopM} onChange={(e) => updateBurialDepth(e.target.value)} />
                          <span className="unit-chip">мм</span>
                        </div>
                      </div>
                      <div className="field">
                        <label>Плотность грунта</label>
                        <div className="input-unit">
                          <input value={form.soilDensityKgM3} onChange={(e) => updateForm("soilDensityKgM3", e.target.value)} />
                          <span className="unit-chip">кг/м³</span>
                        </div>
                      </div>
                      <div className="field">
                        <label>Угол внутреннего трения</label>
                        <div className="input-unit">
                          <input value={form.soilPhiDeg} onChange={(e) => updateForm("soilPhiDeg", e.target.value)} />
                          <span className="unit-chip">°</span>
                        </div>
                      </div>
                    </div>
                    <div className="row2" style={{ marginTop: 14 }}>
                      <div className="field">
                        <label>Коэффициент пористости</label>
                        <div className="input-unit">
                          <input value={form.soilVoidRatio} onChange={(e) => updateForm("soilVoidRatio", e.target.value)} />
                          <span className="unit-chip">e</span>
                        </div>
                      </div>
                      <div className="field">
                        <label>Давление грунта</label>
                        <div className="input-unit">
                          <input value={soil?.average_kpa ? formatNumber(soil.average_kpa, 2) : "после расчёта"} readOnly />
                          <span className="unit-chip">кПа</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card panel-card">
                    <div className="panel-title">Грунтовые воды</div>
                    <div className="row3">
                      <label className="checkbox-card" aria-label="Грунтовые воды">
                        <input
                          type="checkbox"
                          checked={form.groundwater}
                          onChange={(e) => updateForm("groundwater", e.target.checked)}
                        />
                        <span>Грунтовые воды</span>
                      </label>
                      <div className="field">
                        <label>Уровень грунтовых вод</label>
                        <div className="input-unit">
                          <input
                            value={form.groundwaterLevelM}
                            onChange={(e) => updateForm("groundwaterLevelM", e.target.value)}
                            disabled={!form.groundwater}
                          />
                          <span className="unit-chip">мм</span>
                        </div>
                      </div>
                      <div className="field">
                        <label>Плотность воды</label>
                        <div className="input-unit">
                          <input
                            value={form.groundwaterDensityKgM3}
                            onChange={(e) => updateForm("groundwaterDensityKgM3", e.target.value)}
                            disabled={!form.groundwater}
                          />
                          <span className="unit-chip">кг/м³</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="card panel-card">
                <div className="panel-title">Режим работы</div>
                <div className="row3">
                  <div className="field">
                    <label>Температура</label>
                    <div className="input-unit">
                      <input value={form.temperatureC} onChange={(e) => updateForm("temperatureC", e.target.value)} />
                      <span className="unit-chip">°C</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Внутреннее давление</label>
                    <div className="input-unit">
                      <input value={form.designPressureMpa} onChange={(e) => updateForm("designPressureMpa", e.target.value)} />
                      <span className="unit-chip">МПа</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Вакуум / внешнее давление</label>
                    <div className="input-unit">
                      <input value={form.vacuumMpa} onChange={(e) => updateForm("vacuumMpa", e.target.value)} />
                      <span className="unit-chip">МПа</span>
                    </div>
                  </div>
                </div>

                <div className="row3" style={{ marginTop: 14 }}>
                  <div className="field">
                    <label>Режим заполнения</label>
                    <div className="segmented">
                      <button
                        type="button"
                        className={form.fillMode === "percent" ? "segmented-item active" : "segmented-item"}
                        onClick={() => updateFillMode("percent")}
                      >
                        По уровню, %
                      </button>
                      <button
                        type="button"
                        className={form.fillMode === "level" ? "segmented-item active" : "segmented-item"}
                        onClick={() => updateFillMode("level")}
                      >
                        По уровню, мм
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <label>{form.fillMode === "percent" ? "Процент от диаметра" : "Высота продукта"}</label>
                    <div className="input-unit">
                      <input value={form.fillValue} onChange={(e) => updateForm("fillValue", e.target.value)} />
                      <span className="unit-chip">{fillUnit}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="rgs-characteristics" className="grid" style={{ gap: 16, display: activeSection === "characteristics" ? undefined : "none" }}>
              <div className="card panel-card">
                <div className="panel-title">3. Основные характеристики</div>
                <div className="muted">Расчётные минимальные толщины, желаемые толщины и параметры проверки.</div>
              </div>

              <div className="card panel-card">
                <div className="panel-title">Материал и припуски</div>
                <div className="row4">
                  <div className="field">
                    <label>Материал</label>
                    <select value={form.material} onChange={(e) => updateForm("material", e.target.value as Material)}>
                      <option value="09G2S">09Г2С</option>
                      <option value="St3">Ст3</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Минусовой допуск</label>
                    <div className="input-unit">
                      <input value={form.minusToleranceMm} onChange={(e) => updateForm("minusToleranceMm", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                </div>
                {flags.underground ? (
                  <div className="hint-block" style={{ marginTop: 14 }}>
                    Для РГСП t min расч. показывает подобранную номинальную толщину с конструктивным минимумом 5 мм по ГОСТ 17032-2022, п. 5.2.4. Если расчёт по давлению и грунту требует меньше, отображается 5 мм.
                  </div>
                ) : null}
              </div>

              <div className="card panel-card">
                <div className="panel-title">Обечайка</div>
                <div className="row4">
                  <div className="field">
                    <label>t min расч.</label>
                    <div className="input-unit">
                      <input value={shellBaseMinMm ? formatNumber(shellBaseMinMm, 0) : "после расчёта"} readOnly />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>t желаемая</label>
                    <div className="input-unit">
                      <input value={form.shellNominalMm} onChange={(e) => updateForm("shellNominalMm", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Прибавка на коррозию</label>
                    <div className="input-unit">
                      <input value={form.corrMm} onChange={(e) => updateForm("corrMm", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Эффективная t</label>
                    <div className="input-unit">
                      <input value={shell?.effective_mm ? formatNumber(shell.effective_mm, 2) : "после расчёта"} readOnly />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Длина стенки</label>
                    <div className="input-unit">
                      <input value={shell?.spacing_mm ? formatNumber(shell.spacing_mm, 0) : "после расчёта"} readOnly />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card panel-card">
                <div className="panel-title">Кольца жесткости / диафрагмы</div>
                <div className="row4">
                  <div className="field">
                    <label>Статус проверки</label>
                    <input value={ringStatusLabel(rings)} readOnly />
                  </div>
                  <div className="field">
                    <label>Тип элемента</label>
                    <select value={form.ringStiffenerType} onChange={(e) => updateForm("ringStiffenerType", e.target.value as RingStiffenerType)}>
                      <option value="ring">Кольцо жесткости</option>
                      <option value="diaphragm">Диафрагма</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Рекоменд. количество</label>
                    <div className="input-unit">
                      <input value={formatNumber(shell?.recommended_ring_count ?? shell?.fabrication_ring_count, 0)} readOnly />
                      <span className="unit-chip">шт.</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Желаемое количество</label>
                    <div className="input-unit">
                      <input value={form.ringCount} onChange={(e) => updateRingCount(e.target.value)} />
                      <span className="unit-chip">шт.</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Тип профиля</label>
                    <select value={form.ringProfile} onChange={(e) => updateRingProfile(e.target.value as RingProfile)}>
                      <option value="angle_equal">Уголок</option>
                      <option value="flat_bar">Полоса</option>
                      <option value="channel">Швеллер</option>
                      <option value="ibeam">Двутавр</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Типоразмер профиля</label>
                    <select value={form.ringProfileSizeKey} onChange={(e) => updateRingProfileSize(e.target.value)}>
                      {RING_PROFILE_SIZES[form.ringProfile].map((size) => (
                        <option key={size.key} value={size.key}>{size.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Размеры профиля</label>
                    <input value={
                      form.ringProfile === "flat_bar"
                        ? `${form.ringProfileHeightMm}x${form.ringProfileFlangeMm}, торцом`
                        : `${form.ringProfileHeightMm}x${form.ringProfileWidthMm}x${form.ringProfileWebMm}/${form.ringProfileFlangeMm}`
                    } readOnly />
                  </div>
                  <div className="field">
                    <label>Расч. площадь</label>
                    <div className="input-unit">
                      <input value={formatNumber(rings?.area_cm2, 2)} readOnly />
                      <span className="unit-chip">см²</span>
                    </div>
                  </div>
                </div>

                <div className="row3" style={{ marginTop: 14 }}>
                  <div className="field">
                    <label>Требуемая площадь</label>
                    <div className="input-unit">
                      <input value={rings?.required_area_cm2 != null ? formatNumber(rings.required_area_cm2, 2) : "—"} readOnly />
                      <span className="unit-chip">см²</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Момент сопротивления</label>
                    <div className="input-unit">
                      <input value={formatNumber(rings?.section_modulus_cm3, 2)} readOnly />
                      <span className="unit-chip">см³</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Требуемый W</label>
                    <div className="input-unit">
                      <input value={rings?.required_section_modulus_cm3 != null ? formatNumber(rings.required_section_modulus_cm3, 2) : "—"} readOnly />
                      <span className="unit-chip">см³</span>
                    </div>
                  </div>
                </div>

                <div className="row3" style={{ marginTop: 14 }}>
                  <div className="field">
                    <label>Момент инерции</label>
                    <div className="input-unit">
                      <input value={formatNumber(rings?.inertia_cm4, 2)} readOnly />
                      <span className="unit-chip">см⁴</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Требуемый момент</label>
                    <div className="input-unit">
                      <input value={rings?.required_inertia_cm4 != null ? formatNumber(rings.required_inertia_cm4, 2) : "—"} readOnly />
                      <span className="unit-chip">см⁴</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Масса колец</label>
                    <div className="input-unit">
                      <input value={formatNumber(masses?.ring_mass_kg, 1)} readOnly />
                      <span className="unit-chip">кг</span>
                    </div>
                  </div>
                </div>
                {form.ringStiffenerType === "diaphragm" && (
                  <div className="row4" style={{ marginTop: 14 }}>
                    <div className="field">
                      <label>Раскосы диафрагмы</label>
                      <div className="input-unit">
                        <input value={formatNumber(rings?.diaphragm_brace_count ?? 3, 0)} readOnly />
                        <span className="unit-chip">шт.</span>
                      </div>
                    </div>
                    <div className="field">
                      <label>Эффективная полоса обечайки</label>
                      <div className="input-unit">
                        <input value={formatNumber(rings?.shell_effective_width_mm, 0)} readOnly />
                        <span className="unit-chip">мм</span>
                      </div>
                    </div>
                    <div className="field">
                      <label>Площадь обечайки в работе</label>
                      <div className="input-unit">
                        <input value={formatNumber(rings?.shell_effective_area_cm2, 2)} readOnly />
                        <span className="unit-chip">см²</span>
                      </div>
                    </div>
                    <div className="field">
                      <label>Масса 1 диафрагмы</label>
                      <div className="input-unit">
                        <input value={formatNumber(rings?.single_stiffener_mass_kg, 1)} readOnly />
                        <span className="unit-chip">кг</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="row4" style={{ marginTop: 14 }}>
                  <div className="field">
                    <label>Расч. внешнее давление</label>
                    <div className="input-unit">
                      <input value={formatNumber(pressures?.external_required_mpa, 4)} readOnly />
                      <span className="unit-chip">МПа</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Погонная нагрузка</label>
                    <div className="input-unit">
                      <input value={formatNumber(rings?.line_load_n_mm, 3)} readOnly />
                      <span className="unit-chip">Н/мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Сжимающее усилие</label>
                    <div className="input-unit">
                      <input value={formatNumber((rings?.hoop_force_n ?? 0) / 1000, 2)} readOnly />
                      <span className="unit-chip">кН</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Изгибающий момент</label>
                    <div className="input-unit">
                      <input value={formatNumber((rings?.bending_moment_n_mm ?? 0) / 1000000, 3)} readOnly />
                      <span className="unit-chip">кН·м</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Запас A/W/I</label>
                    <div className="input-unit">
                      <input value={`${formatNumber(rings?.area_margin ?? undefined, 2)} / ${formatNumber(rings?.section_modulus_margin ?? undefined, 2)} / ${formatNumber(rings?.inertia_margin ?? undefined, 2)}`} readOnly />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card panel-card">
                <div className="panel-title">Днища</div>
                <div className="row4">
                  <div className="field">
                    <label>Тип днища</label>
                    <select value={form.headType} onChange={(e) => updateForm("headType", e.target.value as HeadType)}>
                      <option value="flat">Плоские</option>
                      <option value="cone">Конические</option>
                      <option value="truncated_cone">Усечённо-конические</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>t min расч.</label>
                    <div className="input-unit">
                      <input value={headBaseMinMm ? formatNumber(headBaseMinMm, 0) : "после расчёта"} readOnly />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>t желаемая</label>
                    <div className="input-unit">
                      <input value={form.headNominalMm} onChange={(e) => updateForm("headNominalMm", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Прибавка на коррозию</label>
                    <div className="input-unit">
                      <input value={form.headAllowancesMm} onChange={(e) => updateForm("headAllowancesMm", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  {form.headType !== "flat" ? (
                    <div className="field">
                      <label>Угол конуса к оси</label>
                      <div className="input-unit">
                        <input value={form.headConeAngleDeg} onChange={(e) => updateForm("headConeAngleDeg", e.target.value)} />
                        <span className="unit-chip">°</span>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="row2" style={{ marginTop: 14 }}>
                  {form.headType === "truncated_cone" ? (
                    <div className="field">
                      <label>Малое основание</label>
                      <div className="input-unit">
                        <input value={form.headSmallDiameterM} onChange={(e) => updateForm("headSmallDiameterM", e.target.value)} />
                        <span className="unit-chip">мм</span>
                      </div>
                    </div>
                  ) : null}
                  {form.headType !== "flat" ? (
                    <div className="field">
                      <label>Расч. глубина днища</label>
                      <div className="input-unit">
                        <input value={formatNumber(calculatedHeadDepthMm, 0)} readOnly />
                        <span className="unit-chip">мм</span>
                      </div>
                    </div>
                  ) : null}
                  <div className="field">
                    <label>Допускаемое внешнее давление</label>
                    <div className="input-unit">
                      <input value={head?.allow_external_mpa ? formatNumber(head.allow_external_mpa, 4) : "после расчёта"} readOnly />
                      <span className="unit-chip">МПа</span>
                    </div>
                  </div>
                </div>
              </div>

              {form.headType === "flat" ? (
                <div className="card panel-card">
                  <div className="panel-title">Рёбра усиления плоского днища</div>
                  <div className="row4">
                    <div className="field">
                      <label>Количество рёбер</label>
                      <div className="input-unit">
                        <input value={form.ribCount} onChange={(e) => updateForm("ribCount", e.target.value)} />
                        <span className="unit-chip">шт.</span>
                      </div>
                    </div>
                    <div className="field">
                      <label>Высота ребра</label>
                      <div className="input-unit">
                        <input value={form.ribHeightMm} onChange={(e) => updateForm("ribHeightMm", e.target.value)} />
                        <span className="unit-chip">мм</span>
                      </div>
                    </div>
                    <div className="field">
                      <label>Ширина/полка ребра</label>
                      <div className="input-unit">
                        <input value={form.ribWidthMm} onChange={(e) => updateForm("ribWidthMm", e.target.value)} />
                        <span className="unit-chip">мм</span>
                      </div>
                    </div>
                    <div className="field">
                      <label>Толщина ребра</label>
                      <div className="input-unit">
                        <input value={form.ribThicknessMm} onChange={(e) => updateForm("ribThicknessMm", e.target.value)} />
                        <span className="unit-chip">мм</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card panel-card">
                  <div className="panel-title">Рёбра усиления днища</div>
                  <div className="row2">
                    <div className="field">
                      <label>Необходимость рёбер</label>
                      <div className="input-unit">
                        <input value={headReinforcementStatus} readOnly />
                      </div>
                    </div>
                    <div className="field">
                      <label>Критерий</label>
                      <div className="hint-block" style={{ minHeight: 42 }}>
                        По расчётному внешнему давлению и несущей способности выбранного днища.
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div id="rgs-equipment" className="grid" style={{ gap: 16, display: activeSection === "equipment" ? undefined : "none" }}>
              <div className="card panel-card">
                <div className="panel-title">4. Комплектация</div>
                <div className="muted">Патрубки, люки, навесное оборудование, покрытия, опоры, хомуты и подземная часть.</div>
              </div>

              <div className="card panel-card">
                <div className="panel-title">Патрубки</div>
                <div className="stack">
                  {form.nozzles.map((nozzle, index) => (
                    <div key={index} className="hint-block">
                      <div className="row4">
                        <div className="field">
                          <label>Назначение</label>
                          <input value={nozzle.name} onChange={(e) => updateNozzle(index, "name", e.target.value)} />
                        </div>
                        <div className="field">
                          <label>Количество</label>
                          <div className="input-unit">
                            <input value={nozzle.count} onChange={(e) => updateNozzle(index, "count", e.target.value)} />
                            <span className="unit-chip">шт.</span>
                          </div>
                        </div>
                        <div className="field">
                          <label>DN</label>
                          <div className="input-unit">
                            <input value={nozzle.dnMm} onChange={(e) => updateNozzle(index, "dnMm", e.target.value)} />
                            <span className="unit-chip">мм</span>
                          </div>
                        </div>
                        <div className="field">
                          <label>Длина</label>
                          <div className="input-unit">
                            <input value={nozzle.lengthMm} onChange={(e) => updateNozzle(index, "lengthMm", e.target.value)} />
                            <span className="unit-chip">мм</span>
                          </div>
                        </div>
                      </div>
                      <div className="row2" style={{ marginTop: 10 }}>
                        <div className="field">
                          <label>Толщина стенки</label>
                          <div className="input-unit">
                            <input value={nozzle.thicknessMm} onChange={(e) => updateNozzle(index, "thicknessMm", e.target.value)} />
                            <span className="unit-chip">мм</span>
                          </div>
                        </div>
                        <div className="field">
                          <label>Примечание</label>
                          <div className="hint-block" style={{ minHeight: 42 }}>
                            Позиция {index + 1} из 5 учитывается в массе и проверке патрубков, если количество больше нуля.
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card panel-card">
                <div className="panel-title">Навесное оборудование</div>
                <div className="row2">
                <label className="checkbox-card">
                  <input type="checkbox" checked={form.ladder} onChange={(e) => updateForm("ladder", e.target.checked)} />
                  <span>Лестница внутренняя</span>
                </label>
                {!flags.underground ? (
                  <label className="checkbox-card">
                    <input type="checkbox" checked={form.platform} onChange={(e) => updateForm("platform", e.target.checked)} />
                    <span>Площадка лестницы</span>
                  </label>
                ) : null}
              </div>
              </div>

              <div className="card panel-card">
                <div className="panel-title">{flags.underground ? "ППУ изоляция" : "Изоляция и покрытия"}</div>
                <div className={flags.underground ? "row3" : "row4"}>
                <label className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={form.insulationEnabled}
                    onChange={(e) => updateForm("insulationEnabled", e.target.checked)}
                  />
                  <span>{flags.underground ? "ППУ изоляция" : "Теплоизоляция"}</span>
                </label>
                <div className="field">
                  <label>{flags.underground ? "Толщина ППУ" : "Толщина изоляции"}</label>
                  <div className="input-unit">
                    <input
                      value={form.insulationThicknessMm}
                      onChange={(e) => updateForm("insulationThicknessMm", e.target.value)}
                      disabled={!form.insulationEnabled}
                    />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>{flags.underground ? "Плотность ППУ" : "Плотность изоляции"}</label>
                  <div className="input-unit">
                    <input
                      value={form.insulationDensityKgM3}
                      onChange={(e) => updateForm("insulationDensityKgM3", e.target.value)}
                      disabled={!form.insulationEnabled}
                    />
                    <span className="unit-chip">кг/м³</span>
                  </div>
                </div>
                {!flags.underground ? (
                  <div className="field">
                    <label>Толщина покрытия</label>
                    <div className="input-unit">
                      <input value={form.coatingThicknessMm} onChange={(e) => updateForm("coatingThicknessMm", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                ) : null}
              </div>
              {form.insulationEnabled ? (
                <div className="hint-block" style={{ marginTop: 14 }}>
                  {flags.underground
                    ? "Для подземного исполнения учитывается масса ППУ. Металлическое крепление теплоизоляции и покрытие не добавляются."
                    : "Крепление ТИ считается автоматически: кольца из полосы 40x4 по краям обечайки и с шагом 500 мм, Т-образные проставки с шагом по окружности и по лучам днищ не более 300 мм."}
                </div>
              ) : null}
            </div>

            <div className="card panel-card">
              <div className="panel-title">Опоры</div>
              <div className="row4">
                <div className="field">
                  <label>Рекоменд. количество</label>
                  <div className="input-unit">
                    <input value={formatNumber(supports?.recommended_support_count ?? supportEstimate.recommendedCount, 0)} readOnly />
                    <span className="unit-chip">шт.</span>
                  </div>
                </div>
                <div className="field">
                  <label>Желаемое количество</label>
                  <div className="input-unit">
                    <input value={form.supportCount} onChange={(e) => updateForm("supportCount", e.target.value)} />
                    <span className="unit-chip">шт.</span>
                  </div>
                </div>
                <div className="field">
                  <label>Вес расч. 1 ед.</label>
                  <div className="input-unit">
                    <input value={formatNumber(supports?.calculated_weight_each_kg ?? supportEstimate.weightEachKg, 1)} readOnly />
                    <span className="unit-chip">кг</span>
                  </div>
                </div>
                <div className="field">
                  <label>Вес польз. 1 ед.</label>
                  <div className="input-unit">
                    <input value={form.supportWeightEachKg} onChange={(e) => updateForm("supportWeightEachKg", e.target.value)} />
                    <span className="unit-chip">кг</span>
                  </div>
                </div>
              </div>
              <div className="row3" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Высота опоры</label>
                  <div className="input-unit">
                    <input
                      value={form.supportHeightM}
                      onChange={(e) => updateSupportHeight(e.target.value)}
                      onBlur={normalizeSupportHeight}
                    />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Ширина седла опоры</label>
                  <div className="input-unit">
                    <input value={form.saddleWidthM} onChange={(e) => updateForm("saddleWidthM", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Вес опор итоговый</label>
                  <div className="input-unit">
                    <input value={formatNumber(supports?.total_mass_kg ?? supportEstimate.totalMassKg, 1)} readOnly />
                    <span className="unit-chip">кг</span>
                  </div>
                </div>
              </div>
              <div className="row2" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Давление под седлом</label>
                  <div className="input-unit">
                    <input value={supports?.foundation_pressure_kpa ? formatNumber(supports.foundation_pressure_kpa, 2) : "после расчёта"} readOnly />
                    <span className="unit-chip">кПа</span>
                  </div>
                </div>
              </div>
              <div className="hint-block" style={{ marginTop: 14 }}>
                {supports?.base_length_m ? (
                  <>
                    Расчётное седло: длина основания {formatNumber((supports.base_length_m ?? 0) * 1000, 0)} мм,
                    высота {formatNumber((supports.saddle_height_m ?? 0) * 1000, 0)} мм,
                    минимум {formatNumber((supports.minimum_height_m ?? 0) * 1000, 0)} мм,
                    дуга опирания {formatNumber(supports.contact_angle_deg, 0)}°.
                    Масса 1 ед.: плита {formatNumber(supports.base_plate_mass_kg, 1)} кг,
                    стенки {formatNumber(supports.web_mass_kg, 1)} кг,
                    рёбра {formatNumber(supports.rib_mass_kg, 1)} кг,
                    накладка {formatNumber(supports.pad_mass_kg, 1)} кг,
                    косынки {formatNumber(supports.gusset_mass_kg, 1)} кг.
                  </>
                ) : (
                  <>
                    Предварительно: длина основания {formatNumber(supportEstimate.baseLengthM * 1000, 0)} мм,
                    высота {formatNumber(supportEstimate.saddleHeightM * 1000, 0)} мм,
                    минимум {formatNumber(supportEstimate.minHeightM * 1000, 0)} мм,
                    дуга опирания {formatNumber(supportEstimate.contactAngleDeg, 0)}°.
                  </>
                )}
              </div>
            </div>

            {flags.underground ? (
              <div className="card panel-card">
                <div className="panel-title">Хомуты</div>
                <div className="row4">
                  <div className="field">
                    <label>Шаг хомутов</label>
                    <div className="input-unit">
                      <input value={form.strapSpacingM} onChange={(e) => updateForm("strapSpacingM", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Доп. напряжение</label>
                    <div className="input-unit">
                      <input value={form.strapAllowableMpa} onChange={(e) => updateForm("strapAllowableMpa", e.target.value)} />
                      <span className="unit-chip">МПа</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Рекоменд. количество</label>
                    <div className="input-unit">
                      <input value={formatNumber(flotation?.strap_count, 0)} readOnly />
                      <span className="unit-chip">шт.</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Рекоменд. сечение</label>
                    <div className="input-unit">
                      <input
                        value={flotation?.recommended_width_mm && flotation?.recommended_thickness_mm
                          ? `${formatNumber(flotation.recommended_width_mm, 0)}x${formatNumber(flotation.recommended_thickness_mm, 0)}`
                          : "после расчёта"}
                        readOnly
                      />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                </div>
                <div className="hint-block" style={{ marginTop: 14 }}>
                  {form.groundwater
                    ? `Расчёт по всплытию: уровень воды ${formatNumber((flotation?.groundwater_level_m ?? parseNumber(form.groundwaterLevelM) / 1000) * 1000, 0)} мм, погружение ${formatNumber((flotation?.submerged_height_m ?? 0) * 1000, 0)} мм, нетто-всплытие ${formatNumber(flotation?.net_uplift_kN, 2)} кН.`
                    : "Хомуты от всплытия считаются после включения грунтовых вод."}
                </div>
              </div>
            ) : null}

            {flags.doubleWall ? (
              <div className="card panel-card">
                <div className="panel-title">Параметры двустенного исполнения</div>
                <div className="row3">
                  <div className="field">
                    <label>Зазор между оболочками</label>
                    <div className="input-unit">
                      <input value={form.outerShellGapM} onChange={(e) => updateForm("outerShellGapM", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Толщина наружной оболочки</label>
                    <div className="input-unit">
                      <input value={form.outerShellNominalMm} onChange={(e) => updateForm("outerShellNominalMm", e.target.value)} />
                      <span className="unit-chip">мм</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Принцип проверки</label>
                    <div className="hint-block" style={{ minHeight: 42 }}>
                      В расчёте выдаются масса и межстенный объём; прочность проверяется по внутренней оболочке.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            </div>

            {activeSection === "results" ? (
              <div id="rgs-results" className="grid" style={{ gap: 16 }}>
                <div className="card panel-card">
                  <div className="panel-title">Результаты расчёта</div>
                  <div className="stats-grid" style={{ marginTop: 14 }}>
                    <div className="stat-box">
                      <span className="muted">Проверок</span>
                      <b>{checkTotals.total || "—"}</b>
                    </div>
                    <div className="stat-box">
                      <span className="muted">OK</span>
                      <b>{checkTotals.passed || "—"}</b>
                    </div>
                    <div className="stat-box">
                      <span className="muted">Внимание</span>
                      <b>{checkTotals.warned || "—"}</b>
                    </div>
                    <div className="stat-box">
                      <span className="muted">Не OK</span>
                      <b>{checkTotals.failed || "—"}</b>
                    </div>
                  </div>
                </div>

                <div className="card panel-card">
                  <div className="panel-title">Исходные данные</div>
                  <div className="check-grid">
                    <div className="hint-block">
                      <b>Среда и режим</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Продукт: {form.productName}; плотность {formatNumber(parseNumber(form.rho), 0)} кг/м³; температура {formatNumber(parseNumber(form.temperatureC), 0)} °C; заполнение {form.fillMode === "percent" ? `${form.fillValue}%` : `${form.fillValue} мм`}.
                      </div>
                    </div>
                    <div className="hint-block">
                      <b>Габариты</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        D {formatNumber(parseNumber(form.D), 0)} мм; общая длина {formatNumber(parseNumber(form.totalLengthM), 0)} мм; геометрический объём {formatNumber(summary?.full_volume_m3 ?? livePreview.totalVolumeM3, 3)} м³; тип днища: {HEAD_LABELS[form.headType]}.
                      </div>
                    </div>
                    <div className="hint-block">
                      <b>Выбранные толщины</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Обечайка {formatNumber(parseNumber(form.shellNominalMm), 0)} мм, прибавка на коррозию {formatNumber(parseNumber(form.corrMm), 1)} мм; днище {formatNumber(parseNumber(form.headNominalMm), 0)} мм, прибавка на коррозию {formatNumber(parseNumber(form.headAllowancesMm), 1)} мм; минусовой допуск {formatNumber(parseNumber(form.minusToleranceMm), 1)} мм.
                      </div>
                    </div>
                    <div className="hint-block">
                      <b>Район установки</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        {form.region || "Регион не задан"}{form.city ? `, ${form.city}` : ""}; ветер {form.windRegion || "—"} / {form.w0 || "—"} кПа; снег {form.snowRegion || "—"} / {form.sg || "—"} кПа; сейсмика {form.seismic || "—"}.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card panel-card">
                  <div className="panel-title">Геометрия и массы</div>
                  <div className="check-grid">
                    <div className="hint-block">
                      <b>Геометрия</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Обечайка {formatNumber((geometry?.shell_length_m ?? livePreview.shellLengthM) * 1000, 0)} мм; наружная площадь {formatNumber(geometry?.external_surface_area_m2, 2)} м²; высота продукта {formatNumber((summary?.fill_height_m ?? livePreview.fillHeightM) * 1000, 0)} мм.
                      </div>
                    </div>
                    <div className="hint-block">
                      <b>Масса</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Металл {formatNumber(summary?.steel_mass_kg, 0)} кг; сухая масса {formatNumber(summary?.dry_mass_kg, 0)} кг; рабочая масса {formatNumber(summary?.operating_mass_kg, 0)} кг; гидроиспытание {formatNumber(summary?.hydrotest_mass_kg, 0)} кг.
                      </div>
                    </div>
                    <div className="hint-block">
                      <b>Разбивка металла</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Обечайка {formatNumber(masses?.shell_mass_kg, 0)} кг; днища {formatNumber(masses?.head_total_mass_kg, 0)} кг; патрубки {formatNumber(masses?.nozzle_mass_kg, 0)} кг; опоры {formatNumber(masses?.supports_mass_kg, 0)} кг; крепление ТИ {formatNumber(masses?.insulation_supports_mass_kg, 0)} кг.
                      </div>
                    </div>
                    <div className="hint-block">
                      <b>Давления</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Внутреннее с гидростатикой {formatNumber(pressures?.internal_total_mpa, 4)} МПа; внешнее требуемое {formatNumber(pressures?.external_required_mpa, 4)} МПа; вакуум {formatNumber(pressures?.vacuum_mpa, 4)} МПа.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card panel-card">
                  <div className="panel-title">Комплектация и нагрузки</div>
                  <div className="check-grid">
                    <div className="hint-block">
                      <b>Опоры</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Рекомендовано {formatNumber(supports?.recommended_support_count ?? supportEstimate.recommendedCount, 0)} шт.; принято {formatNumber(supports?.support_count ?? supportEstimate.actualCount, 0)} шт.; высота {formatNumber((supports?.saddle_height_m ?? supportEstimate.saddleHeightM) * 1000, 0)} мм; вес 1 ед. {formatNumber(supports?.actual_weight_each_kg ?? supportEstimate.actualWeightEachKg, 1)} кг; давление под седлом {formatNumber(supports?.foundation_pressure_kpa, 2)} кПа.
                      </div>
                    </div>
                    <div className="hint-block">
                      <b>Патрубки</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Всего {formatNumber(nozzles?.count ?? activeNozzles.reduce((sum, item) => sum + parseNumber(item.count), 0), 0)} шт.; критический {nozzles?.critical_name || "—"}; допускаемое внешнее давление патрубка {formatNumber(nozzles?.pipe_allow_external_mpa, 4)} МПа.
                      </div>
                      {activeNozzles.length ? (
                        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                          {activeNozzles.map((item) => `${item.name}: ${item.count} шт., DN ${item.dnMm}, L ${item.lengthMm}, t ${item.thicknessMm}`).join("; ")}
                        </div>
                      ) : null}
                    </div>
                    <div className="hint-block">
                      <b>Теплоизоляция</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        {form.insulationEnabled
                          ? flags.underground
                            ? `ППУ ${form.insulationThicknessMm} мм, плотность ${form.insulationDensityKgM3} кг/м³, металлическое крепление и покрытие не учитываются.`
                            : `ТИ ${form.insulationThicknessMm} мм, ${formatNumber(insulationSupports?.shell_ring_count, 0)} колец, ${formatNumber(insulationSupports?.stand_count, 0)} проставок, ${formatNumber(insulationSupports?.head_ray_stand_count, 0)} Т-опор на лучах, масса крепления ${formatNumber(insulationSupports?.steel_mass_kg, 1)} кг.`
                          : "Не включена."}
                      </div>
                    </div>
                    <div className="hint-block">
                      <b>Грунт и хомуты</b>
                      <div className="muted" style={{ marginTop: 8 }}>
                        {flags.underground ? `Грунт: ${soil?.preset || "—"}, pv ${formatNumber(soil?.vertical_kpa, 2)} кПа, ph ${formatNumber(soil?.horizontal_kpa, 2)} кПа; всплытие ${formatNumber(flotation?.net_uplift_kN, 2)} кН; хомутов ${formatNumber(flotation?.strap_count, 0)} шт.` : "Для наземного исполнения не применяется."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card panel-card">
                  <div className="panel-title">Расчётные случаи</div>
                  {calculationCases.length ? (
                    <div className="check-grid">
                      {calculationCases.map((item) => (
                        <div key={item.id} className="hint-block">
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <b>{item.title}</b>
                            <span className={item.active ? "pill pass" : "pill warn"}>{item.active ? "активен" : "не применяется"}</span>
                          </div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{item.basis}</div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{item.note}</div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="hint-block">Расчётные случаи появятся после ответа API.</div>}
                </div>

                <div className="card panel-card">
                  <div className="panel-title">Проверки</div>
                  {checks.length ? (
                    <div className="check-grid">
                      {checks.map((check) => (
                        <div key={check.code} className="card" style={{ boxShadow: "none", padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontWeight: 800 }}>{checkTitle(check)}</div>
                            </div>
                            <span className={checkClass(check.result)}>{checkLabel(check.result)}</span>
                          </div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                            {formatNumber(check.value, 4)} {check.unit} / требуемо {formatNumber(check.limit, 4)} {check.unit}
                          </div>
                          {check.margin ? (
                            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Запас: {formatNumber(check.margin, 2)}</div>
                          ) : null}
                          {check.reference ? <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{check.reference}</div> : null}
                          {check.note ? <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{check.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="hint-block">После расчёта здесь появятся статусы по обечайке, днищам, опорам, патрубкам и всплытию.</div>
                  )}
                </div>

                <div className="card panel-card">
                  <div className="panel-title">Протокол расчёта</div>
                  {reportSections.length ? (
                    <div className="stack" style={{ marginBottom: displayProtocol.length ? 16 : 0 }}>
                      {reportSections.map((section) => (
                        <div key={section.title} className="hint-block">
                          <div style={{ fontWeight: 900, marginBottom: 10 }}>{section.title}</div>
                          <div className="stack">
                            {section.rows.map((row) => (
                              <div key={`${section.title}-${row.name}`} className="kpi">
                                <span className="muted">{row.name}</span>
                                <b>{row.value}{row.unit ? ` ${row.unit}` : ""}</b>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {displayProtocol.length ? (
                    <div className="stack">
                      {displayProtocol.map((item) => (
                        <div key={item.code} className="hint-block">
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <b>{checkTitle(item)}</b>
                            <span className={checkClass(item.result)}>{checkLabel(item.result)}</span>
                          </div>
                          {item.formula ? <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 13 }}>{item.formula}</div> : null}
                          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                            Результат: {formatNumber(item.value, 4)} {item.unit || ""} · Допустимо/требуется: {formatNumber(item.limit, 4)} {item.unit || ""} · Запас: {formatNumber(item.margin, 2)}
                          </div>
                          {item.inputs && Object.keys(item.inputs).length ? (
                            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                              Входные данные: {Object.entries(item.inputs).map(([key, value]) => `${key}=${formatProtocolValue(value)}`).join("; ")}
                            </div>
                          ) : null}
                          {item.reference ? <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{item.reference}</div> : null}
                          {item.note ? <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{item.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="hint-block">После расчёта здесь появятся формулы, исходные данные, результат, запас и нормативная ссылка.</div>
                  )}
                </div>

                <div className="card panel-card">
                  <div className="panel-title">Детализация результата</div>
                  <div className="stack">
                    <div className="hint-block">
                      <b>Геометрия:</b> {geometry ? `${formatNumber((geometry.total_length_m ?? 0) * 1000, 0)} мм общая длина, ${formatNumber((geometry.shell_length_m ?? 0) * 1000, 0)} мм обечайка, ${HEAD_LABELS[form.headType]} днища.` : "—"}
                    </div>
                    <div className="hint-block">
                      <b>Масса металла:</b> {masses ? `${formatNumber(masses.shell_mass_kg, 0)} кг обечайка, ${formatNumber(masses.head_total_mass_kg, 0)} кг днища, ${formatNumber(masses.nozzle_mass_kg, 0)} кг патрубки.` : "—"}
                    </div>
                    <div className="hint-block">
                      <b>Обечайка:</b> {shell ? `эффективная толщина ${formatNumber(shell.effective_mm, 2)} мм, рекомендованная толщина ${formatNumber(shellBaseMinMm, 0)} мм, колец ${formatNumber(shell.recommended_ring_count, 0)} шт.` : "—"}
                    </div>
                    <div className="hint-block">
                      <b>Днище:</b> {head ? `допускаемое внешнее давление ${formatNumber(head.allow_external_mpa, 4)} МПа, рекомендуемая толщина ${formatNumber(headBaseMinMm, 0)} мм.` : "—"}
                    </div>
                    <div className="hint-block">
                      <b>Грунт и всплытие:</b> {flotation ? `нетто-всплытие ${formatNumber(flotation.net_uplift_kN, 2)} кН, хомутов ${formatNumber(flotation.strap_count, 0)} шт., рекомендуемый хомут ${formatNumber(flotation.recommended_width_mm, 0)}×${formatNumber(flotation.recommended_thickness_mm, 0)} мм.` : "Для наземного исполнения не применяется."}
                    </div>
                    <div className="hint-block">
                      <b>{flags.underground ? "ППУ изоляция:" : "Крепление ТИ:"}</b> {form.insulationEnabled
                        ? flags.underground
                          ? `учтена масса ППУ ${form.insulationThicknessMm} мм; крепление и покрытие не добавляются.`
                          : insulationSupports?.enabled ? `${formatNumber(insulationSupports.shell_ring_count, 0)} колец, ${formatNumber(insulationSupports.stands_per_ring, 0)} проставок на кольцо, всего ${formatNumber(insulationSupports.stand_count, 0)} проставок, лучей на днище ${formatNumber(insulationSupports.head_ray_count_each, 0)} шт., Т-опор на лучах ${formatNumber(insulationSupports.head_ray_stand_count, 0)} шт., масса крепления ${formatNumber(insulationSupports.steel_mass_kg, 1)} кг.` : "крепление не рассчитано."
                        : "Теплоизоляция не включена."}
                    </div>
                  </div>
                </div>

                <div className="section-actions">
                  <button className="btn" type="button" onClick={() => downloadRgsDocument("/api/rgs/calculation-report", "rgs_calculation_report.docx")} disabled={reportLoading !== null}>
                    {reportLoading === "/api/rgs/calculation-report" ? "Формирование..." : "Скачать расчёт"}
                  </button>
                  <button className="btn" type="button" onClick={() => downloadRgsDocument("/api/rgs/terms-of-reference", "rgs_terms_of_reference.docx")} disabled={reportLoading !== null}>
                    {reportLoading === "/api/rgs/terms-of-reference" ? "Формирование..." : "Скачать техническое задание"}
                  </button>
                  <ProjectOrderButton source="rgs-results" />
                </div>

                <div className="card panel-card">
                  <div className="panel-title">Нормативная база и ограничения</div>
                  <ul className="muted norms-list">
                    {normative.length ? normative.map((item) => <li key={item}>{item}</li>) : <li>После расчёта здесь появятся ссылки на применённую нормативную базу.</li>}
                  </ul>
                </div>
              </div>
            ) : null}

            {error ? <div className="warn-inline">{error}</div> : null}

          </main>

          <aside className="grid sticky-side" style={{ gap: 16 }}>
            <div className="card pad">
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Сводка</div>
              <div className="kpi">
                <span className="muted">Тип</span>
                <b>{activeType}</b>
              </div>
              <div className="kpi">
                <span className="muted">Продукт</span>
                <b>{summary?.product_name || form.productName}</b>
              </div>
              <div className="kpi">
                <span className="muted">Диаметр</span>
                <b>{formatNumber(livePreview.diameterM * 1000, 0)} мм</b>
              </div>
              <div className="kpi">
                <span className="muted">Общая длина</span>
                <b>{formatNumber(livePreview.totalLengthM * 1000, 0)} мм</b>
              </div>
              <div className="kpi">
                <span className="muted">Полный объём</span>
                <b>{formatNumber(summary?.full_volume_m3 ?? livePreview.totalVolumeM3, 3)} м³</b>
              </div>
              <div className="kpi">
                <span className="muted">Объём продукта</span>
                <b>{formatNumber(summary?.product_volume_m3 ?? livePreview.productVolumeM3, 3)} м³</b>
              </div>
              <div className="kpi">
                <span className="muted">Сухая масса</span>
                <b>{summary ? `${formatNumber(summary.dry_mass_kg, 0)} кг` : "—"}</b>
              </div>
              <div className="kpi">
                <span className="muted">Рабочая масса</span>
                <b>{summary ? `${formatNumber(summary.operating_mass_kg, 0)} кг` : "—"}</b>
              </div>
              <div className="kpi">
                <span className="muted">Нагрузка</span>
                <b>{summary ? `${formatNumber(summary.operating_load_kN, 2)} кН` : "—"}</b>
              </div>
              <div className="kpi">
                <span className="muted">Обечайка</span>
                <b>{formatNumber(parseNumber(form.shellNominalMm), 0)} мм</b>
              </div>
              <div className="kpi">
                <span className="muted">Днище</span>
                <b>{formatNumber(parseNumber(form.headNominalMm), 0)} мм</b>
              </div>
            </div>

            <div className="card pad">
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Статусы</div>
              <div className="stats-grid">
                <div className="stat-box">
                  <span className="muted">Обечайка</span>
                  <b>{boolBadge(summary?.current_shell_ok)}</b>
                </div>
                <div className="stat-box">
                  <span className="muted">Днище</span>
                  <b>{boolBadge(summary?.current_head_ok)}</b>
                </div>
                <div className="stat-box">
                  <span className="muted">Патрубок</span>
                  <b>{boolBadge(summary?.current_nozzle_ok)}</b>
                </div>
                <div className="stat-box">
                  <span className="muted">Хомуты</span>
                  <b>{summary?.net_uplift_kN && summary.net_uplift_kN > 0 ? "НУЖНЫ" : "—"}</b>
                </div>
              </div>
            </div>

            <div className="card pad">
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Ключевые показатели</div>
              <div className="kpi">
                <span className="muted">Цилиндрическая часть</span>
                <b>{formatNumber((geometry?.shell_length_m ?? livePreview.shellLengthM) * 1000, 0)} мм</b>
              </div>
              <div className="kpi">
                <span className="muted">Уровень продукта</span>
                <b>{formatNumber((summary?.fill_height_m ?? livePreview.fillHeightM) * 1000, 0)} мм</b>
              </div>
              <div className="kpi">
                <span className="muted">Внутр. давление с гидростатикой</span>
                <b>{pressures ? `${formatNumber(pressures.internal_total_mpa, 4)} МПа` : "—"}</b>
              </div>
              <div className="kpi">
                <span className="muted">Требуемое внешнее давление</span>
                <b>{pressures ? `${formatNumber(pressures.external_required_mpa, 4)} МПа` : "—"}</b>
              </div>
              <div className="kpi">
                <span className="muted">Допускаемое внешнее (обечайка)</span>
                <b>{shell ? `${formatNumber(shell.allow_external_mpa, 4)} МПа` : "—"}</b>
              </div>
              <div className="kpi">
                <span className="muted">Допускаемое внешнее (днище)</span>
                <b>{head ? `${formatNumber(head.allow_external_mpa, 4)} МПа` : "—"}</b>
              </div>
              <div className="kpi">
                <span className="muted">Реакция на опору</span>
                <b>{supports ? `${formatNumber(supports.reaction_each_kN, 2)} кН` : "—"}</b>
              </div>
              <div className="kpi">
                <span className="muted">Давление под опорой</span>
                <b>{supports ? `${formatNumber(supports.foundation_pressure_kpa, 2)} кПа` : "—"}</b>
              </div>
            </div>

            {warnings.length ? (
              <div className="card pad">
                <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Предупреждения</div>
                <div className="stack">
                  {warnings.map((warning) => (
                    <div key={warning} className="warn-inline" style={{ fontWeight: 600 }}>
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="grid info-grid" style={{ display: "none" }}>
          <div className="card pad">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Проверки</div>
            {checks.length ? (
              <div className="check-grid">
                {checks.map((check) => (
                  <div key={check.code} className="card" style={{ boxShadow: "none", padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{checkTitle(check)}</div>
                      </div>
                      <span className={checkClass(check.result)}>{checkLabel(check.result)}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                      {formatNumber(check.value, 4)} {check.unit} / требуемо {formatNumber(check.limit, 4)} {check.unit}
                    </div>
                    {check.note ? <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{check.note}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="hint-block">После расчёта здесь появятся статусы по обечайке, днищам, опорам, патрубкам и всплытию.</div>
            )}
          </div>

          <div className="card pad">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Детализация результата</div>
            <div className="stack">
              <div className="hint-block">
                <b>Геометрия:</b> {geometry ? `${formatNumber(geometry.total_length_m, 3)} м общая длина, ${formatNumber(geometry.shell_length_m, 3)} м обечайка, ${HEAD_LABELS[form.headType]} днища.` : "—"}
              </div>
              <div className="hint-block">
                <b>Масса металла:</b> {masses ? `${formatNumber(masses.shell_mass_kg, 0)} кг обечайка, ${formatNumber(masses.head_total_mass_kg, 0)} кг днища, ${formatNumber(masses.nozzle_mass_kg, 0)} кг патрубки.` : "—"}
              </div>
              <div className="hint-block">
                <b>Обечайка:</b> {shell ? `эффективная толщина ${formatNumber(shell.effective_mm, 2)} мм, минимальное расстояние между одиночными штуцерами ${formatNumber(shell.minimum_nozzle_spacing_mm, 0)} мм.` : "—"}
              </div>
              <div className="hint-block">
                <b>Днище:</b> {head ? `допускаемое внешнее давление ${formatNumber(head.allow_external_mpa, 4)} МПа, площадь ребра ${formatNumber(head.rib_area_cm2, 2)} см².` : "—"}
              </div>
              <div className="hint-block">
                <b>Патрубки:</b> {nozzles?.count ? `${nozzles.count} шт., допускаемое внешнее для патрубка ${formatNumber(nozzles.pipe_allow_external_mpa, 4)} МПа.` : "Не участвуют в расчёте массы/устойчивости."}
              </div>
              <div className="hint-block">
                <b>Грунт:</b> {soil ? `${soil.preset}, Pv ${formatNumber(soil.vertical_kpa, 2)} кПа, Ph ${formatNumber(soil.horizontal_kpa, 2)} кПа, Pavg ${formatNumber(soil.average_kpa, 2)} кПа.` : "Для наземного исполнения не применяется."}
              </div>
              <div className="hint-block">
                <b>Всплытие:</b> {flotation ? `выталкивающая сила ${formatNumber(flotation.buoyancy_force_kN, 2)} кН, нетто-всплытие ${formatNumber(flotation.net_uplift_kN, 2)} кН, рекомендовано ${formatNumber(flotation.strap_count, 0)} хомутов ${formatNumber(flotation.recommended_width_mm, 0)}×${formatNumber(flotation.recommended_thickness_mm, 0)} мм.` : "—"}
              </div>
              {flags.doubleWall ? (
                <div className="hint-block">
                  <b>Межстенное пространство:</b> {geometry ? `${formatNumber(geometry.double_wall_outer_diameter_m, 3)} м наружный диаметр, ${formatNumber(geometry.annular_volume_m3, 3)} м³ межстенный объём.` : "—"}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid info-grid" style={{ display: "none" }}>
          <div className="card pad">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Нормативная база и принципы</div>
            <ul className="muted norms-list">
              {normative.length ? normative.map((item) => <li key={item}>{item}</li>) : <li>После расчёта здесь появятся ссылки на применённую нормативную базу.</li>}
            </ul>
          </div>
          <div className="card pad">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Что уже учтено в версии сайта</div>
            <ul className="muted norms-list">
              <li>Расчёт ведётся по единой инженерной модели с сохранением исходных данных, проверок и протокола результата.</li>
              <li>Поддержаны 4 типа: РГСН, РГСП, РГСНД, РГСПД.</li>
              <li>Есть подземная схема с давлением грунта, внешним давлением, всплытием и подбором хомутов.</li>
              <li>Учтены тип днища, геометрия, кольца жёсткости, рёбра плоского днища, опоры, патрубки, утепление и двустенная оболочка.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

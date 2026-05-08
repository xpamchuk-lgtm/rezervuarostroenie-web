import React, { useEffect, useMemo, useState } from "react";
import Seo from "../components/Seo";

type TankType = "РГСН" | "РГСП" | "РГСНД" | "РГСПД";
type FillMode = "percent" | "level";
type HeadType = "flat" | "cone" | "truncated_cone";
type Material = "09G2S" | "St3";
type RingMode = "auto" | "manual";
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
  unit: string;
  note?: string;
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
    pipe_allow_external_mpa?: number;
    pipe_elastic_mpa?: number;
    pipe_strength_mpa?: number;
  };
  flotation?: {
    groundwater?: boolean;
    buoyancy_force_kN?: number;
    dry_load_kN?: number;
    net_uplift_kN?: number;
    strap_count?: number;
    required_area_each_mm2?: number;
    recommended_thickness_mm?: number;
    recommended_width_mm?: number;
    allowable_stress_mpa?: number;
  };
};

type RgsResult = {
  summary?: SummaryResult;
  details?: DetailsResult;
  checks?: CheckItem[];
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
  R0Kpa: string;
  ringMode: RingMode;
  ringCount: string;
  ringOffsetM: string;
  ringSectionCm2: string;
  ribCount: string;
  ribHeightMm: string;
  ribWidthMm: string;
  ribThicknessMm: string;
  nozzleCount: string;
  nozzleDnMm: string;
  nozzleLengthMm: string;
  nozzleThicknessMm: string;
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
  gammaF: string;
  groundwater: boolean;
  groundwaterDensityKgM3: string;
  strapSpacingM: string;
  strapAllowableMpa: string;
  outerShellGapM: string;
  outerShellNominalMm: string;
};

const TANK_TYPES: TankType[] = ["РГСН", "РГСП", "РГСНД", "РГСПД"];

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

const FALLBACK_SITE_OPTIONS: SiteOptions = {
  "Саратовская область": ["Саратов", "Энгельс", "Балаково"],
  "Москва": ["Москва"],
  "Санкт-Петербург": ["Санкт-Петербург"],
};

const TYPE_META: Record<TankType, { api: string; title: string; note: string }> = {
  РГСН: {
    api: "rgsn",
    title: "Наземное исполнение",
    note: "Расчёт опор, масс, толщины обечайки и днищ для горизонтальной наземной ёмкости.",
  },
  РГСП: {
    api: "rgsp",
    title: "Подземное исполнение",
    note: "Расчёт давления грунта, внешнего давления, всплытия и удерживающих хомутов для подземной ёмкости.",
  },
  РГСНД: {
    api: "rgsnd",
    title: "Наземное двустенное исполнение",
    note: "Внутренняя оболочка проверяется по прочности, наружная — по массе и геометрии межстенного пространства.",
  },
  РГСПД: {
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
  { id: "characteristics", label: "Основные характеристики", note: "Геометрия, толщины, днища и режим" },
  { id: "equipment", label: "Комплектация", note: "Патрубки, опоры, грунт, хомуты и двустенность" },
  { id: "results", label: "Результаты", note: "Проверки, детализация и нормативы" },
];

const HEAD_LABELS: Record<HeadType, string> = {
  flat: "Плоские",
  cone: "Конические",
  truncated_cone: "Усечённо-конические",
};

function createDefaultForm(type: TankType): RgsForm {
  const underground = type === "РГСП" || type === "РГСПД";
  const doubleWall = type === "РГСНД" || type === "РГСПД";

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
    headType: underground ? "flat" : "flat",
    headProjectionM: underground ? "0" : "0",
    headSmallDiameterM: "400",
    material: "09G2S",
    shellNominalMm: underground ? "7" : "8",
    headNominalMm: underground ? "7" : "8",
    corrMm: underground ? "2.0" : "0.0",
    minusToleranceMm: "0.8",
    headAllowancesMm: underground ? "0.8" : "0.8",
    rho: underground ? "830" : "1000",
    temperatureC: "20",
    fillMode: "percent",
    fillValue: "100",
    extraLiquidHeadM: underground ? "410" : "0",
    designPressureMpa: "0.0",
    vacuumMpa: "0.0",
    supportCount: underground ? "2" : "2",
    saddleWidthM: underground ? "600" : "700",
    R0Kpa: "200",
    ringMode: underground ? "auto" : "manual",
    ringCount: underground ? "2" : "0",
    ringOffsetM: underground ? "200" : "0",
    ringSectionCm2: "10.34",
    ribCount: "8",
    ribHeightMm: "50",
    ribWidthMm: "50",
    ribThicknessMm: "7",
    nozzleCount: underground ? "1" : "0",
    nozzleDnMm: underground ? "700" : "80",
    nozzleLengthMm: underground ? "2800" : "250",
    nozzleThicknessMm: underground ? "7" : "6",
    insulationEnabled: false,
    insulationThicknessMm: "50",
    insulationDensityKgM3: "120",
    coatingThicknessMm: underground ? "3" : "0",
    coatingDensityKgM3: "1200",
    ladder: !underground,
    platform: false,
    manholeCount: underground ? "1" : "1",
    neckHeightM: underground ? "400" : "0",
    soilPreset: "sand_coarse",
    burialDepthTopM: underground ? "3000" : "0",
    soilDensityKgM3: underground ? "1800" : "1800",
    soilPhiDeg: underground ? "40" : "40",
    soilVoidRatio: underground ? "0.45" : "0.45",
    gammaF: "1.15",
    groundwater: underground,
    groundwaterDensityKgM3: "1000",
    strapSpacingM: "2500",
    strapAllowableMpa: "140",
    outerShellGapM: doubleWall ? "30" : "30",
    outerShellNominalMm: doubleWall ? "6" : "6",
  };
}

function createResultMap<T>(value: T): Record<TankType, T> {
  return {
    РГСН: value,
    РГСП: value,
    РГСНД: value,
    РГСПД: value,
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

function boolBadge(value?: boolean | null): string {
  if (value === true) return "OK";
  if (value === false) return "НЕ ОК";
  return "—";
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
  const [activeType, setActiveType] = useState<TankType>("РГСП");
  const [activeSection, setActiveSection] = useState<SectionId>("type");
  const [forms, setForms] = useState<Record<TankType, RgsForm>>({
    РГСН: createDefaultForm("РГСН"),
    РГСП: createDefaultForm("РГСП"),
    РГСНД: createDefaultForm("РГСНД"),
    РГСПД: createDefaultForm("РГСПД"),
  });
  const [results, setResults] = useState<Record<TankType, RgsResult | null>>(createResultMap<RgsResult | null>(null));
  const [loadingType, setLoadingType] = useState<TankType | null>(null);
  const [siteLookupState, setSiteLookupState] = useState<SiteLookupState>("idle");
  const [error, setError] = useState<string>("");

  const form = forms[activeType];
  const result = results[activeType];
  const fillUnit = form.fillMode === "percent" ? "% диаметра" : "мм";
  const activeMeta = useMemo(() => TYPE_META[activeType], [activeType]);
  const flags = useMemo(() => useTypeFlags(activeType), [activeType]);
  const regionOptions = useMemo(() => Object.keys(siteOptions), [siteOptions]);
  const cityOptions = useMemo(() => (form.region ? siteOptions[form.region] ?? [] : []), [form.region, siteOptions]);
  const visibleSections = RGS_SECTIONS;

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
      return { ...prev, [activeType]: next };
    });
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
    next.extraLiquidHeadM = "410";
    setForms((prev) => ({ ...prev, [activeType]: next }));
    setResults((prev) => ({ ...prev, [activeType]: null }));
    setSiteLookupState("idle");
    setError("");
  }

  async function calculate() {
    setLoadingType(activeType);
    setError("");

    const payload = {
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
      head_projection_m: mmToM(form.headProjectionM),
      head_small_diameter_m: mmToM(form.headSmallDiameterM),
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
      extra_liquid_head_m: mmToM(form.extraLiquidHeadM),
      design_pressure_mpa: parseNumber(form.designPressureMpa),
      vacuum_mpa: parseNumber(form.vacuumMpa),
      support_count: parseNumber(form.supportCount),
      saddle_width_m: mmToM(form.saddleWidthM),
      R0_kPa: parseNumber(form.R0Kpa),
      ring_mode: form.ringMode,
      ring_count: parseNumber(form.ringCount),
      ring_offset_m: mmToM(form.ringOffsetM),
      ring_section_cm2: parseNumber(form.ringSectionCm2),
      rib_count: parseNumber(form.ribCount),
      rib_height_mm: parseNumber(form.ribHeightMm),
      rib_width_mm: parseNumber(form.ribWidthMm),
      rib_thickness_mm: parseNumber(form.ribThicknessMm),
      nozzle_count: parseNumber(form.nozzleCount),
      nozzle_dn_mm: parseNumber(form.nozzleDnMm),
      nozzle_length_mm: parseNumber(form.nozzleLengthMm),
      nozzle_thickness_mm: parseNumber(form.nozzleThicknessMm),
      insulation_enabled: form.insulationEnabled,
      insulation_thickness_mm: parseNumber(form.insulationThicknessMm),
      insulation_density_kg_m3: parseNumber(form.insulationDensityKgM3),
      coating_thickness_mm: parseNumber(form.coatingThicknessMm),
      coating_density_kg_m3: parseNumber(form.coatingDensityKgM3),
      ladder: form.ladder,
      platform: form.platform,
      manhole_count: parseNumber(form.manholeCount),
      neck_height_m: mmToM(form.neckHeightM),
      soil_preset: form.soilPreset,
      burial_depth_top_m: mmToM(form.burialDepthTopM),
      soil_density_kg_m3: parseNumber(form.soilDensityKgM3),
      soil_phi_deg: parseNumber(form.soilPhiDeg),
      soil_void_ratio: parseNumber(form.soilVoidRatio),
      gamma_f: parseNumber(form.gammaF),
      groundwater: form.groundwater,
      groundwater_density_kg_m3: parseNumber(form.groundwaterDensityKgM3),
      strap_spacing_m: mmToM(form.strapSpacingM),
      strap_allowable_mpa: parseNumber(form.strapAllowableMpa),
      outer_shell_gap_m: mmToM(form.outerShellGapM),
      outer_shell_nominal_mm: parseNumber(form.outerShellNominalMm),
    };

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
      setResults((prev) => ({
        ...prev,
        [activeType]: data?.result ?? null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось выполнить расчёт.";
      setError(message);
    } finally {
      setLoadingType(null);
    }
  }

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
  const checks = result?.checks ?? [];
  const warnings = result?.warnings ?? [];
  const normative = result?.normative ?? [];
  const livePreview = useMemo(() => {
    const diameterM = Math.max(0, mmToM(form.D));
    const totalLengthM = Math.max(0, mmToM(form.totalLengthM));
    const projectionM = form.headType === "flat" ? 0 : Math.max(0, mmToM(form.headProjectionM));
    const shellLengthM = Math.max(0, totalLengthM - 2 * projectionM);
    const cylinderVolumeM3 = circleAreaM2(diameterM) * shellLengthM;
    const totalVolumeM3 = cylinderVolumeM3 + 2 * headVolumeEachM3(
      form.headType,
      diameterM,
      projectionM,
      mmToM(form.headSmallDiameterM),
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
  }, [form]);

  return (
    <div className="container">
      <Seo
        title="РГС калькулятор | Резервуаростроение"
        description="Расчёт горизонтальных стальных резервуаров: РГСН, РГСП, РГСНД и РГСПД. Расчёты выполняются на Python backend, а сайт отвечает за интерфейс и выдачу результатов."
        canonical="https://rezervuarostroenie.ru/calc/rgs"
      />

      <div className="grid" style={{ gap: 16 }}>
        <div className="card pad">
          <div style={{ fontWeight: 900, fontSize: 28 }}>Калькулятор РГС</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Раздел встроен в существующий сайт и работает через <b>Python backend</b>. На странице только ввод данных,
            запрос к API и выдача инженерного результата. Базовые проверки калиброваны на предоставленные расчёты
            <b> Пассат</b> по РГСП-15 на 6 мм и 7 мм.
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

            <div className="hint-block" style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Текущее исполнение</div>
              <div>{activeMeta.note}</div>
            </div>

            {flags.underground ? (
              <div className="hint-block" style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Калибровка по примерам</div>
                <div className="stack">
                  <button type="button" className="btn mini-btn" onClick={() => loadPassatExample(6)}>
                    РГСП-15 · 6 мм (пример FAIL)
                  </button>
                  <button type="button" className="btn mini-btn" onClick={() => loadPassatExample(7)}>
                    РГСП-15 · 7 мм (пример PASS)
                  </button>
                </div>
              </div>
            ) : null}
          </aside>

          <main className="grid" style={{ gap: 16 }}>
            <div id="rgs-type" className="card panel-card" style={{ scrollMarginTop: 96, display: activeSection === "type" ? undefined : "none" }}>
              <div className="panel-title">1. Тип исполнения</div>
              <div className="row4">
                {TANK_TYPES.map((tankType) => (
                  <button
                    key={tankType}
                    type="button"
                    className={activeType === tankType ? "side-link active" : "side-link"}
                    onClick={() => updateTankType(tankType)}
                    style={{ minHeight: 116 }}
                  >
                    <span>{tankType}</span>
                    <small>{TYPE_META[tankType].title}</small>
                  </button>
                ))}
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
                <div className="row3">
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
                  <div className="field">
                    <label>Колец жёсткости / диафрагм</label>
                    <div className="input-unit">
                      <input value={form.ringCount} onChange={(e) => updateForm("ringCount", e.target.value)} />
                      <span className="unit-chip">шт.</span>
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
            </div>

            <div id="rgs-characteristics" className="grid" style={{ gap: 16, display: activeSection === "characteristics" ? undefined : "none" }}>
              <div className="card panel-card">
              <div className="panel-title">3. Основные характеристики</div>
              <div className="row4" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Тип днища</label>
                  <select value={form.headType} onChange={(e) => updateForm("headType", e.target.value as HeadType)}>
                    <option value="flat">Плоские</option>
                    <option value="cone">Конические</option>
                    <option value="truncated_cone">Усечённо-конические</option>
                  </select>
                </div>
                <div className="field">
                  <label>Вылет одного днища</label>
                  <div className="input-unit">
                    <input
                      value={form.headProjectionM}
                      onChange={(e) => updateForm("headProjectionM", e.target.value)}
                      disabled={form.headType === "flat"}
                    />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Диаметр малого основания</label>
                  <div className="input-unit">
                    <input
                      value={form.headSmallDiameterM}
                      onChange={(e) => updateForm("headSmallDiameterM", e.target.value)}
                      disabled={form.headType !== "truncated_cone"}
                    />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Материал</label>
                  <select value={form.material} onChange={(e) => updateForm("material", e.target.value as Material)}>
                    <option value="09G2S">09Г2С</option>
                    <option value="St3">Ст3</option>
                  </select>
                </div>
              </div>

              <div className="row4">
                <div className="field">
                  <label>Обечайка, текущая толщина</label>
                  <div className="input-unit">
                    <input value={form.shellNominalMm} onChange={(e) => updateForm("shellNominalMm", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Днище, текущая толщина</label>
                  <div className="input-unit">
                    <input value={form.headNominalMm} onChange={(e) => updateForm("headNominalMm", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Коррозионная прибавка</label>
                  <div className="input-unit">
                    <input value={form.corrMm} onChange={(e) => updateForm("corrMm", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Минусовой допуск</label>
                  <div className="input-unit">
                    <input value={form.minusToleranceMm} onChange={(e) => updateForm("minusToleranceMm", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
              </div>

              <div className="row4" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Прибавка для днища</label>
                  <div className="input-unit">
                    <input value={form.headAllowancesMm} onChange={(e) => updateForm("headAllowancesMm", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Режим колец жёсткости</label>
                  <select value={form.ringMode} onChange={(e) => updateRingMode(e.target.value as RingMode)}>
                    <option value="auto">Авто-рекомендация</option>
                    <option value="manual">Фиксированное число</option>
                  </select>
                </div>
                <div className="field">
                  <label>Количество колец</label>
                  <div className="input-unit">
                    <input
                      value={form.ringCount}
                      onChange={(e) => updateForm("ringCount", e.target.value)}
                    />
                    <span className="unit-chip">шт.</span>
                  </div>
                </div>
                <div className="field">
                  <label>Отступ кольца от торца</label>
                  <div className="input-unit">
                    <input value={form.ringOffsetM} onChange={(e) => updateForm("ringOffsetM", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
              </div>

              <div className="row4" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Сечение кольца</label>
                  <div className="input-unit">
                    <input value={form.ringSectionCm2} onChange={(e) => updateForm("ringSectionCm2", e.target.value)} />
                    <span className="unit-chip">см²</span>
                  </div>
                </div>
                <div className="field">
                  <label>Рёбер на плоском днище</label>
                  <div className="input-unit">
                    <input
                      value={form.ribCount}
                      onChange={(e) => updateForm("ribCount", e.target.value)}
                      disabled={form.headType !== "flat"}
                    />
                    <span className="unit-chip">шт.</span>
                  </div>
                </div>
                <div className="field">
                  <label>Высота ребра</label>
                  <div className="input-unit">
                    <input
                      value={form.ribHeightMm}
                      onChange={(e) => updateForm("ribHeightMm", e.target.value)}
                      disabled={form.headType !== "flat"}
                    />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Ширина/полка ребра</label>
                  <div className="input-unit">
                    <input
                      value={form.ribWidthMm}
                      onChange={(e) => updateForm("ribWidthMm", e.target.value)}
                      disabled={form.headType !== "flat"}
                    />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
              </div>

              <div className="row3" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Толщина ребра</label>
                  <div className="input-unit">
                    <input
                      value={form.ribThicknessMm}
                      onChange={(e) => updateForm("ribThicknessMm", e.target.value)}
                      disabled={form.headType !== "flat"}
                    />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Толщина для подбора считать от текущей</label>
                  <div className="hint-block" style={{ minHeight: 42 }}>
                    Рекомендуемая толщина определяется автоматически в Python по текущей геометрии и нагрузкам.
                  </div>
                </div>
                <div className="field">
                  <label>Тип расчёта</label>
                  <div className="hint-block" style={{ minHeight: 42 }}>
                    Проверка ведётся по внутреннему и внешнему давлению, а для подземного исполнения — ещё и по давлению грунта.
                  </div>
                </div>
              </div>
            </div>

              <div className="card panel-card">
              <div className="panel-title">Среда и режим работы</div>
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
                      onClick={() => updateForm("fillMode", "percent")}
                    >
                      По уровню, %
                    </button>
                    <button
                      type="button"
                      className={form.fillMode === "level" ? "segmented-item active" : "segmented-item"}
                      onClick={() => updateForm("fillMode", "level")}
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
                <div className="field">
                  <label>Доп. столб продукта / горловина</label>
                  <div className="input-unit">
                    <input value={form.extraLiquidHeadM} onChange={(e) => updateForm("extraLiquidHeadM", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
              </div>
            </div>

            </div>

            <div id="rgs-equipment" className="grid" style={{ gap: 16, display: activeSection === "equipment" ? undefined : "none" }}>
            <div className="card panel-card">
              <div className="panel-title">4. Комплектация, патрубки и масса</div>
              <div className="row4">
                <div className="field">
                  <label>Количество патрубков</label>
                  <div className="input-unit">
                    <input value={form.nozzleCount} onChange={(e) => updateForm("nozzleCount", e.target.value)} />
                    <span className="unit-chip">шт.</span>
                  </div>
                </div>
                <div className="field">
                  <label>Средний DN патрубка</label>
                  <div className="input-unit">
                    <input value={form.nozzleDnMm} onChange={(e) => updateForm("nozzleDnMm", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Длина патрубка</label>
                  <div className="input-unit">
                    <input value={form.nozzleLengthMm} onChange={(e) => updateForm("nozzleLengthMm", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Толщина патрубка</label>
                  <div className="input-unit">
                    <input value={form.nozzleThicknessMm} onChange={(e) => updateForm("nozzleThicknessMm", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
              </div>

              <div className="row4" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Количество люков/горловин</label>
                  <div className="input-unit">
                    <input value={form.manholeCount} onChange={(e) => updateForm("manholeCount", e.target.value)} />
                    <span className="unit-chip">шт.</span>
                  </div>
                </div>
                <div className="field">
                  <label>Высота горловины</label>
                  <div className="input-unit">
                    <input value={form.neckHeightM} onChange={(e) => updateForm("neckHeightM", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <label className="checkbox-card">
                  <input type="checkbox" checked={form.ladder} onChange={(e) => updateForm("ladder", e.target.checked)} />
                  <span>Лестница</span>
                </label>
                <label className="checkbox-card">
                  <input type="checkbox" checked={form.platform} onChange={(e) => updateForm("platform", e.target.checked)} />
                  <span>Площадка</span>
                </label>
              </div>

              <div className="row4" style={{ marginTop: 14 }}>
                <label className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={form.insulationEnabled}
                    onChange={(e) => updateForm("insulationEnabled", e.target.checked)}
                  />
                  <span>Теплоизоляция</span>
                </label>
                <div className="field">
                  <label>Толщина изоляции</label>
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
                  <label>Плотность изоляции</label>
                  <div className="input-unit">
                    <input
                      value={form.insulationDensityKgM3}
                      onChange={(e) => updateForm("insulationDensityKgM3", e.target.value)}
                      disabled={!form.insulationEnabled}
                    />
                    <span className="unit-chip">кг/м³</span>
                  </div>
                </div>
                <div className="field">
                  <label>Толщина покрытия</label>
                  <div className="input-unit">
                    <input value={form.coatingThicknessMm} onChange={(e) => updateForm("coatingThicknessMm", e.target.value)} />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card panel-card">
              <div className="panel-title">Опоры, грунт и всплытие</div>
              <div className="row4">
                <div className="field">
                  <label>Количество опор</label>
                  <div className="input-unit">
                    <input value={form.supportCount} onChange={(e) => updateForm("supportCount", e.target.value)} />
                    <span className="unit-chip">шт.</span>
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
                  <label>Сопротивление основания</label>
                  <div className="input-unit">
                    <input value={form.R0Kpa} onChange={(e) => updateForm("R0Kpa", e.target.value)} />
                    <span className="unit-chip">кПа</span>
                  </div>
                </div>
                <div className="field">
                  <label>Профиль грунта</label>
                  <select value={form.soilPreset} onChange={(e) => updateForm("soilPreset", e.target.value as SoilPreset)}>
                    {SOIL_OPTIONS.map((soil) => (
                      <option key={soil.value} value={soil.value}>
                        {soil.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row4" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Глубина до верхней образующей</label>
                  <div className="input-unit">
                    <input
                      value={form.burialDepthTopM}
                      onChange={(e) => updateForm("burialDepthTopM", e.target.value)}
                      disabled={!flags.underground}
                    />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
                <div className="field">
                  <label>Плотность грунта</label>
                  <div className="input-unit">
                    <input
                      value={form.soilDensityKgM3}
                      onChange={(e) => updateForm("soilDensityKgM3", e.target.value)}
                      disabled={!flags.underground}
                    />
                    <span className="unit-chip">кг/м³</span>
                  </div>
                </div>
                <div className="field">
                  <label>Угол внутреннего трения</label>
                  <div className="input-unit">
                    <input
                      value={form.soilPhiDeg}
                      onChange={(e) => updateForm("soilPhiDeg", e.target.value)}
                      disabled={!flags.underground}
                    />
                    <span className="unit-chip">°</span>
                  </div>
                </div>
                <div className="field">
                  <label>Коэффициент пористости</label>
                  <div className="input-unit">
                    <input
                      value={form.soilVoidRatio}
                      onChange={(e) => updateForm("soilVoidRatio", e.target.value)}
                      disabled={!flags.underground}
                    />
                    <span className="unit-chip">e</span>
                  </div>
                </div>
              </div>

              <div className="row4" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>γf</label>
                  <div className="input-unit">
                    <input value={form.gammaF} onChange={(e) => updateForm("gammaF", e.target.value)} disabled={!flags.underground} />
                    <span className="unit-chip">—</span>
                  </div>
                </div>
                <label className="checkbox-card" aria-label="Грунтовые воды">
                  <input
                    type="checkbox"
                    checked={form.groundwater}
                    onChange={(e) => updateForm("groundwater", e.target.checked)}
                    disabled={!flags.underground}
                  />
                  <span>Грунтовые воды</span>
                </label>
                <div className="field">
                  <label>Плотность воды</label>
                  <div className="input-unit">
                    <input
                      value={form.groundwaterDensityKgM3}
                      onChange={(e) => updateForm("groundwaterDensityKgM3", e.target.value)}
                      disabled={!flags.underground || !form.groundwater}
                    />
                    <span className="unit-chip">кг/м³</span>
                  </div>
                </div>
                <div className="field">
                  <label>Шаг хомутов</label>
                  <div className="input-unit">
                    <input
                      value={form.strapSpacingM}
                      onChange={(e) => updateForm("strapSpacingM", e.target.value)}
                      disabled={!flags.underground}
                    />
                    <span className="unit-chip">мм</span>
                  </div>
                </div>
              </div>

              <div className="row3" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Допускаемое напряжение хомута</label>
                  <div className="input-unit">
                    <input
                      value={form.strapAllowableMpa}
                      onChange={(e) => updateForm("strapAllowableMpa", e.target.value)}
                      disabled={!flags.underground}
                    />
                    <span className="unit-chip">МПа</span>
                  </div>
                </div>
                <div className="field">
                  <label>Комментарий</label>
                  <div className="hint-block" style={{ minHeight: 42 }}>
                    Для подземной схемы расчёт грунта и всплытия выполняется на Python, на странице только ввод и вывод результата.
                  </div>
                </div>
                <div className="field">
                  <label>Нормативная логика</label>
                  <div className="hint-block" style={{ minHeight: 42 }}>
                    Давление грунта и внешняя устойчивость откалиброваны на загруженные расчёты Пассат по РГСП-15.
                  </div>
                </div>
              </div>
            </div>

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
                  {checks.length ? (
                    <div className="check-grid">
                      {checks.map((check) => (
                        <div key={check.code} className="card" style={{ boxShadow: "none", padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontWeight: 800 }}>{check.title}</div>
                              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{check.code}</div>
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
                      <b>Обечайка:</b> {shell ? `эффективная толщина ${formatNumber(shell.effective_mm, 2)} мм, рекомендованная толщина ${formatNumber(shell.recommended_nominal_mm, 0)} мм, колец ${formatNumber(shell.recommended_ring_count, 0)} шт.` : "—"}
                    </div>
                    <div className="hint-block">
                      <b>Днище:</b> {head ? `допускаемое внешнее давление ${formatNumber(head.allow_external_mpa, 4)} МПа, рекомендуемая толщина ${formatNumber(head.recommended_nominal_mm, 0)} мм.` : "—"}
                    </div>
                    <div className="hint-block">
                      <b>Грунт и всплытие:</b> {flotation ? `нетто-всплытие ${formatNumber(flotation.net_uplift_kN, 2)} кН, хомутов ${formatNumber(flotation.strap_count, 0)} шт., рекомендуемый хомут ${formatNumber(flotation.recommended_width_mm, 0)}×${formatNumber(flotation.recommended_thickness_mm, 0)} мм.` : "Для наземного исполнения не применяется."}
                    </div>
                  </div>
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

            {activeSection !== "type" && activeSection !== "main" ? (
              <div className="section-actions">
                <button className="btn primary" type="button" onClick={calculate} disabled={loadingType === activeType}>
                  {loadingType === activeType ? "Расчёт..." : "Сформировать расчёт"}
                </button>
                <button className="btn" type="button" onClick={resetCurrentForm} disabled={loadingType === activeType}>
                  Сбросить значения
                </button>
              </div>
            ) : null}
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
                <span className="muted">Рекоменд. обечайка</span>
                <b>{summary?.recommended_shell_mm ? `${formatNumber(summary.recommended_shell_mm, 0)} мм` : "—"}</b>
              </div>
              <div className="kpi">
                <span className="muted">Рекоменд. днище</span>
                <b>{summary?.recommended_head_mm ? `${formatNumber(summary.recommended_head_mm, 0)} мм` : "—"}</b>
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
                        <div style={{ fontWeight: 800 }}>{check.title}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{check.code}</div>
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
              <li>Вся инженерная логика выполняется в Python backend — без расчётов на стороне браузера.</li>
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

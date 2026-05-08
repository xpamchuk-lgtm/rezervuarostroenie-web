import React, { useEffect, useMemo, useState } from "react";
import Seo from "../components/Seo";

type SectionId = "main" | "shell" | "bottom" | "roof" | "metal" | "insulation" | "results";

type ReservoirModel = Record<string, any>;
type YesNo = "Да" | "Нет";

type Check = { code: string; title: string; status?: string; result?: string; value?: number; limit?: number; unit?: string; note?: string };
type ReviewFlag = { level: string; title: string; note: string };
type CompletenessItem = { field: string; title: string; value: string; filled: boolean; critical: boolean };
type CalcResult = {
  meta?: { title?: string; tank_type?: string; reservoir_class?: string; reservoir_class_auto?: string; terrain_type?: string };
  normative?: string[];
  summary?: {
    volume_m3?: number;
    fluid_mass_kg?: number;
    steel_mass_kg?: number;
    total_mass_kg?: number;
    total_load_kN?: number;
    sigma_max_mpa?: number;
    min_reserve?: number;
    controlling_belt?: number;
    final_ok?: boolean;
  };
  belts?: Array<Record<string, any>>;
  check_items?: Check[];
  checks?: Record<string, boolean>;
  data_completeness?: { filled?: number; total?: number; percent?: number; missing?: CompletenessItem[]; items?: CompletenessItem[] };
  review_flags?: ReviewFlag[];
  scope?: { performed?: string[]; pending?: string[] };
};

type SiteOptions = Record<string, string[]>;

type MainState = {
  diameterSelect: string;
  diameterOther: string;
  heightSelect: string;
  heightOther: string;
  fillMode: "percent" | "level";
  fillValue: string;
  medium: string;
  density: string;
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
  tankType: "РВС" | "РВСП" | "РВСПК";
  reservoirClass: string;
  serviceLifeYears: string;
  cyclesPerYear: string;
  vacuumKpa: string;
  gasBalanceSystem: string;
  terrainType: "A" | "B" | "C";
  foundationLimitKpa: string;
  frictionCoeff: string;
  productTempMin: string;
  productTempMax: string;
  ambientTempMax: string;
};

type ShellRowEditable = {
  h: string;
  tol: string;
  grade: string;
  tDesired: string;
  corr: string;
};

type ShellRowComputed = ShellRowEditable & {
  tMin: number;
  tFinal: number;
  midM: number;
};

type ShellState = {
  method: "Рулонный" | "Полистовой";
  pGas: string;
  pTest: string;
  pTestAuto: boolean;
  rows: ShellRowEditable[];
};

type BottomState = {
  hasRing: "with_ring" | "no_ring";
  bottomSteel: string;
  bottomMinus: string;
  bottomTDesired: string;
  bottomCorr: string;
  ringSteel: string;
  ringMinus: string;
  ringTDesired: string;
  ringCorr: string;
};

type RoofType = "conical" | "conical_framed" | "frame_panel";

type RoofState = {
  type: RoofType;
  alpha: string;
  frameSpacing: string;
  hasToeAngle: boolean;
  toeAngleSize: string;
  deckSteel: string;
  deckMinus: string;
  deckCorr: string;
  deckTDesired: string;
  frameSteel: string;
  toeSteel: string;
  massUser: string;
};

type MetalState = {
  servicePlatform: YesNo;
  servicePlatformMassUser: string;
  ladder: YesNo;
  ladderType: "Шахтная" | "Винтовая" | "Стремянка";
  ladderMassUser: string;
  foamPlatform: YesNo;
  foamCount: string;
  foamUnitMass: string;
  lightning: YesNo;
  lightningCount: string;
  lightningUnitMass: string;
  irrigation: YesNo;
  pipeOd: string;
  pipeT: string;
  irrigationMassUser: string;
};

type InsulationState = {
  enabled: YesNo;
  fastenersMassUser: string;
  wallMaterial: string;
  wallDensity: string;
  wallThickness: string;
  roofMaterial: string;
  roofDensity: string;
  roofThickness: string;
  galvanizedEnabled: YesNo;
  galvanizedThickness: string;
};

type SiteNormsResponse = {
  wind_region?: string;
  w0?: string;
  snow_region?: string;
  sg?: string;
  seismic?: string;
  t5?: string;
  tmin_abs?: string;
};

const sections: Array<{ id: SectionId; label: string; note?: string }> = [
  { id: "main", label: "Основные данные", note: "Геометрия, заполнение, среда, район" },
  { id: "shell", label: "Стенка", note: "Пояса и давление" },
  { id: "bottom", label: "Днище", note: "Исполнение и толщины" },
  { id: "roof", label: "Крыша", note: "Тип кровли, снег, масса" },
  { id: "metal", label: "Металлоконструкции", note: "Лестницы, площадки, трубы" },
  { id: "insulation", label: "Теплоизоляция", note: "Крепления ТИ и их масса" },
  { id: "results", label: "Характеристики и действия", note: "Паспорт модели резервуара" },
];

const typicalDiametersMm = ["4730", "6630", "7580", "8530", "10430", "11920", "15180", "18980", "22800", "28500", "34200", "39900", "45600", "56900", "60700", "76000", "95400", "Другое"];
const typicalHeightsMm = [...Array.from({ length: Math.floor(17880 / 1490) }, (_, i) => String((i + 1) * 1490)), "Другое"];
const mediumDensity: Record<string, number> = {
  "Вода": 1000,
  "Вода техническая": 1000,
  "Нефть (средняя)": 850,
  "Дизель": 830,
  "Бензин": 740,
  "Керосин": 800,
  "Мазут": 950,
  "Битум (80°C)": 1030,
  "КАС-32 (удобрение)": 1320,
  "Масло индустриальное": 900,
  "Масло трансформаторное": 880,
  "Масло растительное": 920,
};
const steelOptions = ["09Г2С", "16ГС", "Ст3сп", "10ХСНД", "12Х18Н10Т"];
const toeSizes = ["63x63x5", "70x70x5", "75x75x6","75x75x8","75x75x10", "90x90x6","90x90x8","90x90x10", "100x100x8","100x100x10", "125x125x10", "140x140x10", "160x160x10"];
const pipeOdOptions = ["57", "76", "89", "108", "114", "127", "133", "159"];
const pipeTOptions = ["3.0", "3.5", "4.0", "5.0", "6.0"];
const roofTypeLabels: Record<RoofType, string> = {
  conical: "Коническая",
  conical_framed: "Коническая каркасная",
  frame_panel: "Каркасно-щитовая",
};
const snowRegionToSg: Record<string, number> = {
  "I": 0.8,
  "II": 1.2,
  "III": 1.8,
  "IV": 2.4,
  "V": 3.2,
  "VI": 4.0,
  "VII": 4.8,
  "VIII": 5.6,
};

const insulationMaterialDensity: Record<string, number> = {
  "Минеральная вата": 80,
  "Пенополиуретан (ППУ)": 60,
  "Экструдированный пенополистирол": 35,
};
const galvanizedSteelDensity = 7850;

const INSULATION_FASTENERS_A = 0.134624697;
const INSULATION_FASTENERS_B = 0.0705380503;
const INSULATION_FASTENERS_C = -1054.41646;

function num(value: string | number | undefined | null, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ceilMm(value: number): number {
  return Math.max(0, Math.ceil(value));
}

function formatNumber(value: number | undefined | null, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function checkStatusLabel(value?: string): string {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("pass") || raw.includes("ok") || raw.includes("соответ")) return "OK";
  if (raw.includes("fail") || raw.includes("не ") || raw.includes("крит")) return "НЕ ОК";
  return value || "—";
}

function reviewLevelLabel(level?: string): string {
  switch ((level || "").toLowerCase()) {
    case "critical":
      return "Критично";
    case "important":
      return "Важно";
    case "advice":
      return "Рекомендация";
    default:
      return level || "—";
  }
}

function reviewLevelStyle(level?: string): React.CSSProperties {
  const kind = (level || "").toLowerCase();
  if (kind === "critical") return { border: "1px solid #f1aeb5", background: "#fdecec" };
  if (kind === "important") return { border: "1px solid #f3cf6b", background: "#fff4ce" };
  return { border: "1px solid #b7d7c0", background: "#e7f4ea" };
}

function getDiameterMm(main: MainState): number {
  return main.diameterSelect === "Другое" ? num(main.diameterOther, 20000) : num(main.diameterSelect, 11920);
}

function getHeightMm(main: MainState): number {
  return main.heightSelect === "Другое" ? num(main.heightOther, 12000) : num(main.heightSelect, 11920);
}

function circleArea(diameterM: number): number {
  return Math.PI * diameterM * diameterM / 4;
}

function cylinderVolume(diameterM: number, heightM: number): number {
  return circleArea(diameterM) * heightM;
}

function gost31385MinShellMm(diameterM: number): number {
  if (diameterM <= 10) return 4;
  if (diameterM <= 16) return 5;
  if (diameterM <= 25) return 6;
  if (diameterM <= 40) return 8;
  if (diameterM <= 65) return 10;
  return 12;
}

function buildShellRows(heightMm: number, prev: ShellRowEditable[] = []): ShellRowEditable[] {
  const base = 1490;
  const safeHeight = Math.max(base, Math.round(heightMm));
  const count = Math.max(1, Math.ceil(safeHeight / base));
  const rows: ShellRowEditable[] = [];
  let remaining = safeHeight;
  for (let i = 0; i < count; i += 1) {
    const h = i < count - 1 ? base : Math.max(0, remaining);
    remaining -= h;
    const old = prev[i];
    rows.push({
      h: i < count - 1 ? String(base) : String(Math.max(0, remaining + h)),
      tol: old?.tol ?? "0",
      grade: old?.grade ?? "09Г2С",
      tDesired: old?.tDesired ?? "",
      corr: old?.corr ?? "0",
    });
  }
  if (rows.length > 1) {
    const sumExceptLast = rows.slice(0, -1).reduce((acc, row) => acc + num(row.h, base), 0);
    rows[rows.length - 1] = { ...rows[rows.length - 1], h: String(Math.max(0, safeHeight - sumExceptLast)) };
  }
  return rows;
}

function parseAngleSize(value: string): [number, number, number] | null {
  const parts = value.toLowerCase().replace(/х/g, "x").split("x").map((item) => num(item));
  if (parts.length !== 3 || parts.some((item) => item <= 0)) return null;
  return [parts[0], parts[1], parts[2]];
}

function angleAreaMm2(size: string): number {
  const parsed = parseAngleSize(size);
  if (!parsed) return 0;
  const [a, b, t] = parsed;
  return Math.max(0, t * (a + b - t));
}

function pipeMassPerMeterKg(outerDiameterMm: number, thicknessMm: number): number {
  if (outerDiameterMm <= 0 || thicknessMm <= 0 || thicknessMm >= outerDiameterMm) return 0;
  return 0.02466 * (outerDiameterMm - thicknessMm) * thicknessMm;
}

function useSiteOptions(): SiteOptions {
  const [options, setOptions] = useState<SiteOptions>({});
  useEffect(() => {
    let cancelled = false;
    fetch("/api/site/options")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("site options"))))
      .then((data) => {
        if (!cancelled && data && typeof data.regions === "object") {
          setOptions(data.regions as SiteOptions);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="muted" style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700 }}>{children}</label>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
  unit,
  options,
  disabled = false,
  min,
  max,
  step,
}: {
  label: string;
  value: string | number;
  onChange?: (next: string) => void;
  type?: "text" | "number";
  readOnly?: boolean;
  unit?: string;
  options?: string[];
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="field">
      <Label>{label}</Label>
      {options ? (
        <div className="input-unit">
          <select value={String(value)} onChange={(event) => onChange?.(event.target.value)} disabled={disabled || readOnly}>
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {unit && <span className="unit-chip">{unit}</span>}
        </div>
      ) : (
        <div className="input-unit">
          <input
            type={type}
            value={String(value)}
            onChange={(event) => onChange?.(event.target.value)}
            readOnly={readOnly}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
          />
          {unit && <span className="unit-chip">{unit}</span>}
        </div>
      )}
    </div>
  );
}

function ToggleGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (next: T) => void }) {
  return (
    <div className="field">
      <Label>{label}</Label>
      <div className="segmented">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "segmented-item active" : "segmented-item"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card pad">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 22 }}>{title}</div>
        {subtitle && <div className="muted" style={{ marginTop: 4 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export default function RvsCalc() {
  const siteOptions = useSiteOptions();
  const [active, setActive] = useState<SectionId>("main");
  const [main, setMain] = useState<MainState>({
    diameterSelect: "10430",
    diameterOther: "",
    heightSelect: typicalHeightsMm[7] ?? typicalHeightsMm[0],
    heightOther: "",
    fillMode: "percent",
    fillValue: "92",
    medium: "Вода",
    density: "1000",
    region: "",
    city: "",
    windRegion: "II",
    w0: "0.30",
    snowRegion: "III",
    sg: "1.80",
    t5: "-26",
    tminAbs: "-43",
    seismic: "6",
    seisLevel: "B",
    tankType: "РВС",
    reservoirClass: "",
    serviceLifeYears: "30",
    cyclesPerYear: "50",
    vacuumKpa: "0.5",
    gasBalanceSystem: "Не задано",
    terrainType: "A",
    foundationLimitKpa: "200",
    frictionCoeff: "0.35",
    productTempMin: "",
    productTempMax: "",
    ambientTempMax: "",
  });
  const [shell, setShell] = useState<ShellState>({
    method: "Рулонный",
    pGas: "0.005",
    pTest: "0.00625",
    pTestAuto: true,
    rows: buildShellRows(num(typicalHeightsMm[7] ?? typicalHeightsMm[0])),
  });
  const [bottom, setBottom] = useState<BottomState>({
    hasRing: "with_ring",
    bottomSteel: steelOptions[0],
    bottomMinus: "0.3",
    bottomTDesired: "",
    bottomCorr: "0",
    ringSteel: steelOptions[0],
    ringMinus: "0.3",
    ringTDesired: "",
    ringCorr: "0",
  });
  const [roof, setRoof] = useState<RoofState>({
    type: "conical",
    alpha: "15",
    frameSpacing: "3.2",
    hasToeAngle: true,
    toeAngleSize: "63x63x5",
    deckSteel: steelOptions[0],
    deckMinus: "0.0",
    deckCorr: "0",
    deckTDesired: "",
    frameSteel: steelOptions[0],
    toeSteel: steelOptions[0],
    massUser: "",
  });
  const [metal, setMetal] = useState<MetalState>({
    servicePlatform: "Нет",
    servicePlatformMassUser: "",
    ladder: "Нет",
    ladderType: "Шахтная",
    ladderMassUser: "",
    foamPlatform: "Нет",
    foamCount: "1",
    foamUnitMass: "",
    lightning: "Нет",
    lightningCount: "1",
    lightningUnitMass: "",
    irrigation: "Нет",
    pipeOd: pipeOdOptions[0],
    pipeT: pipeTOptions[0],
    irrigationMassUser: "",
  });

  const [insulation, setInsulation] = useState<InsulationState>({
    enabled: "Нет",
    fastenersMassUser: "",
    wallMaterial: "Минеральная вата",
    wallDensity: String(insulationMaterialDensity["Минеральная вата"]),
    wallThickness: "50",
    roofMaterial: "Минеральная вата",
    roofDensity: String(insulationMaterialDensity["Минеральная вата"]),
    roofThickness: "50",
    galvanizedEnabled: "Да",
    galvanizedThickness: "0.7",
  });
  const [result, setResult] = useState<CalcResult | null>(null);
  const [reservoirModel, setReservoirModel] = useState<ReservoirModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [siteLookupState, setSiteLookupState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const diameterMm = useMemo(() => getDiameterMm(main), [main]);
  const heightMm = useMemo(() => getHeightMm(main), [main]);
  const diameterM = diameterMm / 1000;
  const heightM = heightMm / 1000;

  const derivedMain = useMemo(() => {
    const fullVolume = cylinderVolume(diameterM, heightM);
    const rawValue = num(main.fillValue);
    let levelMm = 0;
    let fillWarn = "";
    if (main.fillMode === "percent") {
      const limited = clamp(rawValue, 0, 98);
      if (rawValue > 98) fillWarn = "Заполнение ограничено 98% от геометрического объёма.";
      levelMm = heightMm * limited / 100;
    } else {
      const limited = clamp(rawValue, 0, heightMm * 0.98);
      if (rawValue > heightMm * 0.98) fillWarn = "Уровень ограничен 0.98·H (98% по высоте).";
      levelMm = limited;
    }
    const usefulVolume = fullVolume * (heightMm > 0 ? levelMm / heightMm : 0);
    return {
      fullVolume,
      usefulVolume,
      levelMm,
      fillWarn,
    };
  }, [diameterM, heightM, heightMm, main.fillMode, main.fillValue]);

  useEffect(() => {
    setShell((prev) => {
      const nextRows = buildShellRows(heightMm, prev.rows);
      const same = nextRows.length === prev.rows.length && nextRows.every((row, index) => {
        const old = prev.rows[index];
        return old && row.h === old.h && row.tol === old.tol && row.grade === old.grade && row.tDesired === old.tDesired && row.corr === old.corr;
      });
      return same ? prev : { ...prev, rows: nextRows };
    });
  }, [heightMm]);

  useEffect(() => {
    if (!shell.pTestAuto) return;
    const next = String(Number((num(shell.pGas) * 1.25).toFixed(6)));
    setShell((prev) => (prev.pTest === next ? prev : { ...prev, pTest: next }));
  }, [shell.pGas, shell.pTestAuto]);

  useEffect(() => {
    if (!main.region || !siteOptions[main.region]?.length) return;
    if (!siteOptions[main.region].includes(main.city)) {
      setMain((prev) => ({ ...prev, city: siteOptions[prev.region][0] ?? "" }));
    }
  }, [main.region, main.city, siteOptions]);

  const shellComputed = useMemo<ShellRowComputed[]>(() => {
    const sigmaAllowPa = 230e6;
    const rho = num(main.density, 1000);
    const hFillM = derivedMain.levelMm / 1000;
    const pGasPa = Math.max(0, num(shell.pGas)) * 1_000_000;
    const pTestPa = Math.max(0, num(shell.pTest)) * 1_000_000;
    let zMm = 0;
    return shell.rows.map((row) => {
      const hMm = Math.max(0, num(row.h, 1490));
      const midM = (zMm + hMm / 2) / 1000;
      zMm += hMm;
      const hOp = Math.max(0, hFillM - midM);
      const pOpPa = rho * 9.80665 * hOp + pGasPa;
      const pHtPa = 1000 * 9.80665 * Math.max(0, heightM - midM) + pTestPa;
      const tHydroMm = diameterM > 0 ? Math.max(pOpPa, pHtPa) * diameterM / (2 * sigmaAllowPa) * 1000 : 0;
      const tReq = Math.max(4, gost31385MinShellMm(diameterM), Number(tHydroMm.toFixed(2)));
      const tol = Math.abs(num(row.tol));
      const tMin = Math.max(0, tReq + tol);
      const base = num(row.tDesired) > 0 ? num(row.tDesired) : tMin;
      const tFinal = ceilMm(base + num(row.corr));
      return { ...row, tMin, tFinal, midM };
    });
  }, [shell.rows, shell.pGas, shell.pTest, main.density, derivedMain.levelMm, diameterM, heightM]);

  const shellWarnings = useMemo(() => shellComputed
    .map((row, index) => (num(row.tDesired) > 0 && num(row.tDesired) + 1e-9 < row.tMin ? `Пояс ${index + 1}: желаемая толщина меньше t_min.` : ""))
    .filter(Boolean), [shellComputed]);

  const bottomComputed = useMemo(() => {
    const fullVolume = derivedMain.fullVolume;
    const tMinCentralBase = fullVolume < 2000 ? 4 : 6;
    const bottomMinus = Math.abs(num(bottom.bottomMinus, 0.3));
    const ringMinus = Math.abs(num(bottom.ringMinus, 0.3));
    const firstRow = shellComputed[0];
    const t1BeforeCorr = firstRow ? Math.max(0, firstRow.tFinal - num(firstRow.corr)) : 0;
    const t1Net = Math.max(0, t1BeforeCorr - Math.abs(num(firstRow?.tol, 0)));
    const radiusMm = diameterMm / 2;
    let ringBase = tMinCentralBase;
    if (radiusMm > 0 && t1Net > 0) {
      const factor = 0.77 - 0.0024 * Math.sqrt(radiusMm / t1Net);
      ringBase = Math.max(tMinCentralBase, factor * t1Net);
    }
    const bottomTMin = tMinCentralBase + bottomMinus;
    const ringTMin = ringBase + ringMinus;
    const bottomFinal = ceilMm(Math.max(bottomTMin, num(bottom.bottomTDesired) || bottomTMin) + num(bottom.bottomCorr));
    const ringFinal = ceilMm(Math.max(ringTMin, num(bottom.ringTDesired) || ringTMin) + num(bottom.ringCorr));
    const bottomDiameterMm = bottom.hasRing === "with_ring" ? diameterMm + 200 : diameterMm;
    const ringWidthMm = bottom.hasRing === "with_ring" ? 1490 : 0;
    const centerDiameterMm = Math.max(0, bottomDiameterMm - 2 * ringWidthMm);
    const warn = bottom.hasRing === "no_ring" && fullVolume > 1000
      ? `Внимание: V=${fullVolume.toFixed(1)} м³ > 1000 м³. По ГОСТ 31385-2023 днище без окрайки применяется только по обоснованию проекта.`
      : "";
    return { bottomTMin, ringTMin, bottomFinal, ringFinal, bottomDiameterMm, ringWidthMm, centerDiameterMm, warn, fullVolume };
  }, [bottom, shellComputed, derivedMain.fullVolume, diameterMm]);

  const roofComputed = useMemo(() => {
    const alpha = roof.type === "frame_panel" ? clamp(num(roof.alpha, 3), 3, 9) : clamp(num(roof.alpha, 15), 10, 25);
    const snowKPa = num(main.sg, 0);
    const snowKgm2 = snowKPa * 1000 / 9.81;
    const Rm = diameterMm / 2000;
    const snowMass = Math.PI * Rm * Rm * snowKgm2;
    const tMinDeck = 4;
    const deckFinal = ceilMm(Math.max(tMinDeck, num(roof.deckTDesired) || tMinDeck) + num(roof.deckCorr) + num(roof.deckMinus));
    let autoMass = 0;
    let shellMass = 0;
    let toeMass = 0;
    let ribsMass = 0;
    let ribsCount = 0;
    let ribsRec = "";
    let gostWarn = "";
    const R = diameterM / 2;
    if (diameterMm > 0 && deckFinal > 0) {
      const cosAlpha = Math.max(Math.cos(alpha * Math.PI / 180), 1e-9);
      const area = Math.PI * (R ** 2) / cosAlpha;
      shellMass = area * (deckFinal / 1000) * 7850;
      if (roof.hasToeAngle) {
        toeMass = Math.PI * diameterM * (angleAreaMm2(roof.toeAngleSize) / 1e6) * 7850;
      }
      if (roof.type === "conical_framed") {
        ribsCount = Math.max(4, Math.ceil((Math.PI * diameterM) / 3));
        if (ribsCount % 4 !== 0) ribsCount += 4 - (ribsCount % 4);
        const step = ribsCount > 0 ? Math.PI * diameterM / ribsCount : 0;
        ribsRec = `n=${ribsCount} (шаг ${step.toFixed(2)} м по окружности)`;
        const length = R / Math.max(cosAlpha, 1e-9);
        ribsMass = ribsCount * length * 10.4;
      }
      if (roof.type === "frame_panel") {
        const kD = 1.458 + (5392 / Math.max(1, diameterMm));
        autoMass = shellMass * kD;
      } else {
        autoMass = shellMass + toeMass + ribsMass;
      }
      if (roof.type === "conical") {
        const warns: string[] = [];
        if (diameterMm > 12500) warns.push("D > 12.5 м");
        if (alpha < 15 || alpha > 30) warns.push("α вне 15…30°");
        if (warns.length) gostWarn = `Внимание: ${warns.join("; ")}.`;
      }
    }
    const usedMass = num(roof.massUser) > 0 ? num(roof.massUser) : autoMass;
    let toeRecommendation = "";
    if ((roof.type === "conical" || roof.type === "conical_framed") && diameterMm > 0 && alpha > 0) {
      const Rmm = diameterMm / 2;
      const planAreaMm2 = Math.PI * Rmm * Rmm;
      const selfPressureMpa = planAreaMm2 > 0 ? 1.05 * shellMass * 9.81 / planAreaMm2 : 0;
      const snowPressureMpa = snowKPa * 0.001;
      const requiredArea = (selfPressureMpa + snowPressureMpa) * (Rmm ** 2) / (2 * 160 * Math.tan(alpha * Math.PI / 180));
      toeRecommendation = toeSizes.find((size) => angleAreaMm2(size) >= requiredArea) ?? "";
    }
    return {
      alpha,
      snowKPa,
      snowKgm2,
      snowMass,
      deckFinal,
      autoMass,
      usedMass,
      ribsCount,
      ribsRec,
      gostWarn,
      toeRecommendation,
      frameSpacing: roof.type === "frame_panel" ? clamp(num(roof.frameSpacing, 3.2), 0.5, 3.2) : num(roof.frameSpacing, 3.2),
    };
  }, [roof, main.sg, diameterMm, diameterM]);

  const metalComputed = useMemo(() => {
    const hM = heightM;
    const circumferenceM = Math.PI * diameterM;
    const ladderTypes = hM <= 5 + 1e-9 ? ["Шахтная", "Винтовая", "Стремянка"] : ["Шахтная", "Винтовая"];

    // Внимание: для площадки обслуживания и лестницы формулы взяты по рабочим значениям из локального UI v2,
    // предоставленным пользователем на скриншотах (D=11.92 м -> 1303 кг, H=11.92 м, шахтная лестница -> 3605 кг).
    // Поэтому web-версия повторяет фактическое поведение рабочей локальной сборки, а не архивной ревизии без формулы.
    const servicePlatformKgPerMeter = 34.79511591421806;
    const ladderKgPerMeterByType: Record<MetalState["ladderType"], number> = {
      "Шахтная": 302.43288590604027,
      "Винтовая": 408.2843966241544,
      "Стремянка": 136.09479865771812,
    };
    const foamUnitDefault = 360;
    const lightningUnitDefault = 105;

    const servicePlatformCalc = metal.servicePlatform === "Да" ? circumferenceM * servicePlatformKgPerMeter : 0;
    const servicePlatformUsed = metal.servicePlatform === "Да"
      ? (num(metal.servicePlatformMassUser) > 0 ? num(metal.servicePlatformMassUser) : servicePlatformCalc)
      : 0;

    const ladderCalc = metal.ladder === "Да" ? hM * ladderKgPerMeterByType[metal.ladderType] : 0;
    const ladderUsed = metal.ladder === "Да"
      ? (num(metal.ladderMassUser) > 0 ? num(metal.ladderMassUser) : ladderCalc)
      : 0;

    const foamUnitMass = metal.foamPlatform === "Да"
      ? (num(metal.foamUnitMass) > 0 ? num(metal.foamUnitMass) : foamUnitDefault)
      : 0;
    const foamTotal = metal.foamPlatform === "Да" ? num(metal.foamCount) * foamUnitMass : 0;

    const lightningUnitMass = metal.lightning === "Да"
      ? (num(metal.lightningUnitMass) > 0 ? num(metal.lightningUnitMass) : lightningUnitDefault)
      : 0;
    const lightningTotal = metal.lightning === "Да" ? num(metal.lightningCount) * lightningUnitMass : 0;

    const irrMass = metal.irrigation === "Да"
      ? (Math.PI * diameterM + 2 * hM) * pipeMassPerMeterKg(num(metal.pipeOd), num(metal.pipeT))
      : 0;
    const irrigationUsed = metal.irrigation === "Да"
      ? (num(metal.irrigationMassUser) > 0 ? num(metal.irrigationMassUser) : irrMass)
      : 0;
    const totalMass = servicePlatformUsed + ladderUsed + foamTotal + lightningTotal + irrigationUsed;
    return {
      ladderTypes,
      servicePlatformCalc,
      servicePlatformUsed,
      ladderCalc,
      ladderUsed,
      foamUnitMass,
      foamTotal,
      lightningUnitMass,
      lightningTotal,
      irrigationCalc: irrMass,
      irrigationUsed,
      totalMass,
    };
  }, [metal, diameterM, heightM]);

  const insulationComputed = useMemo(() => {
    const sideArea = Math.PI * diameterM * heightM;
    const roofArea = roof.type === "frame_panel" || roof.type === "conical" || roof.type === "conical_framed"
      ? Math.PI * (diameterM / 2) ** 2 / Math.max(Math.cos(roofComputed.alpha * Math.PI / 180), 1e-9)
      : 0;
    const wallThicknessM = Math.max(0, num(insulation.wallThickness)) / 1000;
    const roofThicknessM = Math.max(0, num(insulation.roofThickness)) / 1000;
    const wallDensity = Math.max(0, num(insulation.wallDensity));
    const roofDensity = Math.max(0, num(insulation.roofDensity));
    const wallMass = insulation.enabled === "Да" ? sideArea * wallThicknessM * wallDensity : 0;
    const roofMass = insulation.enabled === "Да" ? roofArea * roofThicknessM * roofDensity : 0;
    const fastenersCalcMass = insulation.enabled === "Да"
      ? Math.max(0, INSULATION_FASTENERS_A * diameterMm + INSULATION_FASTENERS_B * heightMm + INSULATION_FASTENERS_C)
      : 0;
    const fastenersUsedMass = insulation.enabled === "Да"
      ? (num(insulation.fastenersMassUser) > 0 ? num(insulation.fastenersMassUser) : fastenersCalcMass)
      : 0;
    const claddingArea = insulation.enabled === "Да" ? ((wallThicknessM > 0 ? sideArea : 0) + (roofThicknessM > 0 ? roofArea : 0)) : 0;
    const galvanizedThicknessM = Math.max(0, num(insulation.galvanizedThickness)) / 1000;
    const galvanizedMass = insulation.enabled === "Да" && insulation.galvanizedEnabled === "Да"
      ? 1.1 * claddingArea * galvanizedThicknessM * galvanizedSteelDensity
      : 0;
    const totalMass = fastenersUsedMass + wallMass + roofMass + galvanizedMass;
    return {
      diameterMm,
      heightMm,
      sideArea,
      roofArea,
      fastenersCalcMass,
      fastenersUsedMass,
      wallMass,
      roofMass,
      galvanizedMass,
      totalMass,
      claddingArea,
    };
  }, [insulation, diameterMm, heightMm, diameterM, heightM, roof.type, roofComputed.alpha]);


  const shellMassCalc = useMemo(() => shellComputed.reduce((acc, row) => (
    acc + Math.PI * diameterM * (num(row.h) / 1000) * (row.tFinal / 1000) * 7850
  ), 0), [shellComputed, diameterM]);

  const bottomMassCalc = useMemo(() => {
    const bottomDiameterM = bottomComputed.bottomDiameterMm / 1000;
    const planArea = circleArea(bottomDiameterM);
    if (planArea <= 0) return { total: 0, center: 0, ring: 0 };
    if (bottom.hasRing !== "with_ring") {
      const total = planArea * (bottomComputed.bottomFinal / 1000) * 7850;
      return { total, center: total, ring: 0 };
    }
    const outerR = bottomDiameterM / 2;
    const ringWidthM = bottomComputed.ringWidthMm / 1000;
    const innerR = Math.max(0, outerR - ringWidthM);
    const ringArea = Math.PI * Math.max(0, outerR * outerR - innerR * innerR);
    const centerArea = Math.max(0, planArea - ringArea);
    const center = centerArea * (bottomComputed.bottomFinal / 1000) * 7850;
    const ring = ringArea * (bottomComputed.ringFinal / 1000) * 7850;
    return { total: center + ring, center, ring };
  }, [bottom.hasRing, bottomComputed]);

  const liveTotals = useMemo(() => {
    const fluidMass = num(main.density, 1000) * derivedMain.usefulVolume;
    const steelMass = shellMassCalc + bottomMassCalc.total + roofComputed.usedMass + metalComputed.totalMass + insulationComputed.totalMass;
    const snowMass = roofComputed.snowMass;
    const totalMass = steelMass + fluidMass + snowMass;
    return {
      fluidMass,
      steelMass,
      snowMass,
      totalMass,
      roofMass: roofComputed.usedMass,
      metalMass: metalComputed.totalMass,
      insulationMass: insulationComputed.totalMass,
      insulationFastenersMass: insulationComputed.fastenersUsedMass,
      insulationWallMass: insulationComputed.wallMass,
      insulationRoofMass: insulationComputed.roofMass,
      insulationGalvanizedMass: insulationComputed.galvanizedMass,
      shellMass: shellMassCalc,
      bottomMass: bottomMassCalc.total,
      bottomCenterMass: bottomMassCalc.center,
      bottomRingMass: bottomMassCalc.ring,
      metalServicePlatformMass: metalComputed.servicePlatformUsed,
      metalLadderMass: metalComputed.ladderUsed,
      metalFoamMass: metalComputed.foamTotal,
      metalLightningMass: metalComputed.lightningTotal,
      metalIrrigationMass: metalComputed.irrigationUsed,
    };
  }, [main.density, derivedMain.usefulVolume, shellMassCalc, bottomMassCalc, roofComputed, metalComputed, insulationComputed]);
  useEffect(() => {
    if (!metalComputed.ladderTypes.includes(metal.ladderType)) {
      setMetal((prev) => ({ ...prev, ladderType: metalComputed.ladderTypes[0] as MetalState["ladderType"] }));
    }
  }, [metalComputed.ladderTypes, metal.ladderType]);

  const summary = useMemo(() => ({
    diameterMm,
    heightMm,
    fullVolume: derivedMain.fullVolume,
    usefulVolume: derivedMain.usefulVolume,
    roofType: roofTypeLabels[roof.type],
    regionCity: [main.region, main.city].filter(Boolean).join(", ") || "—",
    totalMass: liveTotals.totalMass,
    steelMass: liveTotals.steelMass,
    fluidMass: liveTotals.fluidMass,
  }), [diameterMm, heightMm, derivedMain, roof.type, main.region, main.city, liveTotals]);

   async function applySiteNorms() {
  if (!main.region || !main.city) return;
  setSiteLookupState("loading");
  try {
    const query = new URLSearchParams({ region: main.region, city: main.city });
    const response = await fetch(`/api/site/norms?${query.toString()}`);
    if (!response.ok) throw new Error("lookup");
    const data = (await response.json()) as SiteNormsResponse;

    setMain((prev) => {
      const nextSnowRegion = data.snow_region || prev.snowRegion;
      const mappedSg = snowRegionToSg[nextSnowRegion];

      return {
        ...prev,
        windRegion: data.wind_region || prev.windRegion,
        w0: data.w0 || prev.w0,
        snowRegion: nextSnowRegion,
        sg: data.sg || (mappedSg !== undefined ? mappedSg.toFixed(2) : prev.sg),
        seismic: data.seismic || prev.seismic,
        t5: data.t5 || prev.t5,
        tminAbs: data.tmin_abs || prev.tminAbs,
      };
    });

    setSiteLookupState("done");
  } catch {
    setSiteLookupState("error");
  }
}

  function buildReservoirModel(): ReservoirModel {
    return {
      generated_at: new Date().toISOString(),
      title: `РВС ${formatNumber(diameterMm, 0)}x${formatNumber(heightMm, 0)}`,
      geometry: {
        diameter_mm: diameterMm,
        diameter_m: diameterM,
        height_mm: heightMm,
        height_m: heightM,
        shell_courses_count: shellComputed.length,
        full_volume_m3: derivedMain.fullVolume,
        useful_volume_m3: derivedMain.usefulVolume,
        fill_level_mm: derivedMain.levelMm,
        fill_percent: heightMm > 0 ? derivedMain.levelMm / heightMm * 100 : 0,
        plan_area_m2: circleArea(diameterM),
        circumference_m: Math.PI * diameterM,
      },
      product: {
        medium: main.medium,
        density_kg_m3: num(main.density, 1000),
        fill_mode: main.fillMode,
        fill_value: num(main.fillValue),
        product_mass_kg: liveTotals.fluidMass,
      },
      site: {
        region: main.region,
        city: main.city,
        wind_region: main.windRegion,
        wind_pressure_kpa: num(main.w0, 0.3),
        snow_region: main.snowRegion,
        snow_pressure_kpa: num(main.sg, 0),
        t5_c: num(main.t5),
        tmin_abs_c: num(main.tminAbs),
        seismic: main.seismic,
        seismic_level: main.seisLevel,
        terrain_type: main.terrainType,
        foundation_limit_kpa: num(main.foundationLimitKpa, 200),
        friction_coeff: num(main.frictionCoeff, 0.35),
      },
      shell: {
        method: shell.method,
        p_gas_mpa: num(shell.pGas),
        p_test_mpa: num(shell.pTest),
        mass_kg: liveTotals.shellMass,
        courses: shellComputed.map((row, index) => ({
          index: index + 1,
          height_mm: num(row.h),
          minus_tolerance_mm: num(row.tol),
          steel_grade: row.grade,
          t_min_mm: row.tMin,
          t_desired_mm: num(row.tDesired),
          corr_mm: num(row.corr),
          t_final_mm: row.tFinal,
          mid_m: row.midM,
        })),
      },
      bottom: {
        execution: bottom.hasRing === "with_ring" ? "с окрайкой" : "без окрайки",
        bottom_steel: bottom.bottomSteel,
        bottom_minus_mm: num(bottom.bottomMinus),
        bottom_t_min_mm: bottomComputed.bottomTMin,
        bottom_t_final_mm: bottomComputed.bottomFinal,
        bottom_corr_mm: num(bottom.bottomCorr),
        ring_steel: bottom.ringSteel,
        ring_minus_mm: num(bottom.ringMinus),
        ring_t_min_mm: bottomComputed.ringTMin,
        ring_t_final_mm: bottomComputed.ringFinal,
        ring_corr_mm: num(bottom.ringCorr),
        bottom_diameter_mm: bottomComputed.bottomDiameterMm,
        ring_width_mm: bottomComputed.ringWidthMm,
        center_diameter_mm: bottomComputed.centerDiameterMm,
        center_mass_kg: liveTotals.bottomCenterMass,
        ring_mass_kg: liveTotals.bottomRingMass,
        mass_kg: liveTotals.bottomMass,
        warning: bottomComputed.warn,
      },
      roof: {
        type_code: roof.type,
        type_label: roofTypeLabels[roof.type],
        alpha_deg: roofComputed.alpha,
        deck_steel: roof.deckSteel,
        deck_minus_mm: num(roof.deckMinus),
        deck_t_min_mm: 4,
        deck_t_final_mm: roofComputed.deckFinal,
        frame_steel: roof.frameSteel,
        toe_steel: roof.toeSteel,
        has_toe_angle: roof.hasToeAngle,
        toe_angle_size: roof.toeAngleSize,
        toe_angle_recommended: roofComputed.toeRecommendation,
        frame_spacing_m: roofComputed.frameSpacing,
        ribs_count: roofComputed.ribsCount,
        snow_load_kpa: roofComputed.snowKPa,
        snow_mass_kg: liveTotals.snowMass,
        auto_mass_kg: roofComputed.autoMass,
        used_mass_kg: roofComputed.usedMass,
        gost_warning: roofComputed.gostWarn,
      },
      metal: {
        total_mass_kg: liveTotals.metalMass,
        service_platform: { enabled: metal.servicePlatform === "Да", calc_mass_kg: metalComputed.servicePlatformCalc, used_mass_kg: metalComputed.servicePlatformUsed },
        ladder: { enabled: metal.ladder === "Да", type: metal.ladderType, calc_mass_kg: metalComputed.ladderCalc, used_mass_kg: metalComputed.ladderUsed },
        foam_platform: { enabled: metal.foamPlatform === "Да", count: num(metal.foamCount), unit_mass_kg: metalComputed.foamUnitMass, total_mass_kg: metalComputed.foamTotal },
        lightning: { enabled: metal.lightning === "Да", count: num(metal.lightningCount), unit_mass_kg: metalComputed.lightningUnitMass, total_mass_kg: metalComputed.lightningTotal },
        irrigation: { enabled: metal.irrigation === "Да", pipe_od_mm: num(metal.pipeOd), pipe_t_mm: num(metal.pipeT), calc_mass_kg: metalComputed.irrigationCalc, used_mass_kg: metalComputed.irrigationUsed, route_length_m: Math.PI * diameterM + 2 * heightM },
      },
      insulation: {
        enabled: insulation.enabled === "Да",
        total_mass_kg: liveTotals.insulationMass,
        fasteners_mass_kg: insulationComputed.fastenersUsedMass,
        wall_mass_kg: insulationComputed.wallMass,
        roof_mass_kg: insulationComputed.roofMass,
        galvanized_mass_kg: insulationComputed.galvanizedMass,
        wall_material: insulation.wallMaterial,
        wall_density_kg_m3: num(insulation.wallDensity),
        wall_thickness_mm: num(insulation.wallThickness),
        roof_material: insulation.roofMaterial,
        roof_density_kg_m3: num(insulation.roofDensity),
        roof_thickness_mm: num(insulation.roofThickness),
        galvanized_enabled: insulation.galvanizedEnabled === "Да",
        galvanized_thickness_mm: num(insulation.galvanizedThickness),
      },
      design_basis: {
        tank_type: main.tankType,
        reservoir_class: main.reservoirClass,
        service_life_years: num(main.serviceLifeYears),
        cycles_per_year: num(main.cyclesPerYear),
        vacuum_kpa: num(main.vacuumKpa),
        gas_balance_system: main.gasBalanceSystem,
        terrain_type: main.terrainType,
        product_temp_min_c: main.productTempMin === "" ? "" : num(main.productTempMin),
        product_temp_max_c: main.productTempMax === "" ? "" : num(main.productTempMax),
        ambient_temp_max_c: main.ambientTempMax === "" ? "" : num(main.ambientTempMax),
      },
      masses: {
        shell_kg: liveTotals.shellMass,
        bottom_kg: liveTotals.bottomMass,
        roof_kg: liveTotals.roofMass,
        metal_kg: liveTotals.metalMass,
        insulation_kg: liveTotals.insulationMass,
        steel_kg: liveTotals.steelMass,
        product_kg: liveTotals.fluidMass,
        snow_kg: liveTotals.snowMass,
        total_kg: liveTotals.totalMass,
      },
    };
  }

  async function downloadReport(endpoint: string, filename: string) {
    const model = reservoirModel ?? buildReservoirModel();
    setReportLoading(endpoint);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Не удалось сформировать отчет");
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка формирования отчета");
    } finally {
      setReportLoading(null);
    }
  }

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const model = buildReservoirModel();
      setReservoirModel(model);
      const response = await fetch("/api/rvs/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Не удалось выполнить инженерную проверку модели");
      }
      const data = await response.json();
      setResult((data?.result || null) as CalcResult | null);
      setActive("results");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка формирования характеристик");
    } finally {
      setLoading(false);
    }
  }

function setMainField<K extends keyof MainState>(key: K, value: MainState[K]) {
  setMain((prev) => {
    const next = { ...prev, [key]: value };
    if (key === "medium" && value in mediumDensity) {
      next.density = String(mediumDensity[value as keyof typeof mediumDensity]);
    }
    if (key === "snowRegion") {
      const mapped = snowRegionToSg[String(value)] ?? num(prev.sg, 0);
      next.sg = mapped.toFixed(2);
    }
    return next;
  });
}

  function setShellField<K extends keyof ShellState>(key: K, value: ShellState[K]) {
    setShell((prev) => ({ ...prev, [key]: value }));
  }

  function setShellRow(index: number, patch: Partial<ShellRowEditable>) {
    setShell((prev) => ({ ...prev, rows: prev.rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)) }));
  }

  function setBottomField<K extends keyof BottomState>(key: K, value: BottomState[K]) {
    setBottom((prev) => ({ ...prev, [key]: value }));
  }

  function setRoofField<K extends keyof RoofState>(key: K, value: RoofState[K]) {
    setRoof((prev) => ({ ...prev, [key]: value }));
  }

  function setMetalField<K extends keyof MetalState>(key: K, value: MetalState[K]) {
    setMetal((prev) => ({ ...prev, [key]: value }));
  }

  function setInsulationField<K extends keyof InsulationState>(key: K, value: InsulationState[K]) {
    setInsulation((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "wallMaterial" && typeof value === "string" && value in insulationMaterialDensity) {
        next.wallDensity = String(insulationMaterialDensity[value]);
      }
      if (key === "roofMaterial" && typeof value === "string" && value in insulationMaterialDensity) {
        next.roofDensity = String(insulationMaterialDensity[value]);
      }
      return next;
    });
  }

  function renderMainSection() {
    const regionOptions = Object.keys(siteOptions);
    const cityOptions = main.region && siteOptions[main.region] ? siteOptions[main.region] : [];
    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionCard title="Основные данные" subtitle="Геометрические размеры резервуара.">
          <div className="row2">
            <Field label="Диаметр резервуара D" value={main.diameterSelect} onChange={(value) => setMainField("diameterSelect", value)} options={typicalDiametersMm} unit="мм" />
            {main.diameterSelect === "Другое" && <Field label="Диаметр D (пользовательский)" value={main.diameterOther} onChange={(value) => setMainField("diameterOther", value)} type="number" unit="мм" />}
          </div>
          <div className="row2" style={{ marginTop: 12 }}>
            <Field label="Высота стенки H" value={main.heightSelect} onChange={(value) => setMainField("heightSelect", value)} options={typicalHeightsMm} unit="мм" />
            {main.heightSelect === "Другое" && <Field label="Высота H (пользовательская)" value={main.heightOther} onChange={(value) => setMainField("heightOther", value)} type="number" unit="мм" />}
          </div>
          <div className="hint-block" style={{ marginTop: 12 }}>Типоразмеры взяты по Таблице 1 ГОСТ 31385-2023; высота — кратна 1490 мм.</div>
        </SectionCard>

        <SectionCard title="Заполнение и среда">
          <div className="row2">
            <ToggleGroup
              label="Режим заполнения"
              value={main.fillMode}
              onChange={(value) => setMainField("fillMode", value)}
              options={[{ value: "percent", label: "уровень, %" }, { value: "level", label: "уровень, мм" }]}
            />
            <Field label="Значение заполнения" value={main.fillValue} onChange={(value) => setMainField("fillValue", value)} type="number" unit={main.fillMode === "percent" ? "%" : "мм"} />
          </div>
          <div className="row3" style={{ marginTop: 12 }}>
            <Field label="Полный объём" value={derivedMain.fullVolume.toFixed(2)} readOnly unit="м³" />
            <Field label="Полезный объём" value={derivedMain.usefulVolume.toFixed(2)} readOnly unit="м³" />
            <Field label="Уровень налива" value={derivedMain.levelMm.toFixed(0)} readOnly unit="мм" />
          </div>
          {derivedMain.fillWarn && <div className="warn-inline" style={{ marginTop: 12 }}>{derivedMain.fillWarn}</div>}
          <div className="row2" style={{ marginTop: 12 }}>
            <Field label="Среда (продукт)" value={main.medium} onChange={(value) => setMainField("medium", value)} options={Object.keys(mediumDensity)} />
            <Field label="Плотность продукта" value={main.density} onChange={(value) => setMainField("density", value)} type="number" unit="кг/м³" />
          </div>
        </SectionCard>

        <SectionCard title="Нормативная постановка задачи" subtitle="Поля ниже позволяют собрать действительно проектную модель, а не только геометрию.">
          <div className="row4">
            <Field label="Тип резервуара" value={main.tankType} onChange={(value) => setMainField("tankType", value as MainState["tankType"])} options={["РВС", "РВСП", "РВСПК"]} />
            <Field label="Класс резервуара" value={main.reservoirClass} onChange={(value) => setMainField("reservoirClass", value)} options={["", "КС-2б", "КС-2а", "КС-3б", "КС-3а"]} />
            <Field label="Срок службы" value={main.serviceLifeYears} onChange={(value) => setMainField("serviceLifeYears", value)} type="number" unit="лет" />
            <Field label="Циклы/год" value={main.cyclesPerYear} onChange={(value) => setMainField("cyclesPerYear", value)} type="number" unit="шт" />
          </div>
          <div className="row4" style={{ marginTop: 12 }}>
            <Field label="Относительный вакуум" value={main.vacuumKpa} onChange={(value) => setMainField("vacuumKpa", value)} type="number" unit="кПа" />
            <Field label="Допускаемое давление на основание" value={main.foundationLimitKpa} onChange={(value) => setMainField("foundationLimitKpa", value)} type="number" unit="кПа" />
            <Field label="Коэффициент трения" value={main.frictionCoeff} onChange={(value) => setMainField("frictionCoeff", value)} type="number" unit="—" />
            <Field label="Тип местности" value={main.terrainType} onChange={(value) => setMainField("terrainType", value as MainState["terrainType"])} options={["A", "B", "C"]} />
          </div>
          <div className="row4" style={{ marginTop: 12 }}>
            <Field label="ГО / УЛФ / инертирование" value={main.gasBalanceSystem} onChange={(value) => setMainField("gasBalanceSystem", value)} options={["Не задано", "ГО", "УЛФ", "ГО + УЛФ", "Инертирование"]} />
            <Field label="Мин. температура продукта" value={main.productTempMin} onChange={(value) => setMainField("productTempMin", value)} type="number" unit="°C" />
            <Field label="Макс. температура продукта" value={main.productTempMax} onChange={(value) => setMainField("productTempMax", value)} type="number" unit="°C" />
            <Field label="Макс. наружная температура" value={main.ambientTempMax} onChange={(value) => setMainField("ambientTempMax", value)} type="number" unit="°C" />
          </div>
        </SectionCard>

        <SectionCard title="Район установки">
          <div className="row2">
            {regionOptions.length > 0 ? (
              <Field label="Регион / субъект РФ" value={main.region} onChange={(value) => setMainField("region", value)} options={["", ...regionOptions]} />
            ) : (
              <Field label="Регион / субъект РФ" value={main.region} onChange={(value) => setMainField("region", value)} />
            )}
            {cityOptions.length > 0 ? (
              <Field label="Город / населённый пункт" value={main.city} onChange={(value) => setMainField("city", value)} options={["", ...cityOptions]} />
            ) : (
              <Field label="Город / населённый пункт" value={main.city} onChange={(value) => setMainField("city", value)} />
            )}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={applySiteNorms} disabled={!main.region || !main.city || siteLookupState === "loading"}>
              {siteLookupState === "loading" ? "Подстановка..." : "Подставить нормативы по региону/городу"}
            </button>
            {siteLookupState === "done" && <span className="muted">Нормативы обновлены.</span>}
            {siteLookupState === "error" && <span style={{ color: "#b42318", fontWeight: 700 }}>Не удалось найти нормативы для выбранного населённого пункта.</span>}
          </div>
          <div className="row3" style={{ marginTop: 12 }}>
            <Field label="Ветровой район" value={main.windRegion} onChange={(value) => setMainField("windRegion", value)} options={["Iа", "I", "II", "III", "IV", "V", "VI", "VII"]} />
            <Field label="Ветровая нагрузка" value={main.w0} onChange={(value) => setMainField("w0", value)} type="number" unit="кПа" />
            <Field label="Снеговой район" value={main.snowRegion} onChange={(value) => setMainField("snowRegion", value)} options={["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]} />
          </div>
          <div className="row3" style={{ marginTop: 12 }}>
            <Field label="Снеговая нагрузка" value={main.sg} onChange={(value) => setMainField("sg", value)} type="number" unit="кПа" />
            <Field label="Минус пятидневки" value={main.t5} onChange={(value) => setMainField("t5", value)} type="number" unit="°C" />
            <Field label="Абсолютный минус" value={main.tminAbs} onChange={(value) => setMainField("tminAbs", value)} type="number" unit="°C" />
          </div>
          <div className="row2" style={{ marginTop: 12 }}>
            <Field label="Сейсмичность района" value={main.seismic} onChange={(value) => setMainField("seismic", value)} options={["5", "6", "7", "8", "9"]} />
            <Field label="Степень сейсмоопасности ОСР-97" value={main.seisLevel} onChange={(value) => setMainField("seisLevel", value as MainState["seisLevel"])} options={["A", "B", "C"]} />
          </div>
          <div className="row4" style={{ marginTop: 12 }}>
            <Field label="Диаметр днища" value={formatNumber(bottomComputed.bottomDiameterMm, 0)} readOnly unit="мм" />
            <Field label="Ширина окрайки" value={formatNumber(bottomComputed.ringWidthMm, 0)} readOnly unit="мм" />
            <Field label="Толщина окрайки" value={bottom.hasRing === "with_ring" ? formatNumber(bottomComputed.ringFinal, 0) : "—"} readOnly unit="мм" />
            <Field label="Масса окрайки" value={bottom.hasRing === "with_ring" ? formatNumber(liveTotals.bottomRingMass, 0) : "—"} readOnly unit="кг" />
          </div>
          <div className="row3" style={{ marginTop: 12 }}>
            <Field label="Диаметр центральной части" value={bottom.hasRing === "with_ring" ? formatNumber(bottomComputed.centerDiameterMm, 0) : "—"} readOnly unit="мм" />
            <Field label="Масса центральной части" value={formatNumber(liveTotals.bottomCenterMass, 0)} readOnly unit="кг" />
            <Field label="Масса днища всего" value={formatNumber(liveTotals.bottomMass, 0)} readOnly unit="кг" />
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderShellSection() {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionCard title="Стенка" subtitle="Пояса снизу вверх. Высота пояса базово 1490 мм.">
          <div className="row-shell-top">
            <ToggleGroup label="Метод изготовления стенки" value={shell.method} onChange={(value) => setShellField("method", value)} options={[{ value: "Рулонный", label: "Рулонный" }, { value: "Полистовой", label: "Полистовой" }]} />
            <Field label="Избыточное давление" value={shell.pGas} onChange={(value) => setShellField("pGas", value)} type="number" unit="МПа" />
            <Field label="Испытательное давление" value={shell.pTest} onChange={(value) => { setShell((prev) => ({ ...prev, pTest: value, pTestAuto: false })); }} type="number" unit="МПа" />
          </div>
          <div className="table-card" style={{ marginTop: 14 }}>
            <table className="data-table shell-table">
              <thead>
                <tr>
                  <th>Пояс</th>
                  <th>Высота, мм</th>
                  <th>Минус допуск, мм</th>
                  <th>Марка стали</th>
                  <th>t_min, мм</th>
                  <th>Желаемая t, мм</th>
                  <th>Коррозия, мм</th>
                  <th>t_итог, мм</th>
                </tr>
              </thead>
              <tbody>
                {shellComputed.map((row, index) => (
                  <tr key={`course-${index + 1}`}>
                    <td>{index + 1}</td>
                    <td><input value={row.h} onChange={(event) => setShellRow(index, { h: event.target.value })} /></td>
                    <td><input value={row.tol} onChange={(event) => setShellRow(index, { tol: event.target.value })} /></td>
                    <td>
                      <select value={row.grade} onChange={(event) => setShellRow(index, { grade: event.target.value })}>
                        {steelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </td>
                    <td><input value={row.tMin.toFixed(2)} readOnly /></td>
                    <td><input value={row.tDesired} onChange={(event) => setShellRow(index, { tDesired: event.target.value })} /></td>
                    <td>
                      <select value={row.corr} onChange={(event) => setShellRow(index, { corr: event.target.value })}>
                        {Array.from({ length: 7 }, (_, idx) => String(idx)).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </td>
                    <td><input value={String(row.tFinal)} readOnly /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shellWarnings.length > 0 && <div className="warn-inline" style={{ marginTop: 12 }}>{shellWarnings.slice(0, 3).join(" | ")}</div>}
          <div className="hint-block" style={{ marginTop: 12 }}>t_min считается от гидростатики, гидроиспытания и минимальной толщины по ГОСТ 31385-2023.</div>
        </SectionCard>
      </div>
    );
  }

  function renderBottomSection() {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionCard title="Днище" subtitle="Исполнение зависит от диаметра и объема резервуара.">
          <ToggleGroup
            label="Исполнение днища"
            value={bottom.hasRing}
            onChange={(value) => setBottomField("hasRing", value)}
            options={[{ value: "with_ring", label: "с окрайкой" }, { value: "no_ring", label: "без окрайки" }]}
          />
          <div className="table-card" style={{ marginTop: 14 }}>
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Элемент</th>
                  <th>Марка стали</th>
                  <th>Минус допуск, мм</th>
                  <th>t_min, мм</th>
                  <th>Желаемая t, мм</th>
                  <th>Коррозия, мм</th>
                  <th>t_итог, мм</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Днище</td>
                  <td><select value={bottom.bottomSteel} onChange={(event) => setBottomField("bottomSteel", event.target.value)}>{steelOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                  <td><input value={bottom.bottomMinus} onChange={(event) => setBottomField("bottomMinus", event.target.value)} /></td>
                  <td><input value={bottomComputed.bottomTMin.toFixed(2)} readOnly /></td>
                  <td><input value={bottom.bottomTDesired} onChange={(event) => setBottomField("bottomTDesired", event.target.value)} /></td>
                  <td><select value={bottom.bottomCorr} onChange={(event) => setBottomField("bottomCorr", event.target.value)}>{Array.from({ length: 13 }, (_, idx) => String(idx)).map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                  <td><input value={String(bottomComputed.bottomFinal)} readOnly /></td>
                </tr>
                {bottom.hasRing === "with_ring" && (
                  <tr>
                    <td>Окрайка</td>
                    <td><select value={bottom.ringSteel} onChange={(event) => setBottomField("ringSteel", event.target.value)}>{steelOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                    <td><input value={bottom.ringMinus} onChange={(event) => setBottomField("ringMinus", event.target.value)} /></td>
                    <td><input value={bottomComputed.ringTMin.toFixed(2)} readOnly /></td>
                    <td><input value={bottom.ringTDesired} onChange={(event) => setBottomField("ringTDesired", event.target.value)} /></td>
                    <td><select value={bottom.ringCorr} onChange={(event) => setBottomField("ringCorr", event.target.value)}>{Array.from({ length: 13 }, (_, idx) => String(idx)).map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                    <td><input value={String(bottomComputed.ringFinal)} readOnly /></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderRoofSection() {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionCard title="Крыша" subtitle="Калькулятор считает массу кровли.">
          <ToggleGroup
            label="Тип кровли"
            value={roof.type}
            onChange={(value) => setRoofField("type", value)}
            options={[{ value: "conical", label: "Коническая" }, { value: "conical_framed", label: "Коническая каркасная" }, { value: "frame_panel", label: "Каркасно-щитовая" }]}
          />
          <div className="row3" style={{ marginTop: 12 }}>
            <Field label="Уклон кровли α" value={roof.alpha} onChange={(value) => setRoofField("alpha", value)} type="number" unit="°" />
            <Field label="Снеговая нагрузка S" value={roofComputed.snowKPa.toFixed(3)} readOnly unit="кПа" />
            <Field label="Масса снега" value={roofComputed.snowKgm2.toFixed(1)} readOnly unit="кг/м²" />
          </div>
          <div className="hint-block" style={{ marginTop: 12 }}>{roof.type === "frame_panel" ? "Допустимый диапазон уклона 3…9°." : "Допустимый диапазон уклона 10…25°. Для бескаркасной конической ГОСТ рекомендует 15…30°."}</div>
          {roofComputed.gostWarn && <div className="warn-inline" style={{ marginTop: 12 }}>{roofComputed.gostWarn}</div>}
        </SectionCard>

        <SectionCard title="Настил кровли">
          <div className="row4">
            <Field label="Марка стали" value={roof.deckSteel} onChange={(value) => setRoofField("deckSteel", value)} options={steelOptions} />
            <Field label="Минус допуск" value={roof.deckMinus} onChange={(value) => setRoofField("deckMinus", value)} type="number" unit="мм" />
            <Field label="t_min" value="4" readOnly unit="мм" />
            <Field label="Желаемая t" value={roof.deckTDesired} onChange={(value) => setRoofField("deckTDesired", value)} type="number" unit="мм" />
          </div>
          <div className="row4" style={{ marginTop: 12 }}>
            <Field label="Коррозия" value={roof.deckCorr} onChange={(value) => setRoofField("deckCorr", value)} type="number" unit="мм" />
            <Field label="t_итог" value={String(roofComputed.deckFinal)} readOnly unit="мм" />
            <Field label="Масса кровли (расчёт)" value={String(Math.round(roofComputed.autoMass))} readOnly unit="кг" />
            <Field label="Масса кровли (исп.)" value={String(Math.round(roofComputed.usedMass))} readOnly unit="кг" />
          </div>
          <div className="row2" style={{ marginTop: 12 }}>
            <Field label="Масса кровли (ввод пользователя)" value={roof.massUser} onChange={(value) => setRoofField("massUser", value)} type="number" unit="кг" />
            <div className="field">
              <Label>Уторный уголок</Label>
              <div className="segmented">
                <button type="button" className={roof.hasToeAngle ? "segmented-item active" : "segmented-item"} onClick={() => setRoofField("hasToeAngle", true)}>Есть</button>
                <button type="button" className={!roof.hasToeAngle ? "segmented-item active" : "segmented-item"} onClick={() => setRoofField("hasToeAngle", false)}>Нет</button>
              </div>
            </div>
          </div>
          {roof.hasToeAngle && (
            <div className="row3" style={{ marginTop: 12 }}>
              <Field label="Рекомендованный уголок" value={roofComputed.toeRecommendation || "—"} readOnly />
              <Field label="Марка стали уголка" value={roof.toeSteel} onChange={(value) => setRoofField("toeSteel", value)} options={steelOptions} />
            </div>
          )}
        </SectionCard>

        {(roof.type === "conical_framed" || roof.type === "frame_panel") && (
          <SectionCard title="Каркас кровли">
            <div className="row3">
              <Field label="Марка стали каркаса" value={roof.frameSteel} onChange={(value) => setRoofField("frameSteel", value)} options={steelOptions} />
              {roof.type === "frame_panel" ? (
                <Field label="Радиальный шаг балок" value={roof.frameSpacing} onChange={(value) => setRoofField("frameSpacing", value)} type="number" unit="м" />
              ) : (
                <Field label="Рёбра швеллер 12П" value={roofComputed.ribsCount > 0 ? String(roofComputed.ribsCount) : ""} readOnly unit="шт" />
              )}
              <Field label="Справка" value={roof.type === "conical_framed" ? roofComputed.ribsRec || "—" : `Шаг ≤ 3.2 м, сейчас ${roofComputed.frameSpacing.toFixed(2)} м`} readOnly />
            </div>
          </SectionCard>
        )}
      </div>
    );
  }

  function renderMetalSection() {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionCard title="Металлоконструкции" subtitle="Вес металлоконструкций взят на основе проектов КМ.">
          <div className="grid" style={{ gap: 14 }}>
            <div className="card panel-card">
              <div className="panel-title">Площадка обслуживания</div>
              <div className="row4">
                <Field label="Наличие" value={metal.servicePlatform} onChange={(value) => setMetalField("servicePlatform", value as YesNo)} options={["Нет", "Да"]} />
                <Field label="Масса (ввод)" value={metal.servicePlatformMassUser} onChange={(value) => setMetalField("servicePlatformMassUser", value)} type="number" unit="кг" disabled={metal.servicePlatform !== "Да"} />
                <Field label="Масса (расчёт)" value={metal.servicePlatform === "Да" && metalComputed.servicePlatformCalc > 0 ? String(Math.round(metalComputed.servicePlatformCalc)) : ""} readOnly unit="кг" />
                <Field label="Масса (используемая)" value={metal.servicePlatform === "Да" ? String(Math.round(metalComputed.servicePlatformUsed)) : ""} readOnly unit="кг" />
              </div>
            </div>

            <div className="card panel-card">
              <div className="panel-title">Лестница</div>
              <div className="row5">
                <Field label="Наличие" value={metal.ladder} onChange={(value) => setMetalField("ladder", value as YesNo)} options={["Нет", "Да"]} />
                <Field label="Тип лестницы" value={metal.ladderType} onChange={(value) => setMetalField("ladderType", value as MetalState["ladderType"])} options={metalComputed.ladderTypes} disabled={metal.ladder !== "Да"} />
                <Field label="Масса (ввод)" value={metal.ladderMassUser} onChange={(value) => setMetalField("ladderMassUser", value)} type="number" unit="кг" disabled={metal.ladder !== "Да"} />
                <Field label="Масса (расчёт)" value={metal.ladder === "Да" ? String(Math.round(metalComputed.ladderCalc)) : ""} readOnly unit="кг" />
                <Field label="Масса (исп.)" value={metal.ladder === "Да" ? String(Math.round(metalComputed.ladderUsed)) : ""} readOnly unit="кг" />
              </div>
            </div>

            <div className="card panel-card">
              <div className="panel-title">Площадка обслуживания пеногенератора</div>
              <div className="row4">
                <Field label="Наличие" value={metal.foamPlatform} onChange={(value) => setMetalField("foamPlatform", value as YesNo)} options={["Нет", "Да"]} />
                <Field label="Количество" value={metal.foamCount} onChange={(value) => setMetalField("foamCount", value)} options={["1", "2", "3", "4", "5"]} disabled={metal.foamPlatform !== "Да"} />
                <Field label="Масса/шт" value={metal.foamPlatform === "Да" && !metal.foamUnitMass ? String(metalComputed.foamUnitMass) : metal.foamUnitMass} onChange={(value) => setMetalField("foamUnitMass", value)} type="number" unit="кг" disabled={metal.foamPlatform !== "Да"} />
                <Field label="Итого" value={metal.foamPlatform === "Да" ? String(Math.round(metalComputed.foamTotal)) : ""} readOnly unit="кг" />
              </div>
            </div>

            <div className="card panel-card">
              <div className="panel-title">Молниеприёмник</div>
              <div className="row4">
                <Field label="Наличие" value={metal.lightning} onChange={(value) => setMetalField("lightning", value as YesNo)} options={["Нет", "Да"]} />
                <Field label="Количество" value={metal.lightningCount} onChange={(value) => setMetalField("lightningCount", value)} options={["1", "2", "3", "4", "5"]} disabled={metal.lightning !== "Да"} />
                <Field label="Масса/шт" value={metal.lightning === "Да" && !metal.lightningUnitMass ? String(metalComputed.lightningUnitMass) : metal.lightningUnitMass} onChange={(value) => setMetalField("lightningUnitMass", value)} type="number" unit="кг" disabled={metal.lightning !== "Да"} />
                <Field label="Итого" value={metal.lightning === "Да" ? String(Math.round(metalComputed.lightningTotal)) : ""} readOnly unit="кг" />
              </div>
            </div>

            <div className="card panel-card">
              <div className="panel-title">Кольцевая труба орошения</div>
              <div className="row4">
                <Field label="Наличие" value={metal.irrigation} onChange={(value) => setMetalField("irrigation", value as YesNo)} options={["Нет", "Да"]} />
                <Field label="Труба Dн" value={metal.pipeOd} onChange={(value) => setMetalField("pipeOd", value)} options={pipeOdOptions} unit="мм" disabled={metal.irrigation !== "Да"} />
                <Field label="Толщина t" value={metal.pipeT} onChange={(value) => setMetalField("pipeT", value)} options={pipeTOptions} unit="мм" disabled={metal.irrigation !== "Да"} />
                <Field label="Масса (ввод)" value={metal.irrigationMassUser} onChange={(value) => setMetalField("irrigationMassUser", value)} type="number" unit="кг" disabled={metal.irrigation !== "Да"} />
              </div>
              <div className="row3" style={{ marginTop: 12 }}>
                <Field label="Масса (расчёт)" value={metal.irrigation === "Да" ? String(Math.round(metalComputed.irrigationCalc)) : ""} readOnly unit="кг" />
                <Field label="Длина трассы" value={metal.irrigation === "Да" ? formatNumber(Math.PI * diameterM + 2 * heightM, 2) : ""} readOnly unit="м" />
                <Field label="Масса (используемая)" value={metal.irrigation === "Да" ? String(Math.round(metalComputed.irrigationUsed)) : ""} readOnly unit="кг" />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderInsulationSection() {
    const materialOptions = Object.keys(insulationMaterialDensity);
    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionCard title="Теплоизоляция" subtitle="Крепления ТИ считаются на основе проектов ТИ металоконструкции выполнены из полосовой стали 40х4. Материалы стенки и крыши считаются по геометрии резервуара, толщине и плотности.">
          <div className="grid" style={{ gap: 14 }}>
            <div className="card panel-card">
              <div className="panel-title">Крепление теплоизоляции</div>
              <div className="row4">
                <Field label="Наличие" value={insulation.enabled} onChange={(value) => setInsulationField("enabled", value as YesNo)} options={["Нет", "Да"]} />
                <Field label="Масса (ввод)" value={insulation.fastenersMassUser} onChange={(value) => setInsulationField("fastenersMassUser", value)} type="number" unit="кг" disabled={insulation.enabled !== "Да"} />
                <Field label="Масса (расчёт)" value={insulation.enabled === "Да" ? String(Math.round(insulationComputed.fastenersCalcMass)) : ""} readOnly unit="кг" />
                <Field label="Масса (используемая)" value={insulation.enabled === "Да" ? String(Math.round(insulationComputed.fastenersUsedMass)) : ""} readOnly unit="кг" />
              </div>
              <div className="row3" style={{ marginTop: 12 }}>
                <Field label="Диаметр из основных данных" value={String(diameterMm)} readOnly unit="мм" />
                <Field label="Высота из основных данных" value={String(heightMm)} readOnly unit="мм" />
                <Field label="Площадь боковой поверхности" value={formatNumber(insulationComputed.sideArea, 2)} readOnly unit="м²" />
              </div>
            </div>

            <div className="card panel-card">
              <div className="panel-title">Материал теплоизоляции — стенка</div>
              <div className="row4">
                <Field label="Материал" value={insulation.wallMaterial} onChange={(value) => setInsulationField("wallMaterial", value)} options={materialOptions} disabled={insulation.enabled !== "Да"} />
                <Field label="Плотность" value={insulation.wallDensity} onChange={(value) => setInsulationField("wallDensity", value)} type="number" unit="кг/м³" disabled={insulation.enabled !== "Да"} />
                <Field label="Толщина" value={insulation.wallThickness} onChange={(value) => setInsulationField("wallThickness", value)} type="number" unit="мм" disabled={insulation.enabled !== "Да"} />
                <Field label="Вес итоговый" value={insulation.enabled === "Да" ? formatNumber(insulationComputed.wallMass, 0) : ""} readOnly unit="кг" />
              </div>
            </div>

            <div className="card panel-card">
              <div className="panel-title">Материал теплоизоляции — крыша</div>
              <div className="row4">
                <Field label="Материал" value={insulation.roofMaterial} onChange={(value) => setInsulationField("roofMaterial", value)} options={materialOptions} disabled={insulation.enabled !== "Да"} />
                <Field label="Плотность" value={insulation.roofDensity} onChange={(value) => setInsulationField("roofDensity", value)} type="number" unit="кг/м³" disabled={insulation.enabled !== "Да"} />
                <Field label="Толщина" value={insulation.roofThickness} onChange={(value) => setInsulationField("roofThickness", value)} type="number" unit="мм" disabled={insulation.enabled !== "Да"} />
                <Field label="Вес итоговый" value={insulation.enabled === "Да" ? formatNumber(insulationComputed.roofMass, 0) : ""} readOnly unit="кг" />
              </div>
              <div className="row2" style={{ marginTop: 12 }}>
                <Field label="Площадь покрытия крыши" value={formatNumber(insulationComputed.roofArea, 2)} readOnly unit="м²" />
                <Field label="Учитываемая геометрия" value={roofTypeLabels[roof.type]} readOnly />
              </div>
            </div>

            <div className="card panel-card">
              <div className="panel-title">Лист оцинкованный</div>
              <div className="row4">
                <Field label="Наличие" value={insulation.galvanizedEnabled} onChange={(value) => setInsulationField("galvanizedEnabled", value as YesNo)} options={["Нет", "Да"]} disabled={insulation.enabled !== "Да"} />
                <Field label="Толщина" value={insulation.galvanizedThickness} onChange={(value) => setInsulationField("galvanizedThickness", value)} type="number" unit="мм" disabled={insulation.enabled !== "Да" || insulation.galvanizedEnabled !== "Да"} />
                <Field label="Площадь обшивки" value={insulation.enabled === "Да" && insulation.galvanizedEnabled === "Да" ? formatNumber(insulationComputed.claddingArea * 1.1, 2) : ""} readOnly unit="м²" />
                <Field label="Вес итоговый" value={insulation.enabled === "Да" && insulation.galvanizedEnabled === "Да" ? formatNumber(insulationComputed.galvanizedMass, 0) : ""} readOnly unit="кг" />
              </div>
            </div>

            <div className="card panel-card">
              <div className="panel-title">Итог по теплоизоляции</div>
              <div className="row4">
                <Field label="Крепления ТИ" value={insulation.enabled === "Да" ? formatNumber(insulationComputed.fastenersUsedMass, 0) : ""} readOnly unit="кг" />
                <Field label="Теплоизоляция стенки" value={insulation.enabled === "Да" ? formatNumber(insulationComputed.wallMass, 0) : ""} readOnly unit="кг" />
                <Field label="Теплоизоляция крыши" value={insulation.enabled === "Да" ? formatNumber(insulationComputed.roofMass, 0) : ""} readOnly unit="кг" />
                <Field label="Лист оцинкованный" value={insulation.enabled === "Да" ? formatNumber(insulationComputed.galvanizedMass, 0) : ""} readOnly unit="кг" />
              </div>
              <div className="row2" style={{ marginTop: 12 }}>
                <Field label="Теплоизоляция всего" value={insulation.enabled === "Да" ? formatNumber(insulationComputed.totalMass, 0) : ""} readOnly unit="кг" />
                <Field label="Принцип расчёта" value="m = A × t × ρ; лист оцинкованный = 1.1 × A × t × 7850" readOnly />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderResultsSection() {
    const model = reservoirModel;
    const review = result;
    const belts = (review?.belts || []) as Array<Record<string, any>>;
    const checkItems = review?.check_items || [];
    const missingItems = review?.data_completeness?.missing || [];
    const flags = review?.review_flags || [];
    const performed = review?.scope?.performed || [];
    const pending = review?.scope?.pending || [];

    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionCard title="Инженерная проверка модели и дальнейшие действия" subtitle="Сайт теперь выполняет автоматизированную инженерную ревизию расчетной модели, а не просто собирает геометрию.">
          {!model && <div className="hint-block">Нажмите «Сформировать характеристики», чтобы собрать модель и выполнить автоматизированную инженерную проверку.</div>}
          {model && (
            <>
              <div className="row4">
                <Field label="Диаметр" value={formatNumber(model.geometry.diameter_mm, 0)} readOnly unit="мм" />
                <Field label="Высота" value={formatNumber(model.geometry.height_mm, 0)} readOnly unit="мм" />
                <Field label="Полный объём" value={formatNumber(model.geometry.full_volume_m3, 2)} readOnly unit="м³" />
                <Field label="Полезный объём" value={formatNumber(model.geometry.useful_volume_m3, 2)} readOnly unit="м³" />
              </div>

              <div className="row4" style={{ marginTop: 12 }}>
                <Field label="Тип резервуара" value={review?.meta?.tank_type || model.design_basis?.tank_type || "—"} readOnly />
                <Field label="Класс резервуара" value={review?.meta?.reservoir_class || review?.meta?.reservoir_class_auto || model.design_basis?.reservoir_class || "—"} readOnly />
                <Field label="Полнота исходных данных" value={review ? `${formatNumber(review.data_completeness?.percent ?? 0, 1)} %` : "—"} readOnly />
                <Field label="Итог инженерной проверки" value={review?.summary?.final_ok ? "соответствует" : "требует доработки"} readOnly />
              </div>

              <div className="row4" style={{ marginTop: 12 }}>
                <Field label="Макс. напряжение в стенке" value={formatNumber(review?.summary?.sigma_max_mpa, 3)} readOnly unit="МПа" />
                <Field label="Минимальный запас" value={formatNumber(review?.summary?.min_reserve, 3)} readOnly unit="—" />
                <Field label="Определяющий пояс" value={formatNumber(review?.summary?.controlling_belt, 0)} readOnly unit="шт" />
                <Field label="Район установки" value={[model.site.region, model.site.city].filter(Boolean).join(", ") || "—"} readOnly />
              </div>

              {review?.normative && review.normative.length > 0 && (
                <div className="card panel-card" style={{ marginTop: 16 }}>
                  <div className="panel-title">Нормативная база, учтенная в движке проверки</div>
                  <div className="grid" style={{ gap: 8 }}>
                    {review.normative.map((item) => (
                      <div key={item} className="hint-block">{item}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="table-card" style={{ marginTop: 16 }}>
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Проверка</th>
                      <th>Статус</th>
                      <th>Значение</th>
                      <th>Предел / сравнение</th>
                      <th>Примечание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkItems.map((item) => (
                      <tr key={item.code}>
                        <td>{item.title}</td>
                        <td>{checkStatusLabel(item.status || item.result)}</td>
                        <td>{item.value !== undefined ? `${formatNumber(item.value, 3)} ${item.unit || ""}`.trim() : "—"}</td>
                        <td>{item.limit !== undefined ? `${formatNumber(item.limit, 3)} ${item.unit || ""}`.trim() : "—"}</td>
                        <td>{item.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="table-card" style={{ marginTop: 16 }}>
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Пояс</th>
                      <th>Высота, мм</th>
                      <th>t ном., мм</th>
                      <th>t эфф., мм</th>
                      <th>t треб. ном., мм</th>
                      <th>Запас</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {belts.map((belt) => (
                      <tr key={`belt-${belt.belt}`}>
                        <td>{formatNumber(belt.belt, 0)}</td>
                        <td>{formatNumber(belt.height_mm, 0)}</td>
                        <td>{formatNumber(belt.thickness_nominal_mm, 3)}</td>
                        <td>{formatNumber(belt.thickness_effective_mm, 3)}</td>
                        <td>{formatNumber(belt.thickness_required_nominal_mm, 3)}</td>
                        <td>{formatNumber(belt.reserve_ratio, 3)}</td>
                        <td>{belt.ok ? "OK" : "НЕ ОК"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid" style={{ gap: 12, marginTop: 16 }}>
                <div className="card panel-card">
                  <div className="panel-title">Замечания экспертизы</div>
                  {flags.length === 0 ? (
                    <div className="hint-block">Критических замечаний по автоматизированной проверке не сформировано.</div>
                  ) : (
                    <div className="grid" style={{ gap: 10 }}>
                      {flags.map((flag, index) => (
                        <div key={`${flag.title}-${index}`} style={{ padding: 12, borderRadius: 12, ...reviewLevelStyle(flag.level) }}>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>{reviewLevelLabel(flag.level)} — {flag.title}</div>
                          <div className="muted" style={{ color: "#344054" }}>{flag.note}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card panel-card">
                  <div className="panel-title">Полнота обязательных исходных данных</div>
                  <div className="row3" style={{ marginBottom: 12 }}>
                    <Field label="Заполнено пунктов" value={formatNumber(review?.data_completeness?.filled, 0)} readOnly unit="шт" />
                    <Field label="Всего контролируется" value={formatNumber(review?.data_completeness?.total, 0)} readOnly unit="шт" />
                    <Field label="Полнота" value={formatNumber(review?.data_completeness?.percent, 1)} readOnly unit="%" />
                  </div>
                  {missingItems.length > 0 ? (
                    <div className="table-card">
                      <table className="data-table compact">
                        <thead>
                          <tr>
                            <th>Не заполнено</th>
                            <th>Критичность</th>
                          </tr>
                        </thead>
                        <tbody>
                          {missingItems.map((item) => (
                            <tr key={item.field}>
                              <td>{item.title}</td>
                              <td>{item.critical ? "обязательно" : "желательно"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="hint-block">Все контролируемые поля исходных данных заполнены.</div>
                  )}
                </div>
              </div>

              <div className="grid" style={{ gap: 12, marginTop: 16 }}>
                <div className="card panel-card">
                  <div className="panel-title">Что сайт уже проверил</div>
                  <div className="grid" style={{ gap: 8 }}>
                    {performed.map((item, index) => (
                      <div key={`performed-${index}`} className="hint-block">{item}</div>
                    ))}
                  </div>
                </div>
                <div className="card panel-card">
                  <div className="panel-title">Что нужно считать отдельно как полноценный проект</div>
                  <div className="grid" style={{ gap: 8 }}>
                    {pending.map((item, index) => (
                      <div key={`pending-${index}`} className="warn-inline">{item}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
                <button className="btn primary" type="button" onClick={() => downloadReport("/api/rvs/strength-report", "rvs_strength_report.docx")} disabled={reportLoading !== null}>
                  {reportLoading === "/api/rvs/strength-report" ? "Формирование..." : "Сформировать экспертный отчёт по прочности"}
                </button>
                <button className="btn" type="button" onClick={() => downloadReport("/api/rvs/foundation-report", "rvs_foundation_report.docx")} disabled={reportLoading !== null}>
                  {reportLoading === "/api/rvs/foundation-report" ? "Формирование..." : "Сформировать отчёт по основанию"}
                </button>
                <button className="btn" type="button" onClick={() => downloadReport("/api/rvs/terms-of-reference", "rvs_terms_of_reference.docx")} disabled={reportLoading !== null}>
                  {reportLoading === "/api/rvs/terms-of-reference" ? "Формирование..." : "Сформировать профессиональное ТЗ"}
                </button>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderSection() {
    switch (active) {
      case "main":
        return renderMainSection();
      case "shell":
        return renderShellSection();
      case "bottom":
        return renderBottomSection();
      case "roof":
        return renderRoofSection();
      case "metal":
        return renderMetalSection();
      case "insulation":
        return renderInsulationSection();
      case "results":
        return renderResultsSection();
      default:
        return null;
    }
  }

  return (
    <div className="container">
      <Seo
        title="РВС калькулятор | Резервуаростроение"
        description="Калькулятор для предварительного инженерного расчёта вертикальных стальных резервуаров: геометрия, нагрузки, стенка, днище и кровля."
        canonical="https://rezervuarostroenie.ru/calc/rvs"
      />
      <div className="calc-layout">
        <aside className="card pad side sticky-side">
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>РВС калькулятор</div>
          <div className="muted" style={{ marginBottom: 14 }}>Инженерный калькулятор для расчёта вертикального стального резервуара.</div>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={active === section.id ? "side-link active" : "side-link"}
              onClick={() => setActive(section.id)}
            >
              <span>{section.label}</span>
              {section.note && <small>{section.note}</small>}
            </button>
          ))}
          <div className="side-actions">
            <button className="btn primary" type="button" onClick={calculate} disabled={loading}>{loading ? "Формирование..." : "Сформировать характеристики"}</button>
            {error && <div style={{ color: "#b42318", fontWeight: 800 }}>{error}</div>}
          </div>
        </aside>

        <main className="grid" style={{ gap: 16 }}>
          <div className="card pad">
            <div style={{ fontWeight: 900, fontSize: 26 }}>Вертикальный стальной резервуар (РВС)</div>
            <div className="muted" style={{ marginTop: 6 }}>Калькулятор предназначен для предварительного инженерного расчёта геометрических и конструктивных параметров вертикальных стальных резервуаров (РВС). Позволяет определить основные размеры резервуара, параметры днища и кровли, а также выполнить ориентировочный подбор элементов конструкции.</div>
          </div>
          {renderSection()}
        </main>

        <aside className="grid sticky-side" style={{ gap: 16 }}>
          <div className="card pad">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Геометрические характеристики</div>
            <div className="kpi"><span className="muted">Диаметр</span><b>{formatNumber(summary.diameterMm)} мм</b></div>
            <div className="kpi"><span className="muted">Высота</span><b>{formatNumber(summary.heightMm)} мм</b></div>
            <div className="kpi"><span className="muted">Полный объём</span><b>{formatNumber(summary.fullVolume, 2)} м³</b></div>
            <div className="kpi"><span className="muted">Полезный объём</span><b>{formatNumber(summary.usefulVolume, 2)} м³</b></div>
            <div className="kpi"><span className="muted">Район установки</span><b>{summary.regionCity}</b></div>
          </div>
          <div className="card pad">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Основные характеристики</div>
            <div className="kpi"><span className="muted">Поясов в стенке</span><b>{shellComputed.length}</b></div>
            <div className="kpi"><span className="muted">Масса стенки</span><b>{formatNumber( liveTotals.shellMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Днище</span><b>{bottom.hasRing === "with_ring" ? "с окрайкой" : "без окрайки"}</b></div>
            <div className="kpi"><span className="muted">Диаметр днища</span><b>{formatNumber(bottomComputed.bottomDiameterMm, 0)} мм</b></div>
            <div className="kpi"><span className="muted">Ширина окрайки</span><b>{bottom.hasRing === "with_ring" ? `${formatNumber(bottomComputed.ringWidthMm, 0)} мм` : "—"}</b></div>
            <div className="kpi"><span className="muted">Толщина окрайки</span><b>{bottom.hasRing === "with_ring" ? `${formatNumber(bottomComputed.ringFinal, 0)} мм` : "—"}</b></div>
            <div className="kpi"><span className="muted">Масса окрайки</span><b>{bottom.hasRing === "with_ring" ? `${formatNumber(liveTotals.bottomRingMass, 0)} кг` : "—"}</b></div>
            <div className="kpi"><span className="muted">Масса днища</span><b>{formatNumber( liveTotals.bottomMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Тип кровли</span><b>{summary.roofType}</b></div>
            <div className="kpi"><span className="muted">Масса кровли</span><b>{formatNumber(liveTotals.roofMass, 0)} кг</b></div>
          </div>
          <div className="card pad">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Металлоконструкции</div>
            <div className="kpi"><span className="muted">Площадка обслуживания</span><b>{formatNumber(liveTotals.metalServicePlatformMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Лестница</span><b>{formatNumber(liveTotals.metalLadderMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Площадка пеногенератора</span><b>{formatNumber(liveTotals.metalFoamMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Молниеприёмник</span><b>{formatNumber(liveTotals.metalLightningMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Крепление ТИ</span><b>{formatNumber(insulationComputed.fastenersUsedMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Труба орошения</span><b>{formatNumber(liveTotals.metalIrrigationMass, 0)} кг</b></div>
          </div>
          <div className="card pad">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Основные итоги</div>
            <div className="kpi"><span className="muted">Масса стали</span><b>{formatNumber(summary.steelMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Масса продукта</span><b>{formatNumber(summary.fluidMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Теплоизоляция</span><b>{formatNumber(liveTotals.insulationMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Масса снега</span><b>{formatNumber(liveTotals.snowMass, 0)} кг</b></div>
            <div className="kpi"><span className="muted">Суммарная масса</span><b>{formatNumber(summary.totalMass, 0)} кг</b></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

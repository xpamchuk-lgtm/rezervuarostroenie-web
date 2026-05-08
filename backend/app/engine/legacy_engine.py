"""
РВС/РГС калькулятор (stdlib-only, Tkinter) — UI v2 (TabStrip/Notebooks)

Запуск: python calculator.py

MVP 0.1 расчётные модели те же, UI обновлён:
- Верхний TabStrip: РВС | РГС
- Для РВС: нижний TabStrip из 5 вкладок:
  1) Общие сведения 2) Район установки 3) Днище 4) Стенка 5) Крыша
- Для РГС: нижний TabStrip из вкладок типов:
  РГСН | РГСП | РГСНД | РГСПД
  (в MVP 0.1 расчёт одинаковый; различия по типам добавим позже)

ВАЖНО: это прототип. Нормативную “строгость” (СП/ГОСТ) будем наращивать итерациями.
"""

from __future__ import annotations
import json
import csv
import math
import re

G = 9.80665
STEEL_DENSITY = 7850.0  # kg/m3
APP_VERSION = "v24"

__all__ = ["APP_VERSION","G","STEEL_DENSITY","gost31385_min_shell_mm","rvs_calc","rgs_calc"]

def _ceil_mm(x_mm: float) -> int:
    """Округление толщины вверх до целых мм (листовой прокат кратен 1 мм)."""
    try:
        return int(math.ceil(float(x_mm)))
    except Exception:
        return 0



# ГОСТ 31385-2023, таблица 3: минимальные толщины стенки (t_min), мм.
# ВАЖНО: значения ниже нужно сверить/уточнить по вашему экземпляру ГОСТ.
# Сейчас они заданы консервативно, чтобы исключить нереалистичные 4 мм на больших диаметрах.
GOST31385_TABLE3_MIN_SHELL_MM = [
    # (D_max, t_min_mm) — по диапазонам из табл. 3 ГОСТ 31385-2023 (как вы указали)
    (10.0, 4.0),   # D ≤ 10 м
    (16.0, 5.0),   # 10 < D ≤ 16 м
    (25.0, 6.0),   # 16 < D ≤ 25 м
    (40.0, 8.0),   # 25 < D ≤ 40 м
    (65.0, 10.0),  # 40 < D ≤ 65 м
    (999.0, 12.0), # D > 65 м
]


def gost31385_min_shell_mm(D_m: float) -> float:
    """Минимальная толщина стенки по ГОСТ 31385-2023 (табл. 3)."""
    try:
        D = float(D_m)
    except Exception:
        return 0.0
    for D_max, t in GOST31385_TABLE3_MIN_SHELL_MM:
        if D <= D_max:
            return float(t)
    return float(GOST31385_TABLE3_MIN_SHELL_MM[-1][1])

import os

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "data")

def read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def read_csv(path, delimiter=","):
    rows = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            for r in reader:
                rows.append(r)
    except Exception:
        pass
    return rows

def norm_text(s: str) -> str:
    """Нормализация названий для сопоставления (г./п./с. и т.п.)."""
    if s is None:
        return ""
    s = str(s).strip()
    s = s.replace("ё", "е").replace("Ё", "Е")
    s = re.sub(r"^(г|гор|город)\.\s*", "", s, flags=re.I)
    s = re.sub(r"^(пгт|пос|п)\.\s*", "", s, flags=re.I)
    s = re.sub(r"^(с|село|дер|д)\.\s*", "", s, flags=re.I)
    s = re.sub(r"\s+", " ", s)
    return s.lower().strip()

def make_key(region: str, city: str):
    return (norm_text(region), norm_text(city))


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p = math.pi/180.0
    a = 0.5 - math.cos((lat2-lat1)*p)/2 + math.cos(lat1*p)*math.cos(lat2*p)*(1-math.cos((lon2-lon1)*p))/2
    return 2*R*math.asin(math.sqrt(max(0.0, a)))

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def circle_area(D_m: float) -> float:
    return math.pi * (D_m**2) / 4.0

def cylinder_volume(D_m: float, H_m: float) -> float:
    return math.pi * (D_m**2) / 4.0 * H_m

def segment_area_circle(r: float, h: float) -> float:
    h = clamp(h, 0.0, 2*r)
    if h <= 0:
        return 0.0
    if h >= 2*r:
        return math.pi * r * r
    theta = 2.0 * math.acos((r - h) / r)
    return 0.5 * r*r * (theta - math.sin(theta))

def bearing_pressures_circular(N_kN: float, M_kNm: float, D_m: float):
    A = circle_area(D_m)
    p_avg_kPa = (N_kN / A)  # kN/m2 = kPa
    e = 0.0 if N_kN == 0 else (M_kNm / N_kN)
    e_eff = clamp(abs(e), 0.0, D_m/4.0)
    factor = 4.0 * e_eff / D_m
    p_max = p_avg_kPa * (1.0 + factor)
    p_min = p_avg_kPa * (1.0 - factor)
    return p_avg_kPa, p_max, p_min, e

def wind_force_on_cylinder_kN(w0_kPa: float, D_m: float, H_m: float, shape_coeff: float = 1.2) -> float:
    return w0_kPa * (D_m * H_m) * shape_coeff

def wind_overturning_moment_kNm(F_kN: float, H_m: float) -> float:
    return F_kN * (H_m/2.0)

def rvs_calc(D, H, roof_type, courses_mm, t_bottom_mm, t_roof_mm,
             rho, fill_mode, fill_value, w0_kPa, R0_kPa,
             steel_Rd_MPa, corr_mm, mu):
    if fill_mode == "level":
        H_fill = float(fill_value)
    else:
        H_fill = H * float(fill_value)/100.0
    H_fill = clamp(H_fill, 0.0, H)

    V = cylinder_volume(D, H_fill)
    m_fluid = rho * V

    n = len(courses_mm)
    Hc = H / n
    per_course = []
    sigma_max = 0.0
    util_max = 0.0

    m_shell = 0.0
    for i, t_mm in enumerate(courses_mm, start=1):
        t_eff_mm = t_mm - corr_mm
        if t_eff_mm <= 0:
            t_eff_mm = 1e-6
        t_eff_m = t_eff_mm / 1000.0
        area_i = math.pi * D * Hc
        m_shell += area_i * t_eff_m * STEEL_DENSITY

        z_mid = (i-1)*Hc + Hc/2.0
        head = max(0.0, H_fill - z_mid)
        p_kPa = rho * G * head / 1000.0
        sigma_MPa = (p_kPa * D) / (2.0 * t_eff_m) / 1000.0
        util = sigma_MPa / steel_Rd_MPa if steel_Rd_MPa > 0 else float("inf")
        sigma_max = max(sigma_max, sigma_MPa)
        util_max = max(util_max, util)

        per_course.append({
            "course": i,
            "z_mid_m": z_mid,
            "t_mm": t_mm,
            "t_eff_mm": t_eff_mm,
            "p_kPa": p_kPa,
            "sigma_hoop_MPa": sigma_MPa,
            "utilization": util,
        })

    A_base = circle_area(D)
    m_bottom = A_base * (t_bottom_mm/1000.0) * STEEL_DENSITY
    m_roof = A_base * (t_roof_mm/1000.0) * STEEL_DENSITY
    m_steel = m_shell + m_bottom + m_roof
    m_total = m_steel + m_fluid
    N_kN = m_total * G / 1000.0

    F_wind = wind_force_on_cylinder_kN(w0_kPa, D, H, shape_coeff=1.2)
    M_wind = wind_overturning_moment_kNm(F_wind, H)
    M_resist = N_kN * (D/2.0)
    F_fric = mu * N_kN

    p_avg, p_max, p_min, e = bearing_pressures_circular(N_kN, M_wind, D)

    checks = []
    checks.append(("RVS_SHELL_STRENGTH", "Прочность стенки (σθ,max ≤ Rd)", "PASS" if util_max <= 1.0 else "FAIL",
                   sigma_max, steel_Rd_MPa, "MPa"))
    checks.append(("RVS_OVERTURNING", "Опрокидывание (Mr ≥ M)", "PASS" if M_resist >= M_wind else "FAIL",
                   M_resist, M_wind, "kN·m"))
    checks.append(("RVS_SLIDING", "Сдвиг (μN ≥ H)", "PASS" if F_fric >= F_wind else "FAIL",
                   F_fric, F_wind, "kN"))
    checks.append(("FOUNDATION_BEARING", "Основание (pmax ≤ R)", "PASS" if p_max <= R0_kPa else "FAIL",
                   p_max, R0_kPa, "kPa"))

    return {
        "summary": {
            "volume_m3": V,
            "fluid_mass_kg": m_fluid,
            "steel_mass_kg": m_steel,
            "total_mass_kg": m_total,
            "total_load_kN": N_kN,
        },
        "details": {
            "rvs": {
                "fill_level_m": H_fill,
                "shell_stress": per_course,
                "sigma_max_MPa": sigma_max,
                "util_max": util_max,
                "R_d_MPa": steel_Rd_MPa,
            },
            "wind": {"F_wind_kN": F_wind, "M_wind_kNm": M_wind, "M_resist_kNm": M_resist, "mu": mu, "F_fric_kN": F_fric},
            "foundation": {"p_avg_kPa": p_avg, "p_max_kPa": p_max, "p_min_kPa": p_min, "e_m": e, "R0_kPa": R0_kPa},
        },
        "checks": [
            {"code": c, "title": t, "result": r, "value": v, "limit": lim, "unit": u} for c,t,r,v,lim,u in checks
        ],
    }

def rgs_calc(D, L, t_shell_mm, saddle_w, rho, fill_mode, fill_value, R0_kPa):
    r = D/2.0
    if fill_mode == "level":
        h = float(fill_value)
    else:
        h = D * float(fill_value)/100.0
    h = clamp(h, 0.0, D)

    A_seg = segment_area_circle(r, h)
    V = A_seg * L
    m_fluid = rho * V

    shell_area = math.pi * D * L
    m_shell = shell_area * (t_shell_mm/1000.0) * STEEL_DENSITY
    m_total = m_shell + m_fluid
    W_kN = m_total * G / 1000.0

    R1 = W_kN/2.0
    R2 = W_kN/2.0

    A_bearing = saddle_w * 1.0  # полоса 1 м (допущение)
    p1 = R1 / A_bearing
    p2 = R2 / A_bearing

    checks = []
    checks.append(("RGS_BEARING_OP1", "Опора 1: p ≤ R", "PASS" if p1 <= R0_kPa else "FAIL", p1, R0_kPa, "kPa"))
    checks.append(("RGS_BEARING_OP2", "Опора 2: p ≤ R", "PASS" if p2 <= R0_kPa else "FAIL", p2, R0_kPa, "kPa"))

    return {
        "summary": {
            "volume_m3": V,
            "fluid_mass_kg": m_fluid,
            "steel_mass_kg": m_shell,
            "total_mass_kg": m_total,
            "total_load_kN": W_kN,
        },
        "details": {
            "rgs": {"fill_level_m": h, "segment_area_m2": A_seg,
                    "reactions": {"R1_kN": R1, "R2_kN": R2},
                    "bearing": {"p1_kPa": p1, "p2_kPa": p2, "assumed_area_m2": A_bearing}},
        },
        "checks": [{"code": c, "title": t, "result": r, "value": v, "limit": lim, "unit": u} for c,t,r,v,lim,u in checks],
    }

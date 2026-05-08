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
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

G = 9.80665
STEEL_DENSITY = 7850.0  # kg/m3
APP_VERSION = "v24"

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

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("РВС/РГС калькулятор (UI v2)")
        self.geometry("1200x740")
        self.resizable(True, True)

        self.result = None
        self._build()

    def _build(self):
        top = ttk.Frame(self)
        top.pack(fill="x", padx=10, pady=(10, 0))

        ttk.Button(top, text="Рассчитать", command=self._calc).pack(side="left")
        ttk.Button(top, text="Сохранить JSON", command=self._save_json).pack(side="left", padx=8)

        main = ttk.Frame(self)
        main.pack(fill="both", expand=True, padx=10, pady=10)

        self.left = ttk.Frame(main)
        self.left.pack(side="left", fill="y")

        self.right = ttk.Frame(main)
        self.right.pack(side="right", fill="both", expand=True)

        self.main_tabs = ttk.Notebook(self.left)
        self.main_tabs.pack(fill="both", expand=False)

        self.rvs_root = ttk.Frame(self.main_tabs)
        self.rgs_root = ttk.Frame(self.main_tabs)
        self.main_tabs.add(self.rvs_root, text="РВС")
        self.main_tabs.add(self.rgs_root, text="РГС")

        self._build_rvs_tabs()
        self._build_rgs_tabs()
        self._build_output()

    def _build_rvs_tabs(self):
        self.rvs_tabs = ttk.Notebook(self.rvs_root)
        self.rvs_tabs.pack(fill="both", expand=True)

        self.rvs_tab_common = ttk.Frame(self.rvs_tabs)
        self.rvs_tab_site = ttk.Frame(self.rvs_tabs)
        self.rvs_tab_bottom = ttk.Frame(self.rvs_tabs)
        self.rvs_tab_shell = ttk.Frame(self.rvs_tabs)
        self.rvs_tab_roof = ttk.Frame(self.rvs_tabs)
        self.rvs_tab_metal = ttk.Frame(self.rvs_tabs)

        self.rvs_tabs.add(self.rvs_tab_common, text="Общие сведения")
        self.rvs_tabs.add(self.rvs_tab_site, text="Район установки")

        # --- Район установки (СП 20.13330 и СП 131.13330) ---
        # Поля "Регион/город" — идентификация объекта. Автоподбор по СП сделаем по справочнику (следующий патч).
        fr_reg = ttk.Frame(self.rvs_tab_site)
        fr_reg.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_reg, text="Регион / субъект РФ, —").pack(side="left")
        self.site_region = tk.StringVar(value="")
        regions = (self._regions_list if getattr(self, "_regions_list", None) else [
            "Республика Адыгея",
            "Республика Алтай",
            "Республика Башкортостан",
            "Республика Бурятия",
            "Республика Дагестан",
            "Республика Ингушетия",
            "Кабардино-Балкарская Республика",
            "Республика Калмыкия",
            "Карачаево-Черкесская Республика",
            "Республика Карелия",
            "Республика Коми",
            "Республика Крым",
            "Республика Марий Эл",
            "Республика Мордовия",
            "Республика Саха (Якутия)",
            "Республика Северная Осетия — Алания",
            "Республика Татарстан",
            "Республика Тыва",
            "Удмуртская Республика",
            "Республика Хакасия",
            "Чеченская Республика",
            "Чувашская Республика",
            "Донецкая Народная Республика",
            "Луганская Народная Республика",
            "Алтайский край",
            "Забайкальский край",
            "Камчатский край",
            "Краснодарский край",
            "Красноярский край",
            "Пермский край",
            "Приморский край",
            "Ставропольский край",
            "Хабаровский край",
            "Амурская область",
            "Архангельская область",
            "Астраханская область",
            "Белгородская область",
            "Брянская область",
            "Владимирская область",
            "Волгоградская область",
            "Вологодская область",
            "Воронежская область",
            "Запорожская область",
            "Ивановская область",
            "Иркутская область",
            "Калининградская область",
            "Калужская область",
            "Кемеровская область — Кузбасс",
            "Кировская область",
            "Костромская область",
            "Курганская область",
            "Курская область",
            "Ленинградская область",
            "Липецкая область",
            "Магаданская область",
            "Московская область",
            "Мурманская область",
            "Нижегородская область",
            "Новгородская область",
            "Новосибирская область",
            "Омская область",
            "Оренбургская область",
            "Орловская область",
            "Пензенская область",
            "Псковская область",
            "Ростовская область",
            "Рязанская область",
            "Самарская область",
            "Саратовская область",
            "Сахалинская область",
            "Свердловская область",
            "Смоленская область",
            "Тамбовская область",
            "Тверская область",
            "Томская область",
            "Тульская область",
            "Тюменская область",
            "Ульяновская область",
            "Херсонская область",
            "Челябинская область",
            "Ярославская область",
            "Москва",
            "Санкт-Петербург",
            "Севастополь",
            "Еврейская автономная область",
            "Ненецкий автономный округ",
            "Ханты-Мансийский автономный округ — Югра",
            "Чукотский автономный округ",
            "Ямало-Ненецкий автономный округ"
])
        cb_region = self._make_autocomplete_combobox(fr_reg, self.site_region, regions, width=32)
        cb_region.pack(side="right")

        fr_city = ttk.Frame(self.rvs_tab_site)
        fr_city.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_city, text="Город / населённый пункт, —").pack(side="left")
        self.site_city = tk.StringVar(value="")
        self._cities_by_region = read_json(os.path.join(DATA_DIR, "regions_cities.json"), {})
        cb_city = self._make_autocomplete_combobox(fr_city, self.site_city, [], width=32)
        cb_city.pack(side="right")

        def _refresh_cities(*_):
            reg = (self.site_region.get() or "").strip()
            vals = self._cities_by_region.get(reg, [])
            cb_city._all_values = list(vals)
            cb_city["values"] = list(vals)
            # если регион выбран и список не пустой — ставим первый как значение по умолчанию
            if vals:
                if self.site_city.get().strip() not in vals:
                    self.site_city.set(vals[0])

        cb_region.bind("<<ComboboxSelected>>", lambda e: _refresh_cities())
        # первичная инициализация
        _refresh_cities()

        # --- Автоподстановка нормативных параметров из справочника (data/city_params.csv) ---
        # Формат: region,city,lat,lon,wind_region,snow_region,seismic,t5,tmin_abs
                # --- Загрузка нормативов по населённым пунктам ---
        # Источник: data/Нормативы_для_всех_НП_geofill_v1.csv (разделитель ;) — единая база по всем НП
        # Fallback: data/city_params.csv (старый формат)
        norms_path = os.path.join(DATA_DIR, "Нормативы_для_всех_НП_geofill_v1.csv")
        if os.path.exists(norms_path):
            _raw = read_csv(norms_path, delimiter=";")
            self._city_params = []
            for r in _raw:
                self._city_params.append({
                    "region": (r.get("Регион","") or "").strip(),
                    "city": (r.get("НП","") or "").strip(),
                    "lat": (r.get("Широта","") or "").strip(),
                    "lon": (r.get("Долгота","") or "").strip(),
                    "wind_region": (r.get("Ветровой район","") or "").strip(),
                    "w0": (r.get("w0, кПа","") or "").strip(),
                    "snow_region": (r.get("Снеговой район","") or "").strip(),
                    "sg": (r.get("S0, кПа","") or "").strip(),
                    "seismic": (r.get("Сейсмичность (MSK-64, C)","") or "").strip(),
                    "t5": (r.get("t5, °C","") or "").strip(),
                    "tmin_abs": (r.get("t_min_abs, °C","") or "").strip(),
                })
        else:
            self._city_params = read_csv(os.path.join(DATA_DIR, "city_params.csv"))
        self._sp20_wind = read_csv(os.path.join(DATA_DIR, "sp20_wind.csv"))
        self._sp20_snow = read_csv(os.path.join(DATA_DIR, "sp20_snow.csv"))
        self._sp14 = read_csv(os.path.join(DATA_DIR, "sp14_seismic.csv"))
        self._city_map = {}
        for r in self._city_params:
            k = make_key(r.get("region",""), r.get("city",""))
            if k[0] and k[1]:
                self._city_map[k] = r
        # Для списков UI: регионы и города берём из _city_params (единая база)
        self._cities_by_region = {}
        for r in self._city_params:
            reg = (r.get("region", "") or "").strip()
            city = (r.get("city", "") or "").strip()
            if not reg or not city:
                continue
            self._cities_by_region.setdefault(reg, set()).add(city)
        # сортированные списки (для combobox)
        self._regions_list = sorted(self._cities_by_region.keys())
        for reg in list(self._cities_by_region.keys()):
            self._cities_by_region[reg] = sorted(self._cities_by_region[reg])
        self._wind_map = {}
        for r in self._sp20_wind:
            k = make_key(r.get("region",""), r.get("city",""))
            if k[0] and k[1]:
                self._wind_map[k] = r
        self._snow_map = {}
        for r in self._sp20_snow:
            k = make_key(r.get("region",""), r.get("city",""))
            if k[0] and k[1]:
                self._snow_map[k] = r
        self._sp14_map = {}
        for r in self._sp14:
            k = make_key(r.get("region",""), r.get("city",""))
            if k[0] and k[1]:
                self._sp14_map[k] = r
        self._sp14 = read_csv(os.path.join(DATA_DIR, "sp14_seismic.csv"))
        self._sp14_map = {}
        for r in self._sp14:
            key = (r.get("region","").strip(), r.get("city","").strip())
            if key[0] and key[1]:
                self._sp14_map[key] = r

        def _apply_params_for_city():
            reg = (self.site_region.get() or "").strip()
            city = (self.site_city.get() or "").strip()
            k = make_key(reg, city)
            row = self._city_map.get(k)
            wind_row = self._wind_map.get(k)
            snow_row = self._snow_map.get(k)
            sp14_row = self._sp14_map.get(k)

            sp14_row = self._sp14_map.get((reg, city))
            # пробуем совпадение без префикса "г." (частый случай)
            if sp14_row is None and city.startswith("г. "):
                sp14_row = self._sp14_map.get((reg, city[3:].strip()))
            if sp14_row is None and (("г. " + city) != city):
                sp14_row = self._sp14_map.get((reg, "г. " + city))

            if row is None:
                if hasattr(self, "site_status"):
                    self.site_status.set("Нет строк в базе нормативов для выбранного пункта (нормативы не подставлены).")

                    self.site_status.set("Нет строк в базе нормативов для выбранного пункта (нормативы не подставлены).")
                return

            changed = False

            # Ветер/снег: сначала из city_params.csv (если заполнено), иначе из СП20 (sp20_wind/sp20_snow)
            # ВЕТЕР
            v = ""
            if row is not None:
                v = (row.get("wind_region") or "").strip()
            if not v and wind_row is not None:
                v = (wind_row.get("wind_region") or "").strip()
            if v:
                self.wind_region.set(v)
                _on_wind_change()
                changed = True

            # СНЕГ
            v = ""
            if row is not None:
                v = (row.get("snow_region") or "").strip()
            if not v and snow_row is not None:
                v = (snow_row.get("snow_region") or "").strip()
            if v:
                self.snow_region.set(v)
                _on_snow_change()
                changed = True

            # СЕЙСМИКА: из city_params.csv если задано, иначе из СП14 (A/B/C)
            v = ""
            if row is not None:
                v = (row.get("seismic") or "").strip()
            if (not v) and sp14_row is not None:
                lvl = (self.seis_level.get() or "B").strip().upper()
                col = {"A":"seis_A","B":"seis_B","C":"seis_C"}.get(lvl, "seis_B")
                v = (sp14_row.get(col) or "").strip()
            if v and v != "-":
                self.seismic.set(v)
                changed = True

            if (row.get("wind_region") or "").strip():
                self.wind_region.set(row["wind_region"].strip())
                changed = True
            if (row.get("snow_region") or "").strip():
                self.snow_region.set(row["snow_region"].strip())
                changed = True
            if (row.get("seismic") or "").strip():
                self.seismic.set(row["seismic"].strip())
                changed = True

            # fallback: сейсмичность из СП 14 (ОСР-97), если в базе нормативов не задано
            if not (row.get("seismic") or "").strip():
                if sp14_row is not None:
                    lvl = (self.seis_level.get() or "B").strip().upper()
                    col = {"A":"seis_A","B":"seis_B","C":"seis_C"}.get(lvl, "seis_B")
                    v = (sp14_row.get(col) or "").strip()
                    if v and v != "-":
                        self.seismic.set(v)
                        changed = True
            if (row.get("t5") or "").strip():
                self.t5.set(row["t5"].strip())
                changed = True
            if (row.get("tmin_abs") or "").strip():
                self.tmin_abs.set(row["tmin_abs"].strip())
                changed = True

            if hasattr(self, "site_status"):
                if changed:
                    self.site_status.set("Нормативы подставлены из city_params.csv (можно корректировать вручную).")
                else:
                    self.site_status.set("Нормативы: ветер/снег берутся из СП20 (sp20_wind/sp20_snow), сейсмика из СП14 (sp14_seismic), температуры пока не заполнены.")

        cb_city.bind("<<ComboboxSelected>>", lambda e: _apply_params_for_city())

        # также подставляем при автосмене города после выбора региона
        self.site_city.trace_add("write", lambda *_: _apply_params_for_city())

        # Ветровой район -> w0 (нормативное давление ветра)
        # Таблица 11.1 СП 20.13330.2016: w0, кПа (I..VII) citeturn2view1
        self.wind_region = tk.StringVar(value="II")
        fr_w = ttk.Frame(self.rvs_tab_site)
        fr_w.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_w, text="Ветровой район (I–VII), —").pack(side="left")
        cb_w = ttk.Combobox(fr_w, textvariable=self.wind_region, values=["I","II","III","IV","V","VI","VII"], width=6, state="readonly")
        cb_w.pack(side="right")

        self.w0 = tk.StringVar(value="0.30")
        fr_w0 = ttk.Frame(self.rvs_tab_site)
        fr_w0.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_w0, text="Нормативное давление ветра (w0), кПа").pack(side="left")
        ttk.Entry(fr_w0, textvariable=self.w0, width=12).pack(side="right")

        wind_w0_map = {"I":0.23,"II":0.30,"III":0.38,"IV":0.48,"V":0.60,"VI":0.73,"VII":0.85}

        def _on_wind_change(*_):
            r = self.wind_region.get()
            if r in wind_w0_map:
                self.w0.set(str(wind_w0_map[r]))

        cb_w.bind("<<ComboboxSelected>>", lambda e: _on_wind_change())

        # Снеговой район -> Sg (нормативный вес снегового покрова земли)
        # Таблица 10.1 СП 20.13330.2016: Sg, кПа (I..VIII) citeturn2view2
        self.snow_region = tk.StringVar(value="III")
        fr_s = ttk.Frame(self.rvs_tab_site)
        fr_s.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_s, text="Снеговой район (I–VIII), —").pack(side="left")
        cb_s = ttk.Combobox(fr_s, textvariable=self.snow_region, values=["I","II","III","IV","V","VI","VII","VIII"], width=6, state="readonly")
        cb_s.pack(side="right")

        self.Sg = tk.StringVar(value="1.5")
        fr_sg = ttk.Frame(self.rvs_tab_site)
        fr_sg.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_sg, text="Нормативный вес снегового покрова (Sg), кПа").pack(side="left")
        ttk.Entry(fr_sg, textvariable=self.Sg, width=12).pack(side="right")

        snow_sg_map = {"I":0.5,"II":1.0,"III":1.5,"IV":2.0,"V":2.5,"VI":3.0,"VII":3.5,"VIII":4.0}

        def _on_snow_change(*_):
            r = self.snow_region.get()
            if r in snow_sg_map:
                self.Sg.set(str(snow_sg_map[r]))

        cb_s.bind("<<ComboboxSelected>>", lambda e: _on_snow_change())

        # Инициализация нормативов по выбранным районам (w0 и Sg)
        _on_wind_change()
        _on_snow_change()


        # Температуры по СП 131.13330 — пока ручной ввод (следующим шагом: автоподбор из таблицы 3.1 по городу)
        # СП 131.13330 допускает принимать значения по ближайшему пункту из таблиц. citeturn1view1
        self.t5 = tk.StringVar(value="-26")
        fr_t5 = ttk.Frame(self.rvs_tab_site)
        fr_t5.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_t5, text="Температура наиболее холодной пятидневки (t5), °C").pack(side="left")
        ttk.Entry(fr_t5, textvariable=self.t5, width=12).pack(side="right")

        self.tmin_abs = tk.StringVar(value="-43")
        fr_tmin = ttk.Frame(self.rvs_tab_site)
        fr_tmin.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_tmin, text="Абсолютный минимум температуры (t_min,abs), °C").pack(side="left")
        ttk.Entry(fr_tmin, textvariable=self.tmin_abs, width=12).pack(side="right")

        # Сейсмичность (по СП 14.13330 / ОСР) — пока выбор вручную
        self.seismic = tk.StringVar(value="6")
        fr_seis = ttk.Frame(self.rvs_tab_site)
        fr_seis.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_seis, text="Сейсмичность района, баллы (MSK-64), —").pack(side="left")
        ttk.Combobox(fr_seis, textvariable=self.seismic, values=["6","7","8","9"], width=6, state="readonly").pack(side="right")

        # Выбор степени сейсмической опасности ОСР-97: A(10%), B(5%), C(1%) за 50 лет (СП 14, Прил.2)
        self.seis_level = tk.StringVar(value="B")
        fr_seis_lvl = ttk.Frame(self.rvs_tab_site)
        fr_seis_lvl.pack(fill="x", padx=8, pady=2)
        ttk.Label(fr_seis_lvl, text="Степень сейсмоопасности (ОСР-97), —").pack(side="left")
        for lvl, txt in [("A","A (10%/50 лет)"), ("B","B (5%/50 лет)"), ("C","C (1%/50 лет)")]:
            ttk.Radiobutton(fr_seis_lvl, text=txt, value=lvl, variable=self.seis_level, command=_apply_params_for_city).pack(side="left", padx=4)

        # Строка статуса по автоподстановке нормативов
        filled = 0
        for r in getattr(self, "_city_params", []):
            if (r.get("wind_region") or r.get("snow_region") or r.get("seismic") or r.get("t5") or r.get("tmin_abs")):
                filled += 1
        self.site_status = tk.StringVar(value=f"Нормативы: {filled} строк(и) заполнены в data/city_params.csv. Если 0 — подставлять нечего.")
        ttk.Label(self.rvs_tab_site, textvariable=self.site_status).pack(anchor="w", padx=8, pady=(8, 6))
        self.rvs_tabs.add(self.rvs_tab_shell, text="Стенка")
        self.rvs_tabs.add(self.rvs_tab_bottom, text="Днище")
        self.rvs_tabs.add(self.rvs_tab_roof, text="Крыша")
        self.rvs_tabs.add(self.rvs_tab_metal, text="Металлоконструкции")

        # Диаметр/высота в мм (как в опросном листе ГОСТ 31385-2023, Приложение А)
        self.rvs_D_sel, self.rvs_D_other = self._diameter_selector(self.rvs_tab_common)
        self.rvs_H_sel, self.rvs_H_other = self._height_selector(self.rvs_tab_common)

        # Заполнение резервуара (перенесено из шапки)
        self.fill_mode = tk.StringVar(value="percent")
        fr_fill = ttk.Frame(self.rvs_tab_common)
        fr_fill.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_fill, text="Заполнение резервуара, —").pack(side="left")
        ttk.Radiobutton(fr_fill, text="%", variable=self.fill_mode, value="percent").pack(side="right")
        ttk.Radiobutton(fr_fill, text="уровень, мм", variable=self.fill_mode, value="level").pack(side="right", padx=(6, 0))

        self.fill_val = tk.StringVar(value="80")
        fr_fill2 = ttk.Frame(self.rvs_tab_common)
        fr_fill2.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_fill2, text="Значение заполнения, % или мм").pack(side="left")
        ttk.Entry(fr_fill2, textvariable=self.fill_val, width=14).pack(side="right")

        # Производные величины: геометрический/полезный объем и уровень налива
        self.v_geom = tk.StringVar(value="0")
        self.v_useful = tk.StringVar(value="0")
        self.level_mm = tk.StringVar(value="0")
        self.fill_warn = tk.StringVar(value="")

        def _make_ro_row(label: str, var: tk.StringVar):
            fr = ttk.Frame(self.rvs_tab_common)
            fr.pack(fill="x", padx=8, pady=4)
            ttk.Label(fr, text=label).pack(side="left")
            ent = ttk.Entry(fr, textvariable=var, width=14, state="readonly")
            ent.pack(side="right")
            return ent

        _make_ro_row("Полный объем резервуара (V_geom), м³", self.v_geom)
        _make_ro_row("Полезный объем (по уровню), м³", self.v_useful)
        _make_ro_row("Уровень налива (h), мм", self.level_mm)

        ttk.Label(self.rvs_tab_common, textvariable=self.fill_warn, foreground="#b00020").pack(anchor="w", padx=8, pady=(2, 4))

        def _safe_update_common(*_):
            try:
                D_mm = self._get_rvs_D_mm()
                H_mm = self._get_rvs_H_mm()
                if H_mm <= 0 or D_mm <= 0:
                    return
                D_m = D_mm / 1000.0
                H_m = H_mm / 1000.0
                V = math.pi * (D_m ** 2) / 4.0 * H_m
                self.v_geom.set(f"{V:.2f}")

                mode = self.fill_mode.get()
                raw = (self.fill_val.get() or "").strip().replace(",", ".")
                val = float(raw) if raw else 0.0

                warn = ""
                if mode == "percent":
                    if val > 98.0:
                        val = 98.0
                        self.fill_val.set("98")
                        warn = "Заполнение ограничено 98% от геометрического объема."
                    if val < 0:
                        val = 0.0
                        self.fill_val.set("0")
                    h_mm = H_mm * (val / 100.0)
                else:
                    # level, mm
                    max_h = 0.98 * H_mm
                    if val > max_h:
                        val = max_h
                        self.fill_val.set(str(int(round(max_h))))
                        warn = "Уровень ограничен 0.98·H (98% по высоте)."
                    if val < 0:
                        val = 0.0
                        self.fill_val.set("0")
                    h_mm = val

                # Полезный объем считается по фактическому уровню (или %), но не выше 0.98·V
                try:
                    fill_ratio = (h_mm / H_mm) if H_mm > 0 else 0.0
                    if fill_ratio > 0.98:
                        fill_ratio = 0.98
                    if fill_ratio < 0.0:
                        fill_ratio = 0.0
                    self.v_useful.set(f"{(V * fill_ratio):.2f}")
                except Exception:
                    pass

                self.level_mm.set(f"{h_mm:.0f}")
                self.fill_warn.set(warn)
            except Exception:
                # не мешаем пользователю вводить данные
                pass

        # Триггеры обновления производных величин
        for v in [self.rvs_D_sel, self.rvs_D_other, self.rvs_H_sel, self.rvs_H_other, self.fill_mode, self.fill_val]:
            try:
                v.trace_add("write", _safe_update_common)
            except Exception:
                pass
        _safe_update_common()

        # Среда (продукт) → плотность ρ (автозаполнение, допускается ручная правка)
        self.medium = tk.StringVar(value="Вода")
        fr_med = ttk.Frame(self.rvs_tab_common)
        fr_med.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_med, text="Среда (продукт), —").pack(side="left")

        # Базовый набор. Позже расширим и привяжем к температуре.
        self._medium_rho = {
            "Вода": 1000.0,
            "Вода техническая": 1000.0,
            "Нефть (средняя)": 850.0,
            "Дизель": 830.0,
            "Бензин": 740.0,
            "Керосин": 800.0,
            "Мазут": 950.0,
            "Битум (80°C)": 1030.0,
            "КАС-32 (удобрение)": 1320.0,
            "Масло индустриальное": 900.0,
            "Масло трансформаторное": 880.0,
            "Масло растительное": 920.0,
        }
        cb_med = ttk.Combobox(fr_med, textvariable=self.medium, values=list(self._medium_rho.keys()), width=18, state="readonly")
        cb_med.pack(side="right")

        # Плотность продукта (ρ) — поле ввода, но при смене продукта перезаписывается
        self.rho = self._num(self.rvs_tab_common, "Плотность продукта (ρ), кг/м³", str(int(self._medium_rho[self.medium.get()])))

        def _on_medium_change(*_):
            name = self.medium.get()
            if name in self._medium_rho:
                self.rho.set(str(self._medium_rho[name]))

        cb_med.bind("<<ComboboxSelected>>", lambda e: _on_medium_change())


        # --- Стенка: таблица поясов (UI) ---
        ttk.Label(self.rvs_tab_shell, text="Стенка: пояса (снизу вверх). Высота пояса базово 1490 мм, последняя — остаток.").pack(anchor="w", padx=8, pady=(8,4))

        self._steel_grades = [
            "Ст3сп/пс (С245)",
            "С255",
            "С345",
            "09Г2С",
            "16ГС",
            "10ХСНД",
            "15ХСНД",
            "12Х18Н10Т (нерж.)",
            "08Х18Н10 (нерж.)",
            "10Х17Н13М2Т (нерж.)",
            "AISI 304 (аналог 08Х18Н10)",
            "AISI 321 (аналог 12Х18Н10Т)",
            "AISI 316Ti (аналог 10Х17Н13М2Т)",
        ]

        shell_box = ttk.Frame(self.rvs_tab_shell)
        shell_box.pack(fill="both", expand=True, padx=8, pady=(0,8))

        # Доп. параметры для расчёта стенки: избыточное давление (газовое пространство) и испытательное давление
        # ГОСТ 31385: нормативное избыточное давление в газовом пространстве ≤ 5000 Па, разрежение ≤ 500 Па.
        # Испытательное избыточное давление (для проверки крыши/газового пространства) принимают на 25% выше проектного, если не задано иначе.
        self.p_gas = tk.StringVar(value="0.005")   # МПа (по ГОСТ для РВС обычно ≤0.005)
        self.p_test = tk.StringVar(value="0.00625")  # МПа (по умолчанию 1.25·p)
        self._p_test_auto = True
        self._p_test_sync_guard = False


        # Скроллинг для таблицы
        shell_canvas = tk.Canvas(shell_box, height=260)
        shell_scroll = ttk.Scrollbar(shell_box, orient="vertical", command=shell_canvas.yview)
        shell_canvas.configure(yscrollcommand=shell_scroll.set)
        shell_scroll.pack(side="right", fill="y")
        shell_canvas.pack(side="left", fill="both", expand=True)

        
        self.shell_method = tk.StringVar(value="Рулонный")
        # --- Метод изготовления стенки ---
        fr_method = ttk.Frame(self.rvs_tab_shell)
        fr_method.pack(fill="x", padx=8, pady=(4,4))
        ttk.Label(fr_method, text="Метод изготовления стенки").pack(side="left")
        ttk.Radiobutton(fr_method, text="Рулонный", variable=self.shell_method, value="Рулонный").pack(side="left", padx=6)
        ttk.Radiobutton(fr_method, text="Полистовой", variable=self.shell_method, value="Полистовой").pack(side="left", padx=6)

        shell_inner = ttk.Frame(shell_canvas)
        shell_canvas.create_window((0, 0), window=shell_inner, anchor="nw")

        def _shell_on_configure(_e=None):
            shell_canvas.configure(scrollregion=shell_canvas.bbox("all"))
        shell_inner.bind("<Configure>", _shell_on_configure)

        # Заголовки
        headers = [
            ("Пояс", 5),
            ("Высота,\nмм", 9),
            ("Минус\nдопуск, мм", 12),
            ("Марка\nстали", 16),
            ("t_min,\nмм", 8),
            ("Желаемая\nt, мм", 10),
            ("Коррозия,\nмм", 10),
            ("t_итог,\nмм", 8),
        ]
        for c, (h, w) in enumerate(headers):
            ttk.Label(shell_inner, text=h, width=w, justify="center").grid(row=0, column=c, sticky="w", padx=3, pady=(0,4))
        ttk.Separator(shell_inner, orient="horizontal").grid(row=1, column=0, columnspan=len(headers), sticky="ew", pady=(0,6))

        self.shell_warn = tk.StringVar(value="")
        ttk.Label(self.rvs_tab_shell, textvariable=self.shell_warn, foreground="#b00020").pack(anchor="w", padx=8, pady=(0,6))

        self.shell_rows = []

        def _shell_calc_tmin_mm(course_mid_from_bottom_m: float) -> float:
            """MVP+: минимальная толщина по поясу как максимум из:
            - требуемой по гидростатике (эксплуатация) + избыточное давление p в газовом пространстве
            - требуемой по гидроиспытанию (вода до полного уровня) + испытательное избыточное давление pисп
            - минимальной по ГОСТ 31385-2023 (табл. 3)
            """
            try:
                D_m = self._get_rvs_D_mm() / 1000.0
                H_mm = self._get_rvs_H_mm()
                H_m = H_mm / 1000.0
                H_liq_m = float(self.level_mm.get().replace(",", ".")) / 1000.0 if self.level_mm.get() else 0.0
                rho_prod = float((self.rho.get() or "0").replace(",", "."))
            except Exception:
                return 4.0

            # p и pисп (МПа) -> Па
            try:
                p_gas_MPa = float((self.p_gas.get() or "0").replace(",", "."))
            except Exception:
                p_gas_MPa = 0.0
            try:
                p_test_MPa = float((self.p_test.get() or "0").replace(",", "."))
            except Exception:
                p_test_MPa = 0.0

            p_gas = max(0.0, p_gas_MPa) * 1_000_000.0
            p_test = max(0.0, p_test_MPa) * 1_000_000.0

            sigma_allow = 230e6  # Па (заглушка MVP)
            phi = 1.0

            if D_m <= 0 or sigma_allow <= 0 or phi <= 0:
                return 4.0

            # Эксплуатация: продукт + p_gas
            h_op = max(0.0, H_liq_m - course_mid_from_bottom_m)
            p_op_Pa = rho_prod * G * h_op + max(0.0, p_gas)
            t_op_mm = (p_op_Pa * D_m) / (2.0 * sigma_allow * phi) * 1000.0

            # Гидроиспытание: вода до полного уровня + p_test
            rho_water = 1000.0
            h_ht = max(0.0, H_m - course_mid_from_bottom_m)
            p_ht_Pa = rho_water * G * h_ht + max(0.0, p_test)
            t_ht_mm = (p_ht_Pa * D_m) / (2.0 * sigma_allow * phi) * 1000.0

            t_hydro_mm = max(t_op_mm, t_ht_mm)
            # Минимальная по ГОСТ 31385-2023, табл. 3
            t_gost = gost31385_min_shell_mm(D_m)

            t_tech_min = 4.0

            return max(t_tech_min, t_gost, round(t_hydro_mm, 2))

        def _shell_update_row(i: int):
            if i < 0 or i >= len(self.shell_rows):
                return
            r = self.shell_rows[i]
            # t_min
            try:
                # отметка середины пояса от низа
                z_mm = 0.0
                for j in range(i):
                    z_mm += float((self.shell_rows[j]["h"].get() or "0").replace(",", "."))
                h_i = float((r["h"].get() or "0").replace(",", "."))
                mid_m = (z_mm + 0.5 * h_i) / 1000.0
            except Exception:
                mid_m = 0.0
            treq = _shell_calc_tmin_mm(mid_m)
            # Минусовой допуск учитываем в минимальной номинальной толщине:
            # t_nom_min = t_req + Δt(-)
            try:
                tol = float((r["tol"].get() or "0").replace(",", "."))
                if tol < 0:
                    tol = abs(tol)
            except Exception:
                tol = 0.0
            tmin = max(0.0, treq + tol)
            r["tmin"].set(f"{tmin:.2f}")

            # t_final = (t_desired if задано else t_min) + corrosion
            warn = ""
            try:
                corr = float((r["corr"].get() or "0").replace(",", "."))
            except Exception:
                corr = 0.0
            base = tmin
            desired_raw = (r["tdes"].get() or "").strip()
            if desired_raw:
                try:
                    desired = float(desired_raw.replace(",", "."))
                    base = desired
                    if desired + 1e-9 < tmin:
                        warn = f"Пояс {i+1}: желаемая толщина меньше t_min."
                except Exception:
                    warn = f"Пояс {i+1}: некорректная желаемая толщина."
                    base = tmin
            r["tfinal"].set(str(int(math.ceil(base + corr))))

            return warn

        def _shell_update_all(*_):
            warns = []
            for i in range(len(self.shell_rows)):
                w = _shell_update_row(i)
                if w:
                    warns.append(w)
            self.shell_warn.set(" | ".join(warns[:3]) + (" ..." if len(warns) > 3 else ""))

        def _shell_recalc_last_height():
            """Делаем сумму высот равной H: последняя строка = остаток."""
            try:
                H_mm = self._get_rvs_H_mm()
                if H_mm <= 0 or not self.shell_rows:
                    return
                if len(self.shell_rows) == 1:
                    self.shell_rows[0]["h"].set(str(int(H_mm)))
                    return
                s = 0.0
                for i in range(len(self.shell_rows)-1):
                    s += float((self.shell_rows[i]["h"].get() or "0").replace(",", "."))
                last = max(0.0, float(H_mm) - s)
                self.shell_rows[-1]["h"].set(f"{last:.0f}")
            except Exception:
                pass

        def _shell_build_rows():
            # очистка старых виджетов (строки начиная с row=2)
            for w in list(shell_inner.grid_slaves()):
                info = w.grid_info()
                if int(info.get("row", 0)) >= 2:
                    w.destroy()

            self.shell_rows = []
            H_mm = self._get_rvs_H_mm()
            if H_mm <= 0:
                return

            base_h = 1490.0
            n = int(math.ceil(H_mm / base_h))
            if n < 1:
                n = 1

            # строим строки
            remaining = float(H_mm)
            for i in range(n):
                h_i = base_h if i < n-1 else max(0.0, remaining)
                remaining -= h_i

                v_h = tk.StringVar(value=f"{h_i:.0f}")
                v_tol = tk.StringVar(value="0")
                v_grade = tk.StringVar(value="09Г2С")
                v_tmin = tk.StringVar(value="4.00")
                v_tdes = tk.StringVar(value="")
                v_corr = tk.StringVar(value="0")
                v_tfinal = tk.StringVar(value="4.00")

                row = {"h": v_h, "tol": v_tol, "grade": v_grade, "tmin": v_tmin, "tdes": v_tdes, "corr": v_corr, "tfinal": v_tfinal}
                self.shell_rows.append(row)

                rr = 2 + i
                ttk.Label(shell_inner, text=str(i+1)).grid(row=rr, column=0, sticky="w", padx=3, pady=2)

                e_h = ttk.Entry(shell_inner, textvariable=v_h, width=7)
                e_h.grid(row=rr, column=1, sticky="w", padx=3, pady=2)

                e_tol = ttk.Entry(shell_inner, textvariable=v_tol, width=9)
                e_tol.grid(row=rr, column=2, sticky="w", padx=3, pady=2)

                cb_g = ttk.Combobox(shell_inner, textvariable=v_grade, values=self._steel_grades, width=16, state="readonly")
                cb_g.grid(row=rr, column=3, sticky="w", padx=3, pady=2)

                e_tmin = ttk.Entry(shell_inner, textvariable=v_tmin, width=7, state="readonly")
                e_tmin.grid(row=rr, column=4, sticky="w", padx=3, pady=2)

                e_tdes = ttk.Entry(shell_inner, textvariable=v_tdes, width=9)
                e_tdes.grid(row=rr, column=5, sticky="w", padx=3, pady=2)

                cb_corr = ttk.Combobox(shell_inner, textvariable=v_corr, values=[str(x) for x in range(0,7)], width=8, state="readonly")
                cb_corr.grid(row=rr, column=6, sticky="w", padx=3, pady=2)

                e_tf = ttk.Entry(shell_inner, textvariable=v_tfinal, width=7, state="readonly")
                e_tf.grid(row=rr, column=7, sticky="w", padx=3, pady=2)

                # триггеры: меняем высоты → пересчёт остатка и tmin/tfinal
                def _mk_height_cb(idx=i):
                    def _cb(*_a):
                        _shell_recalc_last_height()
                        _shell_update_all()
                    return _cb

                v_h.trace_add("write", _mk_height_cb(i))
                v_tol.trace_add("write", lambda *_a: _shell_update_all())
                v_grade.trace_add("write", lambda *_a: _shell_update_all())
                v_tdes.trace_add("write", lambda *_a: _shell_update_all())
                v_corr.trace_add("write", lambda *_a: _shell_update_all())

            _shell_recalc_last_height()
            _shell_update_all()

        # Пересборка таблицы при изменении общей высоты/диаметра/заполнения/плотности
        def _shell_rebuild_on_geometry(*_):
            try:
                _shell_build_rows()
            except Exception:
                pass

        for v in [self.rvs_H_sel, self.rvs_H_other, self.rvs_D_sel, self.rvs_D_other, self.fill_mode, self.fill_val, self.rho]:
            try:
                v.trace_add("write", _shell_rebuild_on_geometry)
            except Exception:
                pass

        # Поля давлений (влияют на t_min): добавка к гидростатике как равномерное давление в газовом пространстве
        fr_p = ttk.Frame(self.rvs_tab_shell)
        fr_p.pack(fill="x", padx=8, pady=(0, 4))
        ttk.Label(fr_p, text="Избыточное давление в газовом пространстве p, МПа (по ГОСТ для РВС обычно ≤0.005)").pack(side="left")
        ttk.Entry(fr_p, textvariable=self.p_gas, width=12).pack(side="right")

        fr_pt = ttk.Frame(self.rvs_tab_shell)
        fr_pt.pack(fill="x", padx=8, pady=(0, 6))
        ttk.Label(fr_pt, text="Испытательное избыточное давление pисп, МПа (по умолчанию 1.25·p)").pack(side="left")
        ttk.Entry(fr_pt, textvariable=self.p_test, width=12).pack(side="right")

        def _on_p_test_user_edit(*_):
            # если пользователь вручную меняет pисп — отключаем авто 1.25·p
            if getattr(self, "_p_test_sync_guard", False):
                return
            self._p_test_auto = False

        def _sync_ptest_from_p(*_):
            # автозаполнение pисп = 1.25·p (МПа), пока пользователь не переопределил вручную
            if not getattr(self, "_p_test_auto", True):
                return
            try:
                p = float((self.p_gas.get() or "0").replace(",", "."))
            except Exception:
                p = 0.0
            p_auto = 1.25 * p
            self._p_test_sync_guard = True
            try:
                self.p_test.set(f"{p_auto:.6g}")
            finally:
                self._p_test_sync_guard = False

        try:
            self.p_test.trace_add("write", _on_p_test_user_edit)
        except Exception:
            pass
        try:
            self.p_gas.trace_add("write", _sync_ptest_from_p)
        except Exception:
            pass
        _sync_ptest_from_p()

        # пересчёт t_min при изменении давлений
        try:
            self.p_gas.trace_add("write", lambda *_a: _shell_update_all())
        except Exception:
            pass
        try:
            self.p_test.trace_add("write", lambda *_a: _shell_update_all())
        except Exception:
            pass

        _shell_build_rows()

        ttk.Label(self.rvs_tab_shell, text="Примечание: t_min — MVP по гидростатике (будет заменён на расчёты по СП/ГОСТ).").pack(anchor="w", padx=8, pady=(6,0))

        
        
        # ---------------- ДНИЩЕ ----------------
        ttk.Label(self.rvs_tab_bottom, text="Днище: исполнение с окрайкой (кольцевой лист) / без окрайки (ГОСТ 31385-2023).").pack(anchor="w", padx=8, pady=(8,4))

        # Исполнение
        self.bottom_has_ring = tk.StringVar(value="with_ring")  # with_ring | no_ring
        fr_exec = ttk.Frame(self.rvs_tab_bottom)
        fr_exec.pack(fill="x", padx=8, pady=(6,2))
        ttk.Label(fr_exec, text="Исполнение днища:").pack(side="left")
        ttk.Radiobutton(fr_exec, text="с окрайкой", variable=self.bottom_has_ring, value="with_ring").pack(side="left", padx=8)
        ttk.Radiobutton(fr_exec, text="без окрайки", variable=self.bottom_has_ring, value="no_ring").pack(side="left")

        # Статус/предупреждения
        self.bottom_status = tk.StringVar(value="")
        
        ttk.Label(self.rvs_tab_bottom, textvariable=self.bottom_status, foreground="#b00020").pack(anchor="w", padx=8, pady=(2,6))

        # Информация по минимальной требуемой ширине окрайки (L0) по ГОСТ 31385-2023, 6.1.3.6
        self.bottom_L0 = tk.StringVar(value="")
        ttk.Label(self.rvs_tab_bottom, textvariable=self.bottom_L0).pack(anchor="w", padx=8, pady=(0,6))

        # Табличка толщин: t_min (readonly, по ГОСТ) + желаемая t + коррозия + минусовой допуск + t_итог (readonly)
        tb = ttk.Frame(self.rvs_tab_bottom)
        tb.pack(fill="x", padx=8, pady=(4,6))

        hdr = [
            ("Элемент", 14),
            ("Марка\nстали", 12),
            ("Минус\nдопуск, мм", 12),
            ("t_min,\nмм", 10),
            ("Желаемая\nt, мм", 12),
            ("Коррозия,\nмм", 10),
            ("t_итог,\nмм", 10),
        ]
        for c, (h, w) in enumerate(hdr):
            ttk.Label(tb, text=h, width=w, justify="center").grid(row=0, column=c, sticky="w", padx=3, pady=(0, 4))
        ttk.Separator(tb, orient="horizontal").grid(row=1, column=0, columnspan=len(hdr), sticky="ew", pady=(0, 6))

        steel_values = ["09Г2С", "16ГС", "Ст3сп", "10ХСНД", "12Х18Н10Т"]

        # Переменные (днище)
        self.bottom_steel = tk.StringVar(value=steel_values[0])
        self.bottom_minus = tk.StringVar(value="0.3")
        self.bottom_tmin = tk.StringVar(value="4.00")
        self.bottom_tdes = tk.StringVar(value="")
        self.bottom_corr = tk.StringVar(value="0")
        self.bottom_tfinal = tk.StringVar(value="4.00")

        # Переменные (окрайка)
        self.ring_steel = tk.StringVar(value=steel_values[0])
        self.ring_minus = tk.StringVar(value="0.3")
        self.ring_tmin = tk.StringVar(value="6.00")
        self.ring_tdes = tk.StringVar(value="")
        self.ring_corr = tk.StringVar(value="0")
        self.ring_tfinal = tk.StringVar(value="6.00")

        # Чтобы общий расчёт использовал итоговую толщину днища:
        self.t_bottom = self.bottom_tfinal

        def _row(r, name, steel_var, minus_var, tmin_var, tdes_var, corr_var, tfinal_var, readonly_min=True):
            ttk.Label(tb, text=name, width=14).grid(row=r, column=0, sticky="w", padx=3, pady=2)
            ttk.Combobox(tb, textvariable=steel_var, values=steel_values, width=10, state="readonly").grid(row=r, column=1, sticky="w", padx=3, pady=2)
            ttk.Entry(tb, textvariable=minus_var, width=12).grid(row=r, column=2, sticky="w", padx=3, pady=2)
            ttk.Entry(tb, textvariable=tmin_var, width=10, state=("readonly" if readonly_min else "normal")).grid(row=r, column=3, sticky="w", padx=3, pady=2)
            ttk.Entry(tb, textvariable=tdes_var, width=12).grid(row=r, column=4, sticky="w", padx=3, pady=2)
            ttk.Combobox(tb, textvariable=corr_var, values=[str(x) for x in range(0, 13)], width=8, state="readonly").grid(row=r, column=5, sticky="w", padx=3, pady=2)
            ttk.Entry(tb, textvariable=tfinal_var, width=10, state="readonly").grid(row=r, column=6, sticky="w", padx=3, pady=2)

        _row(2, "Днище", self.bottom_steel, self.bottom_minus, self.bottom_tmin, self.bottom_tdes, self.bottom_corr, self.bottom_tfinal)

        # Строка "Окрайка" (скрывается, если выбрано "без окрайки")
        self._ring_row_widgets = []
        # Создадим как набор виджетов, чтобы корректно прятать
        def _make_ring_row():
            r = 3
            w0 = ttk.Label(tb, text="Окрайка", width=14); w0.grid(row=r, column=0, sticky="w", padx=3, pady=2)
            w1 = ttk.Combobox(tb, textvariable=self.ring_steel, values=steel_values, width=10, state="readonly"); w1.grid(row=r, column=1, sticky="w", padx=3, pady=2)
            w2 = ttk.Entry(tb, textvariable=self.ring_minus, width=12); w2.grid(row=r, column=2, sticky="w", padx=3, pady=2)
            w3 = ttk.Entry(tb, textvariable=self.ring_tmin, width=10, state="readonly"); w3.grid(row=r, column=3, sticky="w", padx=3, pady=2)
            w4 = ttk.Entry(tb, textvariable=self.ring_tdes, width=12); w4.grid(row=r, column=4, sticky="w", padx=3, pady=2)
            w5 = ttk.Combobox(tb, textvariable=self.ring_corr, values=[str(x) for x in range(0, 13)], width=8, state="readonly"); w5.grid(row=r, column=5, sticky="w", padx=3, pady=2)
            w6 = ttk.Entry(tb, textvariable=self.ring_tfinal, width=10, state="readonly"); w6.grid(row=r, column=6, sticky="w", padx=3, pady=2)
            self._ring_row_widgets = [w0, w1, w2, w3, w4, w5, w6]

        _make_ring_row()

        ttk.Label(self.rvs_tab_bottom, text="Примечание: t_min — по ГОСТ 31385-2023 (для окрайки t_min рассчитывается по 6.1.3.5 и не ниже тех. минимума).").pack(anchor="w", padx=8, pady=(6, 0))

        def _bottom_update_visibility():
            show = (self.bottom_has_ring.get() == "with_ring")
            for w in self._ring_row_widgets:
                w.grid() if show else w.grid_remove()

        def _parse_mm(var: tk.StringVar, default=0.0) -> float:
            try:
                return float((var.get() or "").replace(",", "."))
            except Exception:
                return float(default)

        
        def _bottom_update_all(*_):
            # Геометрия / объем
            try:
                V = float((self.v_geom.get() or "0").replace(",", "."))
            except Exception:
                V = 0.0

            # 1) Предупреждение по применимости днища без окрайки (ГОСТ 31385-2023, 6.1.3.2)
            warn = ""
            if self.bottom_has_ring.get() == "no_ring" and V > 1000.0 + 1e-9:
                warn = (
                    f"Внимание: V={V:.1f} м³ > 1000 м³. По ГОСТ 31385-2023 (6.1.3.2) днище должно быть с окрайками; "
                    f"оставить без окрайки можно только осознанно (по проекту/согласованию)."
                )
            self.bottom_status.set(warn)

            # 2) Базовые минимальные толщины по ГОСТ (без учета минусового допуска и коррозии)
            # Центральная часть днища / днище без окраек: 6.1.3.3 (упрощенная ступень по объему)
            tmin_central_base_mm = 4.0 if V < 2000.0 - 1e-9 else 6.0

            # 3) Окрайка: 6.1.3.5 — расчетная величина (без учета минусового допуска и коррозии),
            # затем не ниже tmin_central_base_mm (тех. минимум).
            try:
                D_m = self._get_rvs_D_mm() / 1000.0
                r_m = D_m / 2.0
            except Exception:
                r_m = 0.0

            # Нижний пояс стенки: берем принятую толщину первого пояса (до коррозии), чтобы получить t_net.
            # Вкладка "Стенка": tfinal = ceil(max(tmin, desired)+corr). Поэтому t_before_corr ≈ tfinal - corr.
            t1_before_corr_mm = 0.0
            t1_minus_mm = 0.0
            t1_corr_mm = 0.0
            try:
                if getattr(self, "shell_rows", None) and len(self.shell_rows) >= 1:
                    row0 = self.shell_rows[0]
                    t1_corr_mm = float((row0["corr"].get() or "0").replace(",", "."))
                    t1_minus_mm = float((row0["tol"].get() or "0").replace(",", "."))
                    t1_minus_mm = abs(t1_minus_mm) if t1_minus_mm < 0 else t1_minus_mm
                    t1_itog_mm = float((row0["tfinal"].get() or "0").replace(",", "."))
                    t1_before_corr_mm = max(0.0, t1_itog_mm - t1_corr_mm)
            except Exception:
                t1_before_corr_mm = 0.0
                t1_minus_mm = 0.0
                t1_corr_mm = 0.0

            # Минусовые допуски (в этой вкладке)
            bottom_minus_mm = _parse_mm(self.bottom_minus, 0.3)
            ring_minus_mm = _parse_mm(self.ring_minus, 0.3)

            # База для t_min (как в "Стенке": t_min включает минусовой допуск, но НЕ включает коррозию)
            bottom_tmin_nom_mm = tmin_central_base_mm + bottom_minus_mm
            self.bottom_tmin.set(f"{bottom_tmin_nom_mm:.2f}")

            # Окрайка — расчетная база (без минуса/коррозии), затем прибавляем минусовой допуск
            k1 = 0.77
            tb_base_mm = tmin_central_base_mm  # fallback

            if r_m > 0 and t1_before_corr_mm > 0:
                try:
                    t_net_mm = max(0.0, t1_before_corr_mm - t1_minus_mm)
                    if t_net_mm <= 0:
                        raise ValueError("t_net<=0")

                    r_mm = r_m * 1000.0
                    factor = (k1 - 0.0024 * math.sqrt(r_mm / t_net_mm))
                    base_mm = factor * t_net_mm
                    tb_base_mm = max(float(base_mm), tmin_central_base_mm)
                except Exception:
                    tb_base_mm = tmin_central_base_mm

            ring_tmin_nom_mm = tb_base_mm + ring_minus_mm
            self.ring_tmin.set(f"{ring_tmin_nom_mm:.2f}")

            # 3b) Минимальная ширина окрайки L0 (6.1.3.6). Для консервативности считаем по номинальной толщине окрайки.
            if self.bottom_has_ring.get() == "with_ring" and r_m > 0:
                try:
                    r_mm = r_m * 1000.0
                    k2 = 0.92
                    # берем толщину по минимуму (с минусовым допуском), без коррозии
                    tb_for_L0_mm = max(tb_base_mm, tmin_central_base_mm) + ring_minus_mm
                    L0_mm = k2 * math.sqrt(max(0.0, r_mm * max(0.0, tb_for_L0_mm)))
                    Lmin_mm = 300.0 if V < 5000.0 - 1e-9 else 600.0
                    Lreq_mm = max(L0_mm, Lmin_mm)
                    self.bottom_L0.set(f"Окрайка: минимальная ширина L0 ≥ {Lreq_mm:.0f} мм (по ГОСТ 6.1.3.6).")
                except Exception:
                    self.bottom_L0.set("")
            else:
                self.bottom_L0.set("")

            # 4) Итоговые толщины: t_итог = ceil(max(t_min, t_жел)+коррозия)
            def _final(tmin_nom_mm: float, desired_str: str, corr_str: str) -> int:
                base = tmin_nom_mm
                if (desired_str or "").strip():
                    try:
                        tdes = float(desired_str.replace(",", "."))
                        base = max(base, tdes)
                    except Exception:
                        pass
                try:
                    corr = float((corr_str or "0").replace(",", "."))
                except Exception:
                    corr = 0.0
                return int(math.ceil(base + corr))

            self.bottom_tfinal.set(str(_final(bottom_tmin_nom_mm, self.bottom_tdes.get(), self.bottom_corr.get())))

            if self.bottom_has_ring.get() == "with_ring":
                self.ring_tfinal.set(str(_final(ring_tmin_nom_mm, self.ring_tdes.get(), self.ring_corr.get())))
            else:
                # строка скрыта, но значение поддерживаем консистентным
                self.ring_tfinal.set(str(_final(ring_tmin_nom_mm, self.ring_tdes.get(), self.ring_corr.get())))

        # триггеры обновления
        self.bottom_has_ring.trace_add("write", lambda *_a: (_bottom_update_visibility(), _bottom_update_all()))
        for v in [
            self.bottom_tdes, self.bottom_corr, self.bottom_minus, self.bottom_steel,
            self.ring_tdes, self.ring_corr, self.ring_minus, self.ring_steel,
            self.v_geom, self.rvs_D_sel, self.rvs_D_other
        ]:
            try:
                v.trace_add("write", _bottom_update_all)
            except Exception:
                pass

        _bottom_update_visibility()
        _bottom_update_all()
# ---------------- /ДНИЩЕ ----------------
        
                # ---------------- КРЫША ----------------
        # MVP (этап): UI и исходные данные под 4 типа кровли.
        # Расчёт пока ограничен снегом по μ(α) (упрощенно) + пользовательским коэффициентом k (для конической по вашей настройке 1.2).
        # Подбор сечений каркаса (швеллер/двутавр) и проверочные расчёты будут наращиваться далее.

        self.roof_type = tk.StringVar(value="conical")  # conical | conical_framed | frame_panel

        roof_box = ttk.Frame(self.rvs_tab_roof)
        roof_box.pack(fill="x", padx=8, pady=(8, 6))

        ttk.Label(roof_box, text="Тип кровли, —").grid(row=0, column=0, sticky="w")
        rb = ttk.Frame(roof_box)
        rb.grid(row=0, column=1, sticky="w", padx=(8, 0))
        for val, txt in [
            ("conical", "Коническая"),
            ("conical_framed", "Коническая каркасная"),
            ("frame_panel", "Каркасно-щитовая"),
        ]:
            ttk.Radiobutton(rb, text=txt, value=val, variable=self.roof_type).pack(side="left", padx=(0, 10))

        # Геометрические параметры
        # Уклон кровли: диапазон зависит от типа
        # - коническая / коническая каркасная: 10…25°
        # - каркасно-щитовая: 3…9°
        self.roof_alpha_deg = tk.StringVar(value="15")

        # Каркас (для каркасных типов)
        # На текущем этапе для конической каркасной каркас фиксируем по минимуму: швеллер 12П.
        self.roof_frame_member = tk.StringVar(value="channel")
        self.roof_frame_spacing_m = tk.StringVar(value="3.2")
        self.roof_ribs_count = tk.StringVar(value="")
        self.roof_ribs_rec = tk.StringVar(value="")
        self.roof_ribs_warn = tk.StringVar(value="")
        self.roof_channel_size = tk.StringVar(value="Швеллер 12П")
        self.roof_ibeam_size = tk.StringVar(value="")

        # Уторный уголок
        self.roof_has_toe_angle = tk.BooleanVar(value=True)
        self.roof_toe_angle_rec = tk.StringVar(value="")
        self.roof_toe_angle_size = tk.StringVar(value="63x63x5")

        # Снег по крыше: показываем только S (кПа) + масса (кг/м²), без коэффициентов формы
        self.roof_alpha_hint = tk.StringVar(value="")
        self.roof_gost_warn = tk.StringVar(value="")
        self.roof_snow_kPa = tk.StringVar(value="")
        self.roof_snow_kgm2 = tk.StringVar(value="")

        # Масса кровли: авто / пользовательская / используемая
        self.roof_mass_auto_kg = tk.StringVar(value="")
        self.roof_mass_user_kg = tk.StringVar(value="")
        self.roof_mass_used_kg = tk.StringVar(value="")

        # Материалы кровли (настил / каркас / уторный уголок)
        self.roof_steel_deck = tk.StringVar(value=self._steel_grades[0])
        self.roof_minus_deck = tk.StringVar(value="0.0")
        self.roof_corr_deck = tk.StringVar(value="0")
        self.roof_tmin_deck = tk.StringVar(value="4")
        self.roof_t_des_deck = tk.StringVar(value="")
        self.roof_tfinal_deck = tk.StringVar(value="4")

        self.roof_steel_frame = tk.StringVar(value=self._steel_grades[0])
        self.roof_steel_toe = tk.StringVar(value=self._steel_grades[0])
        self.roof_minus_toe = tk.StringVar(value="0.0")

        # --- Геометрия: угол / стрела ---
        fr_geo = ttk.Frame(self.rvs_tab_roof)
        fr_geo.pack(fill="x", padx=8, pady=(2, 2))

        self._roof_alpha_row = ttk.Frame(fr_geo)
        self._roof_alpha_row.pack(fill="x", pady=2)
        ttk.Label(self._roof_alpha_row, text="Уклон кровли α, °").pack(side="left")
        self._roof_alpha_entry = ttk.Entry(self._roof_alpha_row, textvariable=self.roof_alpha_deg, width=10)
        self._roof_alpha_entry.pack(side="right")
        ttk.Label(self._roof_alpha_row, textvariable=self.roof_alpha_hint).pack(side="right", padx=(0, 10))
        ttk.Label(fr_geo, textvariable=self.roof_gost_warn, foreground="#b00020").pack(anchor="w", padx=0, pady=(0, 2))

        # --- Настил кровли (лист) ---
        fr_deck = ttk.LabelFrame(self.rvs_tab_roof, text="Настил кровли (лист)")
        fr_deck.pack(fill="x", padx=8, pady=(6, 6))

        hdr = ttk.Frame(fr_deck); hdr.pack(fill="x", padx=8, pady=(4, 2))
        for col, ttxt in enumerate(["Марка стали","Минус допуск, мм","t_min, мм","Желаемая t, мм","Коррозия, мм","t_итог, мм"]):
            ttk.Label(hdr, text=ttxt).grid(row=0, column=col, sticky="w")

        row = ttk.Frame(fr_deck); row.pack(fill="x", padx=8, pady=(0, 4))
        ttk.Combobox(row, textvariable=self.roof_steel_deck, values=self._steel_grades, width=14, state="readonly").grid(row=0, column=0, sticky="w")
        ttk.Entry(row, textvariable=self.roof_minus_deck, width=10).grid(row=0, column=1, sticky="w", padx=(6, 0))
        ttk.Entry(row, textvariable=self.roof_tmin_deck, width=6, state="readonly").grid(row=0, column=2, sticky="w", padx=(6, 0))
        ttk.Entry(row, textvariable=self.roof_t_des_deck, width=10).grid(row=0, column=3, sticky="w", padx=(6, 0))
        ttk.Combobox(row, textvariable=self.roof_corr_deck, values=["0","1","2","3","4","5"], width=8, state="readonly").grid(row=0, column=4, sticky="w", padx=(6, 0))
        ttk.Entry(row, textvariable=self.roof_tfinal_deck, width=6, state="readonly").grid(row=0, column=5, sticky="w", padx=(6, 0))

        ttk.Label(fr_deck, text="Примечание: t_итог округляется вверх до целых мм.").pack(anchor="w", padx=8, pady=(0, 4))


        # --- Каркас (только для каркасных типов) ---
        fr_frame = ttk.LabelFrame(self.rvs_tab_roof, text="Каркас (для каркасных типов)")
        fr_frame.pack(fill="x", padx=8, pady=(10, 6))

        fr_mat = ttk.Frame(fr_frame); fr_mat.pack(fill="x", padx=8, pady=(6, 4))
        ttk.Label(fr_mat, text="Марка стали каркаса, —").pack(side="left")
        ttk.Combobox(fr_mat, textvariable=self.roof_steel_frame, values=self._steel_grades, width=14, state="readonly").pack(side="right")

        fr_toe_mat = ttk.Frame(fr_frame); fr_toe_mat.pack(fill="x", padx=8, pady=(0, 4))
        ttk.Label(fr_toe_mat, text="Марка стали уторного уголка, —").pack(side="left")
        ttk.Combobox(fr_toe_mat, textvariable=self.roof_steel_toe, values=self._steel_grades, width=14, state="readonly").pack(side="right")


        # Тип профиля (выбор скрыт; для конической каркасной фиксируем минимум 12П)
        fr_m = ttk.Frame(fr_frame); fr_m.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_m, text="Профиль радиальных балок, —").pack(side="left")
        ttk.Label(fr_m, text="фиксировано: швеллер 12П").pack(side="left", padx=(12, 0))

        # Шаг (только для каркасно-щитовой)
        self._roof_frame_spacing_row = ttk.Frame(fr_frame); self._roof_frame_spacing_row.pack(fill="x", padx=8, pady=4)
        ttk.Label(self._roof_frame_spacing_row, text="Радиальный шаг балок, м (≤ 3.2)").pack(side="left")
        ttk.Entry(self._roof_frame_spacing_row, textvariable=self.roof_frame_spacing_m, width=10).pack(side="right")

        # Количество ребер (коническая каркасная): рассчитываем автоматически по шагу 3.0 м по окружности
        self._roof_ribs_row = ttk.Frame(fr_frame); self._roof_ribs_row.pack(fill="x", padx=8, pady=4)
        ttk.Label(self._roof_ribs_row, text="Рёбра (швеллер 12П):").pack(side="left")
        ttk.Entry(self._roof_ribs_row, textvariable=self.roof_ribs_count, width=10, state="readonly").pack(side="right")
        ttk.Label(self._roof_ribs_row, textvariable=self.roof_ribs_rec).pack(side="right", padx=(0, 10))
        ttk.Label(self._roof_ribs_row, textvariable=self.roof_ribs_warn, foreground="#b00020").pack(side="right", padx=(0, 10))

        # Сортамент каркаса (на данном этапе не задаётся пользователем)
        fr_sz = ttk.Frame(fr_frame); fr_sz.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_sz, text="Сортамент каркаса, —").pack(side="left")
        ttk.Label(fr_sz, text="швеллер 12П (минимум)").pack(side="right")

        # Уторный уголок
        fr_toe = ttk.Frame(fr_frame); fr_toe.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr_toe, text="Уторный уголок (рекоменд./желаемый)").pack(side="left")
        ttk.Entry(fr_toe, textvariable=self.roof_toe_angle_rec, width=14, state="readonly").pack(side="right", padx=(6, 0))
        toe_sizes = ["63x63x5", "63x63x6", "65x50x5", "65x50x6", "65x50x7", "65x50x8", "70x45x5", "70x50x5", "70x70x4.5", "70x70x5", "70x70x6", "70x70x7", "70x70x8", "75x50x5", "75x50x6", "75x50x8", "75x75x5", "75x75x6", "75x75x7", "75x75x8", "75x75x9", "80x50x5", "80x50x6", "80x60x7", "80x80x5.5", "80x80x6", "80x80x7", "80x80x8", "90x56x5.5", "90x56x6", "90x56x8", "90x90x6", "90x90x7", "90x90x8", "90x90x9", "100x63x6", "100x63x7", "100x63x8", "100x63x10", "100x65x8", "100x65x10", "100x100x6.5", "100x100x7", "100x100x8", "100x100x10", "100x100x12", "100x100x14", "100x100x16", "110x70x6.5", "110x70x8", "110x70x10", "125x80x7", "125x80x8", "125x80x10", "125x125x8", "125x125x10", "125x125x12", "140x90x8", "140x90x10", "160x100x10", "160x100x12", "180x110x12", "200x125x12", "200x125x14"]
        self._roof_cb_toe = ttk.Combobox(fr_toe, textvariable=self.roof_toe_angle_size, values=toe_sizes, width=14, state="readonly")
        self._roof_cb_toe.pack(side="right")

        # --- Снеговые величины ---
        fr_snow2 = ttk.Frame(self.rvs_tab_roof)
        fr_snow2.pack(fill="x", padx=8, pady=(8, 2))
        ttk.Label(fr_snow2, text="Снеговая нагрузка на покрытие S, кПа").pack(side="left")
        ttk.Entry(fr_snow2, textvariable=self.roof_snow_kPa, width=12, state="readonly").pack(side="right")

        fr_snowm = ttk.Frame(self.rvs_tab_roof)
        fr_snowm.pack(fill="x", padx=8, pady=(2, 2))
        ttk.Label(fr_snowm, text="Масса снега, кг/м²").pack(side="left")
        ttk.Entry(fr_snowm, textvariable=self.roof_snow_kgm2, width=12, state="readonly").pack(side="right")

        # --- Масса кровли (все типы) ---
        self._roof_mass_box = ttk.LabelFrame(self.rvs_tab_roof, text="Масса кровли")
        self._roof_mass_box.pack(fill="x", padx=8, pady=(10, 6))

        r1 = ttk.Frame(self._roof_mass_box); r1.pack(fill="x", padx=8, pady=(6, 2))
        ttk.Label(r1, text="Расчётная масса кровли, кг").pack(side="left")
        ttk.Entry(r1, textvariable=self.roof_mass_auto_kg, width=14, state="readonly").pack(side="right")

        r2 = ttk.Frame(self._roof_mass_box); r2.pack(fill="x", padx=8, pady=(2, 2))
        ttk.Label(r2, text="Пользовательская масса кровли, кг").pack(side="left")
        ttk.Entry(r2, textvariable=self.roof_mass_user_kg, width=14).pack(side="right")

        r3 = ttk.Frame(self._roof_mass_box); r3.pack(fill="x", padx=8, pady=(2, 6))
        ttk.Label(r3, text="Используемая масса кровли, кг").pack(side="left")
        ttk.Entry(r3, textvariable=self.roof_mass_used_kg, width=14, state="readonly").pack(side="right")

        self.roof_note = tk.StringVar(
            value="Примечание: по кровле отображается S (кПа) без коэффициентов формы. "
                  "Масса кровли — приближённая, с возможностью ручного ввода."
        )
        ttk.Label(self.rvs_tab_roof, textvariable=self.roof_note).pack(anchor="w", padx=8, pady=(6, 0))

        def _parse_angle_size(s: str):
            # "a x b x t" в мм
            try:
                p = s.lower().replace("х", "x").split("x")
                if len(p) != 3:
                    return None
                a = float(p[0]); b = float(p[1]); t = float(p[2])
                if a <= 0 or b <= 0 or t <= 0:
                    return None
                return a, b, t
            except Exception:
                return None

        def _angle_area_mm2(a: float, b: float, t: float) -> float:
            # Приближённая площадь L-профиля без радиусов: A = t*(a+b-t)
            return max(0.0, t * (a + b - t))

        def _recommend_toe_angle(D_mm: float, alpha_deg: float, m_roof_kg: float, S_kPa: float) -> str:
            # Рекомендация по уторному уголку по требуемой площади сечения (A_req),
            # с учетом вертикальной нагрузки на крышу: собственный вес + снег.
            #
            # Принята инженерная схема (по смыслу аналогична используемой в типовых расчетах):
            # p_r = (γ_g * G_r) / A_plan + S
            # A_req = p_r * R^2 / (2 * σ_allow * tan(α))
            #
            # Единицы:
            # - p_r, σ_allow: МПа (= Н/мм²)
            # - R: мм
            # - A_req: мм²
            if D_mm <= 0:
                return ""
            try:
                alpha = float(alpha_deg)
            except Exception:
                alpha = 0.0
            if alpha <= 0.1:
                return ""

            R_mm = D_mm / 2.0
            A_plan_mm2 = math.pi * (R_mm ** 2)
            if A_plan_mm2 <= 0:
                return ""

            # вертикальная нагрузка на план, МПа
            gamma_g = 1.05
            G_r_N = max(0.0, float(m_roof_kg)) * 9.81
            p_self_MPa = (gamma_g * G_r_N) / A_plan_mm2  # Н/мм² = МПа

            # снег: S_kPa -> МПа
            try:
                p_snow_MPa = max(0.0, float(S_kPa)) * 0.001
            except Exception:
                p_snow_MPa = 0.0

            p_r_MPa = p_self_MPa + p_snow_MPa

            # допускаемое напряжение (консервативно), МПа
            sigma_allow_MPa = 160.0

            tan_a = math.tan(math.radians(alpha))
            if abs(tan_a) < 1e-9:
                return ""

            A_req_mm2 = (p_r_MPa * (R_mm ** 2)) / (2.0 * sigma_allow_MPa * tan_a)

            for ss in toe_sizes:
                parsed = _parse_angle_size(ss)
                if not parsed:
                    continue
                a, b, tt = parsed
                if _angle_area_mm2(a, b, tt) >= A_req_mm2:
                    return ss
            return ""
            R = (D_mm / 1000.0) / 2.0
            if R <= 0:
                return ""
            N_per_m = (m_shell_kg * 9.81) / (2.0 * math.pi * R)  # Н/м
            sigma_allow = 160e6  # Па
            A_req_mm2 = (N_per_m / sigma_allow) * 1e6
            for ss in toe_sizes:
                parsed = _parse_angle_size(ss)
                if not parsed:
                    continue
                a, b, tt = parsed
                if _angle_area_mm2(a, b, tt) >= A_req_mm2:
                    return ss
            return ""

        def _roof_constraints_and_visibility():
            t = self.roof_type.get()
            # Уторный уголок обязателен для всех типов, кроме сферической
            self.roof_has_toe_angle.set(True)

            # Показ/скрытие геометрии
            if False:  # removed
                self._roof_alpha_row.pack_forget()
                self._roof_alpha_row  # _roof_rise_row_removed.pack(fill="x", pady=2)
                self.roof_alpha_hint.set("")
            else:
                self._roof_alpha_row  # _roof_rise_row_removed.pack_forget()
                self._roof_alpha_row.pack(fill="x", pady=2)

            # Подсказки по углам (UI-гигиена)
            if t in ("conical", "conical_framed"):
                self.roof_alpha_hint.set("диапазон: 10…25°")
            elif t == "frame_panel":
                self.roof_alpha_hint.set("диапазон: 3…9°")
            else:
                self.roof_alpha_hint.set("")

            # Каркас: показываем только для каркасных
            if t in ("conical_framed", "frame_panel"):
                fr_frame.pack(fill="x", padx=8, pady=(10, 6))
            else:
                fr_frame.pack_forget()

            # Поля каркаса: для конической каркасной — количество ребер; для каркасно-щитовой — радиальный шаг
            if t == "conical_framed":
                if self._roof_frame_spacing_row.winfo_ismapped():
                    self._roof_frame_spacing_row.pack_forget()
                if not self._roof_ribs_row.winfo_ismapped():
                    self._roof_ribs_row.pack(fill="x", padx=8, pady=4)
            elif t == "frame_panel":
                if self._roof_ribs_row.winfo_ismapped():
                    self._roof_ribs_row.pack_forget()
                if not self._roof_frame_spacing_row.winfo_ismapped():
                    self._roof_frame_spacing_row.pack(fill="x", padx=8, pady=4)
            else:
                if self._roof_ribs_row.winfo_ismapped():
                    self._roof_ribs_row.pack_forget()
                if self._roof_frame_spacing_row.winfo_ismapped():
                    self._roof_frame_spacing_row.pack_forget()

            # Сортамент/тип профиля не переключаем (фиксировано 12П для конической каркасной)

            # Уторный уголок: комбо доступен только если включено
            st = "readonly" if self.roof_has_toe_angle.get() else "disabled"
            self._roof_cb_toe.configure(state=st)

            # Для сферической: отключаем уторный уголок в UI (нужна отдельная норма)
            if False:  # removed
                try:
                    self._roof_cb_toe.configure(state="disabled")
                except Exception:
                    pass

            # В каркасно-щитовой: оставить только марку стали каркаса
            if t == "frame_panel":
                fr_toe_mat.pack_forget()
                fr_m.pack_forget()
                self._roof_frame_spacing_row.pack_forget()
                self._roof_ribs_row.pack_forget()
                fr_sz.pack_forget()
                fr_toe.pack_forget()
            else:
                # Для конической/конической каркасной оставляем уторный уголок и сортамент (информативно)
                if not fr_toe_mat.winfo_ismapped():
                    fr_toe_mat.pack(fill="x", padx=8, pady=(0, 4))
                if not fr_m.winfo_ismapped():
                    fr_m.pack(fill="x", padx=8, pady=4)
                if not fr_sz.winfo_ismapped():
                    fr_sz.pack(fill="x", padx=8, pady=4)
                if not fr_toe.winfo_ismapped():
                    fr_toe.pack(fill="x", padx=8, pady=4)

            # Масса кровли показывается для всех типов
            try:
                self._roof_mass_box.pack(fill="x", padx=8, pady=(10, 6))
            except Exception:
                pass

        def _roof_effective_alpha_deg() -> float:

            try:

                return float((self.roof_alpha_deg.get() or "0").replace(",", "."))

            except Exception:

                return 0.0

        def _roof_validate_spacing():
            # ≤3.2 м
            raw = (self.roof_frame_spacing_m.get() or "").strip().replace(",", ".")
            try:
                s = float(raw) if raw else 0.0
            except Exception:
                s = 0.0
            s = clamp(s, 0.5, 3.2)
            self.roof_frame_spacing_m.set(f"{s:.2f}".rstrip("0").rstrip("."))
            return s

        def _roof_recommend_ribs() -> int:
            # Требование: шаг 3.0 м по наружной окружности резервуара.
            # n = ceil(pi*D_out/3.0), округление n до кратности 4.
            D_mm = self._get_rvs_D_mm()
            if D_mm <= 0:
                return 0
            D_m = D_mm / 1000.0
            n = max(4, int(math.ceil((math.pi * D_m) / 3.0)))
            if n % 4 != 0:
                n += (4 - (n % 4))
            return n

        def _roof_validate_ribs():
            n_rec = _roof_recommend_ribs()
            n = n_rec if n_rec > 0 else 0
            self.roof_ribs_count.set(str(n) if n > 0 else "")
            try:
                D_mm = self._get_rvs_D_mm()
                D_m = D_mm / 1000.0 if D_mm > 0 else 0.0
                if n_rec > 0 and D_m > 0:
                    s_fact = (math.pi * D_m / n_rec)
                    self.roof_ribs_rec.set(f"n={n_rec} (шаг {s_fact:.2f} м по окружности)")
                else:
                    self.roof_ribs_rec.set("")
                self.roof_ribs_warn.set("")
            except Exception:
                self.roof_ribs_rec.set("")
                self.roof_ribs_warn.set("")

        def _roof_update_snow(*_):
            try:
                _roof_constraints_and_visibility()
                if self.roof_type.get() == "frame_panel":
                    _roof_validate_spacing()
                elif self.roof_type.get() == "conical_framed":
                    _roof_validate_ribs()

                Sg = float((self.Sg.get() or "0").replace(",", "."))
                self.roof_snow_kPa.set(f"{Sg:.3f}")


                # Масса снега, кг/м² (пересчёт из кПа -> Н/м² -> кг/м²)

                try:

                    S_kPa = float((self.roof_snow_kPa.get() or "0").replace(",", "."))

                    self.roof_snow_kgm2.set(f"{(S_kPa * 1000.0 / 9.81):.1f}")

                except Exception:

                    self.roof_snow_kgm2.set("")


                # Масса кровли: приближённый расчёт
                # - каркасно-щитовая: калиброванная зависимость по D и t
                # - коническая: оболочка + утор
                # - коническая каркасная: оболочка + утор + рёбра (швеллер 12П)
                try:
                    D_mm = self._get_rvs_D_mm()
                    alpha_deg = _roof_effective_alpha_deg()
                    # Предупреждения по применимости (ГОСТ 31385—2023, 6.1.6.3):
                    # - для бескаркасной конической: D в плане ≤ 12.5 м; α = 15…30°
                    try:
                        self.roof_gost_warn.set("")
                        if self.roof_type.get() == "conical" and D_mm > 0:
                            warn = []
                            if D_mm > 12500.0 + 1e-9:
                                warn.append("D>12.5 м (бескаркасная коническая по ГОСТ 31385—2023 не допускается)")
                            if alpha_deg < 15.0 - 1e-9 or alpha_deg > 30.0 + 1e-9:
                                warn.append("α вне 15…30° (по ГОСТ 31385—2023 для бескаркасной конической)")
                            if warn:
                                self.roof_gost_warn.set("Внимание: " + "; ".join(warn))
                    except Exception:
                        self.roof_gost_warn.set("")
                    t_mm = float((self.roof_tfinal_deck.get() or "0").replace(",", "."))
                    rho = 7850.0
                    m_auto = 0.0
                    m_shell = 0.0
                    if D_mm > 0 and t_mm > 0:
                        D_m = D_mm / 1000.0
                        R = D_m / 2.0
                        ca = math.cos(math.radians(alpha_deg))
                        ca = ca if abs(ca) > 1e-9 else 1e-9
                        A = math.pi * (R ** 2) / ca
                        m_shell = A * (t_mm / 1000.0) * rho

                        ttype = self.roof_type.get()
                        if ttype == "frame_panel":
                            kD = 1.458 + (5392.0 / max(1.0, D_mm))
                            m_auto = m_shell * kD
                        else:
                            # Уторный уголок
                            toe_m = 0.0
                            if self.roof_has_toe_angle.get():
                                sz = (self.roof_toe_angle_size.get() or "").strip()
                                parsed = _parse_angle_size(sz)
                                if parsed:
                                    a, b, tt = parsed
                                    A_toe_mm2 = _angle_area_mm2(a, b, tt)
                                    circ = math.pi * D_m
                                    toe_m = circ * (A_toe_mm2 / 1e6) * rho

                            ribs_m = 0.0
                            if ttype == "conical_framed":
                                n = _roof_recommend_ribs()
                                if n > 0:
                                    L = R / ca
                                    m_per_m = 10.4  # кг/м, швеллер 12П (приближённо)
                                    ribs_m = n * L * m_per_m

                            m_auto = m_shell + toe_m + ribs_m

                    self.roof_mass_auto_kg.set(str(int(round(m_auto))) if m_auto > 0 else "")

                    # Рекомендация уторного уголка (для конусных типов)
                    if self.roof_type.get() in ("conical", "conical_framed"):
                        self.roof_toe_angle_rec.set(_recommend_toe_angle(D_mm, alpha_deg, m_shell, S_kPa))
                    else:
                        self.roof_toe_angle_rec.set("")

                except Exception:
                    self.roof_mass_auto_kg.set("")
                    self.roof_toe_angle_rec.set("")

                # Используемая масса: пользовательская (если задана) иначе расчётная
                try:
                    u = float((self.roof_mass_user_kg.get() or "0").replace(",", "."))
                except Exception:
                    u = 0.0
                try:
                    a = float((self.roof_mass_auto_kg.get() or "0").replace(",", "."))
                except Exception:
                    a = 0.0
                m_used = u if u > 0 else a
                self.roof_mass_used_kg.set(str(int(round(m_used))) if m_used > 0 else "")

                # Настил: t_min по ГОСТ 31385-2023 (конструктивный минимум для углеродистой стали 4 мм, табл. 6)
                tmin = 4.0
                self.roof_tmin_deck.set(str(_ceil_mm(tmin)))

                t_des = float((self.roof_t_des_deck.get() or "0").replace(",", ".") or 0)
                minus = float((self.roof_minus_deck.get() or "0").replace(",", ".") or 0)
                corr = float((self.roof_corr_deck.get() or "0").replace(",", ".") or 0)

                t_req_nom = max(tmin, t_des if t_des > 0 else tmin) + corr + minus
                self.roof_tfinal_deck.set(str(_ceil_mm(t_req_nom)))
            except Exception:
                pass

        # Триггеры обновления
        for v in [
            self.roof_type,
            self.roof_alpha_deg,
            self.roof_frame_spacing_m,
            self.roof_has_toe_angle,
            self.roof_toe_angle_size,
            self.Sg,
            self.rvs_D_sel,
            self.rvs_D_other,
            self.roof_mass_user_kg,
            self.roof_t_des_deck,
            self.roof_corr_deck,
            self.roof_minus_deck,
        ]:
            try:
                v.trace_add("write", _roof_update_snow)
            except Exception:
                pass

        def _roof_alpha_commit(_evt=None):
            raw = (self.roof_alpha_deg.get() or "").strip().replace(",", ".")
            try:
                a = float(raw) if raw else 0.0
            except Exception:
                a = 0.0
            if self.roof_type.get() == "frame_panel":
                a = clamp(a, 3.0, 9.0)
            else:
                a = clamp(a, 10.0, 25.0)
            self.roof_alpha_deg.set(f"{a:.2f}".rstrip("0").rstrip("."))
            _roof_update_snow()

        try:
            self._roof_alpha_entry.bind("<FocusOut>", _roof_alpha_commit)
            self._roof_alpha_entry.bind("<Return>", _roof_alpha_commit)
        except Exception:
            pass

        _roof_update_snow()
# ---------------- /КРЫША ----------------

# ---------------- МЕТАЛЛОКОНСТРУКЦИИ ----------------
        # Переменные (вкладка "Металлоконструкции")
        self.metal_service_platform = tk.StringVar(value="Нет")
        self.metal_service_platform_mass_user = tk.StringVar(value="")
        self.metal_service_platform_mass_calc = tk.StringVar(value="")

        self.metal_ladder = tk.StringVar(value="Нет")
        self.metal_ladder_type = tk.StringVar(value="Шахтная")

        self.metal_foam_platform = tk.StringVar(value="Нет")
        self.metal_foam_count = tk.StringVar(value="1")
        self.metal_foam_mass_unit_user = tk.StringVar(value="")
        self.metal_foam_mass_total = tk.StringVar(value="")

        self.metal_lightning = tk.StringVar(value="Нет")
        self.metal_lightning_count = tk.StringVar(value="1")
        self.metal_lightning_mass_unit_user = tk.StringVar(value="")
        self.metal_lightning_mass_total = tk.StringVar(value="")

        self.metal_irrigation = tk.StringVar(value="Нет")
        self.metal_pipe_od = tk.StringVar(value="57")
        self.metal_pipe_t = tk.StringVar(value="3.0")
        self.metal_irrigation_mass_user = tk.StringVar(value="")
        self.metal_irrigation_mass_calc = tk.StringVar(value="")

        fr_metal = ttk.Frame(self.rvs_tab_metal)
        fr_metal.pack(fill="both", expand=True, padx=8, pady=8)

        def _m_float(s: str) -> float:
            try:
                return float((s or "0").strip().replace(",", "."))
            except Exception:
                return 0.0

        def _pipe_mass_per_m_kg(od_mm: float, t_mm: float) -> float:
            # Удельная масса трубы (кг/м), приближённо:
            # m = 0.02466 * (D - t) * t, D,t в мм
            try:
                D = float(od_mm)
                t = float(t_mm)
                if D <= 0 or t <= 0 or t >= D:
                    return 0.0
                return 0.02466 * (D - t) * t
            except Exception:
                return 0.0

        # 1) Площадка обслуживания
        lf1 = ttk.LabelFrame(fr_metal, text="Площадка обслуживания")
        lf1.pack(fill="x", pady=(0, 8))
        ttk.Label(lf1, text="Наличие").grid(row=0, column=0, sticky="w", padx=8, pady=4)
        ttk.Combobox(lf1, textvariable=self.metal_service_platform, state="readonly", width=8,
                     values=["Нет", "Да"]).grid(row=0, column=1, sticky="w", padx=6, pady=4)
        ttk.Label(lf1, text="Масса (ввод), кг").grid(row=0, column=2, sticky="w", padx=(16, 0), pady=4)
        ttk.Entry(lf1, textvariable=self.metal_service_platform_mass_user, width=12).grid(row=0, column=3, sticky="w", padx=6, pady=4)
        ttk.Label(lf1, text="Масса (расчёт), кг").grid(row=0, column=4, sticky="w", padx=(16, 0), pady=4)
        ttk.Entry(lf1, textvariable=self.metal_service_platform_mass_calc, width=12, state="readonly").grid(row=0, column=5, sticky="w", padx=6, pady=4)

        # 2) Лестница
        lf2 = ttk.LabelFrame(fr_metal, text="Лестница")
        lf2.pack(fill="x", pady=(0, 8))
        ttk.Label(lf2, text="Наличие").grid(row=0, column=0, sticky="w", padx=8, pady=4)
        ttk.Combobox(lf2, textvariable=self.metal_ladder, state="readonly", width=8,
                     values=["Нет", "Да"]).grid(row=0, column=1, sticky="w", padx=6, pady=4)
        ttk.Label(lf2, text="Тип лестницы").grid(row=1, column=0, sticky="w", padx=8, pady=4)
        cb_ladder_type = ttk.Combobox(lf2, textvariable=self.metal_ladder_type, state="disabled", width=14,
                                      values=["Шахтная", "Винтовая", "Стремянка"])
        cb_ladder_type.grid(row=1, column=1, sticky="w", padx=6, pady=4)

        # 3) Площадка обслуживания пеногенератора
        lf3 = ttk.LabelFrame(fr_metal, text="Площадка обслуживания пеногенератора")
        lf3.pack(fill="x", pady=(0, 8))
        ttk.Label(lf3, text="Наличие").grid(row=0, column=0, sticky="w", padx=8, pady=4)
        ttk.Combobox(lf3, textvariable=self.metal_foam_platform, state="readonly", width=8,
                     values=["Нет", "Да"]).grid(row=0, column=1, sticky="w", padx=6, pady=4)
        ttk.Label(lf3, text="Количество").grid(row=0, column=2, sticky="w", padx=(16, 0), pady=4)
        cb_foam_count = ttk.Combobox(lf3, textvariable=self.metal_foam_count, state="disabled", width=6,
                                     values=["1", "2", "3", "4", "5"])
        cb_foam_count.grid(row=0, column=3, sticky="w", padx=6, pady=4)
        ttk.Label(lf3, text="Масса/шт (ввод), кг").grid(row=0, column=4, sticky="w", padx=(16, 0), pady=4)
        ent_foam_unit = ttk.Entry(lf3, textvariable=self.metal_foam_mass_unit_user, width=10, state="disabled")
        ent_foam_unit.grid(row=0, column=5, sticky="w", padx=6, pady=4)
        ttk.Label(lf3, text="Итого, кг").grid(row=0, column=6, sticky="w", padx=(16, 0), pady=4)
        ttk.Entry(lf3, textvariable=self.metal_foam_mass_total, width=12, state="readonly").grid(row=0, column=7, sticky="w", padx=6, pady=4)

        # 4) Молниеприёмник
        lf4 = ttk.LabelFrame(fr_metal, text="Молниеприёмник")
        lf4.pack(fill="x", pady=(0, 8))
        ttk.Label(lf4, text="Наличие").grid(row=0, column=0, sticky="w", padx=8, pady=4)
        ttk.Combobox(lf4, textvariable=self.metal_lightning, state="readonly", width=8,
                     values=["Нет", "Да"]).grid(row=0, column=1, sticky="w", padx=6, pady=4)
        ttk.Label(lf4, text="Количество").grid(row=0, column=2, sticky="w", padx=(16, 0), pady=4)
        cb_light_count = ttk.Combobox(lf4, textvariable=self.metal_lightning_count, state="disabled", width=6,
                                      values=["1", "2", "3", "4", "5"])
        cb_light_count.grid(row=0, column=3, sticky="w", padx=6, pady=4)
        ttk.Label(lf4, text="Масса/шт (ввод), кг").grid(row=0, column=4, sticky="w", padx=(16, 0), pady=4)
        ent_light_unit = ttk.Entry(lf4, textvariable=self.metal_lightning_mass_unit_user, width=10, state="disabled")
        ent_light_unit.grid(row=0, column=5, sticky="w", padx=6, pady=4)
        ttk.Label(lf4, text="Итого, кг").grid(row=0, column=6, sticky="w", padx=(16, 0), pady=4)
        ttk.Entry(lf4, textvariable=self.metal_lightning_mass_total, width=12, state="readonly").grid(row=0, column=7, sticky="w", padx=6, pady=4)

        # 5) Кольцевая труба орошения
        lf5 = ttk.LabelFrame(fr_metal, text="Кольцевая труба орошения")
        lf5.pack(fill="x")
        ttk.Label(lf5, text="Наличие").grid(row=0, column=0, sticky="w", padx=8, pady=4)
        ttk.Combobox(lf5, textvariable=self.metal_irrigation, state="readonly", width=8,
                     values=["Нет", "Да"]).grid(row=0, column=1, sticky="w", padx=6, pady=4)

        ttk.Label(lf5, text="Труба, Dн (мм)").grid(row=0, column=2, sticky="w", padx=(16, 0), pady=4)
        cb_pipe_od = ttk.Combobox(lf5, textvariable=self.metal_pipe_od, state="disabled", width=6,
                                  values=[str(x) for x in [57, 76, 89, 108, 114, 127, 133, 159]])
        cb_pipe_od.grid(row=0, column=3, sticky="w", padx=6, pady=4)

        ttk.Label(lf5, text="t (мм)").grid(row=0, column=4, sticky="w", padx=(16, 0), pady=4)
        cb_pipe_t = ttk.Combobox(lf5, textvariable=self.metal_pipe_t, state="disabled", width=6,
                                 values=[str(x) for x in [3.0, 3.5, 4.0, 5.0, 6.0]])
        cb_pipe_t.grid(row=0, column=5, sticky="w", padx=6, pady=4)

        ttk.Label(lf5, text="Масса (ввод), кг").grid(row=1, column=0, sticky="w", padx=8, pady=4)
        ent_irr_user = ttk.Entry(lf5, textvariable=self.metal_irrigation_mass_user, width=12, state="disabled")
        ent_irr_user.grid(row=1, column=1, sticky="w", padx=6, pady=4)

        ttk.Label(lf5, text="Масса (расчёт), кг").grid(row=1, column=2, sticky="w", padx=(16, 0), pady=4)
        ttk.Entry(lf5, textvariable=self.metal_irrigation_mass_calc, width=12, state="readonly").grid(row=1, column=3, sticky="w", padx=6, pady=4)

        def _metal_update(*_):
            # Высота стенки для ограничений (м)
            try:
                H_m = self._get_rvs_H_mm() / 1000.0
            except Exception:
                H_m = 0.0

            # Лестница: тип активен только если "Да"; стремянка только до 5 м
            ladder_yes = (self.metal_ladder.get() == "Да")
            if ladder_yes:
                cb_ladder_type.configure(state="readonly")
                vals = ["Шахтная", "Винтовая"] + (["Стремянка"] if H_m <= 5.0 + 1e-9 else [])
                cb_ladder_type.configure(values=vals)
                if self.metal_ladder_type.get() not in vals:
                    self.metal_ladder_type.set(vals[0])
            else:
                cb_ladder_type.configure(state="disabled")

            # Пеногенератор
            foam_yes = (self.metal_foam_platform.get() == "Да")
            cb_foam_count.configure(state=("readonly" if foam_yes else "disabled"))
            ent_foam_unit.configure(state=("normal" if foam_yes else "disabled"))
            if foam_yes:
                cnt = int(_m_float(self.metal_foam_count.get()) or 0)
                m_unit = _m_float(self.metal_foam_mass_unit_user.get())
                self.metal_foam_mass_total.set(f"{cnt*m_unit:.0f}" if m_unit > 0 else "")
            else:
                self.metal_foam_mass_total.set("")

            # Молниеприёмник
            light_yes = (self.metal_lightning.get() == "Да")
            cb_light_count.configure(state=("readonly" if light_yes else "disabled"))
            ent_light_unit.configure(state=("normal" if light_yes else "disabled"))
            if light_yes:
                cnt = int(_m_float(self.metal_lightning_count.get()) or 0)
                m_unit = _m_float(self.metal_lightning_mass_unit_user.get())
                self.metal_lightning_mass_total.set(f"{cnt*m_unit:.0f}" if m_unit > 0 else "")
            else:
                self.metal_lightning_mass_total.set("")

            # Орошение
            irr_yes = (self.metal_irrigation.get() == "Да")
            cb_pipe_od.configure(state=("readonly" if irr_yes else "disabled"))
            cb_pipe_t.configure(state=("readonly" if irr_yes else "disabled"))
            ent_irr_user.configure(state=("normal" if irr_yes else "disabled"))

            if irr_yes:
                try:
                    D_m = self._get_rvs_D_mm() / 1000.0
                except Exception:
                    D_m = 0.0
                circ_m = math.pi * max(0.0, D_m)
                length_m = circ_m + 2.0 * max(0.0, H_m)
                m_per_m = _pipe_mass_per_m_kg(self.metal_pipe_od.get(), self.metal_pipe_t.get())
                self.metal_irrigation_mass_calc.set(f"{length_m*m_per_m:.0f}" if m_per_m > 0 and length_m > 0 else "")
            else:
                self.metal_irrigation_mass_calc.set("")

        for v in [
            self.metal_ladder, self.metal_ladder_type,
            self.metal_foam_platform, self.metal_foam_count, self.metal_foam_mass_unit_user,
            self.metal_lightning, self.metal_lightning_count, self.metal_lightning_mass_unit_user,
            self.metal_irrigation, self.metal_pipe_od, self.metal_pipe_t,
            self.rvs_D_sel, self.rvs_D_other, self.rvs_H_sel, self.rvs_H_other
        ]:
            try:
                v.trace_add("write", _metal_update)
            except Exception:
                pass

        # Также пересчитываем при потере фокуса/нажатии Enter в полях, где ввод чисел
        try:
            ent_foam_unit.bind("<FocusOut>", _metal_update); ent_foam_unit.bind("<Return>", _metal_update)
            ent_light_unit.bind("<FocusOut>", _metal_update); ent_light_unit.bind("<Return>", _metal_update)
            ent_irr_user.bind("<FocusOut>", _metal_update); ent_irr_user.bind("<Return>", _metal_update)
        except Exception:
            pass

        _metal_update()
# ---------------- /МЕТАЛЛОКОНСТРУКЦИИ ----------------

    def _build_rgs_tabs(self):
        self.rgs_tabs = ttk.Notebook(self.rgs_root)
        self.rgs_tabs.pack(fill="both", expand=True)

        self.rgs_types = {
            "РГСН": ttk.Frame(self.rgs_tabs),
            "РГСП": ttk.Frame(self.rgs_tabs),
            "РГСНД": ttk.Frame(self.rgs_tabs),
            "РГСПД": ttk.Frame(self.rgs_tabs),
        }
        for name, frame in self.rgs_types.items():
            self.rgs_tabs.add(frame, text=name)

        self.rgs_D = {}
        self.rgs_L = {}
        self.rgs_t = {}
        self.rgs_saddle_w = {}
        self.rgs_R0 = {}

        for name, tab in self.rgs_types.items():
            ttk.Label(tab, text=f"{name}: геометрия и опоры (в MVP расчёт одинаковый)").pack(anchor="w", padx=8, pady=(8,2))
            self.rgs_D[name] = self._num(tab, "D, м", "3.2")
            self.rgs_L[name] = self._num(tab, "L, м", "12.0")
            self.rgs_t[name] = self._num(tab, "tном обечайки, мм", "8.0")
            self.rgs_saddle_w[name] = self._num(tab, "b опоры, м (ширина седла)", "0.6")
            self.rgs_R0[name] = self._num(tab, "R, кПа (сопр. грунта)", "200")

            ttk.Label(tab, text="Примечание: для подземных/двустенных типов позже добавим поля по обсыпке, межстенному контролю и т.д.").pack(anchor="w", padx=8, pady=(6,8))

    def _build_output(self):
        self.text = tk.Text(self.right, wrap="word")
        self.text.pack(fill="both", expand=True)

    def _num(self, parent, label, default):
        fr = ttk.Frame(parent)
        fr.pack(fill="x", padx=8, pady=4)
        ttk.Label(fr, text=label).pack(side="left")
        var = tk.StringVar(value=str(default))
        ttk.Entry(fr, textvariable=var, width=14).pack(side="right")
        return var

    def _make_autocomplete_combobox(self, parent, textvariable, values, width=28):
        """
        Простой автокомплит без внешних библиотек.
        Пользователь начинает вводить -> список фильтруется по подстроке (без учета регистра).
        """
        cb = ttk.Combobox(parent, textvariable=textvariable, values=values, width=width)
        cb._all_values = list(values)

        def _filter(_event=None):
            s = (textvariable.get() or "").strip().lower()
            if not s:
                cb["values"] = cb._all_values
                return
            cb["values"] = [v for v in cb._all_values if s in v.lower()]

        cb.bind("<KeyRelease>", _filter)
        cb.bind("<<ComboboxSelected>>", lambda e: _filter())
        return cb


    def _diameter_selector(self, parent):
        """
        Выбор типового диаметра по Таблице 1 ГОСТ 31385-2023 (D, м) + вариант "Другое".
        В UI работаем в мм.
        """
        fr = ttk.Frame(parent)
        fr.pack(fill="x", padx=8, pady=4)

        ttk.Label(fr, text="Диаметр резервуара (D), мм").pack(side="left")

        # типовые значения (по Таблице 1 ГОСТ 31385-2023, D в метрах → переводим в мм)
        typical_D_m = [4.73, 6.63, 7.58, 8.53, 10.43, 11.92, 15.18, 18.98, 22.80,
                       28.50, 34.20, 39.90, 45.60, 56.90, 60.70, 76.00, 95.40]
        typical_mm = [str(int(round(x * 1000))) for x in typical_D_m]

        values = typical_mm + ["Другое"]
        sel = tk.StringVar(value=typical_mm[5])  # 11.92 м ~ 11920 мм (частый типоразмер)
        cb = ttk.Combobox(fr, textvariable=sel, values=values, width=10, state="readonly")
        cb.pack(side="right")

        other = tk.StringVar(value="")
        ent = ttk.Entry(fr, textvariable=other, width=12, state="disabled")
        ent.pack(side="right", padx=(6, 6))

        def on_change(*_):
            if sel.get() == "Другое":
                ent.configure(state="normal")
                if not other.get().strip():
                    other.set("20000")
            else:
                ent.configure(state="disabled")
                other.set("")

        cb.bind("<<ComboboxSelected>>", lambda e: on_change())
        on_change()

        # Вторая строка подсказки
        hint = ttk.Label(parent, text="Выбор типоразмеров: Таблица 1 ГОСТ 31385-2023 (рекомендуемые параметры).")
        hint.pack(anchor="w", padx=8, pady=(0, 6))

        return sel, other

    def _height_selector(self, parent):
        """
        Выбор высоты стенки (H), мм.
        Кратность 1490 мм, последний типовой 17880 мм.
        """
        fr = ttk.Frame(parent)
        fr.pack(fill="x", padx=8, pady=4)

        ttk.Label(fr, text="Высота стенки (H), мм").pack(side="left")

        # кратность 1490 мм
        step = 1490
        typical_mm = [str(step * i) for i in range(1, int(17880/step) + 1)]

        values = typical_mm + ["Другое"]
        sel = tk.StringVar(value=typical_mm[7] if len(typical_mm) > 7 else typical_mm[0])
        cb = ttk.Combobox(fr, textvariable=sel, values=values, width=10, state="readonly")
        cb.pack(side="right")

        other = tk.StringVar(value="")
        ent = ttk.Entry(fr, textvariable=other, width=12, state="disabled")
        ent.pack(side="right", padx=(6, 6))

        def on_change(*_):
            if sel.get() == "Другое":
                ent.configure(state="normal")
                if not other.get().strip():
                    other.set("12000")
            else:
                ent.configure(state="disabled")
                other.set("")

        cb.bind("<<ComboboxSelected>>", lambda e: on_change())
        on_change()

        hint = ttk.Label(parent, text="Высота кратна 1490 мм (типовая компоновка поясов).")
        hint.pack(anchor="w", padx=8, pady=(0, 6))

        return sel, other

    def _active_main(self):
        return self.main_tabs.tab(self.main_tabs.select(), "text")

    def _get_rvs_D_mm(self) -> float:
        v = self.rvs_D_sel.get().strip()
        if v == "Другое":
            s = self.rvs_D_other.get().strip()
            if not s:
                raise ValueError("Диаметр: выбрано 'Другое', но значение не задано")
            return float(s)
        return float(v)

    def _get_rvs_H_mm(self) -> float:
        v = self.rvs_H_sel.get().strip()
        if v == "Другое":
            s = self.rvs_H_other.get().strip()
            if not s:
                raise ValueError("Высота: выбрано 'Другое', но значение не задано")
            return float(s)
        return float(v)

    def _calc(self):
        try:
            fill_mode = self.fill_mode.get()
            fill_val_raw = float(self.fill_val.get())

            if self._active_main() == "РВС":
                D_mm = self._get_rvs_D_mm()
                H_mm = self._get_rvs_H_mm()
                D = D_mm / 1000.0
                H = H_mm / 1000.0
                rho = float(self.rho.get())
                Rd = 300.0  # временно: будет заменено на выбор стали и расчёт по ГОСТ/СП
                corr = 0.0  # припуск на коррозию будет задан в вкладках "Днище/Стенка/Крыша"
                mu = 0.35  # временно: коэффициент трения будет перенесён в расширенные настройки/анкера
                w0 = float(self.w0.get())
                R0 = float(self.R0.get())
                roof = self.roof.get()
                t_bot = float(self.t_bottom.get())
                t_roof = float(self.t_roof.get())

                courses = []
                for p in self.courses_entry.get().split(","):
                    p = p.strip()
                    if p:
                        courses.append(float(p))
                if not courses:
                    raise ValueError("Не заданы толщины поясов")

                fill_val = (fill_val_raw/1000.0) if fill_mode=="level" else fill_val_raw

                fill_val = (fill_val_raw/1000.0) if fill_mode=="level" else fill_val_raw

                self.result = rvs_calc(D,H,roof,courses,t_bot,t_roof,rho,fill_mode,fill_val,w0,R0,Rd,corr,mu)

            else:
                tname = self.rgs_tabs.tab(self.rgs_tabs.select(), "text")
                D = float(self.rgs_D[tname].get())
                L = float(self.rgs_L[tname].get())
                t_shell = float(self.rgs_t[tname].get())
                saddle_w = float(self.rgs_saddle_w[tname].get())
                R0 = float(self.rgs_R0[tname].get())

                # плотность одна общая (из РВС вкладки) — так проще на MVP
                rho = float(self.rho.get())

                fill_val = (fill_val_raw/1000.0) if fill_mode=="level" else fill_val_raw

                fill_val = (fill_val_raw/1000.0) if fill_mode=="level" else fill_val_raw

                self.result = rgs_calc(D,L,t_shell,saddle_w,rho,fill_mode,fill_val,R0)

            self._render()
        except Exception as e:
            messagebox.showerror("Ошибка", str(e))

    def _render(self):
        self.text.delete("1.0", "end")
        if not self.result:
            return
        s = self.result["summary"]
        self.text.insert("end", "РЕЗЮМЕ\n")
        for k,v in s.items():
            if isinstance(v, float):
                self.text.insert("end", f"- {k}: {v:.6g}\n")
            else:
                self.text.insert("end", f"- {k}: {v}\n")

        self.text.insert("end", "\nПРОВЕРКИ\n")
        for c in self.result["checks"]:
            self.text.insert("end", f"[{c['result']}] {c['code']} — {c['title']} | {c['value']:.6g} {c['unit']} / лимит {c['limit']:.6g}\n")

        if "rvs" in self.result["details"]:
            self.text.insert("end", "\nРВС: ПОЯСА (детально)\n")
            for row in self.result["details"]["rvs"]["shell_stress"]:
                self.text.insert(
                    "end",
                    f"Пояс {row['course']}: z={row['z_mid_m']:.3g} м, t_eff={row['t_eff_mm']:.3g} мм, "
                    f"p={row['p_kPa']:.3g} кПа, σθ={row['sigma_hoop_MPa']:.3g} МПа, util={row['utilization']:.3g}\n"
                )

    def _save_json(self):
        if not self.result:
            messagebox.showinfo("Нет данных", "Сначала нажмите 'Рассчитать'")
            return
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON","*.json")])
        if not path:
            return
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.result, f, ensure_ascii=False, indent=2)
        messagebox.showinfo("Готово", f"Сохранено: {path}")


    def _shell_stability_ratio(self, t_mm):
        try:
            D = self._get_rvs_D_mm()/1000
            H = self._get_rvs_H_mm()/1000
            t = t_mm/1000
            E = 2.1e11
            wind = float((self.w0.get() or "0").replace(",", "."))*1000
            snow = float((self.Sg.get() or "0").replace(",", "."))*1000
            sigma = (wind + snow)/(math.pi*D*t+1e-6)
            sigma_cr = 0.605*E*(t/D)
            return sigma/sigma_cr
        except:
            return 0


    def _shell_required_rings(self, t_mm):
        try:
            D = self._get_rvs_D_mm()/1000
            H = self._get_rvs_H_mm()/1000
            t = t_mm/1000
            hmax = 1.1*math.sqrt(D*t)
            n = math.ceil(H/max(hmax,0.001))
            return max(0,n-1)
        except:
            return 0

if __name__ == "__main__":
    App().mainloop()



from __future__ import annotations

import csv
import re
from pathlib import Path

from fastapi import APIRouter, Body, Query
from fastapi.responses import FileResponse

from .models import RVSRequest, RGSRequest, CalcResponse
from ..engine.legacy_engine import rvs_calc, APP_VERSION
from ..engine.rgs_engine import calculate_rgs
from ..engine.strength_engine import calculate_strength
from ..core.config import settings
from ..reporting import create_strength_report, create_foundation_report, create_terms_of_reference

router = APIRouter(prefix="/api")
DATA_DIR = Path(settings.data_dir).resolve()


def _norm_text(value: str) -> str:
    text = (value or "").strip().replace("ё", "е").replace("Ё", "Е")
    text = re.sub(r"^(г|гор|город)\.\s*", "", text, flags=re.I)
    text = re.sub(r"^(пгт|пос|п)\.\s*", "", text, flags=re.I)
    text = re.sub(r"^(с|село|дер|д)\.\s*", "", text, flags=re.I)
    text = re.sub(r"\s+", " ", text)
    return text.lower().strip()


def _read_delimited(path: Path, delimiter: str = ";") -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", errors="ignore") as file:
        reader = csv.DictReader(file, delimiter=delimiter)
        rows: list[dict[str, str]] = []
        for row in reader:
            cleaned = {(k or "").strip(): (v or "").strip() for k, v in row.items() if k is not None}
            if not cleaned:
                continue
            if not any(value for value in cleaned.values()):
                continue
            rows.append(cleaned)
        return rows


def _site_regions() -> dict[str, list[str]]:
    import json

    merged: dict[str, set[str]] = {}
    json_path = DATA_DIR / "regions_cities.json"
    if json_path.exists():
        raw = json.loads(json_path.read_text(encoding="utf-8"))
        for region, cities in raw.items():
            merged.setdefault(str(region), set()).update(str(city) for city in cities)

    geofill_path = next(iter(sorted(DATA_DIR.glob('*geofill*.csv'))), None)
    if geofill_path is not None:
        for row in _read_delimited(geofill_path):
            region = (row.get('Регион') or '').strip()
            city = (row.get('НП') or '').strip()
            if region and city:
                merged.setdefault(region, set()).add(city)

    return {region: sorted(cities) for region, cities in sorted(merged.items())}


def _pick(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = (row.get(key) or '').strip()
        if value:
            return value
    return ''


def _find_by_region_city(rows: list[dict[str, str]], region_key: str, city_key: str, *, region_field: str = 'region', city_field: str = 'city') -> dict[str, str] | None:
    for row in rows:
        if _norm_text(row.get(region_field, '')) == region_key and _norm_text(row.get(city_field, '')) == city_key:
            return row
    for row in rows:
        if _norm_text(row.get(city_field, '')) == city_key:
            return row
    return None


def _lookup_geofill(region: str, city: str) -> dict[str, str]:
    geofill_path = next(iter(sorted(DATA_DIR.glob('*geofill*.csv'))), None)
    if geofill_path is None:
        return {}
    region_key = _norm_text(region)
    city_key = _norm_text(city)
    row = _find_by_region_city(_read_delimited(geofill_path), region_key, city_key, region_field='Регион', city_field='НП')
    if not row:
        return {}
    return {
        'wind_region': _pick(row, 'Ветровой район'),
        'w0': _pick(row, 'w0, кПа'),
        'snow_region': _pick(row, 'Снеговой район'),
        'sg': _pick(row, 'S0, кПа'),
        'seismic': _pick(row, 'Сейсмичность (MSK-64, C)'),
        't5': _pick(row, 't5, °C'),
        'tmin_abs': _pick(row, 't_min_abs, °C'),
    }


def _lookup_site_norms(region: str, city: str) -> dict[str, str]:
    region_key = _norm_text(region)
    city_key = _norm_text(city)

    result = _lookup_geofill(region, city)

    wind_row = _find_by_region_city(_read_delimited(DATA_DIR / 'sp20_wind.csv'), region_key, city_key)
    if wind_row:
        result.setdefault('wind_region', _pick(wind_row, 'wind_region'))
        result.setdefault('w0', _pick(wind_row, 'w0_kpa', 'w0_kPa'))

    snow_row = _find_by_region_city(_read_delimited(DATA_DIR / 'sp20_snow.csv'), region_key, city_key)
    if snow_row:
        result.setdefault('snow_region', _pick(snow_row, 'snow_region'))
        result.setdefault('sg', _pick(snow_row, 's0_kpa', 'Sg_kpa', 'Sg_kPa'))

    seismic_row = _find_by_region_city(_read_delimited(DATA_DIR / 'sp14_seismic.csv'), region_key, city_key)
    if seismic_row:
        seis = _pick(seismic_row, 'seis_B', 'seis_A', 'seis_C')
        if seis:
            result.setdefault('seismic', seis)

    return {key: value for key, value in result.items() if value}


@router.get("/health")
def health():
    return {"ok": True, "version": APP_VERSION}


@router.get("/site/options")
def site_options():
    return {"regions": _site_regions()}


@router.get("/site/norms")
def site_norms(region: str = Query(...), city: str = Query(...)):
    result = _lookup_site_norms(region, city)
    if not result:
        return {"wind_region": "", "w0": "", "snow_region": "", "sg": "", "seismic": "", "t5": "", "tmin_abs": ""}
    return {
        "wind_region": result.get("wind_region", ""),
        "w0": result.get("w0", ""),
        "snow_region": result.get("snow_region", ""),
        "sg": result.get("sg", ""),
        "seismic": result.get("seismic", ""),
        "t5": result.get("t5", ""),
        "tmin_abs": result.get("tmin_abs", ""),
    }


@router.post("/calc/rvs", response_model=CalcResponse)
def calc_rvs(req: RVSRequest):
    payload = req.model_dump()
    if payload.get("fill_mode") == "height_m":
        payload["fill_mode"] = "level"
    result = rvs_calc(**payload)
    return CalcResponse(ok=True, result=result)


@router.post("/rvs/review")
def review_rvs(data: dict = Body(...)):
    return {"ok": True, "result": calculate_strength(data)}


@router.post("/calc/rgs", response_model=CalcResponse)
def calc_rgs(req: RGSRequest):
    payload = req.model_dump()
    if payload.get("fill_mode") == "height_m":
        payload["fill_mode"] = "level"
    result = calculate_rgs(payload)
    return CalcResponse(ok=True, result=result)


@router.post("/rvs/strength-report")
def strength_report(data: dict):
    path = create_strength_report(data)
    return FileResponse(path, filename="rvs_strength_report.docx", media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@router.post("/rvs/foundation-report")
def foundation_report(data: dict):
    path = create_foundation_report(data)
    return FileResponse(path, filename="rvs_foundation_report.docx", media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@router.post("/rvs/terms-of-reference")
def terms_of_reference(data: dict):
    path = create_terms_of_reference(data)
    return FileResponse(path, filename="rvs_terms_of_reference.docx", media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

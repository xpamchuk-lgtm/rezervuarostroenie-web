from __future__ import annotations

import csv
import json
import mimetypes
import os
import re
import shutil
import smtplib
import ssl
import subprocess
import uuid
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path

from fastapi import APIRouter, Body, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse

from .models import RVSRequest, RGSRequest, CalcResponse
from ..engine.legacy_engine import rvs_calc, APP_VERSION
from ..engine.rgs_engine import calculate_rgs
from ..engine.strength_engine import calculate_strength
from ..core.config import settings
from ..reporting import (
    create_foundation_report,
    create_rgs_calculation_report,
    create_rgs_terms_of_reference,
    create_strength_report,
    create_terms_of_reference,
)

router = APIRouter(prefix="/api")
DATA_DIR = Path(settings.data_dir).resolve()
PROJECT_ORDERS_DIR = DATA_DIR / "project_orders"
PROJECT_ORDER_EMAIL_TO = os.getenv("PROJECT_ORDER_EMAIL_TO", "rezervuarostroenie@yandex.com")
PROJECT_ORDER_ALLOWED_EXTENSIONS = {".doc", ".docx", ".pdf", ".xls", ".xlsx", ".txt"}
PROJECT_ORDER_MAX_FILE_BYTES = int(os.getenv("PROJECT_ORDER_MAX_FILE_BYTES", str(10 * 1024 * 1024)))
PROJECT_ORDER_MAX_COMMENT_LENGTH = 3000
PROJECT_ORDER_MAX_SOURCE_LENGTH = 80
PROJECT_ORDER_MAX_CONTACT_LENGTH = 120
PROJECT_ORDER_RATE_LIMIT = int(os.getenv("PROJECT_ORDER_RATE_LIMIT", "5"))
PROJECT_ORDER_RATE_WINDOW_SECONDS = int(os.getenv("PROJECT_ORDER_RATE_WINDOW_SECONDS", "600"))
PROJECT_ORDER_RATE_BUCKETS: dict[str, list[datetime]] = {}


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


def _safe_upload_name(value: str) -> str:
    name = Path(value or "tz_file").name
    name = re.sub(r"[^A-Za-zА-Яа-я0-9_. -]+", "_", name).strip(" .")
    return name or "tz_file"


def _clean_form_value(value: str, *, max_length: int, field_name: str) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "").strip())
    if len(cleaned) > max_length:
        raise HTTPException(status_code=413, detail=f"{field_name} is too long")
    return cleaned


def _validate_contact(phone: str, email: str) -> None:
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Invalid email")
    if not re.fullmatch(r"[0-9+() .-]{5,40}", phone):
        raise HTTPException(status_code=422, detail="Invalid phone")


def _check_project_order_rate_limit(request: Request) -> None:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded_for.split(",", 1)[0].strip() or (request.client.host if request.client else "unknown")
    now = datetime.now()
    window_start = now - timedelta(seconds=PROJECT_ORDER_RATE_WINDOW_SECONDS)
    recent = [created_at for created_at in PROJECT_ORDER_RATE_BUCKETS.get(client_ip, []) if created_at > window_start]
    if len(recent) >= PROJECT_ORDER_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests")
    recent.append(now)
    PROJECT_ORDER_RATE_BUCKETS[client_ip] = recent


async def _save_project_order_file(upload: UploadFile, order_dir: Path) -> str:
    saved_name = _safe_upload_name(upload.filename or "tz_file")
    extension = Path(saved_name).suffix.lower()
    if extension not in PROJECT_ORDER_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    saved_path = order_dir / saved_name
    total = 0
    with saved_path.open("wb") as handle:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > PROJECT_ORDER_MAX_FILE_BYTES:
                handle.close()
                saved_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File is too large")
            handle.write(chunk)
    return saved_name


def _send_project_order_email(payload: dict[str, str | None], order_dir: Path) -> tuple[bool, str]:
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_host = os.getenv("SMTP_HOST", "").strip() or ("smtp.yandex.ru" if smtp_user else "")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_ssl = os.getenv("SMTP_SSL", "1").strip().lower() not in {"0", "false", "no"}
    smtp_from = os.getenv("PROJECT_ORDER_EMAIL_FROM", "").strip() or smtp_user or PROJECT_ORDER_EMAIL_TO
    sendmail_path = shutil.which("sendmail")

    subject = f"Заявка на проект КМ/КМД от {payload.get('phone') or payload.get('email') or 'с сайта'}"
    body = "\n".join(
        [
            "Новая заявка с сайта rezervuarostroenie.ru",
            "",
            f"Дата: {payload.get('created_at', '')}",
            f"Источник: {payload.get('source', '')}",
            f"Телефон: {payload.get('phone', '')}",
            f"Почта: {payload.get('email', '')}",
            f"Комментарий: {payload.get('comment', '')}",
            f"Файл ТЗ: {payload.get('tz_file') or 'не приложен'}",
        ]
    )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = PROJECT_ORDER_EMAIL_TO
    if payload.get("email"):
        message["Reply-To"] = str(payload["email"])
    message.set_content(body)

    saved_file = payload.get("tz_file")
    if saved_file:
        file_path = order_dir / str(saved_file)
        if file_path.exists():
            content_type, _ = mimetypes.guess_type(file_path.name)
            maintype, subtype = (content_type or "application/octet-stream").split("/", 1)
            message.add_attachment(file_path.read_bytes(), maintype=maintype, subtype=subtype, filename=file_path.name)

    try:
        if smtp_host and smtp_user and smtp_password:
            if smtp_ssl:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ssl.create_default_context(), timeout=20) as server:
                    server.login(smtp_user, smtp_password)
                    server.send_message(message)
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                    server.starttls(context=ssl.create_default_context())
                    server.login(smtp_user, smtp_password)
                    server.send_message(message)
            return True, ""

        if sendmail_path:
            subprocess.run([sendmail_path, "-t", "-oi"], input=message.as_bytes(), check=True, timeout=20)
            return True, ""

        return False, "Почтовый транспорт не настроен: задайте SMTP_USER и SMTP_PASSWORD."
    except Exception as exc:
        return False, str(exc)


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


@router.post("/rgs/calculation-report")
def rgs_calculation_report(data: dict = Body(...)):
    path = create_rgs_calculation_report(data)
    return FileResponse(path, filename="rgs_calculation_report.docx", media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@router.post("/rgs/terms-of-reference")
def rgs_terms_of_reference(data: dict = Body(...)):
    path = create_rgs_terms_of_reference(data)
    return FileResponse(path, filename="rgs_terms_of_reference.docx", media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@router.post("/project-order")
async def project_order(
    request: Request,
    source: str = Form("site"),
    phone: str = Form(...),
    email: str = Form(...),
    comment: str = Form(""),
    website: str = Form(""),
    tz_file: UploadFile | None = File(None),
):
    _check_project_order_rate_limit(request)
    if website.strip():
        raise HTTPException(status_code=400, detail="Invalid form submission")
    source = _clean_form_value(source, max_length=PROJECT_ORDER_MAX_SOURCE_LENGTH, field_name="source")
    phone = _clean_form_value(phone, max_length=PROJECT_ORDER_MAX_CONTACT_LENGTH, field_name="phone")
    email = _clean_form_value(email, max_length=PROJECT_ORDER_MAX_CONTACT_LENGTH, field_name="email")
    comment = _clean_form_value(comment, max_length=PROJECT_ORDER_MAX_COMMENT_LENGTH, field_name="comment")
    _validate_contact(phone, email)

    PROJECT_ORDERS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    order_dir = PROJECT_ORDERS_DIR / stamp
    order_dir.mkdir(parents=True, exist_ok=True)

    saved_file = None
    if tz_file and tz_file.filename:
        saved_file = await _save_project_order_file(tz_file, order_dir)

    payload = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "source": source,
        "phone": phone,
        "email": email,
        "comment": comment,
        "tz_file": saved_file,
    }
    (order_dir / "order.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    mail_sent, mail_error = _send_project_order_email(payload, order_dir)
    if mail_error:
        (order_dir / "mail_error.txt").write_text(mail_error, encoding="utf-8")
    return {"ok": True, "order_id": stamp, "mail_sent": mail_sent}

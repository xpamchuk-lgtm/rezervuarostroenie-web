from __future__ import annotations

import json
from pathlib import Path
from bs4 import BeautifulSoup

BASE_URL_OLD = "http://rezervuarostroenie.ru"
BASE_URL_NEW = "https://rezervuarostroenie.ru"
DATE_MODIFIED_NEW = "2026-03-25"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = PROJECT_ROOT / "frontend" / "public"
KB_ROOT = PUBLIC_ROOT / "baza-znaniy"

FAVICON_LINKS = [
    {"rel": "apple-touch-icon", "sizes": "180x180", "href": "/apple-touch-icon.png"},
    {"rel": "icon", "type": "image/png", "sizes": "32x32", "href": "/favicon-32x32.png"},
    {"rel": "icon", "type": "image/png", "sizes": "16x16", "href": "/favicon-16x16.png"},
    {"rel": "icon", "href": "/favicon.ico", "sizes": "any"},
    {"rel": "shortcut icon", "href": "/favicon.ico"},
]

NORMS_REPLACEMENTS = {
    "ГОСТ 31385-2023 — основной стандарт для вертикальных цилиндрических стальных резервуаров для нефти и нефтепродуктов; действует с 01.08.2023 и заменил ГОСТ 31385-2016.": "ГОСТ 31385-2023 — профильный стандарт по вертикальным стальным резервуарам; перед выпуском документации проверяют область применения, комплект требований и актуальную редакцию документа.",
    "СП 20.13330.2016 — нагрузки и воздействия; для климатических проверок по резервуару учитывают действующую редакцию с опубликованным Изм. №5 от 14.12.2023.": "СП 20.13330 — документ по нагрузкам и воздействиям; для снега, ветра и сочетаний нагрузок используют редакцию, действующую на дату расчёта.",
    "СП 22.13330.2016 — основания зданий и сооружений; для основания резервуара учитывают действующую редакцию с опубликованным Изм. №5 от 07.12.2023.": "СП 22.13330 — документ по основаниям и осадкам; фактическую оценку основания выполняют по материалам инженерно-геологических изысканий.",
    "СП 14.13330.2018 — строительство в сейсмических районах; при сейсмической проверке используют действующую редакцию с опубликованным Изм. №4 от 19.09.2024.": "СП 14.13330 — документ для строительства в сейсмических районах; при сейсмической проверке учитывают площадку, грунты и расчётную модель резервуара.",
    "СП 16.13330.2017 — стальные конструкции; для стали и общих расчётных положений учитывают действующую редакцию с опубликованным Изм. №6 от 31.01.2025.": "СП 16.13330 — документ по стальным конструкциям; его используют для общих расчётных положений по стали и проверок несущих элементов.",
}

KB_HOME_HEADING_OLD = "Нормативная база учтена в редакциях, с которыми инженеры работают в 2026 году"
KB_HOME_HEADING_NEW = "Нормативная база приведена как рабочий ориентир для инженерной проверки"
KB_HOME_PARAGRAPH_OLD = "В описаниях материалов учтены действующий ГОСТ 31385-2023 и связанные документы по нагрузкам, основаниям, сейсмике и стальным конструкциям. Перед выпуском отчёта или проекта полезно ещё раз проверить официальные публикации редакций и изменений."
KB_HOME_PARAGRAPH_NEW = "В материалах использованы действующий ГОСТ 31385-2023 и связанные документы по нагрузкам, основаниям, сейсмике и стальным конструкциям. Перед выпуском расчётной записки, проекта или тендерного пакета полезно дополнительно проверить официальные редакции и изменения документов."


def ensure_head_meta(soup: BeautifulSoup) -> None:
    head = soup.head
    if head is None:
        return

    existing_links = {
        (" ".join(link.get("rel", [])).strip().lower(), link.get("href", ""))
        for link in head.find_all("link")
    }
    stylesheet = head.find("link", attrs={"href": "/knowledge-base.css"})

    for item in FAVICON_LINKS:
        rel = item["rel"]
        href = item["href"]
        key = (rel.lower(), href)
        if key in existing_links:
            continue
        tag = soup.new_tag("link")
        tag["rel"] = rel
        for attr, value in item.items():
            if attr == "rel":
                continue
            tag[attr] = value
        if stylesheet is not None:
            stylesheet.insert_before(tag)
        else:
            head.append(tag)

    meta_theme = head.find("meta", attrs={"name": "theme-color"})
    if meta_theme is None:
        meta_theme = soup.new_tag("meta")
        meta_theme["name"] = "theme-color"
        meta_theme["content"] = "#0f2f4a"
        head.append(meta_theme)

    meta_og_locale = head.find("meta", attrs={"property": "og:locale"})
    if meta_og_locale is None:
        meta_og_locale = soup.new_tag("meta")
        meta_og_locale["property"] = "og:locale"
        meta_og_locale["content"] = "ru_RU"
        head.append(meta_og_locale)

    meta_twitter = head.find("meta", attrs={"name": "twitter:card"})
    if meta_twitter is None:
        meta_twitter = soup.new_tag("meta")
        meta_twitter["name"] = "twitter:card"
        meta_twitter["content"] = "summary_large_image"
        head.append(meta_twitter)


def patch_note(soup: BeautifulSoup) -> None:
    note = soup.select_one(".strong-note")
    title = soup.find("h1")
    if note is None or title is None:
        return
    note.string = (
        f"Практический вывод: материал по теме «{title.get_text(strip=True)}» удобно использовать "
        f"как инженерный чек-лист перед запуском калькулятора и при подготовке расчётной записки."
    )


def replace_normative_items(soup: BeautifulSoup) -> None:
    for li in soup.find_all("li"):
        text = li.get_text(" ", strip=True)
        replacement = NORMS_REPLACEMENTS.get(text)
        if replacement:
            li.clear()
            li.append(replacement)


def patch_kb_home_text(soup: BeautifulSoup) -> None:
    for h2 in soup.find_all("h2"):
        if h2.get_text(strip=True) == KB_HOME_HEADING_OLD:
            h2.string = KB_HOME_HEADING_NEW

    for p in soup.find_all("p"):
        if p.get_text(strip=True) == KB_HOME_PARAGRAPH_OLD:
            p.string = KB_HOME_PARAGRAPH_NEW


def update_domain_and_dates(html_text: str) -> str:
    return (
        html_text.replace(BASE_URL_OLD, BASE_URL_NEW)
        .replace('"dateModified": "2026-03-15"', f'"dateModified": "{DATE_MODIFIED_NEW}"')
        .replace("в 2026 году", "в текущей практике")
    )


def patch_html_file(path: Path) -> None:
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    ensure_head_meta(soup)
    replace_normative_items(soup)
    patch_note(soup)
    if path == KB_ROOT / "index.html":
        patch_kb_home_text(soup)
    html_out = soup.decode(formatter="minimal")
    html_out = update_domain_and_dates(html_out)
    path.write_text(html_out, encoding="utf-8")


def patch_sitemap() -> None:
    path = PUBLIC_ROOT / "sitemap.xml"
    text = path.read_text(encoding="utf-8")
    text = text.replace(BASE_URL_OLD, BASE_URL_NEW).replace("2026-03-15", DATE_MODIFIED_NEW)
    path.write_text(text, encoding="utf-8")


def patch_robots() -> None:
    path = PUBLIC_ROOT / "robots.txt"
    text = path.read_text(encoding="utf-8").replace(BASE_URL_OLD, BASE_URL_NEW)
    path.write_text(text, encoding="utf-8")


def patch_manifest() -> None:
    path = PUBLIC_ROOT / "site.webmanifest"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["start_url"] = "/"
    data["scope"] = "/"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    for html_path in sorted(KB_ROOT.rglob("index.html")):
        patch_html_file(html_path)
    patch_sitemap()
    patch_robots()
    patch_manifest()


if __name__ == "__main__":
    main()

# SEO knowledge base update

Что добавлено:
- ссылка `База знаний` в шапке сайта;
- отдельный статический раздел `/baza-znaniy/`;
- 100 SEO-страниц по резервуаростроению;
- 10 якорных страниц с расширенной структурой;
- `robots.txt` и `sitemap.xml` под обновлённую структуру;
- CSS-стили для базы знаний;
- `pages.json` и `baza-znaniy-manifest.md` для навигации и сопровождения;
- скрипт `tools/generate_kb.py`, который генерирует весь раздел заново.

Что НЕ менялось:
- содержание главной страницы;
- структура и логика калькулятора `/calc/rvs`.

Где лежат статьи:
- `frontend/public/baza-znaniy/`

Как заново сгенерировать раздел после правок в генераторе:
```bash
cd frontend
python3 ../tools/generate_kb.py
npm run build
```

Важно:
- canonical, Open Graph, JSON-LD, robots.txt и sitemap переведены на `https://rezervuarostroenie.ru`;
- после повторной генерации раздела рекомендуется запускать `python3 ../tools/patch_public_kb.py`, чтобы заново проставить favicon и зафиксировать служебные SEO-правки.

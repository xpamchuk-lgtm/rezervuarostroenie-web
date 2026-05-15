import fs from "node:fs/promises";
import path from "node:path";

const CHANNEL = "rvs_pro";
const BASE_URL = "https://rezervuarostroenie.ru";
const ROOT = path.resolve("frontend/public/articles");
const TODAY = "2026-05-15";
const ARTICLES_INDEX = "/articles/index.html";

const CATEGORIES = {
  rvs: {
    slug: "rvs",
    label: "РВС",
    title: "Статьи по РВС",
    intro: "Материалы по вертикальным стальным резервуарам: расчет, проектирование, монтаж, узлы, нагрузки и эксплуатация.",
  },
  rgs: {
    slug: "rgs",
    label: "РГС",
    title: "Статьи по РГС",
    intro: "Материалы по горизонтальным стальным резервуарам: обечайка, опоры, диафрагмы, жесткость, давление и конструктивные решения.",
  },
  sug: {
    slug: "sug",
    label: "СУГ",
    title: "Статьи по СУГ",
    intro: "Материалы по резервуарам и емкостям для сжиженных углеводородных газов: давление, арматура, безопасность и нормативная логика.",
  },
};

const METRIKA = `
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
  (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)}
      m[i].l=1*new Date();
      for (var j = 0; j < document.scripts.length; j++) {
        if (document.scripts[j].src === r) { return; }
      }
      k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
  })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=107707633', 'ym');

  ym(107707633, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true
  });
</script>
<!-- /Yandex.Metrika counter -->`.trim();

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(value) {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<i[^>]*class="emoji"[^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/i>/gi, "$1")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function translit(value) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "c", ч: "ch", ш: "sh", щ: "shch", ы: "y", э: "e", ю: "yu", я: "ya", ь: "", ъ: "",
  };
  return value
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 78)
    .replace(/-+$/g, "");
}

function classify(text) {
  const lower = text.toLowerCase();
  if (/(суг|сжиженн|пропан|бутан|тр тс 032|сосуд|давлением|газгольдер)/i.test(lower)) return "sug";
  if (/(ргс|горизонтальн|седлов|обечайк|диафрагм|горизонтальн.*резервуар)/i.test(lower)) return "rgs";
  return "rvs";
}

function makeTitle(text, category, id) {
  if (/люк и теплоизоляция/i.test(text)) return "Люк и теплоизоляция резервуара";
  const lines = cleanArticleText(text)
    .split("\n")
    .map((line) => normalizeImportedText(line.trim().replace(/^[-—•\s]+/, "")))
    .flatMap((line) => splitChannelTitleLine(line))
    .flatMap((line) => expandTitleCandidates(line))
    .filter(Boolean);
  const directSubjectTitle = lines.find((line) => /^люк и теплоизоляция\b/i.test(line));
  if (directSubjectTitle) return "Люк и теплоизоляция резервуара";
  const title = chooseThematicTitle(lines, category) ?? `${CATEGORIES[category].label}: материал из Telegram ${id}`;
  return normalizeTitle(title).replace(/[.?!:;,\s]+$/g, "").slice(0, 110);
}

function chooseThematicTitle(lines, category) {
  const candidates = lines
    .map((line, index) => ({ text: normalizeTitle(line), index }))
    .filter(({ text }) => isTitleCandidate(text));

  if (!candidates.length) return null;

  const scored = candidates
    .map((candidate) => ({ ...candidate, score: titleScore(candidate.text, candidate.index, category) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return scored[0]?.text ?? null;
}

function isTitleCandidate(text) {
  if (!text) return false;
  const hasSubject = /(рвс|ргс|суг|резервуар|емкост|бак|обечайк|днищ|стенк|кровл|патруб|люк|опор|диафрагм|кольц|обогрев|молни|изоляц|испытан)/i.test(text);
  if ((text.length < 24 && !(text.length >= 15 && hasSubject)) || text.length > 135) return false;
  if (!/^[A-ZА-ЯЁ0-9]/.test(text)) return false;
  if (shouldDropImportedLine(text)) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/^(знаю, что|для|а монтажное|опоры напрямую|и если|то есть|это вырез|чаще всего|при расчете подземного|когда проектируют|если ргс работает|если резервуар утепленный|что проверяют по диафрагме|\d+\.)/i.test(text)) return false;
  if (/^(вес|для|нужна ли|появляются|какая|чтобы|может|что на|это когда|а монтажное|опоры напрямую|и если|где нужно|то есть|чаще всего|если ргс работает|что проверяют по диафрагме|\d+\.)\b/i.test(text)) return false;
  if (/^(коротко|итог|пример|важный момент|главное отличие|первый шаг|второй шаг|третий шаг|четвертый шаг|пятый шаг|шестой шаг)$/i.test(text)) return false;
  if (/^(с чего начинается|что важно понимать|что проверять|где чаще всего ошибаются|нормативная логика)$/i.test(text)) return false;
  if (/^[а-яё\s-]{1,22}$/i.test(text)) return false;
  if (/^[A-ZА-ЯЁ]\.?$/i.test(text)) return false;
  return true;
}

function titleScore(text, index, category) {
  const lower = text.toLowerCase();
  let score = 0;

  if (/(рвс|ргс|суг|резервуар|емкост|бак-аккумулятор|обечайк|днищ|стенк|кровл|патруб|люк|опор|диафрагм|кольц|обогрев|молни)/i.test(lower)) score += 35;
  if (/(расчет|рассчитать|провер|проектир|монтаж|испытан|толщин|устойчив|нагрузк|давлен|вакуум|осадк|сварк|контрол)/i.test(lower)) score += 28;
  if (/^(как|почему|когда|зачем|что|где|с чего)/i.test(lower)) score += 24;
  if (/(ошибк|не просто|что реально|как правильно|где чаще|что проверяют|как определить|почему это)/i.test(lower)) score += 18;
  if (text.includes(":")) score += 10;
  if (text.includes("?")) score += 8;
  if (/^люк и теплоизоляция$/i.test(text)) score += 90;
  if (text.length >= 42 && text.length <= 105) score += 12;
  if (text.length > 115) score -= 10;
  if (index <= 1) score += 65;
  if (index <= 3) score += 20;

  if (category === "rvs" && /рвс|вертикальн|стенк|днищ|кровл|гост 31385/i.test(lower)) score += 16;
  if (category === "rgs" && /ргс|горизонтальн|обечайк|седлов|диафрагм|опор/i.test(lower)) score += 16;
  if (category === "sug" && /суг|сосуд|давлен|пропан|бутан|емкост/i.test(lower)) score += 16;

  if (/^(когда говорят|очень часто|после того как|есть элементы|лестницу|люк-лаз|если тема|уважаемые|при проектировании|когда проектируют|если резервуар работает|для цилиндрической|для центральной|для эллиптического|опоры напрямую|и если|то есть|чаще всего)/i.test(lower)) score -= 45;
  if (/(в этой статье|ниже|разберем|материал|публикац)/i.test(lower)) score -= 12;
  score -= Math.min(index, 20) * 0.2;

  return score;
}

function splitChannelTitleLine(line) {
  const channelPattern = /резервуаростроение\s*\|\s*от расч[её]та до монтажа/i;
  if (!channelPattern.test(line)) return [line];
  const rest = line.replace(channelPattern, "").replace(/^[:;,\s-]+/, "").trim();
  return rest ? [rest] : [];
}

function expandTitleCandidates(line) {
  const cleaned = normalizeTitle(line);
  if (!cleaned) return [];
  const candidates = [cleaned];
  const markers = [
    " Когда ",
    " Очень часто ",
    " После того как ",
    " Здесь ",
    " Есть ",
    " Лестницу ",
    " Люк-лаз ",
    " Если ",
    " В горизонтальных ",
    " При расчете ",
    " На практике ",
    " Но ",
    " Сначала ",
    " Обычно ",
  ];
  for (const marker of markers) {
    const index = cleaned.indexOf(marker);
    if (index > 14) {
      candidates.push(cleaned.slice(0, index).trim());
    }
  }
  const colonIndex = cleaned.indexOf(":");
  if (colonIndex > 24 && colonIndex < 95) {
    candidates.push(cleaned.slice(0, colonIndex).trim());
    const afterColon = cleaned.slice(colonIndex + 1).trim();
    if (/^(как|почему|когда|зачем|что|где|с чего|ошибки|расчет|проверка)/i.test(afterColon)) {
      candidates.push(afterColon);
    }
  }
  return [...new Set(candidates)];
}

function descriptionFrom(text, title) {
  const normalized = cleanArticleText(text)
    .replace(title, "")
    .split("\n")
    .map((line) => normalizeImportedText(line))
    .flatMap((line) => splitChannelTitleLine(line))
    .filter((line) => !shouldDropImportedLine(line))
    .join(" ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || title).slice(0, 156).replace(/\s+\S*$/u, "") + "...";
}

function isNonArticle(article) {
  const text = `${article.title} ${article.description} ${article.text}`.toLowerCase();
  return /уважаемые подписчики/.test(text) && /калькулятор[а-я\s]+ргс/.test(text);
}

function parseMessages(html) {
  const chunks = html.split(/<div class="tgme_widget_message_wrap js-widget_message_wrap">/g).slice(1);
  return chunks
    .map((chunk) => {
      const post = chunk.match(/data-post="rvs_pro\/(\d+)"/);
      const text = chunk.match(/<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>\s*<div class="tgme_widget_message_footer/);
      const time = chunk.match(/<time datetime="([^"]+)"/);
      if (!post || !text) return null;
      return {
        id: Number(post[1]),
        sourceUrl: `https://t.me/${CHANNEL}/${post[1]}`,
        publishedAt: time?.[1] ?? `${TODAY}T00:00:00+00:00`,
        text: stripTags(text[1]),
      };
    })
    .filter((message) => message && message.text.length > 120);
}

async function fetchAllMessages() {
  const seenPages = new Set();
  const messages = new Map();
  let url = `https://t.me/s/${CHANNEL}`;

  for (let page = 0; page < 30 && url && !seenPages.has(url); page += 1) {
    seenPages.add(url);
    const response = await fetchWithRetry(url);
    if (!response.ok) throw new Error(`Telegram returned ${response.status} for ${url}`);
    const html = await response.text();

    for (const message of parseMessages(html)) {
      messages.set(message.id, message);
    }

    const prev = html.match(/<link rel="prev" href="([^"]+)"/);
    if (!prev) break;
    url = new URL(prev[1], "https://t.me").toString();
  }

  return [...messages.values()].sort((a, b) => a.id - b.id);
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 article-importer" },
      });
      if (response.ok) return response;
      lastError = new Error(`Telegram returned ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  throw lastError;
}

function groupMessages(messages) {
  const groups = [];
  for (const message of messages) {
    const last = groups.at(-1);
    const sameTimestamp = last && last.publishedAt === message.publishedAt;
    const continuation = /^[а-яa-z0-9—-]/i.test(message.text.trim());
    if (sameTimestamp && continuation) {
      last.ids.push(message.id);
      last.sourceUrls.push(message.sourceUrl);
      last.text += `\n\n${message.text}`;
      continue;
    }
    groups.push({
      ids: [message.id],
      sourceUrls: [message.sourceUrl],
      publishedAt: message.publishedAt,
      text: message.text,
    });
  }
  return groups;
}

function cleanArticleText(text) {
  const lines = text.split("\n").map((line) => sanitizeLine(line.trim())).filter(Boolean);
  const questionIndex = lines.findIndex((line) => /^(вопрос к вам|вопрос к аудитории|вопрос коллегам|вопрос к инженерам|вопрос инженерам|практический вопрос|коллеги,)/i.test(line));
  const usefulLines = questionIndex >= 0 ? lines.slice(0, questionIndex) : lines;
  return usefulLines
    .filter((line) => !shouldDropImportedLine(line))
    .join("\n");
}

function sanitizeLine(line) {
  const normalized = normalizeImportedText(line);
  if (/^резервуаростроение\s*\|\s*от расч[её]та до монтажа\s*:?\s*$/i.test(normalized)) {
    return "";
  }
  return normalized
    .replace(/[�✅📌💬⚠️❗️❓🔥🎉🤩💯👍🥰😍❤]/gu, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImportedText(value) {
  return value
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/ГОСТ[\s-]*31395[\s-]*2023/gi, "ГОСТ 31385-2023")
    .replace(/СП[\s-]*31395[\s-]*2023/gi, "ГОСТ 31385-2023")
    .replace(/ГОСТ[\s-]*31395/gi, "ГОСТ 31385")
    .replace(/СП[\s-]*21\.?13330[\s-]*2016/gi, "СП 20.13330.2016")
    .replace(/СП21/gi, "СП 20.13330")
    .replace(/СП[\s-]*31\.?13330[\s-]*2014/gi, "СП 20.13330.2016")
    .replace(/СП[\s-]*85\.?13330[\s-]*2012/gi, "СП 14.13330.2018")
    .replace(/^\s*резервуаростроение\s*\|\s*от расч[её]та до монтажа\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value) {
  return sanitizeLine(value)
    .replace(/^[:;,\s-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldDropImportedLine(line) {
  if (!line) return true;
  if (/^#[\p{L}\p{N}_#\s-]+$/u.test(line)) return true;
  if (/(^|\s)#[\p{L}\p{N}_-]+/u.test(line)) return true;
  if (/^(как у вас чаще|а у вас|напишите|делитесь|что у вас чаще|приходилось ли вам)/i.test(line)) return true;
  if (/(вопрос к вам|вопрос к аудитории|вопрос коллегам|вопрос колл|вопрос к инженерам|вопрос инженерам|вопрос к специалистам|практический вопрос|напишите в комментариях|делитесь в комментариях)/i.test(line)) return true;
  if (/^[\d\s❤🔥🎉🤩💯👍🥰😍‍-]+$/u.test(line)) return true;
  if (/^(экономический аспект|показатель примерные цифры)$/i.test(line)) return true;
  if (/(стоимость .*%|снижение затрат|уменьшение риска .*%|общего бюджета)/i.test(line)) return true;
  if (/(ГЭСН|СН\s*2\.5|по\s+СП\s*31\b)/i.test(line)) return true;
  return false;
}

function articleBodyHtml(text) {
  const lines = cleanArticleText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  let list = [];

  const flushList = () => {
    if (!list.length) return;
    blocks.push(`<ul class="bullet-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const line of lines) {
    const cleaned = line.replace(/^[-•]\s+/, "— ");
    if (/^—\s+/.test(cleaned)) {
      list.push(cleaned.replace(/^—\s+/, ""));
      continue;
    }
    flushList();

    const h2 = cleaned.replace(/^[📌💬]\s*/, "");
    if (/^[📌💬]/.test(cleaned) || /^(коротко|с чего начинается|что учитывают|что проверяют|нормативная логика|важный момент)/i.test(cleaned)) {
      blocks.push(`<h2>${escapeHtml(h2)}</h2>`);
    } else if (/^[A-ZА-ЯЁ0-9][^.!?]{8,75}$/.test(cleaned) && !/[а-яё],/i.test(cleaned)) {
      blocks.push(`<h2>${escapeHtml(cleaned)}</h2>`);
    } else {
      blocks.push(`<p>${escapeHtml(cleaned)}</p>`);
    }
  }
  flushList();
  return blocks.join("\n");
}

function hasAny(value, words) {
  const lower = value.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function renderNormativeBlock(article) {
  const subject = `${article.title} ${article.text}`.toLowerCase();
  const norms = [];

  if (article.category === "rvs") {
    norms.push(
      ["ГОСТ 31385-2023", "основной стандарт для вертикальных цилиндрических стальных резервуаров для нефти и нефтепродуктов; по нему проверяют область применения, конструктивные требования, изготовление, монтаж, испытания и приемку."],
      ["СП 20.13330.2016", "нагрузки и воздействия: снег, ветер, температурные воздействия и расчетные сочетания нагрузок."],
      ["СП 16.13330.2017", "стальные конструкции: общая расчетная логика по прочности, устойчивости и элементам стального каркаса."],
    );
  }

  if (article.category === "rgs") {
    norms.push(
      ["Техническое задание и ТУ на конкретный резервуар", "для РГС нет одного универсального аналога ГОСТ 31385 для всех исполнений, поэтому расчетная рамка начинается с назначения, среды, давления, размещения и требований заказчика."],
      ["СП 20.13330.2016", "нагрузки от грунта, снега, ветра, веса оборудования и расчетные сочетания при наземном или подземном размещении."],
      ["СП 16.13330.2017", "проверки стальных элементов, опор, накладок, ребер, связей и сварных узлов."],
    );
  }

  if (article.category === "sug" || hasAny(subject, ["сосуд", "давлен", "суг", "пропан", "бутан"])) {
    norms.push(
      ["ТР ТС 032/2013", "обязательная рамка безопасности для оборудования, работающего под избыточным давлением; применимость зависит от давления, объема и рабочей среды."],
      ["ГОСТ 34347-2017", "общие технические условия для стальных сварных сосудов и аппаратов."],
      ["ГОСТ 34233", "серия стандартов для расчетов на прочность сосудов и аппаратов; конкретная часть выбирается по рассчитываемому элементу."],
    );
  }

  if (hasAny(subject, ["фундамент", "основан", "осадк", "грунт"])) {
    norms.push(["СП 22.13330.2016", "основания зданий и сооружений: расчетное сопротивление, осадки, деформации и требования к инженерно-геологическим данным."]);
  }

  if (hasAny(subject, ["сейсм", "землетр"])) {
    norms.push(["СП 14.13330.2018", "строительство в сейсмических районах: расчетная сейсмичность площадки и учет сейсмического воздействия."]);
  }

  const unique = norms.filter((item, index) => norms.findIndex((candidate) => candidate[0] === item[0]) === index);
  return `<section class="editorial-section norm-section">
    <h2>Нормативная база</h2>
    <p>Ниже приведена безопасная нормативная рамка для предварительной проверки. Перед выпуском рабочей документации нужно сверять актуальные редакции, изменения и область применения каждого документа.</p>
    <ul class="bullet-list">${unique.map(([name, note]) => `<li><strong>${escapeHtml(name)}</strong> — ${escapeHtml(note)}</li>`).join("")}</ul>
  </section>`;
}

function renderArticleIntro(article) {
  const category = CATEGORIES[article.category];
  const calcKind = article.category === "rgs" ? "горизонтального резервуара" : article.category === "sug" ? "емкости СУГ" : "вертикального стального резервуара";
  return `<section class="editorial-section">
    <h2>Инженерный смысл материала</h2>
    <p>Инженерный смысл материала — перевести тему в проверяемые решения для ${calcKind}: какие исходные данные нужны, какая нормативная схема применяется и какой узел может стать ограничивающим.</p>
    <p>Материал относится к теме <strong>${escapeHtml(category.label)}</strong> и работает как предварительный чек-лист перед расчетом: он помогает не пропустить нагрузки, устойчивость, основание, узлы, коррозию, монтаж и требования к контролю.</p>
  </section>`;
}

function renderUsefulChecks(article) {
  const subject = `${article.title} ${article.text}`;
  let items = [
    "назначение резервуара, продукт, плотность и рабочую температуру;",
    "расчетное давление или вакуум, если они влияют на оболочку;",
    "материал основных элементов и коррозионный припуск;",
    "климатические данные площадки: снег, ветер, сейсмика при необходимости;",
    "ограничения по изготовлению, транспортировке, монтажу и контролю сварных соединений.",
  ];
  if (article.category === "rgs") {
    items = [
      "диаметр, длину обечайки и схему расположения седловых опор;",
      "массу продукта и собственный вес резервуара;",
      "зоны местных нагрузок около опор, патрубков и люков;",
      "наличие диафрагм, колец жесткости и усиливающих накладок;",
      "условия транспортировки, подъема и монтажа на площадке.",
    ];
  }
  if (article.category === "sug") {
    items = [
      "расчетное давление, температуру и группу рабочей среды;",
      "применимость ТР ТС 032/2013, ГОСТ 34233 и требований к сосудам под давлением;",
      "тип арматуры, предохранительных устройств и контрольно-измерительных приборов;",
      "толщину стенки, днищ, штуцеров и усилений в зоне врезок;",
      "сценарии испытаний, контроля сварных соединений и эксплуатации.",
    ];
  }
  if (hasAny(subject, ["фундамент", "основан", "осадк"])) {
    items = [
      "расчетную массу резервуара в пустом и заполненном состоянии;",
      "геологию площадки, расчетное сопротивление и ожидаемые осадки;",
      "тип основания: песчаная подушка, кольцевой фундамент, плита или свайная схема;",
      "уклон, отвод воды и защиту днища от коррозии;",
      "допустимые неравномерные осадки и требования к исполнительной съемке.",
    ];
  }

  return `<section class="editorial-section">
    <h2>Что проверить до расчета</h2>
    <p>Перед тем как принимать конструктивное решение, нужно собрать исходные данные. Без них любая формула превращается в красивую, но слабую догадку.</p>
    <ul class="bullet-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>`;
}

function fraction(numerator, denominator) {
  return `<span class="formula-frac"><span>${numerator}</span><span>${denominator}</span></span>`;
}

function renderFormulaBlock(article) {
  const subject = `${article.title} ${article.text}`;
  let title = "Расчетный фрагмент";
  let rows = [];
  let conclusion = "Решение принимают только после подстановки фактических исходных данных и проверки применимых норм.";

  if (article.category === "rgs" || hasAny(subject, ["диафрагм", "обечайк", "седлов"])) {
    title = "Пример проверки элемента РГС";
    rows = [
      {
        label: "Проверка расчетного сечения диафрагмы:",
        formula: `A<sub>тр</sub> = ${fraction("N", "R<sub>d</sub>")} = ${fraction("180000", "215")} = 837 мм²`,
      },
      {
        label: "Проверка сварного шва:",
        formula: `l<sub>ш</sub> · k<sub>ш</sub> · R<sub>ш</sub> ≥ N`,
      },
      {
        label: "Проверка овальности обечайки:",
        formula: `ΔD / D ≤ [ΔD / D]`,
      },
    ];
    conclusion = "Если диафрагма или шов не передают расчетное усилие, требуется менять сечение, схему крепления или расположение элемента.";
  } else if (article.category === "sug" || hasAny(subject, ["давлен", "сосуд", "суг", "пропан", "бутан"])) {
    title = "Пример проверки стенки емкости под давлением";
    rows = [
      {
        label: "Окружное напряжение в цилиндрической части:",
        formula: `σ<sub>к</sub> = ${fraction("p · R", "s - c")} = ${fraction("1,6 · 1000", "10 - 1")} = 177,8 МПа`,
      },
      {
        label: "Условие прочности:",
        formula: `σ<sub>к</sub> ≤ [σ] · φ`,
      },
      {
        label: "Проверка пробного давления:",
        formula: `p<sub>исп</sub> = 1,25 · p<sub>раб</sub>`,
      },
    ];
    conclusion = "Для СУГ расчет выполняют только после определения давления, температуры, группы среды и категории оборудования.";
  } else if (hasAny(subject, ["стенк", "толщин", "пояс", "09г2с", "ст3"])) {
    title = "Пример проверки толщины стенки РВС";
    rows = [
      {
        label: "Радиус резервуара:",
        formula: `R = ${fraction("D", "2")} = ${fraction("2000", "2")} = 1000 мм`,
      },
      {
        label: "Расчетная толщина стенки с учетом прибавок:",
        formula: `s<sub>тр</sub> + c = ${fraction("p · R", "2 · [σ] · φ - 1,2 · p")} + c = 7,8 мм`,
      },
      {
        label: "Проверка принятой толщины:",
        formula: `s<sub>прин</sub> = 8 мм ≥ s<sub>тр</sub> = 7,8 мм`,
      },
    ];
    conclusion = "Фактический вывод делают после сравнения требуемой толщины с принятой толщиной листа с учетом припусков, допуска и коэффициента шва.";
  } else if (hasAny(subject, ["фундамент", "основан", "осадк", "днищ"])) {
    title = "Пример проверки нагрузки на основание";
    rows = [
      {
        label: "Площадь опирания:",
        formula: `A = ${fraction("π · D²", "4")}`,
      },
      {
        label: "Среднее давление на основание:",
        formula: `q = ${fraction("N", "A")} = ${fraction("G<sub>рез</sub> + G<sub>прод</sub>", "A")}`,
      },
      {
        label: "Условие по основанию:",
        formula: `q ≤ R<sub>осн</sub>`,
      },
    ];
    conclusion = "Если давление или осадки не проходят по расчету основания, требуется менять основание, фундамент или расчетный режим заполнения.";
  } else {
    rows = [
      {
        label: "Полезный объем цилиндрической части:",
        formula: `V = ${fraction("π · D² · H", "4")}`,
      },
      {
        label: "Гидростатическое давление:",
        formula: `p = ρ · g · h`,
      },
      {
        label: "Нагрузка от продукта:",
        formula: `G = ρ · V`,
      },
    ];
    conclusion = "Эти зависимости дают только предварительный порядок величин и не заменяют расчет по принятой нормативной схеме.";
  }

  return `<section class="calculation-section">
    <h2>${escapeHtml(title)}</h2>
    <p>Формулы ниже приведены как инженерный ориентир. В рабочем проекте значения уточняют по действующим нормам, расчетной схеме и фактическим исходным данным.</p>
    <div class="calc-sheet">
      ${rows.map((row) => `<div class="calc-row"><div class="calc-label">${escapeHtml(row.label)}</div><div class="calc-formula">${row.formula}</div></div>`).join("")}
      <div class="calc-conclusion">Проверочный вывод: ${escapeHtml(conclusion)}</div>
    </div>
  </section>`;
}

function renderPracticalBlock(article) {
  const subject = `${article.title} ${article.text}`;
  const checks = [
    "зафиксировать принятые допущения в пояснительной записке;",
    "отдельно показать, какие проверки выполнены расчетом, а какие требуют уточнения в проекте;",
    "не переносить типовое решение без проверки продукта, площадки и режима работы;",
  ];
  if (hasAny(subject, ["монтаж", "транспорт", "подъем"])) {
    checks.push("проверить временные монтажные и транспортные состояния, потому что они часто отличаются от эксплуатационной схемы;");
  }
  if (hasAny(subject, ["шов", "свар", "контрол"])) {
    checks.push("указать объем контроля сварных соединений и требования к доступу для дефектоскопии;");
  }
  if (hasAny(subject, ["люк", "патруб", "врезк"])) {
    checks.push("проверить местные усиления вокруг люков, патрубков и технологических врезок;");
  }

  return `<section class="editorial-section">
    <h2>Практический вывод для проекта</h2>
    <p>Полезная статья должна приводить не только к пониманию темы, но и к следующему действию. Для этой темы таким действием будет короткая инженерная проверка.</p>
    <ul class="bullet-list">${checks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>`;
}

function renderConsultationCta() {
  return `<section class="consultation-note">
    <h2>Нужна консультация или проект?</h2>
    <p>Если Вам нужна консультация, расчет или проект по резервуару, обращайтесь, всегда помогу. Можно разобрать исходные данные, проверить принятое решение или подготовить проектную документацию.</p>
    <div class="cta-actions"><a class="btn btn-primary" href="https://t.me/rvs_pro">Написать в Telegram</a><a class="btn" href="${ARTICLES_INDEX}">Смотреть другие статьи</a></div>
  </section>`;
}

function topbar(active = "articles") {
  const nav = [
    ["/", "Главная", "home"],
    ["/calc/rvs", "РВС калькулятор", "rvs-calc"],
    ["/calc/rgs", "РГС калькулятор", "rgs-calc"],
    ["/baza-znaniy/", "База знаний", "kb"],
    [ARTICLES_INDEX, "Статьи", "articles"],
  ];
  return `
<header class="kb-topbar">
  <div class="kb-shell kb-topbar-inner">
    <a class="kb-brand" href="/">
      <img src="/logo.png" alt="Резервуаростроение">
      <span><strong>Резервуаростроение</strong><span>Инженерные материалы и расчеты</span></span>
    </a>
    <nav class="kb-nav" aria-label="Основная навигация">
      ${nav.map(([href, label, key]) => `<a${key === active ? ' class="active"' : ""} href="${href}">${label}</a>`).join("")}
    </nav>
  </div>
</header>`;
}

function pageShell({ title, description, canonical, type = "website", body, schema }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex,follow,max-snippet:-1,max-image-preview:large">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE_URL}/logo.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" sizes="32x32" type="image/png" href="/favicon-32x32.png">
<link rel="icon" sizes="16x16" type="image/png" href="/favicon-16x16.png">
<link rel="icon" sizes="any" href="/favicon.ico">
<link rel="stylesheet" href="/knowledge-base.css">
${METRIKA}
<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>
</head>
<body>
${topbar()}
${body}
<footer class="kb-footer"><div class="kb-shell"><div>© Резервуаростроение. Статьи из Telegram-канала, подготовленные для локальной SEO-структуры.</div><div><a href="${ARTICLES_INDEX}">Все статьи</a> · <a href="https://t.me/${CHANNEL}">Telegram</a></div></div></footer>
</body>
</html>`;
}

function renderCard(article) {
  return `<article class="knowledge-card" data-needle="${escapeHtml(`${article.title} ${article.description}`.toLowerCase())}">
  <div class="knowledge-card-top"><span class="small-chip">${CATEGORIES[article.category].label}</span></div>
  <h3><a href="/articles/${article.slug}/index.html">${escapeHtml(article.title)}</a></h3>
  <p>${escapeHtml(article.description)}</p>
</article>`;
}

function renderGeneratedArticleBody(article) {
  const subject = `${article.slug} ${article.title}`.toLowerCase();
  let meaning = "Материал относится к проектированию резервуаров и помогает перевести тему в проверяемую инженерную задачу: исходные данные, нормативная схема, расчетные зависимости и проектные решения.";
  let checks = [
    "назначение резервуара, продукт, плотность, температуру и режим работы;",
    "геометрию, материалы, коррозионный припуск и расчетные нагрузки;",
    "основание, днище, стенку, кровлю, узлы и монтажные состояния;",
    "контроль качества, испытания и требования к исполнительной документации.",
  ];
  let mistakes = [
    "переносить типовое решение без проверки площадки;",
    "считать один узел без связи с остальной конструкцией;",
    "не учитывать монтаж и контроль качества;",
    "не фиксировать принятые допущения в расчетной записке.",
  ];
  let result = "Итогом должна быть понятная инженерная логика: что проверили, по каким данным, по каким нормам и какое решение принято.";

  if (/нк|контрол|испыт|лаборатор|узи|рк|вик|gidroispyt|ispyt|kontrol|laborator/.test(subject)) {
    meaning = "Контроль и испытания подтверждают работоспособность резервуара до передачи в эксплуатацию. Проверяют не только герметичность, но и геометрию, швы, основание, днище и уторный узел.";
    checks = [
      "какие соединения подлежат ВИК, РК, УЗК, ПВК, МПК и контролю герметичности;",
      "какой объем контроля назначен по зонам и типам швов;",
      "когда выполняется контроль: завод, монтаж, после исправления дефекта, перед гидроиспытанием;",
      "как фиксируются результаты в исполнительной документации.",
    ];
    mistakes = [
      "задавать общий процент контроля без привязки к зонам;",
      "не выделять пересечения швов, врезки и уторный узел;",
      "проводить контроль без связи с технологией сварки;",
      "не проверять исправленные участки повторно.",
    ];
    result = "Итогом должна быть ведомость контроля: зона, тип соединения, метод, объем, этап выполнения и документ, где фиксируется результат.";
  } else if (/gost|sp|norm|норм|гост|сп|тр тс|фнп|17032/.test(subject)) {
    meaning = "Материал нужен для правильного выбора нормативной рамки. Ошибка здесь опасна тем, что расчет может быть выполнен по документу, который не покрывает фактическое назначение резервуара, условия размещения или работу под давлением.";
    checks = [
      "что именно проектируется: атмосферный резервуар, горизонтальная емкость, сосуд под давлением или объект в составе склада/АЗС;",
      "какая среда хранится, есть ли избыточное давление, вакуум, температурный режим и специальные требования безопасности;",
      "какие документы применяются совместно: профильный ГОСТ, СП по нагрузкам, СП по основаниям, пожарные требования, ТР ТС 032/2013 и ФНП при необходимости;",
      "какая редакция документа действует на дату расчета и есть ли изменения, влияющие на проект.",
    ];
    mistakes = [
      "считать, что один ГОСТ закрывает все требования к объекту целиком;",
      "не отделять требования к изделию от требований к размещению на площадке;",
      "не фиксировать редакции нормативов в расчетной записке;",
      "применять резервуарные нормы к оборудованию, которое уже относится к оборудованию под давлением.",
    ];
    result = "В проекте нужно явно указать применимые нормы, область применения каждого документа и границу ответственности: что относится к конструкции резервуара, что к площадке, а что к промышленной или пожарной безопасности.";
  } else if (/ргс|горизонт|обечайк|диафрагм|седл|хомут|rgs|gorizontal/.test(subject)) {
    meaning = "Для РГС ключевая задача — проверить горизонтальную обечайку, днища, седловые опоры, врезки и условия установки как единую систему.";
    checks = [
      "диаметр, длину, давление, продукт и расчетную температуру;",
      "схему опор, подземное или наземное размещение, всплытие и нагрузки от грунта;",
      "днища, патрубки, люки, диафрагмы и кольца жесткости;",
      "транспортировку, монтаж и контроль сварных соединений.",
    ];
    mistakes = [
      "считать РГС как уменьшенный РВС;",
      "не проверять опоры и местные напряжения у седел;",
      "забывать всплытие подземного резервуара;",
      "не отделять атмосферный резервуар от оборудования под давлением.",
    ];
    result = "Расчет должен показать обечайку, днища, опоры, врезки, устойчивость и нормативную область применения.";
  }

  return `<section id="content">
      <h2>${escapeHtml(article.title)}</h2>
      <p>${escapeHtml(meaning)}</p>
      <h2>Что проверить инженеру</h2>
      <ul class="bullet-list">${checks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <h2>Типовые ошибки</h2>
      <ul class="bullet-list">${mistakes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <h2>Что зафиксировать в проекте</h2>
      <p>${escapeHtml(result)}</p>
    </section>`;
}

async function writeArticle(article, related) {
  const category = CATEGORIES[article.category];
  const canonical = `${BASE_URL}/articles/${article.slug}/`;
  const body = `
<main class="kb-shell article-layout">
  <article class="article-main">
    <nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span class="crumb-sep">/</span><a href="${ARTICLES_INDEX}">Статьи</a><span class="crumb-sep">/</span><span>${escapeHtml(article.title)}</span></nav>
    <section class="hero-card hero-article">
      <div class="hero-copy">
        <div class="chip">${category.label}</div>
        <h1>${escapeHtml(article.title)}</h1>
        <p class="lead">${escapeHtml(article.description)}</p>
        <div class="hero-actions"><a class="btn btn-primary" href="/calc/${article.category === "rgs" ? "rgs" : "rvs"}">Открыть калькулятор</a><a class="btn" href="${ARTICLES_INDEX}">Ко всем статьям</a></div>
      </div>
      <div class="hero-aside">
        <h2>Редакционная версия</h2>
        <p>Материал взят из Telegram-канала, очищен от формата короткого поста и дополнен расчетными пояснениями для статьи на сайте.</p>
        <p><a class="btn" href="${article.sourceUrls[0]}">Открыть пост</a></p>
      </div>
    </section>
    ${renderArticleIntro(article)}
    ${renderNormativeBlock(article)}
    ${renderUsefulChecks(article)}
    ${renderFormulaBlock(article)}
    ${renderGeneratedArticleBody(article)}
    ${renderPracticalBlock(article)}
    ${renderConsultationCta()}
    <section class="cta-panel">
      <div>
        <h2>Перейти к расчету</h2>
        <p>После чтения материала можно открыть калькулятор и проверить основные исходные данные в числах.</p>
      </div>
      <div class="cta-actions"><a class="btn btn-primary" href="/calc/${article.category === "rgs" ? "rgs" : "rvs"}">Перейти к расчету</a><a class="btn" href="${ARTICLES_INDEX}#${category.slug}">Еще по теме</a></div>
    </section>
  </article>
  <aside class="article-side">
    <section class="side-card"><h2>Раздел</h2><p>${escapeHtml(category.intro)}</p></section>
    <section class="side-card"><h2>Похожие статьи</h2><ul class="link-list">${related.map((item) => `<li><a href="/articles/${item.slug}/index.html">${escapeHtml(item.title)}</a></li>`).join("")}</ul></section>
    <section class="side-card"><h2>Telegram</h2><p>Оригинальные публикации остаются в канале, а на сайте они работают как поисковые страницы.</p></section>
  </aside>
</main>`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.description,
      author: { "@type": "Organization", name: "Резервуаростроение" },
      publisher: {
        "@type": "Organization",
        name: "Резервуаростроение",
        logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
      },
      mainEntityOfPage: canonical,
      datePublished: article.publishedAt.slice(0, 10),
      dateModified: TODAY,
      articleSection: category.label,
      inLanguage: "ru-RU",
      isBasedOn: article.sourceUrls[0],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Резервуаростроение", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Статьи", item: `${BASE_URL}/articles/` },
        { "@type": "ListItem", position: 3, name: article.title, item: canonical },
      ],
    },
  ];

  const dir = path.join(ROOT, article.slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), pageShell({
    title: `${article.title} | Резервуаростроение`,
    description: article.description,
    canonical,
    type: "article",
    body,
    schema,
  }));
}

async function writeIndex(articles) {
  const groups = Object.values(CATEGORIES).map((category) => ({
    ...category,
    articles: articles.filter((article) => article.category === category.slug),
  }));

  const body = `
<main class="kb-shell knowledge-home">
  <section class="hero-card hero-home">
    <div class="hero-copy">
      <div class="chip">Telegram → сайт</div>
      <h1>Статьи по резервуаростроению</h1>
      <p class="lead">Локальная версия раздела статей, перенесенных из Telegram-канала. Материалы разделены на РВС, РГС и СУГ, чтобы каждая тема работала как отдельная SEO-страница.</p>
      <div class="hero-actions"><a class="btn btn-primary" href="#rvs">РВС</a><a class="btn" href="#rgs">РГС</a><a class="btn" href="#sug">СУГ</a></div>
    </div>
    <div class="hero-aside">
      <h2>Что дальше</h2>
      <ul class="check-list">
        <li>выбрать коммерчески важные статьи;</li>
        <li>добавить внутренние ссылки на услуги и калькуляторы;</li>
        <li>после редакторской вычитки открыть индексацию.</li>
      </ul>
    </div>
  </section>
  <section class="toolbar">
    <label class="search-box"><span>Поиск по статьям</span><input id="article-search" type="search" placeholder="Например: диафрагма, днище, давление, СУГ"></label>
      <div class="toolbar-note">Импортировано ${articles.length} материалов. Страницы уже очищены от Telegram-оформления, дополнены расчетными блоками и пока помечены noindex для редакторской проверки.</div>
  </section>
  ${groups.map((group) => `
  <section class="cluster-section" id="${group.slug}">
    <div class="cluster-head">
      <div>
        <div class="chip">${group.label}</div>
        <h2>${group.title}</h2>
        <p>${group.intro}</p>
      </div>
      <span class="small-chip">${group.articles.length} материалов</span>
    </div>
    <div class="knowledge-grid">${group.articles.map(renderCard).join("") || `<article class="knowledge-card"><h3>Материалы пока не найдены</h3><p>Если в Telegram появятся публикации с явными признаками раздела ${group.label}, импортер добавит их сюда.</p></article>`}</div>
  </section>`).join("")}
</main>
<script>
  const input = document.getElementById('article-search');
  const cards = Array.from(document.querySelectorAll('.knowledge-card'));
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    cards.forEach((card) => {
      card.style.display = !q || card.dataset.needle?.includes(q) ? '' : 'none';
    });
  });
</script>`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Статьи по резервуаростроению",
      description: "Статьи по РВС, РГС и СУГ из Telegram-канала Резервуаростроение, подготовленные для локального SEO-раздела.",
      url: `${BASE_URL}/articles/`,
      inLanguage: "ru-RU",
      dateModified: TODAY,
      publisher: { "@type": "Organization", name: "Резервуаростроение" },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Статьи по резервуаростроению",
      itemListElement: articles.slice(0, 50).map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${BASE_URL}/articles/${article.slug}/`,
        name: article.title,
      })),
    },
  ];

  await fs.writeFile(path.join(ROOT, "index.html"), pageShell({
    title: "Статьи по резервуаростроению: РВС, РГС, СУГ",
    description: "Локальный раздел статей по РВС, РГС и СУГ, перенесенных из Telegram-канала Резервуаростроение.",
    canonical: `${BASE_URL}/articles/`,
    body,
    schema,
  }));
}

async function main() {
  await fs.rm(ROOT, { recursive: true, force: true });
  await fs.mkdir(ROOT, { recursive: true });
  const messages = await fetchAllMessages();
  const groups = groupMessages(messages);
  const usedSlugs = new Map();
  const articles = groups
    .map((group) => {
      const category = classify(group.text);
      const title = makeTitle(group.text, category, group.ids[0]);
      const baseSlug = translit(title) || `telegram-${group.ids[0]}`;
      const count = usedSlugs.get(baseSlug) ?? 0;
      usedSlugs.set(baseSlug, count + 1);
      const slug = count ? `${baseSlug}-${group.ids[0]}` : baseSlug;
      return {
        ...group,
        category,
        title,
        slug,
        description: normalizeImportedText(descriptionFrom(group.text, title)),
      };
    })
    .filter((article) => article.text.length > 500 && !isNonArticle(article));

  for (const article of articles) {
    const related = articles
      .filter((item) => item.category === article.category && item.slug !== article.slug)
      .slice(0, 6);
    await writeArticle(article, related);
  }

  await writeIndex(articles);
  await fs.writeFile(path.join(ROOT, "pages.json"), JSON.stringify(articles.map((article) => ({
    slug: article.slug,
    url: `/articles/${article.slug}/index.html`,
    title: article.title,
    description: article.description,
    category: article.category,
    sourceUrls: article.sourceUrls,
    publishedAt: article.publishedAt,
  })), null, 2));

  console.log(`Imported ${articles.length} articles from ${messages.length} Telegram posts into ${ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("frontend/public/baza-znaniy");
const TODAY = "2026-05-15";

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    if (entry.isFile() && entry.name === "index.html") files.push(full);
  }
  return files;
}

function extractTitle(html) {
  return html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "Материал базы знаний";
}

function topicFor(file, title) {
  const slug = path.basename(path.dirname(file));
  const text = `${slug} ${title}`.toLowerCase();
  if (/стенк|пояс|толщин|напряж/.test(text)) return "wall";
  if (/днищ|окрайк|основан|фундамент|осадк|опора-днищ/.test(text)) return "bottom";
  if (/кровл|кры[шш]|настил|ребр|стойк/.test(text)) return "roof";
  if (/ветр|опрокид|анкер|устойчив/.test(text)) return "wind";
  if (/снег|снегов/.test(text)) return "snow";
  if (/сейсм|импульс|конвектив|гидродинамич/.test(text)) return "seismic";
  if (/гост|сп20|сп14|сп16|сп22|норматив|допуск|припуск/.test(text)) return "norms";
  if (/испыт|гидроиспыт|мониторинг|диагност|контрол/.test(text)) return "tests";
  if (/патруб|люк|лестниц|площадк|арматур|молни|изоляц|корроз/.test(text)) return "details";
  return "general";
}

const FORMULAS = {
  general: {
    name: "общей расчетной проверки РВС",
    norms: ["ГОСТ 31385-2023", "СП 20.13330.2016", "СП 22.13330.2016", "СП 16.13330.2017"],
    rows: [
      ["Полезный объем цилиндрической части", "V = π · D² · H / 4", "Проверка геометрии и соответствия номинальному объему."],
      ["Гидростатическое давление", "p(z) = ρ · g · z", "Базовая зависимость для стенки, днища и местных узлов."],
      ["Нагрузка от продукта", "G = ρ · V · g", "Используют для проверки основания, днища и устойчивости."],
    ],
  },
  wall: {
    name: "стенки резервуара",
    norms: ["ГОСТ 31385-2023", "СП 16.13330.2017", "СП 20.13330.2016"],
    rows: [
      ["Окружное напряжение в поясе", "σθ = p · R / tэф", "Позволяет найти управляющий пояс по гидростатическому давлению."],
      ["Эффективная толщина", "tэф = tном − cкор − Δ−", "Из номинала вычитают коррозионный припуск и минусовой допуск проката."],
      ["Проверка прочности", "σθ ≤ Ry · γc · φ", "Сравнение выполняют с расчетным сопротивлением материала и коэффициентом шва."],
    ],
  },
  bottom: {
    name: "днища, окрайки и основания",
    norms: ["ГОСТ 31385-2023", "СП 22.13330.2016", "СП 20.13330.2016"],
    rows: [
      ["Площадь опирания", "A = π · D² / 4", "Нужна для оценки среднего давления на основание."],
      ["Среднее давление", "q = (Gрез + Gпрод) / A", "Проверяют по расчетному сопротивлению основания и осадкам."],
      ["Условие по основанию", "q ≤ Rосн", "Если условие не выполняется, меняют основание, фундамент или режим заполнения."],
    ],
  },
  roof: {
    name: "кровли резервуара",
    norms: ["ГОСТ 31385-2023", "СП 20.13330.2016", "СП 16.13330.2017"],
    rows: [
      ["Расчетная нагрузка на кровлю", "q = gсоб + S + W", "Собственный вес, снег и ветровая составляющая собираются в расчетных сочетаниях."],
      ["Изгибающий момент элемента", "M = q · l² / 8", "Ориентир для настила, ребра или балки при шарнирной схеме."],
      ["Требуемый момент сопротивления", "Wтр = M / Ry", "Используют для подбора профиля или проверки принятого сечения."],
    ],
  },
  wind: {
    name: "ветра и устойчивости",
    norms: ["СП 20.13330.2016", "ГОСТ 31385-2023", "СП 16.13330.2017"],
    rows: [
      ["Ветровое давление", "w = w0 · k(z) · c", "Районное давление уточняют коэффициентами высоты и аэродинамики."],
      ["Опрокидывающий момент", "Mвет = Σ(Fi · zi)", "Суммируют ветровые силы по высоте корпуса и навесных элементов."],
      ["Коэффициент устойчивости", "γуст = Mуд / Mвет", "Проверяют пустое, заполненное и монтажные состояния."],
    ],
  },
  snow: {
    name: "снеговой нагрузки",
    norms: ["СП 20.13330.2016", "ГОСТ 31385-2023"],
    rows: [
      ["Снеговая нагрузка", "S = μ · ce · ct · Sg", "Коэффициенты формы, экспозиции и теплового режима выбирают по схеме кровли."],
      ["Полная нагрузка на покрытие", "q = gсоб + S", "Применяют для настила, ребер и опорного кольца."],
      ["Момент от равномерной нагрузки", "M = q · l² / 8", "Дает первичный подбор несущего элемента кровли."],
    ],
  },
  seismic: {
    name: "сейсмического воздействия",
    norms: ["СП 14.13330.2018", "ГОСТ 31385-2023", "СП 20.13330.2016"],
    rows: [
      ["Сейсмическая сила", "Fс = kс · G", "Коэффициент назначают по расчетной сейсмичности, грунтам и расчетной схеме."],
      ["Опрокидывающий момент", "Mс = Fс · zц", "Определяет требования к устойчивости корпуса и анкерному креплению."],
      ["Разделение массы жидкости", "G = Gимп + Gконв", "Для заполненных резервуаров учитывают импульсную и конвективную составляющие."],
    ],
  },
  norms: {
    name: "нормативной проверки",
    norms: ["ГОСТ 31385-2023", "СП 20.13330.2016", "СП 22.13330.2016", "СП 14.13330.2018", "СП 16.13330.2017"],
    rows: [
      ["Проверка применимости стандарта", "тип РВС + продукт + объем + давление", "Перед расчетом фиксируют, попадает ли объект в область применения документа."],
      ["Сочетание нагрузок", "E = γg · G + γq · Q", "Коэффициенты и состав сочетания принимают по действующим СП для конкретного режима."],
      ["Расчетная толщина", "tном ≥ tтр + cкор + Δ−", "Номинал выбирают с учетом коррозии, допуска и конструктивных минимумов."],
    ],
  },
  tests: {
    name: "испытаний и контроля",
    norms: ["ГОСТ 31385-2023", "СП 16.13330.2017"],
    rows: [
      ["Гидростатическое давление", "pисп = ρв · g · hисп", "Проверяют стенку, днище, швы и основание в испытательном режиме."],
      ["Осадка после наполнения", "sфакт ≤ sдоп", "Сравнивают фактические отметки с допустимыми деформациями основания."],
      ["Контроль герметичности", "Δp или падение уровня → в пределах методики испытания", "Критерий задают программой испытаний и нормативными требованиями."],
    ],
  },
  details: {
    name: "узлов и конструктивных элементов",
    norms: ["ГОСТ 31385-2023", "СП 16.13330.2017", "СП 20.13330.2016"],
    rows: [
      ["Местное напряжение у врезки", "σloc = N / Aэф", "Для люков, патрубков и накладок проверяют ослабление сечения."],
      ["Проверка сварного шва", "N ≤ lw · kw · Rw", "Несущую способность шва сравнивают с усилием, которое должен передать узел."],
      ["Дополнительная нагрузка элемента", "Gдоп = m · g", "Лестницы, площадки, изоляция и арматура учитываются в массе и ветровой проекции."],
    ],
  },
};

function formulaBlock(topic, title) {
  const data = FORMULAS[topic] ?? FORMULAS.general;
  const rows = data.rows.map(([label, formula, note]) => `
      <div class="calc-row">
        <div class="calc-label">${escapeHtml(label)}</div>
        <div class="calc-formula">${escapeHtml(formula)}</div>
        <p>${escapeHtml(note)}</p>
      </div>`).join("");
  const norms = data.norms.map((norm) => `<li>${escapeHtml(norm)}</li>`).join("");
  return `
<section class="kb-engineering-upgrade calculation-section">
  <h2>Инженерные формулы по теме</h2>
  <p>Для материала «${escapeHtml(title)}» ниже приведён расчетный минимум по ${escapeHtml(data.name)}. Это не заменяет рабочий расчет, но убирает пустые формулировки и показывает, какие зависимости инженер должен проверить первыми.</p>
  <div class="calc-sheet">${rows}
    <div class="calc-conclusion">Проверочный вывод: значения подставляют из задания, расчетной схемы и действующих нормативов; итоговое решение фиксируют в расчётной записке.</div>
  </div>
  <div class="strong-note"><strong>Нормативная привязка:</strong><ul class="bullet-list">${norms}</ul></div>
</section>`;
}

function enhanceArticle(html, file) {
  if (!html.includes('class="article-main"')) return html;
  const title = extractTitle(html);
  const topic = topicFor(file, title);
  let next = html.replace(/\n<section class="kb-engineering-upgrade calculation-section">[\s\S]*?<\/section>/g, "");
  const block = formulaBlock(topic, title);

  if (next.includes('<section id="formulas">')) {
    next = next.replace(/(<section id="formulas">[\s\S]*?<\/section>)/, `$1${block}`);
  } else {
    next = next.replace(/(<section id="quick-answer">[\s\S]*?<\/section>)/, `$1${block}`);
  }
  next = next.replace('<li><a href="#formulas">Формулы и параметры</a></li>', '<li><a href="#formulas">Формулы и параметры</a></li><li><a href="#engineering-formulas">Инженерный блок</a></li>');
  return next.replace('<section class="kb-engineering-upgrade calculation-section">', '<section id="engineering-formulas" class="kb-engineering-upgrade calculation-section">');
}

function enhanceNav(html) {
  return html.replace(/<nav class="kb-nav">([\s\S]*?)<\/nav>/, (match, inner) => {
    let nav = inner;
    if (!nav.includes('/articles/index.html')) {
      nav = nav.replace(/(<a class="active" href="\/baza-znaniy\/">База знаний<\/a>)/, '$1<a href="/articles/index.html">Статьи</a>');
    }
    if (!nav.includes('#normativnaya-baza')) {
      nav = nav.replace(/(<a href="\/articles\/index\.html">Статьи<\/a>|<a class="active" href="\/baza-znaniy\/">База знаний<\/a>)/, '$1<a href="/baza-znaniy/#normativnaya-baza">Нормативная база</a>');
    }
    return `<nav class="kb-nav">${nav}</nav>`;
  });
}

function normativeHomeSection() {
  return `
<section id="normativnaya-baza" class="cluster-section kb-engineering-upgrade">
  <div class="cluster-head">
    <div>
      <div class="chip">Нормативная база</div>
      <h2>Рабочие документы для расчёта резервуаров</h2>
      <p>Раздел собран как инженерный навигатор: какой документ за что отвечает и какие формулы обычно связывают статью с расчетом. Перед выпуском проекта проверяют актуальную редакцию, изменения и область применения.</p>
    </div>
    <span class="small-chip">обновлено ${TODAY}</span>
  </div>
  <div class="knowledge-grid">
    <article class="knowledge-card"><h3>ГОСТ 31385-2023</h3><p>Вертикальные цилиндрические стальные резервуары для нефти и нефтепродуктов: проектирование, изготовление, монтаж, испытания, приемка, защита от коррозии.</p></article>
    <article class="knowledge-card"><h3>СП 20.13330.2016</h3><p>Нагрузки и воздействия: снег, ветер, температурные воздействия и расчетные сочетания нагрузок.</p></article>
    <article class="knowledge-card"><h3>СП 22.13330.2016</h3><p>Основания и фундаменты: расчетное сопротивление, среднее давление, осадки и требования к инженерно-геологическим данным.</p></article>
    <article class="knowledge-card"><h3>СП 14.13330.2018</h3><p>Сейсмические районы: расчетная сейсмичность площадки, грунты, горизонтальные воздействия и устойчивость резервуара.</p></article>
    <article class="knowledge-card"><h3>СП 16.13330.2017</h3><p>Стальные конструкции: расчетные сопротивления, прочность, устойчивость, сварные соединения и элементы каркаса.</p></article>
    <article class="knowledge-card"><h3>ТР ТС 032/2013 и ГОСТ 34347-2017</h3><p>Для емкостей и сосудов под избыточным давлением, включая случаи СУГ, когда объект выходит за рамки обычного атмосферного резервуара.</p></article>
  </div>
</section>`;
}

function enhanceHome(html) {
  let next = html;
  next = next.replace(/<section id="normativnaya-baza" class="cluster-section kb-engineering-upgrade">[\s\S]*?<\/section>/, "");
  if (!next.includes('/articles/index.html')) {
    next = next.replace('<a class="btn" href="/">Вернуться на главную</a>', '<a class="btn" href="/">Вернуться на главную</a><a class="btn" href="/articles/index.html">Статьи</a>');
  }
  next = next.replace(/(<section class="cluster-section update-note">[\s\S]*?<\/section>)/, `$1${normativeHomeSection()}`);
  return next;
}

async function main() {
  const files = await walk(ROOT);
  for (const file of files) {
    let html = await fs.readFile(file, "utf8");
    html = enhanceNav(html);
    html = file === path.join(ROOT, "index.html") ? enhanceHome(html) : enhanceArticle(html, file);
    await fs.writeFile(file, html, "utf8");
  }
  console.log(`Upgraded ${files.length} KB pages`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

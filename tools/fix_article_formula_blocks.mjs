import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("frontend/public/articles");

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fraction(numerator, denominator) {
  return `<span class="formula-frac"><span>${numerator}</span><span>${denominator}</span></span>`;
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

function topicFor(slug, html) {
  if (/obogrev|teploizol|temperatur|deformac/.test(slug)) return "temperature";
  if (/dnishch|okray|fundament|osnovan|osadk|razuklonk|grunt/.test(slug)) return "bottom";
  if (/sneg|snow/.test(slug)) return "snow";
  if (/vetr|wind|oprokid|anker/.test(slug)) return "wind";
  if (/seysm|seismic|impuls|konvektiv|gidrodinam/.test(slug)) return "seismic";
  if (/krovl|roof|nastil|rebr|uklon/.test(slug)) return "roof";
  if (/svark|shov|rulon|polist|montazh|transport|podem|serpovid/.test(slug)) return "assembly";
  if (/lyuk|laz|patrub|vrezk|lestnic|ploshchad|molni|armatur/.test(slug)) return "details";
  if (/korroz|pokryt|akz|pripusk/.test(slug)) return "corrosion";
  if (/gidroispyt|ispytan|kontrol|laborator|diagnost/.test(slug)) return "tests";
  if (/stenk|tolshch|poyas|stal|09g2s/.test(slug)) return "wall";
  if (/rgs|gorizontal|obechayk|diafragm|sedl|homut|vsplyti|oval|ellipt/.test(slug)) return "rgs";
  if (/sug|propan|butan|sosud/.test(slug)) return "sug";
  if (/tipovye|oshibk|tz|zadani/.test(slug)) return "general";

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  const main = html.match(/<section id="content">([\s\S]*?)<\/section>/i)?.[1] ?? "";
  const text = `${slug} ${h1} ${main}`.replace(/<[^>]+>/g, " ").toLowerCase();

  if (/tipovye|oshibk|tz|zadani|типов|ошибк|тз|задани/.test(text)) return "general";
  if (/sug|суг|propan|butan|пропан|бутан|сосуд|избыточн/.test(text)) return "sug";
  if (/rgs|gorizontal|obechayk|diafragm|sedl|homut|vsplyti|oval|ellipt|горизонтальн|обечайк|диафрагм|седл|хомут|всплыти|овальн|эллиптич/.test(text)) return "rgs";
  if (/dnishch|okray|fundament|osnovan|osadk|razuklonk|grunt|днищ|окрайк|фундамент|основан|осадк|разуклонк|грунт/.test(text)) return "bottom";
  if (/sneg|snow|снег|снегов/.test(text)) return "snow";
  if (/vetr|wind|oprokid|anker|ветр|опрокид|анкер/.test(text)) return "wind";
  if (/seysm|seismic|impuls|konvektiv|gidrodinam|сейсм|импульсив|конвектив|гидродинами/.test(text)) return "seismic";
  if (/krovl|roof|nastil|rebr|uklon|кровл|настил|ребр|уклон/.test(text)) return "roof";
  if (/obogrev|teploizol|temperatur|deformac|обогрев|теплоизоляц|температур|деформац/.test(text)) return "temperature";
  if (/svark|shov|rulon|polist|montazh|transport|podem|serpovid|свар|шов|рулонир|полист|монтаж|транспорт|подъем|серповид/.test(text)) return "assembly";
  if (/lyuk|laz|patrub|vrezk|lestnic|ploshchad|molni|armatur|люк|лаз|патруб|врезк|лестниц|площадк|молни|арматур/.test(text)) return "details";
  if (/korroz|pokryt|akz|pripusk|корроз|покрыт|акз|припуск/.test(text)) return "corrosion";
  if (/gidroispyt|ispytan|kontrol|laborator|diagnost|гидроиспыт|испытан|контрол|лаборатор|нк|узи|диагност/.test(text)) return "tests";
  if (/stenk|tolshch|poyas|stal|09g2s|стенк|толщин|пояс|сталь|09г2с|ст3/.test(text)) return "wall";
  return "general";
}

const FORMULAS = {
  wall: {
    title: "Пример проверки толщины стенки РВС",
    rows: [
      ["Радиус резервуара:", `R = ${fraction("D", "2")} = ${fraction("2000", "2")} = 1000 мм`],
      ["Расчетная толщина стенки с учетом прибавок:", `s<sub>тр</sub> + c = ${fraction("p · R", "2 · [σ] · φ - 1,2 · p")} + c = 7,8 мм`],
      ["Проверка принятой толщины:", `s<sub>прин</sub> = 8 мм ≥ s<sub>тр</sub> = 7,8 мм`],
    ],
    conclusion: "Вывод делают после сравнения требуемой толщины с принятой толщиной листа с учетом коррозионного припуска, минусового допуска и коэффициента сварного шва.",
  },
  bottom: {
    title: "Пример проверки днища, окраек и основания",
    rows: [
      ["Минимальная толщина центральной части днища:", `t<sub>ном</sub> ≥ t<sub>min</sub> + c<sub>дн</sub> + Δt<sub>минус</sub>`],
      ["Толщина кольцевой окрайки:", `t<sub>b</sub> = (k<sub>1</sub> - 0,0024 · √${fraction("r", "t<sub>1</sub> - Δt<sub>cs</sub>")}) · (t<sub>1</sub> - Δt<sub>cs</sub>) + Δt<sub>cb</sub> + Δt<sub>mb</sub>`],
      ["Среднее давление на основание:", `q = ${fraction("G<sub>рез</sub> + G<sub>прод</sub>", "A")} ≤ R<sub>осн</sub>`],
    ],
    conclusion: "Для днища нельзя ограничиваться толщиной стенки: отдельно проверяют центральную часть, окрайку, основание, осадки и коррозионные припуски.",
  },
  wind: {
    title: "Пример проверки ветра, устойчивости и анкеров",
    rows: [
      ["Ветровое давление:", `w = w<sub>0</sub> · k(z) · c`],
      ["Опрокидывающий момент:", `M<sub>w</sub> = Σ(F<sub>i</sub> · z<sub>i</sub>)`],
      ["Условие устойчивости:", `${fraction("M<sub>уд</sub>", "M<sub>w</sub>")} ≥ γ<sub>min</sub>`],
    ],
    conclusion: "Проверяют пустой, заполненный и монтажный режимы; анкера назначают только после расчета опрокидывания, сдвига и отрыва уторного узла.",
  },
  snow: {
    title: "Пример проверки снеговой нагрузки на кровлю",
    rows: [
      ["Расчетная снеговая нагрузка:", `S = μ · c<sub>e</sub> · c<sub>t</sub> · S<sub>g</sub>`],
      ["Полная нагрузка на кровлю:", `q = g<sub>соб</sub> + S`],
      ["Изгибающий момент элемента:", `M = ${fraction("q · l²", "8")}`],
    ],
    conclusion: "Снеговую нагрузку связывают с формой кровли, районом строительства и фактической схемой несущих элементов.",
  },
  seismic: {
    title: "Пример сейсмической проверки резервуара",
    rows: [
      ["Эквивалентная сейсмическая сила:", `F<sub>s</sub> = k<sub>s</sub> · G`],
      ["Опрокидывающий момент:", `M<sub>s</sub> = F<sub>s</sub> · z<sub>c</sub>`],
      ["Разделение массы жидкости:", `G = G<sub>имп</sub> + G<sub>конв</sub>`],
    ],
    conclusion: "Для заполненного резервуара важно учитывать не только массу стали, но и импульсивную и конвективную составляющие жидкости.",
  },
  roof: {
    title: "Пример проверки кровли резервуара",
    rows: [
      ["Полная распределенная нагрузка:", `q = g<sub>соб</sub> + S + W`],
      ["Максимальный момент в расчетной полосе:", `M = ${fraction("q · l²", "8")}`],
      ["Требуемый момент сопротивления:", `W<sub>тр</sub> = ${fraction("M", "R<sub>y</sub> · γ<sub>c</sub>")}`],
    ],
    conclusion: "Для кровли подбирают не только толщину настила, но и ребра, стойки, кольца и узлы передачи нагрузки на стенку.",
  },
  temperature: {
    title: "Пример проверки температурных воздействий",
    rows: [
      ["Температурное удлинение элемента:", `ΔL = α · L · ΔT`],
      ["Ориентировочное температурное напряжение при защемлении:", `σ<sub>T</sub> = E · α · ΔT`],
      ["Проверка компенсации деформаций:", `ΔL<sub>своб</sub> ≥ ΔL<sub>расч</sub>`],
    ],
    conclusion: "Для обогрева, теплоизоляции и температурных режимов важна не толщина стенки сама по себе, а свобода деформаций, узлы крепления и расчетная температура металла.",
  },
  assembly: {
    title: "Пример проверки монтажной схемы",
    rows: [
      ["Отклонение геометрии стенки:", `${fraction("ΔD", "D")} ≤ [${fraction("ΔD", "D")}]`],
      ["Монтажное усилие в временном креплении:", `N<sub>м</sub> ≤ R<sub>d</sub> · A`],
      ["Проверка сварного шва:", `N ≤ l<sub>ш</sub> · k<sub>ш</sub> · R<sub>ш</sub>`],
    ],
    conclusion: "Для монтажа проверяют временные состояния, геометрию, удержание листов, последовательность сварки и контроль деформаций.",
  },
  details: {
    title: "Пример проверки узла и местного усиления",
    rows: [
      ["Ослабление сечения у врезки:", `A<sub>эф</sub> = A<sub>ст</sub> - A<sub>отв</sub> + A<sub>ус</sub>`],
      ["Местное напряжение:", `σ<sub>loc</sub> = ${fraction("N", "A<sub>эф</sub>")}`],
      ["Проверка шва накладки:", `N ≤ l<sub>ш</sub> · k<sub>ш</sub> · R<sub>ш</sub>`],
    ],
    conclusion: "Для люков, патрубков, лестниц и площадок считают местную передачу усилий, усиление ослабленного сечения и доступность контроля.",
  },
  corrosion: {
    title: "Пример учета коррозии и покрытия",
    rows: [
      ["Расчетный коррозионный припуск:", `c = v<sub>кор</sub> · T<sub>сл</sub>`],
      ["Эффективная толщина:", `t<sub>эф</sub> = t<sub>ном</sub> - c - Δt<sub>минус</sub>`],
      ["Условие работоспособности:", `t<sub>эф</sub> ≥ t<sub>тр</sub>`],
    ],
    conclusion: "Коррозионная защита должна быть связана с продуктом, сроком службы, припуском на коррозию и системой контроля покрытия.",
  },
  tests: {
    title: "Пример проверки при испытаниях и контроле",
    rows: [
      ["Гидростатическое давление при испытании:", `p<sub>исп</sub> = ρ<sub>в</sub> · g · h<sub>исп</sub>`],
      ["Контроль осадки:", `s<sub>факт</sub> ≤ s<sub>доп</sub>`],
      ["Проверка герметичности:", `Δp → в пределах методики испытаний`],
    ],
    conclusion: "Испытания подтверждают не только герметичность: дополнительно смотрят осадки, геометрию, швы, уторный узел и состояние основания.",
  },
  rgs: {
    title: "Пример проверки элемента РГС",
    rows: [
      ["Проверка расчетного сечения диафрагмы:", `A<sub>тр</sub> = ${fraction("N", "R<sub>d</sub>")} = ${fraction("180000", "215")} = 837 мм²`],
      ["Проверка сварного шва:", `l<sub>ш</sub> · k<sub>ш</sub> · R<sub>ш</sub> ≥ N`],
      ["Проверка овальности обечайки:", `${fraction("ΔD", "D")} ≤ [${fraction("ΔD", "D")}]`],
    ],
    conclusion: "Для РГС особенно важны седловые опоры, овальность обечайки, диафрагмы, зоны люков и патрубков.",
  },
  sug: {
    title: "Пример проверки емкости СУГ под давлением",
    rows: [
      ["Окружное напряжение обечайки:", `σ<sub>к</sub> = ${fraction("p · R", "s - c")}`],
      ["Условие прочности:", `σ<sub>к</sub> ≤ [σ] · φ`],
      ["Пробное давление:", `p<sub>исп</sub> = 1,25 · p<sub>раб</sub>`],
    ],
    conclusion: "Для СУГ расчет ведут как для оборудования под давлением: сначала задают давление, температуру, среду и категорию, затем проверяют стенку, днища, штуцеры и предохранительную арматуру.",
  },
  general: {
    title: "Расчетный фрагмент по теме статьи",
    rows: [
      ["Полезный объем цилиндрической части:", `V = ${fraction("π · D² · H", "4")}`],
      ["Гидростатическое давление:", `p = ρ · g · h`],
      ["Нагрузка от продукта:", `G = ρ · V · g`],
    ],
    conclusion: "Формулы задают только порядок проверки; рабочий расчет выполняют по исходным данным, нормативной схеме и принятым коэффициентам.",
  },
};

function renderFormulaBlock(data) {
  const rows = data.rows
    .map(([label, formula]) => `<div class="calc-row"><div class="calc-label">${escapeHtml(label)}</div><div class="calc-formula">${formula}</div></div>`)
    .join("");
  return `<section class="calculation-section">
    <h2>${escapeHtml(data.title)}</h2>
    <p>Формулы ниже привязаны к теме статьи и приведены как инженерный ориентир. В рабочем проекте значения уточняют по действующим нормам, расчетной схеме и фактическим исходным данным.</p>
    <div class="calc-sheet">
      ${rows}
      <div class="calc-conclusion">Проверочный вывод: ${escapeHtml(data.conclusion)}</div>
    </div>
  </section>`;
}

function enhanceInlineFormulas(html) {
  return html
    .replace(
      /<p>t_b = \(k₁ - 0,0024·√\( r \/ \(t₁ - Δt_cs\) \)\)·\(t₁ - Δt_cs\) \+ Δt_cb \+ Δt_mb<\/p>/g,
      `<div class="inline-formula">t<sub>b</sub> = (k<sub>1</sub> - 0,0024 · √${fraction("r", "t<sub>1</sub> - Δt<sub>cs</sub>")}) · (t<sub>1</sub> - Δt<sub>cs</sub>) + Δt<sub>cb</sub> + Δt<sub>mb</sub></div>`,
    )
    .replace(
      /<p>t_ном_поле ≥ t_min \+ c_дн \+ Δt_минус<\/p>/g,
      `<div class="inline-formula">t<sub>ном</sub> ≥ t<sub>min</sub> + c<sub>дн</sub> + Δt<sub>минус</sub></div>`,
    )
    .replace(
      /<p>t_ном_поле ≥ 6 \+ 2 \+ 0,3 = 8,3 мм<\/p>/g,
      `<div class="inline-formula">t<sub>ном</sub> ≥ 6 + 2 + 0,3 = 8,3 мм</div>`,
    );
}

async function main() {
  const files = await walk(ROOT);
  let changed = 0;

  for (const file of files) {
    const slug = path.basename(path.dirname(file));
    let html = await fs.readFile(file, "utf8");
    const topic = topicFor(slug, html);
    const block = renderFormulaBlock(FORMULAS[topic] ?? FORMULAS.general);
    let next = html.replace(/<section class="calculation-section">[\s\S]*?<\/section>/, block);
    next = enhanceInlineFormulas(next);

    if (next !== html) {
      await fs.writeFile(file, next, "utf8");
      changed += 1;
    }
  }

  console.log(`Updated formula blocks in ${changed} articles`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

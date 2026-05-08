import React from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";

type HomeCard = {
  title: string;
  desc: string;
  to?: string;
  status?: "active" | "soon";
};

const cards: HomeCard[] = [
  {
    title: "РВС калькулятор",
    desc: "Предварительный инженерный расчёт вертикальных стальных резервуаров.",
    to: "/calc/rvs",
    status: "active",
  },
  {
    title: "РГС калькулятор",
    desc: "Предварительный инженерный расчёт горизонтальных стальных резервуаров.",
    to: "/calc/rgs",
    status: "active",
  },
  {
    title: "Калькулятор кровли",
    desc: "Подбор нагрузок и элементов крыши резервуара — в разработке.",
    status: "soon",
  },
  {
    title: "Калькулятор СУГ",
    desc: "Предварительная проверка резервуаров под давлением — в разработке.",
    status: "soon",
  },
  {
    title: "Калькулятор обогрева",
    desc: "Оценка теплопотерь и систем обогрева резервуара — в разработке.",
    status: "soon",
  },
  {
    title: "Калькулятор теплоизоляции",
    desc: "Подбор толщины теплоизоляции и массы покрытия — в разработке.",
    status: "soon",
  },
];

export default function Home() {
  return (
    <div className="container home-page">
      <Seo
        title="Резервуаростроение — калькуляторы и база знаний по РВС"
        description="Инженерные калькуляторы и база знаний по расчёту вертикальных стальных резервуаров: РВС, стенка, днище, кровля, нагрузки и предварительная инженерная проверка."
        canonical="https://rezervuarostroenie.ru/"
      />

      <section className="hero card pad">
        <div className="hero-copy">
          <div className="hero-badge">Инженерная платформа</div>
          <h1>Инженерные калькуляторы для резервуаростроения</h1>
          <p>
            Расчёт, предварительная инженерная проверка и база знаний по вертикальным
            стальным резервуарам. Сервис помогает быстро собрать исходные данные,
            получить расчётный результат и сверить его с логикой инженерной проверки.
          </p>
          <div className="hero-meta muted" id="docs">
            ГОСТ 31385-2023 · СП 20.13330 · СП 22.13330 · СП 14.13330 · СП 16.13330
          </div>
        </div>

        <div className="hero-brand card pad" aria-label="Бренд блок">
          <img src="/logo.png" alt="Резервуаростроение" className="hero-logo" />
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="grid cards">
        {cards.map((card) => (
          <div key={card.title} className="card pad home-card">
            <div style={{ fontWeight: 900, fontSize: 18 }}>{card.title}</div>
            <div className="muted" style={{ margin: "6px 0 12px" }}>
              {card.desc}
            </div>

            {card.status === "active" && card.to ? (
              <Link className="btn primary" to={card.to}>
                Открыть калькулятор
              </Link>
            ) : (
              <button className="btn disabled" type="button" disabled>
                Скоро
              </button>
            )}
          </div>
        ))}
      </section>

      <section id="norms" style={{ marginTop: 18 }} className="grid info-grid">
        <div className="card pad">
          <div style={{ fontWeight: 900, fontSize: 18 }}>Нормативная база</div>
          <ul className="muted norms-list">
            <li>ГОСТ 31385-2023 — профильный стандарт по вертикальным стальным резервуарам.</li>
            <li>СП 20.13330 — нагрузки и воздействия.</li>
            <li>СП 22.13330 — основания, осадки и деформации основания.</li>
            <li>СП 14.13330 — расчёт в сейсмических районах.</li>
            <li>СП 16.13330 — общие требования к стальным конструкциям.</li>
          </ul>
        </div>

        <div id="workflow" className="card pad">
          <div style={{ fontWeight: 900, fontSize: 18 }}>Как пользоваться сервисом</div>
          <ol className="muted norms-list">
            <li>Соберите исходные данные по геометрии, продукту и площадке.</li>
            <li>Выполните предварительный расчёт в РВС калькуляторе.</li>
            <li>Сверьте результат с материалами базы знаний.</li>
            <li>Вынесите отдельные проектные проверки в рабочую документацию.</li>
          </ol>
        </div>
      </section>

      <footer style={{ margin: "18px 0 28px" }} className="muted home-footer">
        © Резервуаростроение
      </footer>
    </div>
  );
}

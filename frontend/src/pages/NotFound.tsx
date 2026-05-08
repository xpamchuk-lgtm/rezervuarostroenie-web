import React from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";

export default function NotFound() {
  return (
    <div className="container">
      <Seo
        title="Страница не найдена | Резервуаростроение"
        description="Запрошенная страница не найдена. Вернитесь на главную, в калькулятор РВС или в базу знаний по резервуаростроению."
        robots="noindex,nofollow"
      />

      <section className="hero card pad" style={{ marginTop: 18 }}>
        <div className="hero-copy">
          <div className="hero-badge">Ошибка 404</div>
          <h1>Страница не найдена</h1>
          <p>
            Проверь адрес страницы или вернитесь в один из основных разделов сайта.
          </p>
          <div className="hero-actions">
            <Link className="btn primary" to="/">
              На главную
            </Link>
            <Link className="btn" to="/calc/rvs">
              Открыть РВС калькулятор
            </Link>
            <a className="btn" href="/baza-znaniy/">
              Перейти в базу знаний
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

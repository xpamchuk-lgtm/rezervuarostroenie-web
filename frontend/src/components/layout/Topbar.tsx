import React from "react";
import { Link, NavLink } from "react-router-dom";
import ProjectOrderButton from "../ProjectOrderButton";

export default function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <img
            src="/logo-96.png"
            alt="Резервуаростроение"
            className="topbar-logo"
            width={46}
            height={35}
            decoding="async"
          />
          <div className="brand-text">
            <div className="brand-title">Резервуаростроение</div>
            <small>Инженерные калькуляторы резервуаров</small>
          </div>
        </Link>

        <nav className="nav" aria-label="Основная навигация">
          <NavLink to="/" end>
            Калькуляторы
          </NavLink>
          <a href="/baza-znaniy/">База знаний</a>
          <a href="/articles/">Статьи</a>
          <a href="/#workflow">Как пользоваться</a>
          <a href="/#norms">Нормативная база</a>
          <ProjectOrderButton source="topbar" compact />
        </nav>
      </div>
    </header>
  );
}


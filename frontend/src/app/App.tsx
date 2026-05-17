import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Topbar from "../components/layout/Topbar";
import Home from "../pages/Home";
import NotFound from "../pages/NotFound";

const RvsCalc = lazy(() => import("../pages/RvsCalc"));
const RgsCalc = lazy(() => import("../pages/RgsCalc"));

export default function App() {
  return (
    <>
      <Topbar />
      <Suspense fallback={<main className="container card pad">Загрузка...</main>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calc/rvs" element={<RvsCalc />} />
          <Route path="/calc/rgs" element={<RgsCalc />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

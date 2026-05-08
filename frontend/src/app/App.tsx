import React from "react";
import { Routes, Route } from "react-router-dom";
import Topbar from "../components/layout/Topbar";
import Home from "../pages/Home";
import NotFound from "../pages/NotFound";
import RvsCalc from "../pages/RvsCalc";
import RgsCalc from "../pages/RgsCalc";

export default function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calc/rvs" element={<RvsCalc />} />
        <Route path="/calc/rgs" element={<RgsCalc />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

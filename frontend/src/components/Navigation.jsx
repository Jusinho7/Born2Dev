import React from "react";
import { NavLink, useLocation } from "react-router-dom";

const Navigation = ({ Style, isClose }) => {
  const { pathname } = useLocation();

  // Détection active
  const isFactureActive = () =>
    pathname === "/" || pathname.startsWith("/facture");

  const isOffresActive = () =>
    pathname.startsWith("/produit") ||
    pathname.startsWith("/Offres") ||
    pathname.startsWith("/service") ||
    pathname.startsWith("/historique");

  const isStockActive = () =>
    pathname.startsWith("/entrees") || pathname.startsWith("/sorties");

  const isStatsActive = () =>
    pathname.startsWith("/statistiques-ventes") ||
    pathname.startsWith("/statistiques-entrees");

  return (
    <div className={Style}>
      <nav>
        {/* Facturation */}
        <NavLink
          to="/"
          className={() => (isFactureActive() ? "nav-link active" : "nav-link")}
        >
          <i className="fa-solid fa-file-lines"></i>
          <span className={`link-text ${isClose ? "show" : "hide"}`}>
            Facturation
          </span>
        </NavLink>

        {/* Clients */}
        <NavLink
          to="/Client"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          <i className="fas fa-user"></i>
          <span className={`link-text ${isClose ? "show" : "hide"}`}>
            Client
          </span>
        </NavLink>

        {/* Offres */}
        <NavLink
          to="/produit"
          className={() => (isOffresActive() ? "nav-link active" : "nav-link")}
        >
          <i className="fa-solid fa-briefcase"></i>
          <span className={`link-text ${isClose ? "show" : "hide"}`}>
            Offres
          </span>
        </NavLink>

        {/* Stock (Entrées / Sorties)
        <NavLink
          to="/entrees"
          className={() => (isStockActive() ? "nav-link active" : "nav-link")}
        >
          <i className="fa-solid fa-dolly"></i>
          <span className={`link-text ${isClose ? "show" : "hide"}`}>
            Stock
          </span>
        </NavLink> */}

        {/* Statistiques */}
        <NavLink
          to="/statistiques-ventes"
          className={() => (isStatsActive() ? "nav-link active" : "nav-link")}
        >
          <i className="fa-solid fa-chart-line"></i>
          <span className={`link-text ${isClose ? "show" : "hide"}`}>
            Statistiques
          </span>
        </NavLink>
      </nav>
    </div>
  );
};

export default Navigation;

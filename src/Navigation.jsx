import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Navigation() {

  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (

    <header className="header">

      <div className="nav-container">

        <Link to="/" className="brand">

          <img
            src={
              theme === "dark"
                ? "/images/logo-icon.png"
                : "/images/logo-icon-dark.png"
            }
            className="brand-icon"
          />

          <img
            src={
              theme === "dark"
                ? "/images/logo.png"
                : "/images/logo-dark.png"
            }
            className="brand-text"
          />

        </Link>


        <nav className="nav-links">

          <Link to="/">Home</Link>

          <Link to="/about">About us</Link>

          <Link to="/how-it-works">How it Works</Link>

          <Link to="/challenges">Challenges</Link>

        </nav>


        <div className="nav-actions">

          <button
            onClick={toggleTheme}
            className="theme-btn"
          >
            {theme === "dark" ? "☀" : "🌙"}
          </button>

          <button className="cta">
            Get Started
          </button>

        </div>

      </div>

    </header>

  );
}

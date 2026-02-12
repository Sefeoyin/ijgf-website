import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Navigation() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "day");
  }, [theme]);

  return (
    <header className="site-header">
      <div className="container nav-row">
        <div className="brand">
          <img src="/logo-icon.png" alt="icon" className="brand-icon" />
          <img src="/logo.png" alt="logo" className="brand-text" />
        </div>

        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/about">About us</Link>
          <Link to="/how-it-works">How it Works</Link>
          <Link to="/challenges">Challenges</Link>
        </nav>

        <div className="nav-actions">
          <button
            onClick={() => setTheme(t => (t === "dark" ? "day" : "dark"))}
            className="theme-toggle"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "dark" ? "☀" : "🌙"}
          </button>

          <button className="btn cta">Get Started</button>
        </div>
      </div>
    </header>
  );
}

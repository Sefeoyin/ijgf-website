import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Navigation() {

  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <nav className="nav">

      <div className="nav-container">

        <Link to="/" className="logo">

          <img
            src={
              theme === "dark"
                ? "/images/logo.png"
                : "/images/logo-dark.png"
            }
            className="logo-img"
          />

        </Link>

        <div className="nav-links">

          <Link to="/">Home</Link>

          <Link to="/about">About us</Link>

          <Link to="/how-it-works">How it Works</Link>

          <Link to="/challenges">Challenges</Link>

        </div>

        <div className="nav-right">

          <button
            className="theme-toggle"
            onClick={toggleTheme}
          >

            {theme === "dark" ? (

              <svg width="20" height="20">
                <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="2"/>
              </svg>

            ) : (

              <svg width="20" height="20">
                <path d="M10 2a8 8 0 1 0 8 8 6 6 0 0 1-8-8z" fill="currentColor"/>
              </svg>

            )}

          </button>

          <button className="get-started">
            Get Started
          </button>

        </div>

      </div>

    </nav>
  );
}

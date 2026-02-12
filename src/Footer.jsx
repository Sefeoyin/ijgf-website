import React from "react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">

        <div className="footer-brand">
          <img
            src="/logo-icon.png"
            alt="IJGF Icon"
            className="footer-logo-icon"
          />

          <img
            src="/logo.png"
            alt="IJGF Logo"
            className="footer-logo-text"
          />

          <p className="footer-tagline">
            Where Skill, Not Capital, Determines Opportunity.
          </p>
        </div>

        <div className="footer-links">
          {/* keep your existing links here */}
        </div>

      </div>

      <div className="footer-bottom">
        © 2025 IJGF. All rights reserved.
      </div>
    </footer>
  );
}

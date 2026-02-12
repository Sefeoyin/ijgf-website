import React from 'react';
import logo from "./assets/logo.png";
import logoIcon from "./assets/logo-icon.png";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <LogoIcon className="logo-icon" /> {/* Removed background via CSS */}
          <img src={logoImage} alt="IJGF Logo" className="footer-logo-img" />
          <p className="footer-tagline">
            Where Skill, Not Capital, Determines Opportunity.
          </p>
        </div>
        {/* ... rest of footer links ... */}
      </div>
      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} IJGF. All rights reserved.
      </div>
    </footer>
  );
}

import React from 'react';

export default function AboutUsPage() {
  return (
    <section className="about-page">
      <div className="about-hero">
        <h1 className="about-hero-title">About IJGF</h1>
        <p className="about-hero-subtitle">
          At IJGF, we believe in a world where trading success is determined by skill, not by capital. Our mission is to democratize access to funding through challenges that test and reward trader ability.
        </p>
      </div>

      <div className="about-mission">
        <h2 className="about-section-title">Our Mission</h2>
        <div className="about-mission-content">
          <p>
            We empower traders of all levels to reach their potential by funding those who excel in skill-based challenges.
          </p>
        </div>
      </div>

      <div className="about-stats">
        {/* Stat items */}
      </div>

      <div className="about-what-we-do">
        <h2 className="about-section-title">What We Do</h2>
        <p className="about-what-we-do-text">
          We run trading competitions that allow skilled traders to earn funding. By eliminating the need for significant initial capital, we open the door for anyone with talent to participate.
        </p>
      </div>

      <div className="about-features-grid">
        {/* Feature cards: e.g., Transparency, Automation, Funding, Community */}
      </div>
    </section>
  );
}

import React from 'react';

export default function HowItWorksPage() {
  return (
    <section className="how-page">
      <div className="how-hero">
        <h1>How It Works</h1>
        <p>Learn the steps to get funded based on your trading skill.</p>
      </div>

      <div className="how-steps-grid">
        <div className="how-step-card">
          <div className="how-step-number">1</div>
          <h3>Sign Up</h3>
          <p>Create an account and start by completing a simple application.</p>
        </div>
        <div className="how-step-card">
          <div className="how-step-number">2</div>
          <h3>Pass Challenge</h3>
          <p>Trade in the simulation challenge and meet the profit targets.</p>
        </div>
        <div className="how-step-card">
          <div className="how-step-number">3</div>
          <h3>Get Funded</h3>
          <p>After proving your skill, receive funding and start live trading.</p>
        </div>
      </div>

      <div className="how-details-section">
        <h2>Detailed Requirements</h2>
        <div className="how-details-grid">
          <div className="how-detail-card">
            <h3>Consistency</h3>
            <p>Demonstrate consistent returns during the challenge.</p>
            <ul>
              <li>Maintain profit targets</li>
              <li>Follow risk rules</li>
              <li>Complete the challenge within time limit</li>
            </ul>
          </div>
          <div className="how-detail-card">
            <h3>Risk Management</h3>
            <p>Ensure you do not exceed the maximum allowed drawdown.</p>
            <ul>
              <li>No single-trade losses beyond limit</li>
              <li>No daily losses beyond limit</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

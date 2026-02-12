import React from 'react';
export default function ChallengesPage() {
  return (
    <section className="challenges-page">
      <div className="challenges-hero">
        <h1>Choose Your Challenge</h1>
        <p>Explore our trading challenges and prove your skills!</p>
      </div>
      <div className="challenge-cards-grid">
        {/* Example challenge cards */}
        <ChallengeCard title="Strategy Simulator" popular />
        <ChallengeCard title="Market Maker" />
        <ChallengeCard title="Day Trader" />
        <ChallengeCard title="Algo Trader" />
        {/* Add more cards as needed */}
      </div>
    </section>
  );
}

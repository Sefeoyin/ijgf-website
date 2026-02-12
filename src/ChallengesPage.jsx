export default function ChallengesPage() {

  const challenges = [
    {
      name: "$5k Challenge",
      price: "$49.99",
      popular: false,
    },
    {
      name: "$10k Challenge",
      price: "$99.99",
      popular: true,
    },
    {
      name: "$25k Challenge",
      price: "$249.99",
    },
    {
      name: "$50k Challenge",
      price: "$499.99",
    },
    {
      name: "$100k Challenge",
      price: "$999.99",
    },
  ];

  return (

    <div>

      <h1 className="page-title">
        Choose Your Challenge
      </h1>

      <p className="page-subtitle">
        Choose your path to becoming a funded trader.
      </p>

      <div className="challenges-grid">

        {challenges.map((c, i) => (

          <div
            key={i}
            className={
              c.popular
                ? "challenge-card popular"
                : "challenge-card"
            }
          >

            <h3>{c.name}</h3>

            <h2>{c.price}</h2>

            <button className="challenge-btn">
              Start Challenge
            </button>

          </div>

        ))}

      </div>

    </div>

  );

}

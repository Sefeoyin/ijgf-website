import Navigation from "./Navigation";
import Footer from "./Footer";

export default function Layout({ children }) {
  return (
    <div className="site">

      <Navigation />

      <main className="main">
        {children}
      </main>

      <Footer />

    </div>
  );
}

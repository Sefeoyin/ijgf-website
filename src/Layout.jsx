import Navigation from "./Navigation";
import Footer from "./Footer";

export default function Layout({ children }) {
  return (
    <div className="layout">

      <Navigation />

      <main className="main-content">
        <div className="content-container">
          {children}
        </div>
      </main>

      <Footer />

    </div>
  );
}

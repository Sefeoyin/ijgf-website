import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Layout from "./Layout";
import LandingPage from "./LandingPage";
import AboutUsPage from "./AboutUsPage";
import ChallengesPage from "./ChallengesPage";
import HowItWorksPage from "./HowItWorksPage";

import "./index.css";

export default function App() {
  return (
    <Router>
      <Routes>

        <Route
          path="/"
          element={
            <Layout>
              <LandingPage />
            </Layout>
          }
        />

        <Route
          path="/about"
          element={
            <Layout>
              <AboutUsPage />
            </Layout>
          }
        />

        <Route
          path="/challenges"
          element={
            <Layout>
              <ChallengesPage />
            </Layout>
          }
        />

        <Route
          path="/how-it-works"
          element={
            <Layout>
              <HowItWorksPage />
            </Layout>
          }
        />

      </Routes>
    </Router>
  );
}

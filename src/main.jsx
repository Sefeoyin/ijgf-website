import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";   // REQUIRED: global styles
createRoot(document.getElementById("root")).render(<App />);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

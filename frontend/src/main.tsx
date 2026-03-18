import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import App from "./App.tsx";
import "./index.css";

// In production the backend lives on Railway; set VITE_BACKEND_URL in Vercel env vars.
// In dev, leave it unset and the Vite proxy handles /api → localhost:8000.
if (import.meta.env.VITE_BACKEND_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

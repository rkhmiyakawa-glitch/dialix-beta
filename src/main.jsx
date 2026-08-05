import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import DialogProvider from "./components/ui/DialogProvider.jsx";

document.documentElement.style.colorScheme = "light";

createRoot(document.getElementById("root")).render(
  <StrictMode><ErrorBoundary><DialogProvider><App /></DialogProvider></ErrorBoundary></StrictMode>
);

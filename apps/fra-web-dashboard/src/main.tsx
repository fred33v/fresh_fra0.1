import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installErrorReporting } from "./lib/errorReporter";

// Report uncaught errors and unhandled promise rejections to our API (production only)
installErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);

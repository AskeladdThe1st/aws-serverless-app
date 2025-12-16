import { createRoot } from "react-dom/client";
import "./legacy-persona-fallbacks";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

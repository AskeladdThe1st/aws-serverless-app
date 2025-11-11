import { createRoot } from "react-dom/client";
import { AuthLayout } from "./components/AuthLayout";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AuthLayout>
    <App />
  </AuthLayout>
);

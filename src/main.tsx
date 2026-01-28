import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18n

console.log("Main.tsx execution started");

try {
    const rootElement = document.getElementById("root");
    console.log("Root element found:", rootElement);

    if (!rootElement) {
        throw new Error("Failed to find the root element");
    }

    const root = createRoot(rootElement);
    console.log("Root created, rendering App...");
    root.render(<App />);
    console.log("Render method called successfully");
} catch (error) {
    console.error("Error during app initialization:", error);
}

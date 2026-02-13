import ReactDOM from "react-dom/client";
import "@mysten/dapp-kit/dist/index.css";
import App from "./App";
import { AppProviders } from "@app/providers/AppProviders";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <App />
  </AppProviders>
);

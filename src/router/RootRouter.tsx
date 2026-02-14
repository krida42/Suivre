import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LandingPage } from "@pages/LandingPage";
import { PresentationPage } from "@pages/PresentationPage";
import { AppShell } from "@router/AppShell";

export function RootRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/presentation" element={<PresentationPage />} />
        <Route path="/app/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}

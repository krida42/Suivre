import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingView } from "./views/LandingView";
import { AppView } from "./views/AppView";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/app/*" element={<AppView />} />
      </Routes>
    </BrowserRouter>
  );
}

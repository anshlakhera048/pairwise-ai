import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Arena } from "./pages/Arena";
import { Dashboard } from "./pages/Dashboard";
import { ParticipantDetail } from "./pages/ParticipantDetail";
import { Participants } from "./pages/Participants";
import { Rankings } from "./pages/Rankings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/participants" element={<Participants />} />
          <Route path="/participants/:id" element={<ParticipantDetail />} />
          <Route path="/arena" element={<Arena />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route
            path="*"
            element={
              <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
                <p className="font-display text-3xl text-ink">Lost your date?</p>
                <p className="mt-2 text-sm text-stone-500">That page doesn't exist.</p>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

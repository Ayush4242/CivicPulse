import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "./ProtectedRoute";
import Home from "../pages/Home";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import ReportIncident from "../pages/ReportIncident";
import IncidentDetails from "../pages/IncidentDetails";
import ModeratorDashboard from "../pages/ModeratorDashboard";
import StaffDashboard from "../pages/StaffDashboard";
import AdminDashboard from "../pages/AdminDashboard";
import Leaderboard from "../pages/Leaderboard";
import NotFound from "../pages/NotFound";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        <Route element={<MainLayout />}>

          <Route path="/" element={<Home />} />
          <Route path="/leaderboard" element={<Leaderboard />} />

          <Route
            path="/incidents/:id"
            element={<IncidentDetails />}
          />

          <Route element={<ProtectedRoute />}>

            <Route
              path="/report"
              element={<ReportIncident />}
            />

            <Route
              path="/moderator"
              element={<ModeratorDashboard />}
            />

            <Route
              path="/staff"
              element={<StaffDashboard />}
            />

            <Route
              path="/admin"
              element={<AdminDashboard />}
            />

          </Route>

          <Route path="/login" element={<Login />} />

          <Route path="/signup" element={<Signup />} />

        </Route>

        <Route path="*" element={<NotFound />} />

      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
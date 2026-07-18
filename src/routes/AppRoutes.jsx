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
import NotFound from "../pages/NotFound";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        <Route element={<MainLayout />}>

          <Route path="/" element={<Home />} />

          <Route
            path="/incidents/:id"
            element={<IncidentDetails />}
          />

          <Route element={<ProtectedRoute />}>

  <Route
    path="/report"
    element={<ReportIncident />}
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
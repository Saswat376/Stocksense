import { Routes, Route } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";

import DashboardPage from "../pages/DashboardPage";
import ProductsPage from "../pages/ProductsPage";
import ReceiptsPage from "../pages/ReceiptsPage";
import DeliveriesPage from "../pages/DeliveriesPage";
import TransfersPage from "../pages/TransfersPage";
import AdjustmentsPage from "../pages/AdjustmentsPage";
import MoveHistoryPage from "../pages/MoveHistoryPage";
import StockPage from "../pages/StockPage";
import WarehousesPage from "../pages/WarehousesPage";
import LocationsPage from "../pages/LocationsPage";
import ProfilePage from "../pages/ProfilePage";

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>

        <Route path="/" element={<DashboardPage />} />

        <Route
          path="/products"
          element={<ProductsPage />}
        />

        <Route
          path="/operations/receipts"
          element={<ReceiptsPage />}
        />

        <Route
          path="/operations/deliveries"
          element={<DeliveriesPage />}
        />

        <Route
          path="/operations/transfers"
          element={<TransfersPage />}
        />

        <Route
          path="/operations/adjustments"
          element={<AdjustmentsPage />}
        />

        <Route
          path="/move-history"
          element={<MoveHistoryPage />}
        />

        <Route
          path="/stock"
          element={<StockPage />}
        />

        <Route
          path="/settings/warehouses"
          element={<WarehousesPage />}
        />

        <Route
          path="/settings/locations/1"
          element={<LocationsPage />}
        />

        <Route
          path="/profile"
          element={<ProfilePage />}
        />

      </Route>
    </Routes>
  );
}

export default AppRoutes;
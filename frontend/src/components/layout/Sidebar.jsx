import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="sidebar">
      <h2>StockSense</h2>

      <nav>
        <NavLink to="/">Dashboard</NavLink>

        <NavLink to="/products">Products</NavLink>

        <div className="sidebar-section">
          <p>Operations</p>

          <NavLink to="/operations/receipts">
            Receipts
          </NavLink>

          <NavLink to="/operations/deliveries">
            Deliveries
          </NavLink>

          <NavLink to="/operations/transfers">
            Transfers
          </NavLink>

          <NavLink to="/operations/adjustments">
            Adjustments
          </NavLink>
        </div>

        <NavLink to="/move-history">
          Move History
        </NavLink>

        <NavLink to="/stock">
          Stock
        </NavLink>

        <div className="sidebar-section">
          <p>Settings</p>

          <NavLink to="/settings/warehouses">
            Warehouses
          </NavLink>

          <NavLink to="/settings/locations/1">
            Locations
          </NavLink>
        </div>

        <NavLink to="/profile">
          Profile
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
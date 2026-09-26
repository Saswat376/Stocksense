const express = require("express");

const dashboardRoutes = require("./routes/dashboard.routes");
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const warehouseRoutes = require("./routes/warehouse.routes");
const locationRoutes = require("./routes/location.routes");
const receiptRoutes = require("./routes/receipt.routes");
const deliveryRoutes = require("./routes/delivery.routes");
const transferRoutes = require("./routes/transfer.routes");
const adjustmentRoutes = require("./routes/adjustment.routes");
const moveRoutes = require("./routes/move.routes");
const stockRoutes = require("./routes/stock.routes");
const settingsRoutes = require("./routes/settings.routes");

const app = express();

app.use(express.json());

// API routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/adjustments", adjustmentRoutes);
app.use("/api/moves", moveRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/settings", settingsRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "StockSense backend is running!"
  });
});

module.exports = app;
const express = require("express");

const router = express.Router();

router.get("/kpis", (req, res) => {
  res.json({
    message: "Dashboard KPI API is working",
    data: {
      totalProducts: 0,
      totalStock: 0,
      pendingReceipts: 0,
      pendingDeliveries: 0
    }
  });
});

module.exports = router;
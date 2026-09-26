const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Receipts API is working",
    data: []
  });
});

module.exports = router;

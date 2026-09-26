const express = require("express");

const router = express.Router();

// GET all products
router.get("/", (req, res) => {
  res.json({
    message: "Products API is working",
    data: []
  });
});

module.exports = router;
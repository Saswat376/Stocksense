const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Stock API is working",
    data: []
  });
});

module.exports = router;

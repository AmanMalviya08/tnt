const express = require("express");
const { webhook } = require("../controller/checkoutController");
const router = express.Router();

router.post('/webhook',webhook)

module.exports =router
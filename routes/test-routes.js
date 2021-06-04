const express = require('express');
const { check } = require('express-validator')

const checkAuth = require("../middleware/check-auth")

const router = express.Router();

router.get('/', (req, res) => {
    res.send("test route, unsecured");
})

router.use(checkAuth)

router.get('/secured', (req, res) => {
    res.send("test route, secured");
})

module.exports = router;
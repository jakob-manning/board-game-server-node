const express = require('express');
const { check } = require('express-validator')

const usersControllers = require("../controllers/users-controller")
const checkAuth = require("../middleware/check-auth")

const router = express.Router();

router.get('/', usersControllers.getUsers)

router.post(
    '/signup',
    [
        check('name').notEmpty(),
        check('email').normalizeEmail({all_lowercase: true}).isEmail(),
        check('password').isLength({min:6})
    ],
    usersControllers.signUp
)

router.post('/login',
    [
        check('email').normalizeEmail({all_lowercase: true}).isEmail(),
        check('password').isLength({min:8})
    ],
    usersControllers.login
)

router.delete('/:uid',
    [
        check('email').normalizeEmail({all_lowercase: true}).isEmail(),
        check('password').isLength({min:8})
    ],
    usersControllers.deleteUser
)

router.get('/activate/:activationToken',
    usersControllers.activateFromToken
)

router.use(checkAuth)

router.get('/resendVerificationEmail',
    usersControllers.resendVerificationToken
)

router.post('/refreshToken',
    usersControllers.refreshToken
)

module.exports = router;
const express = require('express');
const { check } = require('express-validator')

const usersControllers = require("../controllers/users-controller")
const checkAuth = require("../middleware/check-auth")
const checkActivation = require("../middleware/check-activation")

const router = express.Router();

router.post(
    '/signup',
    [
        check('name').notEmpty().isLength({max:20}),
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

router.use(checkActivation)

router.get('/', usersControllers.getUserList)

router.get('/all', usersControllers.getUsers)

router.post('/refreshToken',
    usersControllers.refreshToken
)

module.exports = router;
const express = require('express');
const { check } = require('express-validator')

const chatRoomControllers = require("../controllers/chatRoom-httpController")
const checkAuth = require("../middleware/check-auth")

const router = express.Router();

router.get('/',chatRoomControllers.getChatRooms)

router.get('/:id',chatRoomControllers.getRoomByID)

router.get('/byName/:name',chatRoomControllers.getRoomByName)

router.use(checkAuth)

router.post('/newRoom',
    [
        check('name').notEmpty().isLength({max:20}).trim().isAlphanumeric(),
        check('description').isLength({max:50})
    ],
    chatRoomControllers.createRoom)

router.patch('/:id',
    [
        check('name').notEmpty().isLength({max:20}),
        check('description').isLength({max:50})
    ],
    chatRoomControllers.updateRoom)

router.delete('/:id', chatRoomControllers.deleteRoom)

module.exports = router;
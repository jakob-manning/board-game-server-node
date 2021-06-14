const express = require('express');
const { check } = require('express-validator')

const chatRoomControllers = require("../controllers/ChatRooms/chatRoom-httpController")
const chatRoomPermissions = require("../controllers/ChatRooms/chatRoom-PermissionsController")
const checkAuth = require("../middleware/check-auth")

const router = express.Router();

router.use(checkAuth)

router.get('/',chatRoomControllers.getUserChatRooms)

router.get('/all',chatRoomControllers.getChatRooms)

router.get('/:id',chatRoomControllers.getRoomByID)

router.get('/byName/:name',chatRoomControllers.getRoomByName)

router.post('/addUsers/:roomID',chatRoomPermissions.addUsersToRoom)

router.post('/addUser/:roomID', [
    check('memberToAdd').notEmpty()
], chatRoomPermissions.addUserToRoom)

// router.post('/joinRoom/:roomJoinSecret',chatRoomPermissions.joinRoomBySecret)

router.post('/removeUser/:roomID',[
    check('memberToRemove').notEmpty()
], chatRoomPermissions.removeUserFromRoom)

router.post('/newRoom',
    [
        check('name').trim().notEmpty().isLength({max:50}),
        check('description').trim().isLength({max:250})
    ],
    chatRoomControllers.createRoom)

router.patch('/:id',
    [
        check('name').trim().notEmpty().isLength({max:50}),
        check('description').trim().isLength({max:250})
    ],
    chatRoomControllers.updateRoom)

router.delete('/:id', chatRoomControllers.deleteRoom)

module.exports = router;
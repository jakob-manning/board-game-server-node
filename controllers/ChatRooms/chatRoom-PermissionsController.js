const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose")
const {validationResult} = require("express-validator");

const Room = require("../../models/chatRoom");
const User = require("../../models/user")
const HttpError = require("../../models/http-error");

const SERVER_TOKEN_KEY = process.env.WEB_TOKEN_SECRET_KEY;

let chatRoomPermissions = {

    // --- ADD USERS TO ROOM ---
    addUsersToRoom: async (req, res, next) => {
        let {membersToAdd} = req.body
        const roomID = req.params.roomID;

        // Check validity of membersToAdd
        if(!membersToAdd){
            return next(new HttpError("No users added, you didn't send us any.", 403))
        }

        // Check validity of membersToAdd
        membersToAdd.forEach( (member, index) =>{
            if(typeof member !== "string"){
                return next(new HttpError("Those don't look like valid users.", 403))
            }
        })

        // Get Room
        let room
        try {
            room = await Room.findById(roomID, '-password')
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find your room.", 500))
        }
        if(!room){
            return next(new HttpError("That room doesn't exist. Maybe try creating it first?", 500))
        }

        // If room is not "open"
        if(!room.open){
            // Verify that user is an admin of this room
            try{
                let admin = room.admin.find( userID => userID.toString() === req.userData.userID)
                if(!admin){
                    return next(new HttpError("Tsk Tsk. you need to be admin to edit that room", 403))
                }
            } catch (e) {
                return next(new HttpError("Maybe we're crazy, but it looks like your room doesn't exist.", 404))
            }
        }

        // Push users to Room
        let memberCheck = {}
        room.members.forEach(member => memberCheck[member.toString()] = true)

        membersToAdd = membersToAdd.filter( member => !memberCheck[member])
        if(membersToAdd.length === 0){
            return next(new HttpError("All of those users are already in this room.", 403))
        }
        membersToAdd.forEach( member => room.members.push(member))

        // Update Room and Users
        try {
            const sess = await mongoose.startSession();
            sess.startTransaction();

            await room.save({session: sess})

            for( let member of membersToAdd){
                let user = await User.findById(member, '-password');
                if(!user){
                    throw new Error()
                }
                console.log("current user is: " + user)

                if(!user.chatRooms){
                    user.chatRooms = []
                }

                if(user.chatRooms.find(item => item === roomID)){
                    console.log("user already added to this room")
                    continue
                }
                else {
                    user.chatRooms.push(roomID)
                    await user.save({session: sess})
                }
            }

            // Complete Transaction
            await sess.commitTransaction()
        } catch (e) {
            console.log(e);
            return next(new HttpError("Couldn't add users to room.", 500))
        }

        res.json({
            room: room.toObject({getters: true}),
        })
    },

    // --- Add USER TO ROOM ---
    addUserToRoom: async (req, res, next) => {
        const errors = validationResult(req)
        if ( !errors.isEmpty() ) {
            return next(new HttpError("Please provide a valid member to add.", 422))
        }

        let {memberToAdd} = req.body
        const roomID = req.params.roomID;

        // Get Room
        let room
        try {
            room = await Room.findById(roomID, '-password')
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find your room.", 500))
        }
        if(!room){
            return next(new HttpError("That room doesn't exist. Maybe try using the app properly?", 500))
        }

        // If room is not "open"
        if(!room.open) {
            // Verify that the current user is an admin of this room
            try {
                let admin = room.admin.find(userID => userID.toString() === req.userData.userID)
                if ( !admin ) {
                    return next(new HttpError("Tsk Tsk. you need to be admin to edit this room", 403))
                }
            }catch (e) {
                return next(new HttpError("Maybe we're crazy, but it looks like your room doesn't exist.", 404))
            }
        }

        // Add user to Room
        if(room.members.find(member => member.toString() === memberToAdd)){
            return next(new HttpError("Silly Willy, that user is already in this room", 401))
        }
        room.members.push(memberToAdd)

        // Update Room and Users
        try {
            const sess = await mongoose.startSession();
            sess.startTransaction();

            await room.save({session: sess})

            let user = await User.findById(memberToAdd, '-password');
            if(!user){
                return next(new HttpError("That user doesn't exist. What are you trying to do?", 401))
            }

            // Check if user is already in this chatroom
            if(user.chatRooms.find(item => item.toString() === roomID)){
                return next(new HttpError("That user is already here. Did you break our site?", 401))
            }
            user.chatRooms.push(roomID)
            await user.save({session: sess})

            await sess.commitTransaction()
        } catch (e) {
            console.log(e);
            return next(new HttpError("Couldn't add user to room.", 500))
        }

        res.json({
            room: room.toObject({getters: true}),
        })
    },

    // --- REMOVE USER FROM ROOM ---
    removeUserFromRoom: async (req, res, next) => {
        const errors = validationResult(req)
        if ( !errors.isEmpty() ) {
            return next(new HttpError("Please provide a valid member to remove.", 422))
        }

        let {memberToRemove} = req.body
        const roomID = req.params.roomID;

        // Get Room
        let room
        try {
            room = await Room.findById(roomID, '-password')
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find your room.", 500))
        }
        if(!room){
            return next(new HttpError("That room doesn't exist. Maybe try using the app properly?", 500))
        }

        // Verify that the current user is an admin of this room
        try{
            let admin = room.admin.find( userID => userID.toString() === req.userData.userID)
            if(!admin){
                return next(new HttpError("Tsk Tsk. you need to be admin to edit this room", 403))
            }
        } catch (e) {
            return next(new HttpError("Maybe we're crazy, but it looks like your room doesn't exist.", 404))
        }

        // Remove user from Room
        room.members = room.members.filter( member => member.toString() !== memberToRemove)
        room.admin = room.admin.filter( admin => admin.toString() !== memberToRemove)

        // Verify that there are still admin left
        if(room.admin.length === 0){
            return next(new HttpError("You can't remove yourself if you're the only admin. Do you want to delete the room instead?", 401))
        }

        // Update Room and Users
        try {
            const sess = await mongoose.startSession();
            sess.startTransaction();

            await room.save({session: sess})

            let user = await User.findById(memberToRemove, '-password');
            if(!user){
                return next(new HttpError("That user doesn't exist. What are you trying to do?", 500))
            }
            user.chatRooms = user.chatRooms.filter(item => item.toString() !== roomID)
            await user.save({session: sess})

            await sess.commitTransaction()
        } catch (e) {
            console.log(e);
            return next(new HttpError("Couldn't remove user from room.", 500))
        }

        res.json({
            room: room.toObject({getters: true}),
        })
    },
}

module.exports = chatRoomPermissions;
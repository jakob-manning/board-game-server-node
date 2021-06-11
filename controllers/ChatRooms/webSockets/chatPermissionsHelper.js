const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose")
const {validationResult} = require("express-validator");

const Room = require("../../../models/chatRoom");
const User = require("../../../models/user")
const HttpError = require("../../../models/http-error");

const SERVER_TOKEN_KEY = process.env.WEB_TOKEN_SECRET_KEY;

let chatRoomPermissions = {

    // --- ADD USERS TO ROOM ---
    addUsersToRoom: async (data, socket, io, liveSockets) => {
        let {roomID, membersToAdd} = data
        const userID = socket.userData.userID;

        // Check validity of membersToAdd
        if(!membersToAdd){
            return socket.emit("error", "No users added to chat because you didn't provide any.")
        }

        // Check validity of membersToAdd
        membersToAdd.forEach( (member, index) =>{
            if(typeof member !== "string"){
                return socket.emit("error", "Those don't look like valid users.")
            }
        })

        // Get Room
        let room
        try {
            room = await Room.findById(roomID, '-password')
        } catch (e) {
            console.log(e);
            return socket.emit("error", "Something went wrong, couldn't find your room.")
        }
        if(!room){
            return socket.emit("error", "That room doesn't exist. Maybe try creating it first?")
        }

        // If room is not "open"
        if(!room.open){
            // Verify that user is an admin of this room
            try{
                let admin = room.admin.find( userID => userID.toString() === userID)
                if(!admin){
                    return socket.emit("error", "Tsk Tsk. you need to be admin to edit that room")
                }
            } catch (e) {
                return socket.emit("error", "Maybe we're crazy, but it looks like your room doesn't exist.")
            }
        }

        // Push users to Room
        let memberCheck = {}
        room.members.forEach(member => memberCheck[member.toString()] = true)

        membersToAdd = membersToAdd.filter( member => !memberCheck[member])
        if(membersToAdd.length === 0){
            return socket.emit("error", "All of those users are already in this room.")
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
            return socket.emit("error", "Couldn't add users to room.")
        }

        // Broadcast the new room to all users
        membersToAdd.forEach( member => {
            if(liveSockets[member.id]){
                console.log("liveSockets[member.id]")
                console.log(liveSockets[member.id])
                liveSockets[member.id].forEach( connection => {
                    console.log("room")
                    console.log(room)
                    io.to(connection).emit("newRoom", room)
                })
            }
        })

        // Respond with a heads up that it worked
        return socket.emit("confirmation", {
            message: "Success, users added!",
            data: { room: room.toObject({getters: true})}
        })
    },

    // --- Add USER TO ROOM ---
    addUserToRoom: async (data, socket, io, liveSockets) => {
        let {roomID, memberToAdd} = data
        const userID = socket.userData.userID;

        // Get Room
        let room
        try {
            room = await Room.findById(roomID, '-password')
        } catch (e) {
            console.log(e);
            return socket.emit("error", "Something went wrong, couldn't find your room.")
        }
        if(!room){
            return socket.emit("error", "That room doesn't exist. Maybe try using the app properly?")
        }

        // If room is not "open"
        if(!room.open) {
            // Verify that the current user is an admin of this room
            try {
                let admin = room.admin.find(userID => userID.toString() === userID)
                if ( !admin ) {
                    return socket.emit("error", "Tsk Tsk. you need to be admin to edit this room")
                }
            }catch (e) {
                return socket.emit("error", "Maybe we're crazy, but it looks like your room doesn't exist.")
            }
        }

        // Add user to Room
        if(room.members.find(member => member.toString() === memberToAdd)){
            return socket.emit("error", "Silly Willy, that user is already in this room")
        }
        room.members.push(memberToAdd)

        // Update Room and Users
        try {
            const sess = await mongoose.startSession();
            sess.startTransaction();

            await room.save({session: sess})

            let user = await User.findById(memberToAdd, '-password');
            if(!user){
                return socket.emit("error", "That user doesn't exist. What are you trying to do?")
            }

            // Check if user is already in this chatroom
            if(user.chatRooms.find(item => item.toString() === roomID)){
                return socket.emit("error", "That user is already here. Did you break our site?")
            }
            user.chatRooms.push(roomID)
            await user.save({session: sess})

            await sess.commitTransaction()
        } catch (e) {
            console.log(e);
            return socket.emit("error", "Couldn't add user to room.")
        }

        if(liveSockets[member.id]){
            liveSockets[member.id].forEach( connection => {
                io.to(connection).emit("newRoom", room)
            })
        }
    },

    // --- REMOVE USER FROM ROOM ---
    removeUserFromRoom: async (data, socket, io, liveSockets) => {
        let {roomID, memberToRemove} = data
        const userID = socket.userData.userID;

        // Get Room
        let room
        try {
            room = await Room.findById(roomID, '-password')
        } catch (e) {
            console.log(e);
            return socket.emit("error", "Something went wrong, couldn't find your room.")
        }
        if(!room){
            return socket.emit("error", "That room doesn't exist. Maybe try using the app properly?")
        }

        // Verify that the current user is an admin of this room
        try{
            let admin = room.admin.find( userID => userID.toString() === userID)
            if(!admin){
                return socket.emit("error", "Tsk Tsk. you need to be admin to edit this room")
            }
        } catch (e) {
            return socket.emit("error", "Maybe we're crazy, but it looks like your room doesn't exist.")
        }

        // Remove user from Room
        room.members = room.members.filter( member => member.toString() !== memberToRemove)
        room.admin = room.admin.filter( admin => admin.toString() !== memberToRemove)

        // Verify that there are still admin left
        if(room.admin.length === 0){
            return socket.emit("error", "You can't remove yourself if you're the only admin. Do you want to delete the room instead?")
        }

        // Update Room and Users
        try {
            const sess = await mongoose.startSession();
            sess.startTransaction();

            await room.save({session: sess})

            let user = await User.findById(memberToRemove, '-password');
            if(!user){
                return socket.emit("error", "That user doesn't exist. What are you trying to do?")
            }
            user.chatRooms = user.chatRooms.filter(item => item.toString() !== roomID)
            await user.save({session: sess})

            await sess.commitTransaction()
        } catch (e) {
            console.log(e);
            return socket.emit("error", "Couldn't remove user from room.")
        }

        if(liveSockets[member.id]){
            liveSockets[member.id].forEach( connection => {
                io.to(connection).emit("roomDeleted", {roomID: room.id})
            })
        }
    },
}

module.exports = chatRoomPermissions;
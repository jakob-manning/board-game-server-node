const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose")
const {validationResult} = require("express-validator");

const Room = require("../../models/chatRoom");
const User = require("../../models/user")
const HttpError = require("../../models/http-error");

const SERVER_TOKEN_KEY = process.env.WEB_TOKEN_SECRET_KEY;

let chatRoomHttpController = {
    // --- GET ROOMS ---
    getChatRooms: async (req, res, next) => {
        let rooms;
        try {
            rooms = await Room.find({}, '-password');
        }catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find rooms.", 500))
        }
        if ( !rooms ) {
            return next(new HttpError("Looks like you don't have any chat rooms yet.", 500))
        }

        // res.json({rooms: rooms.map(room => room.toObject({getters: true}))})
        // res.json({rooms: rooms.map(room => room)})
        res.json({rooms: rooms.map(room => room.toObject({getters: true, flattenMaps: true}))})
    },

    // --- GET ALL CHAT ROOMS FOR A USER ---
    getUserChatRooms: async (req, res, next) => {
        // Get user records
        let user;
        console.log(req.userData.userID)
        try {
            user = await User.findById(req.userData.userID, '-password');
        }catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find your user info.", 500))
        }
        if ( !user ) {
            return next(new HttpError("Have you eaten recently? The database says you don't exist.", 500))
        }

        // Get all of the chat rooms for this user
        if(!user.chatRooms){
            return next(new HttpError("Looks like you don't have any chat rooms yet.", 500))
        }

        let rooms;
        try {
            rooms = await Room.find( {'_id': { $in: user.chatRooms}}, '-password')
        }catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't load your chat rooms.", 500))
        }
        if ( !rooms ) {
            return next(new HttpError("Looks like you don't have any chat rooms yet.", 500))
        }

        res.json({rooms: rooms.map(room => room.toObject({getters: true, flattenMaps: true}))})
        // res.json({rooms: rooms.map(room => room)})
    },

    // --- GET ROOM BY NAME ---
    getRoomByName: async (req, res, next) => {
        const name = req.params.name;
        let rooms;
        try {
            rooms = await Room.find({name: name}, '-password');
        }catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find room.", 500))
        }

        if ( !rooms ) {
            return next(new HttpError("Couldn't find a room with that name.", 404))
        }

        res.json({room: rooms[0].toObject({getters: true})})
    },

    // --- GET ROOM BY ID ---
    getRoomByID: async (req, res, next) => {
        const id = req.params.id;
        let room;
        try {
            room = await Room.findById(id, '-password');
        }catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find room.", 500))
        }

        if ( !room ) {
            return next(new HttpError("Couldn't find that room.", 404))
        }

        res.json({room: room.toObject({getters: true})})
    },

    // --- CLEAN UP OLD ROOMS ---
    // Removes rooms that haven't been used in 20 days
    cleanUpChatRooms: async (req, res, next) => {
        let rooms;
        let today = new Date()
        try {
            rooms = await Room.remove({lastUsed: {$lte: today.setDate(today.getDate() - 20)}});
        }catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find rooms.", 500))
        }

        res.json({roomsRemoved: rooms.map(room => room.toObject({getters: true}))})
    },

    //  -- CREATE ROOM --
    createRoom: async (req, res, next) => {
        const errors = validationResult(req)
        if ( !errors.isEmpty() ) {
            return next(new HttpError("Please provide valid room details.", 422))
        }

        const {name, description, open, password} = req.body
        const creator = req.userData.userID

        // check if Room name already exists
        let room;
        try {
            room = await Room.findOne({name})
        }catch (e) {
            return next(new HttpError("Something went wrong, couldn't complete setup.", 500))
        }

        if ( !!room ) {
            return next(new HttpError("There's already a room with that name. Please try to be more creative.", 403))
        }

        // create room
        let newRoom = new Room({
            name,
            description,
            password,
            creator,
            open,
            admin: [creator],
            members: [creator],
            dateCreated: new Date(),
            lastUpdated: new Date(),
            updatedBy: creator,
        })

        // Get creators details
        let user
        try{
            user = await User.findById(req.userData.userID)
        } catch (e) {
            return next(new HttpError("Something went wrong, couldn't complete setup.", 500))
        }
        if(!user){
            return next(new HttpError("Are you feeling alright? The database says you don't exist.", 403))
        }

        // write room to database and add room to creators list
        try {
            const sess = await mongoose.startSession();
            sess.startTransaction();
            newRoom = await newRoom.save({session: sess});
            // Update user here
            user.chatRooms.push(newRoom._id)
            await user.save({session: sess})
            await sess.commitTransaction()
        }catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't create room. Please try again."), 403)
        }

        // return token
        res
            .status(201)
            .json({
                message: "new room created!",
                roomId: newRoom.id,
                name: newRoom.name,
                creator: newRoom.creator,
                admin: newRoom.admin,
                members: newRoom.members,
            });
    },

    // -- UPDATE ROOM ---
    updateRoom: async (req, res, next) => {
        const errors = validationResult(req)
        if ( !errors.isEmpty() ) {
            console.log(errors)
            return next(new HttpError("Please provide a valid room description.", 422))
        }

        const {name, description} = req.body

        const roomID = req.params.id;
        const userID = req.userData.userID

        // verify that user can update room
        let room;
        try {
            room = await Room.findById(roomID)
        }catch (e) {
            return next(new HttpError("Something went wrong, couldn't complete update.", 500))
        }

        if ( !room ) {
            return next(new HttpError("There's no room with that id. Go figure.", 403))
        }

        if ( room.creator.toString() !== userID ) {
            return next(new HttpError("I'm afraid I can't do that Dave. You're not an admin of this room."), 403)
        }

        //make requested changes
        try {
            room = await Room.findByIdAndUpdate(roomID, {name, description})
        }catch (e) {
            console.log(e)
            return next(new HttpError("Something went wrong, couldn't find a room.", 500))
        }

        // return
        res
            .status(201)
            .json({
                message: "update successful",
                userId: room.id,
                oldName: room.name,
                newName: name,
                oldDescription: room.description,
                newDescription: description
            });

        return next()
    },

    //  -- DELETE ROOM --
    deleteRoom: async (req, res, next) => {
        const errors = validationResult(req)
        if ( !errors.isEmpty() ) {
            console.log(errors)
            return next(new HttpError("Please provide valid room details.", 422))
        }

        const roomID = req.params.id;
        const userID = req.userData.userID

        // verify that user can delete room
        let room;
        try {
            room = await Room.findById(roomID)
        }catch (e) {
            return next(new HttpError("Something went wrong, couldn't complete delete.", 500))
        }

        if ( !room ) {
            return next(new HttpError("There's no room with that id. Go figure.", 403))
        }

        if ( room.creator.toString() !== userID ) {
            return next(new HttpError("I'm afraid I can't do that Dave. You're not an admin of this room."), 403)
        }

        // remove room (overbuilt for future proofing)
        try {
            const sess = await mongoose.startSession();
            sess.startTransaction();
            await room.remove({session: sess});
            // remove room record from users lists as well
            for(let userID of room.members){
                let user = await User.findById(userID, '-password')
                user.chatRooms = user.chatRooms.filter(item => item.toString() !== roomID)
                await user.save({session: sess})
            }
            await sess.commitTransaction()
        }catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't delete room.", 500))
        }

        // return
        res
            .status(201)
            .json({
                message: "delete successful",
                userId: room.id,
                name: room.name
            });
    },


};

module.exports = chatRoomHttpController;
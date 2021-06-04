const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose")
const { validationResult } = require("express-validator");

const Room = require("../models/chatRoom");
const HttpError = require("../models/http-error");

const SERVER_TOKEN_KEY = process.env.WEB_TOKEN_SECRET_KEY;

let chatRoomHttpController = {
    // --- GET ROOMS ---
    getChatRooms: async (req, res,  next) => {
        let rooms;
        try {
            rooms = await Room.find({}, '-password');
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find rooms.", 500))
        }

        res.json({rooms: rooms.map(room => room.toObject({getters: true}))})
    },

    // --- GET ROOM BY NAME ---
    getRoomByName: async (req, res,  next) => {
        const name = req.params.name;
        let rooms;
        try {
            rooms = await Room.find({name: name}, '-password');
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find room.", 500))
        }

        if(!rooms){
            return next(new HttpError("Couldn't find a room with that name.", 404))
        }

        res.json({room: rooms[0].toObject({getters: true})})
    },

    // --- GET ROOM BY ID ---
    getRoomByID: async (req, res,  next) => {
        const id = req.params.id;
        let room;
        try {
            room = await Room.findById(id, '-password');
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find room.", 500))
        }

        if(!room){
            return next(new HttpError("Couldn't find that room.", 404))
        }

        res.json({room: room.toObject({getters: true})})
    },

    // --- CLEAN UP OLD ROOMS ---
    // Removes rooms that haven't been used in 20 days
    cleanUpChatRooms: async (req, res,  next) => {
        let rooms;
        let today = new Date()
        try {
            rooms = await Room.remove({lastUsed: { $lte: today.setDate(today.getDate() - 20) }});
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find rooms.", 500))
        }

        res.json({roomsRemoved: rooms.map(room => room.toObject({getters: true}))})
    },

    //  -- CREATE ROOM --
    createRoom: async (req, res, next) => {
        const errors = validationResult(req)
        if(!errors.isEmpty()){
            return next(new HttpError("Please provide valid room details.", 422))
        }

        const {name, description, password} = req.body
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
        const newRoom = new Room({
            name,
            description,
            password,
            creator,
            dateCreated: new Date(),
            lastUsed: new Date(),
        })

        // write room to database
        try{
            await newRoom.save();
        } catch (e) {
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
            });
    },

    // -- UPDATE ROOM ---
    updateRoom: async (req, res, next) => {
        const errors = validationResult(req)
        if(!errors.isEmpty()){
            console.log(errors)
            return next(new HttpError("Please provide valid room details.", 422))
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
        } catch (e) {
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
        if(!errors.isEmpty()){
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
            await room.remove( {session: sess});
            // TODO: delete room record from users lists as well (once this has been implemented)
            await sess.commitTransaction()
        } catch (e) {
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
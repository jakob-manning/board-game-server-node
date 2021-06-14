const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const bcrypt = require('bcrypt');

const Schema = mongoose.Schema;

const messageSchema = new Schema({
    message: {type: String, required: true},
    userName: {type: String, required: true, ref: 'User'},
    userID: {type: mongoose.Types.ObjectId, required: true, ref: 'User'},
    timeStamp: {type: Date, required: true, default: new Date()},
    tempID: {type: String, required: false},
})

const chatRoomSchema = new Schema({
    name: {type: String, required: true},
    description: {type: String, required: false},
    dateCreated: {type: Date, required: true},
    lastUpdated: {type: Date, required: true},
    open: {type: Boolean, required: false, default: false},
    updatedBy: {type: mongoose.Types.ObjectId, required: true, ref: 'User'},
    creator: {type: mongoose.Types.ObjectId, required: true, ref: 'User'},
    admin: [{type: mongoose.Types.ObjectId, required: false, ref: 'User'}],
    members: [{type: mongoose.Types.ObjectId, required: false, ref: 'User'}],
    password: {type: String, required: false, minlength: 6},
    messages: [messageSchema],
    membersRead: {type: Map, required: false, of: Boolean},
})

chatRoomSchema.plugin(uniqueValidator);

module.exports = mongoose.model("ChatRoom", chatRoomSchema)

// exports.ChatRoom = mongoose.model("ChatRoom", chatRoomSchema)

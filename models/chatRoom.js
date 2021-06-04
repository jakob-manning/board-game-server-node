const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const bcrypt = require('bcrypt');

const Schema = mongoose.Schema;

const chatRoomSchema = new Schema({
    name: {type: String, required: true},
    description: {type: String, required: false},
    dateCreated: {type: Date, required: true},
    lastUsed: {type: Date, required: true},
    creator: {type: mongoose.Types.ObjectId, required: true, ref: 'User'},
    owners: [{type: mongoose.Types.ObjectId, required: false, ref: 'User'}],
    members: [{type: mongoose.Types.ObjectId, required: false, ref: 'User'}],
    password: {type: String, required: false, minlength: 6},
})

chatRoomSchema.methods.isValidPassword = async function (password) {
    const room = this;
    const compare = await bcrypt.compare(password, room.password);
    return compare;
}

chatRoomSchema.plugin(uniqueValidator);

module.exports = mongoose.model("ChatRoom", chatRoomSchema)
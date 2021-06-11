const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const bcrypt = require('bcrypt');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {type: String, required: true, maxLength: 20, unique: true},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true, minlength: 6},
    active: {type: Boolean, required: false, default: false},
    chatRooms: [{type: mongoose.Types.ObjectId, required: false, ref: 'ChatRoom'}],
})

userSchema.methods.isValidPassword = async function (password) {
    const user = this;
    const compare = await bcrypt.compare(password, user.password);
    return compare;
}

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model("User", userSchema)
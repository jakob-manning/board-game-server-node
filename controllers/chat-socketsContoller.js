const checkAuth = require("../middleware/check-auth")
const jwt = require("jsonwebtoken");
const Room = require("../models/chatRoom");
const { v4: uuidv4 } = require('uuid');

const SERVER_TOKEN_KEY = process.env.WEB_TOKEN_SECRET_KEY

const socketHistory = {}

// const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);

module.exports = (io,app) => {

    io.use( async (socket, next) => {
        try {
            //extract token from headers
            const token = socket.handshake.auth.token;
            console.log(`token is: ${token}`)
            if (!token){
                return next(new Error("Please sign in or refresh!"));
            }
            //expose userId and Token for future middleware
            const decodedToken = await jwt.verify(token, SERVER_TOKEN_KEY);
            //add info to the socketObject
            socket.userData = {userID: decodedToken.userId, email: decodedToken.email, name: decodedToken.name}
            return next();
        } catch (e) {
            return next(new Error("Server error, please try again."));
        }
        return next()
    })

    io.on('connection', (socket) => {
        console.log(`Connected: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`Disconnected: ${socket.id}`)
        });

        socket.on('join', async (room) => {
            console.log(`Socket ${socket.id} joining ${room}`);
            socket.join(room);

            // ask mongoose for room's chat history
            let chatRoom
            try{
                chatRoom = await Room.findById(room)
            } catch (e) {
                console.log(e);
                return socket.emit("error", "Error loading a chat room, please try again.")
            }
            if(!chatRoom){
                return socket.emit("error", "You tried loading a chat room that doesn't exist.")
            }
            if(!chatRoom.messages){
                return socket.emit('roomHistory', {room, history: []});
            }

            let history = chatRoom.messages.map(message => message.toObject({getters: true}))

            socket.emit('roomHistory', {room, history});
        });

        socket.on('chat', async (data) => {

            console.log("userData: " + socket.userData)
            const { message, room } = data;
            console.log(`msg: ${message}, room: ${room}`);
            let newMessage = {
                userID: socket.userData.userID,
                userName: socket.userData.name,
                message
            }

            // store user on the database
            // Find the right parent item
            let chatRoom
            try{
                chatRoom = await Room.findById(room)
            } catch (e) {
                console.log(e);
                return socket.emit("error", "Chatroom error, please try again.")
            }
            if(!chatRoom){
                return socket.emit("error", "Can't find your chat room.")
            }


            // Add message to list
            chatRoom.messages.push(newMessage)

            try{
                await chatRoom.save()
            } catch (e) {
                console.log(e);
                return socket.emit("error", "Couldn't save your message, please try again.")
            }

            console.log("new message saved: " + newMessage)
            io.to(room).emit('chat', newMessage);
        });
    })
}
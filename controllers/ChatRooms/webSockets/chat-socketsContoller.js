const checkAuth = require("../../../middleware/check-auth")
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require('uuid');

const Room = require("../../../models/chatRoom");
const chatPermissionsHelper = require("./chatPermissionsHelper")


const SERVER_TOKEN_KEY = process.env.WEB_TOKEN_SECRET_KEY

const liveSockets = {}

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
        // link socket ID and userID
        if(socket.userData.userID){
            if(!liveSockets[socket.userData.userID]){
                liveSockets[socket.userData.userID] = []
            }
            liveSockets[socket.userData.userID].push(socket.id)
        }

        socket.on('disconnect', () => {
            console.log(`Disconnected: ${socket.id}`)
            // remove user from live sockets
            liveSockets[socket.userData.userID] = liveSockets[socket.userData.userID]
                .filter(item => item !== socket.id)
        });

        socket.on('join', async (room) => {
            console.log(`Socket ${socket.id} joining ${room}`);
            socket.join(room);
        });

        socket.on('chat', async (data) => {

            console.log("userData: " + socket.userData.userID + " " + socket.userData.name)
            const { message, room } = data;
            console.log(`msg: ${message}, room: ${room}`);
            let tempID = uuidv4()
            let newMessage = {
                userID: socket.userData.userID,
                userName: socket.userData.name,
                message,
                timeStamp: new Date(),
                tempID
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

            // Update lastUpdated
            let now = new Date()
            chatRoom.lastUpdated = now
            chatRoom.updatedBy = socket.userData.userID

            try{
                chatRoom = await chatRoom.save()
            } catch (e) {
                console.log(e);
                return socket.emit("error", "Couldn't save your message, please try again.")
            }

            newMessage = chatRoom.messages[chatRoom.messages.length - 1]
            // If last message is current - send it to all users
            if(newMessage.tempID === tempID){
                let payload ={ newMessage: newMessage.toObject({getters: true}), room }
                console.log("new message broadcast: ")
                console.log(newMessage)
                io.to(room).emit('chat', payload);
            }
            // otherwise find the right message and send it to users
            else {
                newMessage = chatRoom.messages.find( message => message.tempID === tempID)
                let payload ={ newMessage: newMessage.toObject({getters: true}), room }
                console.log("new message broadcast: ")
                console.log(newMessage)
                io.to(room).emit('chat', payload);
            }

            // Update user objects with chat state
            // for every user in this chat (except the active user) go to their chats Unread document and change the state
            if(!chatRoom.membersRead){
                chatRoom.membersRead = new Map()
            }
            for(let member of chatRoom.members){
                if(member.toString() === socket.userData.userID){
                    chatRoom.membersRead.set(member.toString(), true)
                }
                else {
                    chatRoom.membersRead.set(member.toString(), false)
                }
            }

            try{
                await chatRoom.save()
            } catch (e) {
                console.log(e);
                return socket.emit("error", "Couldn't save your message, please try again.")
            }

        });

        socket.on('markAsRead', async (data) => {
            const { room } = data;
            const userID = socket.userData.userID;

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
            if(!chatRoom.membersRead){
                chatRoom.membersRead = new Map()
            }
            chatRoom.membersRead.set(userID, true)
            chatRoom.save()
        })

        socket.on('addUsersToRoom', (data) => {
            console.log("Request to Add Users To room")
            chatPermissionsHelper.addUsersToRoom(data, socket, io, liveSockets).then(e=>console.log(e))
        })

        socket.on('addUserToRoom', (data) => {
            chatPermissionsHelper.addUserToRoom(data, socket, io, liveSockets).catch(e=>socket.emit("error", "Couldn't add user to room."))
        })

        socket.on('removeUserFromRoom', (data) => {
            console.log("server received request to remove user from room")
            console.log(data)
            chatPermissionsHelper.removeUserFromRoom(data, socket, io, liveSockets).catch(e=>socket.emit("error", "Couldn't remove user from room."))
        })

    })
}
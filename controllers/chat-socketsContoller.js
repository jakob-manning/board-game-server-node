const checkAuth = require("../middleware/check-auth")
const jwt = require("jsonwebtoken");
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

        socket.on('join', (room) => {
            console.log(`Socket ${socket.id} joining ${room}`);
            socket.join(room);
            if(!socketHistory[room]) socketHistory[room] = []
            socket.emit('roomHistory', {room, history: socketHistory[room]});
        });

        socket.on('chat', (data) => {
            console.log("userData: " + socket.userData)
            const { message, room } = data;
            console.log(`msg: ${message}, room: ${room}`);
            let newMessage = {
                messageID: uuidv4(),
                userID: socket.userData.userID,
                userName: socket.userData.name,
                message
            }
            socketHistory[room] = socketHistory[room] ? [...socketHistory[room], newMessage]: [newMessage]
            console.log(socketHistory[room])
            io.to(room).emit('chat', newMessage);
        });
    })
}
const express = require("express");
const cors = require('cors');
const mongoose = require("mongoose");
const morgan = require("morgan");
require("dotenv").config();

const userRoutes = require('./routes/users-routes')
const testRoutes = require('./routes/test-routes')
const chatRoutes = require('./routes/chatRoom-httpRoutes')

const PORT = process.env.PORT || 3001;

// Start express
const app = express();

// Setup for socket.io
const server = require('http').Server(app);
const io = require('socket.io')(server, {
    cors: {origin: "*"}
});

// Enable all CORS requests for our demo
app.use(cors());

// Error log with morgan
app.use(morgan("dev"));

// parse JSON from the req body
app.use(express.json());

// // Test Route
// app.get('/test',
//     function (req, res) {
//         res.send("hello world");
//     });

// User Routes
app.use('/api/users', userRoutes)

// Test routes
app.use('/test', testRoutes)

// Chat Room routes
app.use('/api/chat', chatRoutes)

require('./controllers/chat-socketsContoller')(io, app)

// // Auth Routes
// app.use('/auth', authRoutes);
//

//Error Handling
app.use((error, req, res, next) => {
    //check if a response has already been sent
    if( res.headerSent){
        return next(error);
    }
    res.status(error.code || 500)
    res.json({message: error.message || "An unknown error occurred"});
})

//Initialize Connection to Mongo-DB
const DB_URI = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.ffn6h.mongodb.net/${process.env.DB_DATABASE}?retryWrites=true&w=majority`
mongoose.connect(DB_URI, {useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false}).catch(e => console.log(e));

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    // Initialize server
    server.listen(PORT, function () {
        console.log(
            `Server running on port:${PORT} 🚀`
        );
    });
});

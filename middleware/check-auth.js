const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const SERVER_TOKEN_KEY = process.env.WEB_TOKEN_SECRET_KEY

module.exports = (req, res, next) => {
    //let option request pass
    if( req.method === "OPTIONS") return next()
    //expose userId and email from token
    try {
        //extract token from headers
        const token = req.headers.authorization.split(" ")[1];
        if (!token){
            return next(new HttpError("Authentication failed!", 403));
        }
        //expose userId and Token for future middleware
        const decodedToken = jwt.verify(token, SERVER_TOKEN_KEY);
        //add info to the req
        req.userData = {userID: decodedToken.userId, email: decodedToken.email}
        return next();
    } catch (e) {
        return next(new HttpError("Authentication failed, please try again", 500));
    }
};
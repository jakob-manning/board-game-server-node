const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const SERVER_TOKEN_KEY = process.env.WEB_TOKEN_SECRET_KEY

module.exports = async (req, res, next) => {
    //let option request pass
    if( req.method === "OPTIONS") return next()

    // Check if they are inactive
    if(req.userData.inactive){
        return next(new HttpError("Your account is not active yet, " +
            "Please check your email for an activation link and then sign in again.", 500))
    }
    return next();
};
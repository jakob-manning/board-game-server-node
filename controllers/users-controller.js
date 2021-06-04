const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose")
const { validationResult } = require("express-validator");

const User = require("../models/user");
const HttpError = require("../models/http-error");

const SERVER_TOKEN_KEY = process.env.WEB_TOKEN_SECRET_KEY;

let usersController = {
    getUsers: async (req, res,  next) => {
        let users;
        try {
            users = await User.find({}, '-password');
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't find users.", 500))
        }
        res.json({users: users.map(user => user.toObject({getters: true}))})
    },

    //  -- SIGN UP --
    signUp: async (req, res, next) => {
        const errors = validationResult(req)
        if(!errors.isEmpty()){
            console.log(errors)
            return next(new HttpError("Please provide a valid name, email, and password.", 422))
        }

        const { name, email, password } = req.body;

        //ensure email isn't already in the database
        let existingUser;
        try {
            existingUser = await User.findOne({email});
        } catch (e) {
            return next(new HttpError("Something went wrong, couldn't create user. Please try typing more gently.", 500))
        }
        if(!!existingUser){
            return next(new HttpError("Unable to create an account, please try again", 422))
        }

        // hash password
        let hashedPassword;
        try{
            hashedPassword = await bcrypt.hash(password, 12);
        } catch (e) {
            return next(new HttpError(("Could not create user, please try again."), 500))
        }

        // create user
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        })

        // store user on the database
        try{
            await newUser.save();
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't create user. Please try again."), 403)
        }

        // generate a token
        let token;
        try {
            token = jwt.sign(
                {userId: newUser.id, email: newUser.email, name: newUser.name},
                SERVER_TOKEN_KEY,
                {expiresIn: "7d"}
            );
        }catch (e) {
            return next(new HttpError("Unable to log you in, please try signing in again."), 403)
        }

        // return a jwt token and their new user id
        res
            .status(201)
            .json({
                message: "signup successful",
                userId: newUser.id,
                email: newUser.email,
                token: token
            });
    },

    //  -- LOGIN --
    login: async (req, res, next) => {
        const errors = validationResult(req)
        if(!errors.isEmpty()){
            console.log(errors)
            return next(new HttpError("Please provide a valid email and password.", 422))
        }

        const {email, password} = req.body

        let user;
        try {
            user = await User.findOne({email})
        }catch (e) {
            return next(new HttpError("Something went wrong, couldn't complete sign-in.", 500))
        }

        if ( !user ) {
            return next(new HttpError("Couldn't find ya, are you sure you're spelling that right?", 403))
        }

        // compare plain string password to hashed password
        let isValidPassword = false;
        try {
            isValidPassword = await bcrypt.compare(password, user.password);
        }catch (e) {
            return next(new HttpError("Couldn't log you in, check email and password and try again."), 403)
        }
        if ( !isValidPassword ) {
            return next(new HttpError("Couldn't find ya, are you sure you're spelling that right?"), 403)
        }

        //generate token
        let token;
        try {
            token = jwt.sign(
                {userId: user.id, email: user.email, name: user.name},
                SERVER_TOKEN_KEY,
                {expiresIn: "7d"}
            );
        }catch (e) {
            return next(new HttpError("Unable to log you in, please try signing in again."), 500)
        }

        // return token
        res
            .status(201)
            .json({
                message: "logging in successful",
                userId: user.id,
                email: user.email,
                token: token
            });
    },

    //  -- DELETE USER --
    deleteUser: async (req, res, next) => {
        const errors = validationResult(req)
        if(!errors.isEmpty()){
            console.log(errors)
            return next(new HttpError("Please provide a valid email and password.", 422))
        }

        const userID = req.params.uid;
        const {email, password} = req.body

        // verify username
        let user;
        try {
            user = await User.findOne({email})
        }catch (e) {
            return next(new HttpError("Something went wrong, couldn't complete sign-in.", 500))
        }
        if ( !user ) {
            return next(new HttpError("Couldn't find ya, are you sure you're spelling that right?.", 403))
        }

        // verify password
        let isValidPassword = false;
        try {
            isValidPassword = await bcrypt.compare(password, user.password);
        }catch (e) {
            return next(new HttpError("Something's wrong with our server, please try again."), 403)
        }
        if ( !isValidPassword ) {
            return next(new HttpError("Couldn't find ya, are you sure you're spelling that right?"), 403)
        }

        // verify uid
        if ( user.id !== userID ) {
            return next(new HttpError("Something's not right, please check your email and password and try again."), 403)
        }

        // remove user (overbuilt for future proofing)
        try {
            const sess = await mongoose.startSession();
            sess.startTransaction();
            await user.remove( {session: sess});
            await sess.commitTransaction()
        } catch (e) {
            console.log(e);
            return next(new HttpError("Something went wrong, couldn't delete user.", 500))
        }

        // return
        res
            .status(201)
            .json({
                message: "delete successful",
                userId: user.id,
                email: user.email
            });
    },
    // -- REFRESH USER TOKEN --
    refreshToken: async (req, res, next) => {

        // generate a new token
        let token;
        try {
            token = jwt.sign(
                {userId: req.userData.userID, email: req.userData.email, name: req.userData.name},
                SERVER_TOKEN_KEY,
                {expiresIn: "7d"}
            );
        }catch (e) {
            return next(new HttpError("Unable to log you in, please try signing in again."), 403)
        }

        // return a jwt token and their new user id
        res
            .status(201)
            .json({
                message: "refresh successful",
                userId: req.userData.userID,
                email: req.userData.email,
                token: token
            });
    }


};

module.exports = usersController;
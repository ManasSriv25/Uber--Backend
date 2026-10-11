const userModel = require('../models/user.model');
const userService = require('../services/user.service');
const { validationResult } = require('express-validator');
const blackListTokenModel = require('../models/blackListToken.model');

module.exports.registerUser = async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { fullname, email, password } = req.body;

        const isUserAlready = await userModel.findOne({ email });

        if (isUserAlready) {
            return res.status(400).json({ message: 'User already exist' });
        }

        const hashedPassword = await userModel.hashPassword(password);

        const user = await userService.createUser({
            firstname: fullname.firstname,
            lastname: fullname.lastname,
            email,
            password: hashedPassword
        });

        const token = user.generateAuthToken();
        const safeUser = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email
        };

        res.status(201).json({ token, user: safeUser });
    } catch (error) {
        console.error('User registration failed:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }

        if (error.code === 11000) {
            return res.status(409).json({ message: 'User already exists' });
        }

        return res.status(500).json({ message: 'Unable to create account. Please try again.' });
    }

}

module.exports.loginUser = async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;

        const user = await userModel.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = user.generateAuthToken();
        const safeUser = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email
        };

        res.cookie('token', token);

        res.status(200).json({ token, user: safeUser });
    } catch (error) {
        console.error('User login failed:', error);
        return res.status(500).json({ message: 'Unable to log in. Please try again.' });
    }
}

module.exports.getUserProfile = async (req, res, next) => {

    res.status(200).json(req.user);

}

module.exports.logoutUser = async (req, res, next) => {
    res.clearCookie('token');
    const token = req.cookies.token || req.headers.authorization.split(' ')[ 1 ];

    await blackListTokenModel.create({ token });

    res.status(200).json({ message: 'Logged out' });

}
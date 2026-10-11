const captainModel = require('../models/captain.model');
const captainService = require('../services/captain.service');
const blackListTokenModel = require('../models/blackListToken.model');
const { validationResult } = require('express-validator');


module.exports.registerCaptain = async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { fullname, email, password, vehicle } = req.body;

        const isCaptainAlreadyExist = await captainModel.findOne({ email: email.toLowerCase().trim() });

        if (isCaptainAlreadyExist) {
            return res.status(409).json({ message: 'Captain already exists' });
        }

        const hashedPassword = await captainModel.hashPassword(password);

        const captain = await captainService.createCaptain({
            firstname: fullname.firstname,
            lastname: fullname.lastname,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            color: vehicle.color,
            plate: vehicle.plate,
            capacity: vehicle.capacity,
            vehicleType: vehicle.vehicleType
        });

        const token = captain.generateAuthToken();
        const safeCaptain = {
            _id: captain._id,
            fullname: captain.fullname,
            email: captain.email,
            vehicle: captain.vehicle,
            status: captain.status
        };

        return res.status(201).json({ token, captain: safeCaptain });
    } catch (error) {
        console.error('Captain registration failed:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Captain already exists' });
        }
        return res.status(500).json({ message: 'Unable to create captain account. Please try again.' });
    }

}

module.exports.loginCaptain = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;

        const captain = await captainModel.findOne({ email: email.toLowerCase().trim() }).select('+password');

        if (!captain) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await captain.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = captain.generateAuthToken();
        const safeCaptain = {
            _id: captain._id,
            fullname: captain.fullname,
            email: captain.email,
            vehicle: captain.vehicle,
            status: captain.status
        };

        res.cookie('token', token);

        return res.status(200).json({ token, captain: safeCaptain });
    } catch (error) {
        console.error('Captain login failed:', error);
        return res.status(500).json({ message: 'Unable to log in. Please try again.' });
    }
}

module.exports.getCaptainProfile = async (req, res, next) => {
    res.status(200).json({ captain: req.captain });
}

module.exports.logoutCaptain = async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[ 1 ];

    await blackListTokenModel.create({ token });

    res.clearCookie('token');

    res.status(200).json({ message: 'Logout successfully' });
}
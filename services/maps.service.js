const axios = require('axios');
const captainModel = require('../models/captain.model');

const mapError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const getApiKey = () => {
    if (!process.env.GOOGLE_MAPS_API) {
        throw mapError('Google Maps API key is missing. Set GOOGLE_MAPS_API in Backend/.env.', 503);
    }

    return process.env.GOOGLE_MAPS_API;
};

const requestMapsApi = async (url, service) => {
    let response;
    try {
        response = await axios.get(url);
    } catch (error) {
        const providerMessage = error.response?.data?.error_message;
        const message = providerMessage
            ? `Google Maps ${service} request failed: ${providerMessage}`
            : `Google Maps ${service} request failed. Check the API key, enabled APIs, billing, and network connection.`;
        throw mapError(message, 502);
    }

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        const providerMessage = response.data.error_message;
        const detail = providerMessage || `Check the API key and API restrictions (${response.data.status}).`;
        throw mapError(`Google Maps ${service} request failed: ${detail}`, 502);
    }

    return response.data;
};

module.exports.getAddressCoordinate = async (address) => {
    const apiKey = getApiKey();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    const data = await requestMapsApi(url, 'geocoding');
    const location = data.results?.[ 0 ]?.geometry?.location;
    if (!location) {
        throw mapError('No coordinates found for this address.', 404);
    }

    return {
        ltd: location.lat,
        lng: location.lng
    };
}

module.exports.getDistanceTime = async (origin, destination) => {
    if (!origin || !destination) {
        throw new Error('Origin and destination are required');
    }

    const apiKey = getApiKey();

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;

    const data = await requestMapsApi(url, 'distance matrix');
    const result = data.rows?.[ 0 ]?.elements?.[ 0 ];
    if (!result || result.status === 'ZERO_RESULTS') {
        throw mapError('No route found for the selected addresses.', 404);
    }

    if (result.status !== 'OK') {
        throw mapError(`Google Maps could not calculate the route: ${result.status}.`, 404);
    }

    return result;
}

module.exports.getAutoCompleteSuggestions = async (input) => {
    if (!input) {
        throw new Error('query is required');
    }

    const apiKey = getApiKey();
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`;

    const data = await requestMapsApi(url, 'autocomplete');

    if (data.status === 'ZERO_RESULTS') {
        return [];
    }

    return data.predictions.map(prediction => prediction.description).filter(value => value);
}

module.exports.getCaptainsInTheRadius = async (ltd, lng, radius) => {

    // radius in km


    const captains = await captainModel.find({
        location: {
            $geoWithin: {
                $centerSphere: [ [ ltd, lng ], radius / 6371 ]
            }
        }
    });

    return captains;


}
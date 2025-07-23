// server.js

// Import necessary packages
const express = require('express');
const path = require('path');
require('dotenv').config(); // Loads environment variables from a.env file

const app = express();
const PORT = 3000;

// This tells Express to serve static files (like index.html) from the current directory
app.use(express.static(path.join(__dirname)));

// In-memory cache to store the fixture data and the time it was fetched
const cache = {
    data: null,
    timestamp: 0,
};

// The duration for which the cache is valid (1 hour in milliseconds)
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// The local API endpoint that your frontend will call
app.get('/api/fixtures', async (req, res) => {
    // Dynamically import the node-fetch module
    const fetch = (await import('node-fetch')).default;
    const now = Date.now();

    // Check if we have valid, non-expired data in our cache
    if (cache.data && (now - cache.timestamp < CACHE_DURATION)) {
        console.log('Serving fixtures from cache.');
        return res.json(cache.data);
    }

    console.log('Cache is stale or empty. Fetching new fixtures from API-Football...');

    // --- API Call to API-Football ---
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
        console.error('API key is not configured on the server. Make sure you have a.env file.');
        return res.status(500).json({ error: 'API key is not configured on the server.' });
    }

    // *** CORRECTED URL AND HEADERS BASED ON DOCUMENTATION ***
    // The URL now points to the RapidAPI gateway.
    const API_URL = 'https://api-football-v1.p.rapidapi.com/v3/fixtures?league=39&season=2025';

    const options = {
        method: 'GET',
        headers: {
            // The host header must match the RapidAPI gateway.
            'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
            'x-rapidapi-key': apiKey
        }
    };

    try {
        const apiResponse = await fetch(API_URL, options);
        const data = await apiResponse.json();

        // Check for errors from the external API (like an invalid key)
        if (!apiResponse.ok || (data.errors && Object.keys(data.errors).length > 0)) {
            console.error('API-Football Error:', data.errors);
            return res.status(apiResponse.status).json(data);
        }

        // Update the cache with the new data and the current timestamp
        cache.data = data;
        cache.timestamp = now;
        console.log('Fixtures fetched successfully and cache has been updated.');

        // Send the fresh data to the client
        res.json(data);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running! Open your browser and go to http://localhost:${PORT}`);
});
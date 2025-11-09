// netlify/functions/get-video-details.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // CORS headers to allow requests from your frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET and POST requests
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Extract videoId from query parameters or request body
    let videoId;
    if (event.httpMethod === 'GET') {
      videoId = event.queryStringParameters.videoId;
    } else {
      const body = JSON.parse(event.body || '{}');
      videoId = body.videoId;
    }

    // Validate videoId parameter
    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing videoId parameter',
          message: 'Please provide a valid YouTube video ID'
        })
      };
    }

    // Validate videoId format (basic YouTube ID validation)
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid videoId format',
          message: 'YouTube video ID must be 11 characters long'
        })
      };
    }

    // Get API key from environment variable
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    
    if (!RAPIDAPI_KEY) {
      throw new Error('RAPIDAPI_KEY environment variable is not configured');
    }

    // Make request to YouTube Media Downloader API
    const response = await axios.get(
      `https://youtube-media-downloader.p.rapidapi.com/v2/video/details`,
      {
        params: {
          videoId: videoId,
          urlAccess: 'normal',
          videos: 'auto',
          audios: 'auto'
        },
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'youtube-media-downloader.p.rapidapi.com'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    // Return successful response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    console.error('Netlify Function Error:', error);

    // Handle specific error types
    if (error.response) {
      // API responded with error status
      return {
        statusCode: error.response.status,
        headers,
        body: JSON.stringify({ 
          error: 'YouTube API Error',
          message: error.response.data?.message || 'Failed to fetch video details from YouTube API',
          status: error.response.status
        })
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ 
          error: 'Network Error',
          message: 'Unable to connect to YouTube API service'
        })
      };
    } else if (error.code === 'ECONNABORTED') {
      // Request timeout
      return {
        statusCode: 408,
        headers,
        body: JSON.stringify({ 
          error: 'Request Timeout',
          message: 'YouTube API request timed out'
        })
      };
    } else {
      // Other errors
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Internal Server Error',
          message: error.message || 'An unexpected error occurred'
        })
      };
    }
  }
};

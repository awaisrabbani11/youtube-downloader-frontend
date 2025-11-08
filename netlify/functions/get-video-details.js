// netlify/functions/get-video-details.js
const axios = require('axios'); // You'll need to install this package

exports.handler = async (event, context) => {
  // Handle CORS - allows your frontend to call this function
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    // Get videoId from query parameters or body
    let videoId;
    if (event.httpMethod === 'GET') {
      videoId = event.queryStringParameters.videoId;
    } else {
      const body = JSON.parse(event.body || '{}');
      videoId = body.videoId;
    }

    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing videoId parameter' })
      };
    }

    // SECURE API CALL - your key is safe here
    const response = await axios.get(
      `https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=${videoId}&urlAccess=normal&videos=auto&audios=auto`,
      {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, // Your secured key
          'X-RapidAPI-Host': 'youtube-media-downloader.p.rapidapi.com'
        }
      }
    );

    // Return the video data to your frontend
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch video details',
        message: error.message 
      })
    };
  }
};

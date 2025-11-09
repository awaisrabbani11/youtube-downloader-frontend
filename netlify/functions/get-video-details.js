// netlify/functions/get-video-details.js
const axios = require('axios');

exports.handler = async (event) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { videoId } = event.queryStringParameters;

    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing videoId parameter' })
      };
    }

    // Get API key from environment
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    
    if (!RAPIDAPI_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured on server' })
      };
    }

    // Make API request
    const apiResponse = await axios.get(
      'https://youtube-media-downloader.p.rapidapi.com/v2/video/details',
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
        timeout: 10000
      }
    );

    const apiData = apiResponse.data;

    // Extract available formats
    let formats = [];
    
    // Check multiple possible format locations
    if (apiData.videos && apiData.videos.formats) {
      formats = apiData.videos.formats.map(format => ({
        quality: format.qualityLabel || `Quality ${format.itag}`,
        container: format.container || 'mp4',
        url: format.url,
        itag: format.itag
      }));
    }

    // Prepare response
    const responseData = {
      success: true,
      title: apiData.title || 'Unknown Title',
      thumbnail: apiData.thumbnails && apiData.thumbnails[0] ? apiData.thumbnails[0].url : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: apiData.duration || 'Unknown',
      viewCount: apiData.viewCount || 'Unknown',
      formats: formats,
      message: formats.length === 0 ? 'No downloadable formats found' : `${formats.length} formats available`
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('Function error:', error);

    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;

    if (error.response) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.message || `API returned ${statusCode}`;
    } else if (error.request) {
      errorMessage = 'No response from YouTube API';
    } else {
      errorMessage = error.message;
    }

    return {
      statusCode: statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage
      })
    };
  }
};


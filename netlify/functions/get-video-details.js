// netlify/functions/get-video-details.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-RapidAPI-Key, X-RapidAPI-Host',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const videoId = event.queryStringParameters.videoId;

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
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    console.log(`Fetching video details for: ${videoId}`);

    // Make API request
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
        timeout: 15000
      }
    );

    const data = response.data;
    console.log('API Response received:', Object.keys(data));

    // Process video formats for download
    let downloadableFormats = [];

    // Check for video formats in different possible locations
    if (data.videos && data.videos.formats) {
      downloadableFormats = data.videos.formats.map(format => ({
        quality: format.qualityLabel || `Quality ${format.itag}`,
        container: format.container || 'mp4',
        url: format.url,
        itag: format.itag,
        hasAudio: format.hasAudio !== false
      }));
    }

    // If no videos found, check adaptive formats
    if (downloadableFormats.length === 0 && data.videos && data.videos.adaptiveFormats) {
      downloadableFormats = data.videos.adaptiveFormats
        .filter(format => format.mimeType && format.mimeType.includes('video'))
        .map(format => ({
          quality: format.qualityLabel || `Quality ${format.itag}`,
          container: format.container || 'mp4',
          url: format.url,
          itag: format.itag,
          hasAudio: format.hasAudio !== false
        }));
    }

    // If still no formats, check direct formats array
    if (downloadableFormats.length === 0 && data.formats) {
      downloadableFormats = data.formats
        .filter(format => format.mimeType && format.mimeType.includes('video'))
        .map(format => ({
          quality: format.qualityLabel || `Quality ${format.itag}`,
          container: format.container || 'mp4',
          url: format.url,
          itag: format.itag,
          hasAudio: format.hasAudio !== false
        }));
    }

    console.log(`Found ${downloadableFormats.length} downloadable formats`);

    // Return processed data to frontend
    const responseData = {
      title: data.title || 'Unknown Title',
      thumbnail: data.thumbnails && data.thumbnails.length > 0 ? data.thumbnails[0].url : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: data.duration || 'Unknown',
      viewCount: data.viewCount || 'Unknown',
      formats: downloadableFormats,
      rawData: data // Include raw data for debugging
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('Netlify Function Error:', error);

    if (error.response) {
      return {
        statusCode: error.response.status,
        headers,
        body: JSON.stringify({ 
          error: 'API Error',
          message: error.response.data?.message || 'Failed to fetch video details'
        })
      };
    } else if (error.request) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ 
          error: 'Network Error',
          message: 'Unable to connect to YouTube API service'
        })
      };
    } else {
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
  }


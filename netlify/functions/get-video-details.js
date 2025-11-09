// netlify/functions/get-video-details.js
const axios = require('axios');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const videoId = event.queryStringParameters.videoId;
    
    if (!videoId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing videoId' }) };
    }

    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    
    if (!RAPIDAPI_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    console.log(`Fetching formats for video: ${videoId}`);

    // Try multiple API endpoints to get formats
    let formats = [];

    // First try: Get video details with all formats
    try {
      const response = await axios.get(
        'https://youtube-media-downloader.p.rapidapi.com/v2/video/details',
        {
          params: {
            videoId: videoId,
            urlAccess: 'normal',
            includeFormats: true
          },
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'youtube-media-downloader.p.rapidapi.com'
          },
          timeout: 15000
        }
      );

      const data = response.data;
      console.log('API Response structure:', Object.keys(data));

      // Extract formats from different possible locations
      if (data.videos && data.videos.formats) {
        formats = data.videos.formats.map(format => ({
          quality: format.qualityLabel || `Quality ${format.itag}`,
          container: format.container || 'mp4',
          url: format.url,
          itag: format.itag,
          hasAudio: format.hasAudio !== false
        }));
      }

      // Try adaptive formats
      if (formats.length === 0 && data.videos && data.videos.adaptiveFormats) {
        formats = data.videos.adaptiveFormats
          .filter(format => format.mimeType && format.mimeType.includes('video/mp4'))
          .map(format => ({
            quality: format.qualityLabel || `Quality ${format.itag}`,
            container: 'mp4',
            url: format.url,
            itag: format.itag,
            hasAudio: format.audioQuality !== undefined
          }));
      }

      // Try direct formats array
      if (formats.length === 0 && data.formats) {
        formats = data.formats
          .filter(format => format.mimeType && format.mimeType.includes('video/mp4'))
          .map(format => ({
            quality: format.qualityLabel || `Quality ${format.itag}`,
            container: format.container || 'mp4',
            url: format.url,
            itag: format.itag,
            hasAudio: format.audioQuality !== undefined
          }));
      }

    } catch (apiError) {
      console.log('First API method failed, trying alternative...');
    }

    // Second try: Use a different endpoint if first failed
    if (formats.length === 0) {
      try {
        const altResponse = await axios.get(
          'https://youtube-media-downloader.p.rapidapi.com/v2/video/formats',
          {
            params: { videoId: videoId },
            headers: {
              'X-RapidAPI-Key': RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'youtube-media-downloader.p.rapidapi.com'
            },
            timeout: 15000
          }
        );

        const altData = altResponse.data;
        console.log('Alternative API response:', Object.keys(altData));

        if (altData.formats) {
          formats = altData.formats
            .filter(format => format.mimeType && format.mimeType.includes('video/mp4'))
            .map(format => ({
              quality: format.qualityLabel || `Quality ${format.itag}`,
              container: 'mp4',
              url: format.url,
              itag: format.itag,
              hasAudio: format.audioQuality !== undefined
            }));
        }
      } catch (altError) {
        console.log('Alternative API also failed');
      }
    }

    // If still no formats, create fallback download URLs
    if (formats.length === 0) {
      console.log('No formats found, creating fallback options');
      
      // Fallback: Create direct download URLs using common services
      formats = [
        {
          quality: '720p',
          container: 'mp4',
          url: `https://ssyoutube.com/watch?v=${videoId}`,
          itag: 'fallback-1',
          hasAudio: true,
          isFallback: true
        },
        {
          quality: '480p', 
          container: 'mp4',
          url: `https://y2mate.com/youtube/${videoId}`,
          itag: 'fallback-2',
          hasAudio: true,
          isFallback: true
        }
      ];
    }

    // Get video info for title and thumbnail
    let videoInfo = {
      title: `YouTube Video - ${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: 'Unknown',
      viewCount: 'Unknown'
    };

    try {
      const infoResponse = await axios.get(
        'https://youtube-media-downloader.p.rapidapi.com/v2/video/details',
        {
          params: { videoId: videoId },
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'youtube-media-downloader.p.rapidapi.com'
          }
        }
      );

      const infoData = infoResponse.data;
      videoInfo = {
        title: infoData.title || videoInfo.title,
        thumbnail: (infoData.thumbnails && infoData.thumbnails[0] && infoData.thumbnails[0].url) || videoInfo.thumbnail,
        duration: infoData.duration || videoInfo.duration,
        viewCount: infoData.viewCount || videoInfo.viewCount
      };
    } catch (infoError) {
      console.log('Could not fetch video info, using defaults');
    }

    console.log(`Final formats count: ${formats.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        viewCount: videoInfo.viewCount,
        formats: formats,
        message: formats.length > 0 ? 
          `${formats.length} download options available` : 
          'No direct download formats found - using external services'
      })
    };

  } catch (error) {
    console.error('Function error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      })
    };
  }
};


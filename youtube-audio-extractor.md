# YouTube Audio Extraction Guide for Expo (React Native)

This guide isolates the exact audio extraction logic used by open-source players like Bloomee and Metrolist. It transforms a standard song query into a direct, ad-free streaming link (`.m4a`/`.webm`) using a public proxy API.

## 🛠️ The Extraction Code (`extractor.js`)

```javascript
// You can change this instance if it experiences downtime. 
// The open-source community maintains alternative public mirrors.
const PIPED_API = "https://pipedapi.kavin.rocks"; 

/**
 * Searches for a song and extracts the direct raw audio stream URL (.m4a/.webm)
 * @param {string} songName - The title/artist of the song (e.g., "Blinding Lights")
 * @returns {Promise<string|null>} Direct streaming audio URL or null if failed
 */
export async function extractAudioUrl(songName) {
  try {
    // STEP 1: Search the proxy for the track
    const searchQuery = encodeURIComponent(songName);
    const searchUrl = `${PIPED_API}/search?q=${searchQuery}&filter=music_videos`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      console.warn("No songs matched that query.");
      return null;
    }

    // STEP 2: Extract the video ID from the first search result
    // The API usually returns a relative URL format like "/watch?v=dQw4w9WgXcQ"
    const firstResult = searchData.items[0]; // Fixed indexing element
    const videoId = firstResult.url.split("v=")[1];

    if (!videoId) {
      console.warn("Could not parse Video ID from search result.");
      return null;
    }

    // STEP 3: Request the direct stream assets for that specific ID
    const streamUrl = `${PIPED_API}/streams/${videoId}`;
    const streamResponse = await fetch(streamUrl);
    const streamData = await streamResponse.json();

    if (!streamData.audioStreams || streamData.audioStreams.length === 0) {
      console.warn("No audio-only streams found for this track.");
      return null;
    }

    // STEP 4: Filter out video tracks and grab the highest quality audio stream (.m4a)
    const bestAudioStream = streamData.audioStreams.reduce((highest, current) => {
      return (current.bitrate > highest.bitrate) ? current : highest;
    });

    // STEP 5: Return the raw URL string
    // This is the direct link that you pass into Expo Audio or React Native Track Player!
    return bestAudioStream.url;

  } catch (error) {
    console.error("Extraction error:", error);
    return null;
  }
}
```

## 🚀 How to Execute It

```javascript
import { extractAudioUrl } from './extractor';

const handleSearchAndPlay = async () => {
  const songQuery = "Starboy The Weeknd";
  const rawUrl = await extractAudioUrl(songQuery);
  
  console.log("Direct Link for Expo Player:", rawUrl); 
  // Output: A direct googlevideo.com link serving raw audio stream content.
};
```

## 💡 Key Architectural Details

1. **Ad Stripping:** Because you are pulling a raw media element (`.url`) and bypassing YouTube's web player scripts entirely, zero advertisements are attached to the stream.
2. **Reliability:** Public proxy servers like Piped do the heavy lifting of parsing YouTube's structural layout updates on their backend. This protects your mobile app from suddenly breaking when YouTube changes its platform configuration.

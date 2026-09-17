async function test() {
  const body = {
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '20.05.5',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        hl: 'en',
        gl: 'US',
        osName: 'iOS',
        osVersion: '18.1.0.22B83',
        userAgent: 'com.google.ios.youtube/20.05.5 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
      },
    },
    videoId: 'dQw4w9WgXcQ',
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const res = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc&prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.ios.youtube/20.05.5 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
      'X-YouTube-Client-Name': '5',
      'X-YouTube-Client-Version': '20.05.5',
      'Cookie': 'CONSENT=YES+cb',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  
  console.log('Status:', data.playabilityStatus?.status);
  
  // Check HLS
  console.log('HLS manifest:', data.streamingData?.hlsManifestUrl ? 'YES' : 'NO');
  if (data.streamingData?.hlsManifestUrl) {
    console.log('HLS URL:', data.streamingData.hlsManifestUrl.substring(0, 150) + '...');
    // Test if HLS URL works
    const hlsRes = await fetch(data.streamingData.hlsManifestUrl, { method: 'HEAD' });
    console.log('HLS HEAD test:', hlsRes.status, hlsRes.headers.get('content-type'));
  }
  
  // Check DASH
  console.log('DASH manifest:', data.streamingData?.dashManifestUrl ? 'YES' : 'NO');
  
  // Check all format details
  const audio = (data.streamingData?.adaptiveFormats || []).filter(f => f.mimeType && f.mimeType.startsWith('audio/'));
  console.log('Audio formats:', audio.length);
  audio.forEach(f => {
    console.log('  itag=' + f.itag + ' mime=' + f.mimeType + ' bitrate=' + f.bitrate);
    console.log('    url=' + (f.url ? f.url.substring(0, 80) + '...' : 'NONE'));
    console.log('    signatureCipher=' + (f.signatureCipher ? 'YES' : 'NO'));
    console.log('    cipher=' + (f.cipher ? 'YES' : 'NO'));
    console.log('    initRange=' + JSON.stringify(f.initRange) + ' indexRange=' + JSON.stringify(f.indexRange));
  });
}
test();

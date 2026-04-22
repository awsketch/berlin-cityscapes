# Berlin Treasure Hunt App

A web-based treasure hunt app with an interactive map of Berlin. Users explore locations, scan QR codes, and listen to audio clues.

## Features

- **Interactive Map**: OpenStreetMap-based map of Berlin with treasure locations
- **Audio Clues**: Each location has an audio file that plays in the app
- **Progress Tracking**: Automatically saves which treasures you've found (persists across sessions)
- **Simple UI**: Mobile-friendly interface optimized for outdoor exploration
- **No Installation**: Works in any web browser (no app store needed)

## Quick Start

### Option 1: Deploy to Vercel (Recommended - Free & Easy)

1. Create a GitHub account if you don't have one
2. Fork this repository to your GitHub account
3. Go to [vercel.com](https://vercel.com) and sign in with GitHub
4. Click "New Project" and select your forked repository
5. Click "Deploy" - Vercel will automatically build and deploy your app
6. Your app will be live at a URL like `your-project.vercel.app`

### Option 2: Deploy to Netlify (Also Free & Easy)

1. Go to [netlify.com](https://netlify.com) and sign up
2. Click "New site from Git"
3. Connect your GitHub account and select your repository
4. Click "Deploy site"
5. Your app will be live within minutes

### Option 3: Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm start

# Open http://localhost:3000 in your browser
```

## How It Works

1. **User opens the app** → sees the Berlin map
2. **User navigates to a treasure location** in real life and scans the QR code
3. **QR code opens your app** with that treasure location pinned
4. **User clicks the pin** to see the clue and play the audio file
5. **User marks it as "found"** - progress is saved automatically
6. **Repeat for all treasures**

## Customization

### Add Your Own Treasures

Edit the `TREASURES` array in `src/treasure-hunt-app.jsx`:

```javascript
const TREASURES = [
  {
    id: 1,
    name: 'My Treasure Location',
    coords: [52.5075, 13.4019],  // [latitude, longitude]
    clue: 'Find the hidden thing',
    audioUrl: 'https://your-audio-file-url.mp3',
    description: 'Description of the location'
  },
  // ... add more
];
```

### Generate QR Codes

Each location should have a QR code that links to your app:

```
https://your-app-url.vercel.app/
```

For more specific linking (e.g., to a specific treasure):
```
https://your-app-url.vercel.app/?treasure=1
```

You can generate these QR codes using:
- [QR Server](https://qrserver.com/)
- [QR Code Generator](https://www.qr-code-generator.com/)

### Host Your Audio Files

You have several options:
1. **AWS S3** - Free tier (5GB/month)
2. **Bunny CDN** - Very cheap (~$0.01/GB)
3. **Firebase Storage** - Free tier
4. **Your own server** - If you have one

Just replace the `audioUrl` values in the TREASURES array with your actual audio URLs.

## Cost Breakdown

- **Hosting**: Free (Vercel/Netlify free tier)
- **Domain**: Free (vercel.app subdomain) or ~$10/year for custom domain
- **Audio Storage**: Free-$5/month depending on your choice
- **Total**: $0-15/year (if you use a custom domain)

## Browser Compatibility

Works on modern evergreen browsers:
- Chrome/Chromium 90+
- Firefox 90+
- Safari 14+ (iOS 14+, macOS 11+)
- Edge 90+

React 18 and react-leaflet 4 require modern JS features, so older browsers (including iOS 12/13 Safari) are not supported.

## License

Open source - feel free to modify and share!

# Audio stories

This folder holds the audio "reward" files for each station. They're served as
static assets by Create React App: a file at `public/audio/foo.mp3` becomes
available at the URL `/audio/foo.mp3` at runtime.

## Naming convention

`<two-digit-station-id>-<slugified-name>.mp3`

Examples:

- `01-neue-synagoge.mp3`
- `02-hackesche-hoefe.mp3`
- `03-monbijoupark.mp3`
- `04-kw-institute.mp3`
- `05-volksbuehne.mp3`
- `06-station-six.mp3` (rename once the 6th station is chosen)

Using a station-id prefix keeps the folder listing in the same order as the
hunt, and the slug makes it obvious at a glance which file belongs where.

## Encoding recommendation

- Mono
- MP3, 96 kbps (or 64 kbps for pure spoken word)
- ~0.7 MB per minute at 96 kbps → six 7-minute files ≈ 30 MB total

ffmpeg example:

```
ffmpeg -i raw.wav -ac 1 -b:a 96k -codec:a libmp3lame output.mp3
```

## Wiring into the app

These files are placeholders (0 bytes) right now. The app still points at the
SoundHelix demo URLs in `src/treasure-hunt-app.jsx` (the `audioUrl` field of
each entry in the `TREASURES` array). When you have real recordings, drop them
into this folder and update each station's `audioUrl` to:

```js
audioUrl: '/audio/01-neue-synagoge.mp3',
```

The `<audio>` element already has `preload="none"`, so nothing is downloaded
until the user scans the QR code and presses play.

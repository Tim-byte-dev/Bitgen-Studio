# bitGen - the phone app for bitGen Studio

Make pictures and videos **on your own PC** from your phone. The app is the prompt docker in your pocket: you pick a style,
write the prompt, add pictures from the camera, press Generate - bitGen Studio on your PC renders it, and the result
comes back to the phone (play it, save it, share it). Nothing goes through a cloud service.

This first version talks to **your PC** ("My PC"). RunPod and OpenRouter directly from the phone come later.

## On the PC

1. bitGen Studio **2.909.0 or newer**.
2. **Settings ▸ General ▸ Remote access** - tick it. The first time, close bitGen Studio and start it again (it then listens
   on your network; Windows asks to let it through the firewall - allow it on **private** networks).
3. **Create link** shows a QR code. It works once and for 10 minutes.

## In the app

- **📷 Scan the QR** (a photo of it) - or paste the link - and **Connect**. Done; the pairing lasts a month and survives
  restarting the PC. One phone at a time.
- **✨ Create** - 🎬 Video / 🖼 Picture / 🎵 Music, the style, the prompt (a song's lyrics), pictures, size, seconds,
  Override style (a song: its sound words, seconds, title, mp3 / flac / wav - or ✨ Write the song: your PC's LLM writes
  them from an idea); ⏱ the time estimate; **Generate**.
- **⏳ Queue** - progress, the log, ■ Cancel.
- **🖼 Gallery** - your PC's videos, pictures and music; ⬇ Save (Documents/bitGen), ⤴ Share.
- **Folding phones** (a Galaxy Z Fold): compact on the cover screen / split screen / pop-up windows, wide (Create left,
  the other tab right, each on its own side of the hinge) unfolded - live as you fold and resize. **⛶** hides the
  status and navigation bars (Capacitor 8's SystemBars).
- **⚙ Settings** - the PC's address (change it to your VPN / router address when you are away from home), Disconnect.

## Building the APK

**The easy way - from bitGen Studio 2.911.0+:** Settings ▸ General ▸ Remote ▸ 📱 The bitGen app. It uses Android Studio's
Java 21 + SDK when they are there, or ⬇ downloads them; pair the phone once with Wireless debugging (its 6-digit code),
then 🔨 Build + install builds the APK and installs it on the phone over Wi-Fi, no taps.

**By hand:** you need **Node.js 20+** and **Android Studio** (it brings the Android SDK and JDK 21), or Anvil.

```
cd mobile
npm install
npm run sync          # copies www/ into the Android project (and the QR reader into www/vendor)
npm run open          # opens Android Studio -> Build ▸ Build App Bundle(s) / APK(s) ▸ Build APK(s)
```

Or from a terminal: `cd android && gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`) - the APK is
`android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to the phone and open it (allow "install unknown apps" for
your file manager once), or `adb install -r app-debug.apk`.

For a release build, make a signing key once (Android Studio ▸ Build ▸ Generate Signed App Bundle / APK) and keep it safe -
updates must be signed with the same key.

After changing anything in `www/`: `npm run sync` again. Icons and the splash come from the bitGen logo:
`python3 scripts/icons.py`.

## How it talks to the PC

- Pairing: the QR's link is `http://<PC>:<port>/remote?t=<code>`; the app sends the code to `POST /api/remote/pair` and
  keeps the key it gets back (Capacitor Preferences). Every request carries it in `X-Bitgen-Key`; a picture or video the
  app shows carries it as `?bgk=` (an `<img>` / `<video>` cannot send a header).
- `GET /api/app/info` - the PC's styles; `POST /api/app/video` - one form for every video model (the PC sends it to the
  model's own renderer); `POST /api/genimage` (+ `POST /api/passets` for pictures); `POST /api/timeestimate`;
  `/api/jobs`, `/api/outputs`, `/outputs/<file>`.
- The app's page is `http://localhost` inside the app (Capacitor), so a PC on the Wi-Fi is plain `http` - the manifest
  allows cleartext traffic for that.

`node scripts/test-app.js` checks the app's pure parts; the studio's `scripts/test-909.js` and `scripts/test-ui909-ui.js`
test the app against a real studio.

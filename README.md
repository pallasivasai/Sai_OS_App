# SAI Voice OS

**A voice-first Telugu and English assistant designed for blind and low-vision users.**

SAI Voice OS aims to make common internet information more accessible without requiring users to navigate a dense visual interface or type every question.

## Features

- **Voice first:** tap a large microphone control and ask a question aloud.
- **Telugu and English:** switch assistant language in Settings.
- **Spoken answers:** answers can be read aloud; replay any assistant message.
- **Online knowledge search:** looks up topic summaries using the public Wikipedia API and displays source links.
- **Google fallback:** provides a Google Search path when a reliable free summary is unavailable.
- **Accessible interface:** semantic landmarks, labelled controls, keyboard navigation, focus visibility, status announcements, reduced-motion support, and a text-input fallback.
- **Useful basics:** ask for the current local time, today's date, help, or open Google / YouTube.
- **Android-ready:** Capacitor project generation plus speech-recognition and text-to-speech plugins.
- **Build automation:** GitHub Actions builds a web artifact and Android debug APK on each push to `main`.

## Current limitations (important)

This first version is a useful foundation, not a full general-purpose AI model. Its built-in answers are based on local time/date/help intents and online encyclopedia summaries; arbitrary questions may need a broader Google search. Wikipedia's English API is used for topic lookup, so Telugu input may work better when the topic is also recognised in English. Voice recognition and Telugu speech quality vary by browser, Android device, installed speech services, and permissions.

A full conversational LLM requires a server-side API integration. **Do not add a paid AI key to this public frontend or commit one to GitHub.** For production, add a protected backend endpoint and appropriate rate limits, privacy notice, and error handling.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Microphone access usually requires HTTPS or localhost and explicit browser permission.

Create a production web build:

```bash
npm run build
npm run preview
```

## Android APK build

The repository's **Actions** workflow builds a debug APK for testing. On GitHub, open **Actions → Build web app and Android APK → latest successful run → Artifacts → SAI-Voice-OS-Android-APK** and download the ZIP containing `app-debug.apk`.

The workflow generates the Android project from Capacitor on each run so generated platform files do not need to be committed. The debug APK is for testing and is not a Play Store release. Validate microphone, Telugu recognition, and speech output on an actual Android device before relying on it.

To generate Android locally:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## GitHub Pages

The included Pages workflow builds the web app with the correct project base path and deploys it. In repository settings, make sure **Settings → Pages → Build and deployment → Source** is set to **GitHub Actions**.

Expected URL: https://pallasivasai.github.io/Sai_OS_App/

## Privacy and safety

- Browser speech recognition may send audio to the speech provider configured by the browser or operating system.
- Search queries are sent to Wikipedia; when the user selects Google Search, the query is sent to Google.
- Do not rely on this prototype for emergency instructions, medical decisions, financial actions, or other high-stakes decisions.
- The UI provides visible and keyboard-accessible controls as a complement to screen-reader access, but real blind/low-vision user testing is essential.

## Technology

React · TypeScript · Vite · Capacitor · Web Speech API · Wikipedia API · GitHub Actions

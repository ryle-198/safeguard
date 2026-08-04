# SAFEGUARD Mobile (React Native / Expo)


## Setup
```bash
npm install
npx expo start
```
Scan the QR code with Expo Go (iOS/Android) or press `i` / `a` for a simulator.

## ⚠️ Image assets expire in ~7 days
`screens/LoginScreen.js` currently loads icons from temporary Figma-hosted
URLs (`ASSETS` object at the top of the file). These links stop working
about a week after they were generated. Before then:

1. In Figma, select each icon/image node and **Export** it (PNG or SVG)
2. Save the exported files into `/assets`
3. Replace the URL strings in `ASSETS` with local requires, e.g.:
   ```js
   shieldIcon: require('../assets/shield-icon.png'),
   ```
   and change `<Image source={{ uri: ASSETS.shieldIcon }} />` to
   `<Image source={ASSETS.shieldIcon} />` (no `uri:` wrapper needed for
   local requires).

## Project structure
```
theme/tokens.js       - colors, spacing, radii, typography (pulled from Figma)
components/Button.js  - primary (red) / secondary (outline) button variants
components/FormInput.js - bordered text input with leading icon
screens/LoginScreen.js  - the screen itself
App.js                - font loading + navigation setup
```

## Design tokens
All colors/spacing/type sizes were extracted directly from the Figma file's
computed styles (not eyeballed), so they should match pixel-for-pixel. New
screens should import from `theme/tokens.js` rather than hardcoding values,
so everything stays visually consistent as more screens get added.

Font is **Public Sans** (loaded via `@expo-google-fonts/public-sans`), with
weights: Regular, SemiBold, Bold, ExtraBold.

## Wiring to the backend
The `handleLogin` function in `LoginScreen.js` is currently a stub with a
`TODO`. It should call `POST /api/auth/login` on the SAFEGUARD Spring Boot
backend, store the returned JWT (recommend `expo-secure-store`, not
AsyncStorage, since it's a token), and navigate to the resident home screen.

## Next screens
When you hand off the next Figma screen, share a node-specific link (with
`?node-id=` in the URL) and it'll get added to this same project, using the
same design tokens and component patterns established here.

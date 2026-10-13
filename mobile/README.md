# Floor 2 Rafters: iPhone and Android app

The phone app is the website in `../public`, wrapped with Capacitor. Same code, same database, same logins.

What the app adds on top of the website:
- Launch screen, dark status bar, portrait only, a light tap feel on every pick
- The phone's own share sheet for share cards and board posts
- Sign-in with the 6-digit code from the email (email links open the browser, so the app uses the code)
- **Phone alerts:** "your #1 moved", the weekly recap and the streak reminder. It asks politely first ("Know when your #1 moves"), then the phone asks for permission.
- **Invite links open the app:** `floor2rafters.com/join/CODE` opens straight to the join screen
- **Android back button:** closes a sheet, steps back through the app, and leaves the app from the Board
- Libraries are built in (no internet needed to open it; data still comes from Supabase)
- No ads in the app, and Pro isn't sold in the app (Apple and Google require their own payment systems); fans who bought Pro on the website see it here

## Accounts you need
| For | Account | Cost |
|---|---|---|
| iPhone | Apple Developer Program (enroll as the LLC once it exists; needs a D-U-N-S number, free) | $99 a year |
| iPhone builds without a Mac | Codemagic (codemagic.io) | Free: 500 build minutes a month |
| Android | Google Play Console | $25 once |
| Android builds | GitHub Actions (already in the repo) | Free |
| Phone alerts | Firebase (for Android) and an Apple push key (for iPhone) | Free |

Launch the website first. The app reads the same `public/config.js` keys.

## Android: build it (no Android Studio needed)
1. Push the code to GitHub (the launch checklist does this).
2. GitHub → your repo → **Actions** → **Android app** → **Run workflow** (type the version, like 1.0.0).
3. When it finishes (about 10 minutes), open the run → **Artifacts** → download. Inside is `f2r-debug.apk`: send it to your Android phone and open it to install (allow "install unknown apps" once).

### Android signing (for Google Play)
Do this once and keep the file and passwords somewhere safe forever. If you lose them you can't update the app.
1. On any computer with Java, run: `keytool -genkeypair -v -keystore f2r-release.jks -alias f2r -keyalg RSA -keysize 2048 -validity 10000`
2. GitHub → Settings → Secrets and variables → Actions → add:
   - `ANDROID_KEYSTORE_BASE64`: the file as base64 (`base64 -i f2r-release.jks` on a Mac, `certutil -encode` on Windows)
   - `ANDROID_KEYSTORE_PASSWORD`: the password you picked
   - `ANDROID_KEY_ALIAS`: `f2r`
3. Run the workflow again. Now it also makes `f2r-release.aab`; upload that in the Play Console.
4. Play Console → your app → Setup → App signing: copy the **SHA-256** fingerprint into `public/.well-known/assetlinks.json` (replace `PLAY_APP_SIGNING_SHA256`) and push. That's what lets invite links open the app.

New personal Play accounts must run a closed test with at least 12 testers for 14 days before going public, so start that early.

## iPhone: build it without a Mac (Codemagic)
1. Apple Developer → enroll. Then App Store Connect → My Apps → **+** → New App: name Floor 2 Rafters, bundle ID `com.floor2rafters.app`, SKU `f2r`.
2. App Store Connect → Users and Access → Integrations → App Store Connect API → generate a key (Admin). Download the .p8 file.
3. Codemagic → sign up with GitHub → add the repo → Team settings → Integrations → Developer Portal → add the key; name it exactly `F2R App Store Connect key`.
4. In `codemagic.yaml` set `APP_STORE_APPLE_ID` (App Store Connect → your app → App Information → Apple ID). Push.
5. Codemagic → start the **iPhone app → TestFlight** build. It creates the iPhone project, signs it and uploads it to TestFlight (about 20 minutes).
6. Install TestFlight on your iPhone; the build shows up there for you and up to 100 testers.
7. Apple Developer → Membership: copy your **Team ID** into `public/.well-known/apple-app-site-association` (replace `APPLE_TEAM_ID`) and push. That's what lets invite links open the app.

## Phone alerts setup
**Android (Firebase):**
1. console.firebase.google.com → Add project "Floor 2 Rafters" (Analytics off is fine) → Add app → Android, package `com.floor2rafters.app` → download `google-services.json`.
2. GitHub secret `GOOGLE_SERVICES_JSON_BASE64` = that file as base64. Rebuild.
3. Firebase → Project settings → Service accounts → Generate new private key. Paste the whole JSON into Supabase → Edge Functions → Secrets as `FCM_SERVICE_ACCOUNT`.

**iPhone (Apple push key):**
1. Apple Developer → Certificates, IDs & Profiles → Keys → **+** → Apple Push Notifications service → download the .p8 (only downloadable once).
2. Supabase secrets: `APNS_KEY` (the .p8 file's text, including the BEGIN/END lines), `APNS_KEY_ID` (shown next to the key), `APPLE_TEAM_ID`.
3. Apple Developer → Identifiers → `com.floor2rafters.app` → turn on **Push Notifications** and **Associated Domains**. Codemagic picks these up on the next build.

The weekly recap email and the `notify` function setup are in the main README ("Notifications").

## Every time the website changes
The cloud builds always take the latest `public/` folder. Run the Android workflow and the Codemagic build again, with a higher version number.

## Store listings
`store/listing.md` has the names, descriptions, keywords, privacy answers and review notes; `store/screenshots/` has the iPhone (1320×2868) and Android (1080×2160) screenshots. Retake the screenshots after launch so they show the real board instead of the sample one.

Apple can reject apps that are "just a website". Point the reviewer at what's app-only: phone alerts, the native share sheet, invite links that open the app, and tap feedback (the review notes in `store/listing.md` say this).

## Before you submit
- [ ] `public/config.js` has the live Supabase keys (the build warns you if not)
- [ ] Supabase email templates include the code (`{{ .Token }}`), already in `supabase/email/`
- [ ] The review account review@floor2rafters.com exists in Supabase with a password (Authentication → Users → Add user), has a few lists filled in, and is in a group with a friend or two
- [ ] Privacy policy is live at floor2rafters.com/privacy.html
- [ ] Delete account works in Me → Settings
- [ ] `.well-known` files have your Team ID and SHA-256 (invite links)

## On a Mac instead (optional)
`npm install`, then `npm run setup` (creates both projects), `npm run ios` (opens Xcode) or `npm run android` (opens Android Studio). After website changes: `npm run sync`.

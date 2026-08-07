# Hisab Boi

Hisab Boi is a multi-tenant cash book / POS-style mobile app built with React Native, Expo, Express.js, MongoDB, and Node.js.

---

## 🚀 Features

- ✅ Dynamic product data with variants & extras
- 🔄 Order parking, re-parking, and status tracking
- 📱 Multi-tab layout: POS | Cart | Bar | KDS | Completed Orders
- ⚡ Cloudinary image uploads
- 🧠 State with Zustand | Data with React Query

---

## 🖼️ UI Preview

- POS: ![POS](link-to-image)
- Bar: ![Bar](link-to-image)
- Cart: ![Cart](link-to-image)

---

## ⚙️ Tech Stack

- **Frontend:** React Native + Expo
- **Backend:** Express.js + MongoDB + Node.js
- **State:** Zustand
- **Data Fetching:** React Query
- **Cloud Storage:** Cloudinary

---

## 📦 Local-first mode (on-device SQLite)

Personal cash book can run **local-first**: SQLite is the source of truth, optional incremental cloud sync, and dated Google Drive snapshots for disaster recovery. Org/invoice paths stay cloud-primary in v1.

| Doc | Purpose |
|-----|---------|
| [`docs/LOCAL_FIRST_PRODUCTION_PLAN.md`](docs/LOCAL_FIRST_PRODUCTION_PLAN.md) | Phased implementation plan |
| [`docs/ENTITY_INVENTORY.md`](docs/ENTITY_INVENTORY.md) | What is local vs cloud |
| [`docs/LOCAL_FIRST_SUPPORT.md`](docs/LOCAL_FIRST_SUPPORT.md) | Support playbook (restore, reset, disable sync) |

**Mobile env (`mobile/.env.local`)** — in addition to `EXPO_PUBLIC_BASE_URL`:

```env
# Google Drive OAuth (one client ID per platform; users sign into their own Google account)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=....apps.googleusercontent.com
# EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
# EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
# EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=
```

iOS OAuth client bundle ID must match the app (`com.alamgir.hisabboi`). Prefer a **development build** for Google Sign-In; Expo Go often fails redirect/bundle checks.

**Dogfood checklist**

1. Settings → On-device storage → Local-first **ON**, Dual-write **OFF**.
2. Migrate once from cloud (or restore from Drive / JSON).
3. Optional: Cloud sync ON only after `/api/sync` is deployed.
4. Connect Drive → Upload dated backup → Restore pick-date smoke test.

Flags default **OFF** so production stays cloud-primary until cutover.

**Attachments policy (v1):** with local-first ON, receipts save under the app documents folder (compressed via ImagePicker quality) — no Cloudinary. Paths live in SQLite `attachments_json`. Drive JSON backups do **not** embed binary media yet (zip later). Cloud-primary mode still uses the server/Cloudinary upload API.

**Cloud sync OFF:** personal Home / Ledger / Accounts read SQLite only (works offline long-term). Organization books still need cloud — if an org is selected while sync is off, the app shows **personal on-device data** plus a yellow banner (not an empty API failure). Keep Dual-write OFF for real offline. Drive backups remain independent of Mongo sync.

**Encryption:** Expo Go uses unencrypted `expo-sqlite` (`USE_SQLCIPHER = false`). Production cutover should add at-rest encryption (or rely on OS data protection + biometric gates for restore/Drive). See Phase 8 in the plan.

---

## 🧪 Setup Instructions

Before running locally, set up the required `.env` / `.env.local` files for the backend and mobile app.

Install backend dependencies:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/backend
npm install
```

Install mobile dependencies:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npm install
```

Run backend locally:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/backend
npm start
```

Run mobile locally:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npm run dev
```

---

## 📱 Physical device + local API (`mobile/.env.local`)

Simulators/emulators can reach the backend via `127.0.0.1`. A **physical phone cannot** — `127.0.0.1` on the device is the phone itself, so the app opens but lists stay empty / requests fail.

### 1. Point the app at your Mac’s LAN IP

In `mobile/.env.local`:

```env
# Simulator / same machine only — will NOT work on a real phone:
# EXPO_PUBLIC_BASE_URL=http://127.0.0.1:5050/api

# Physical device (phone and Mac on the same Wi‑Fi):
EXPO_PUBLIC_BASE_URL=http://YOUR_MAC_LAN_IP:5050/api

# Or use the deployed API:
# EXPO_PUBLIC_BASE_URL=https://cash-book-seven.vercel.app/api
```

Find your Mac IP:

```shell
ipconfig getifaddr en0
```

Example: if that prints `192.168.0.166`, use:

```env
EXPO_PUBLIC_BASE_URL=http://192.168.0.166:5050/api
```

### 2. Restart Metro after changing env

Expo bakes `EXPO_PUBLIC_*` at start time. After editing `.env.local`:

```shell
cd mobile
# stop the running Metro process, then:
npx expo start --clear
```

Rebuild / reopen the **development build** on the phone. **Do not use Expo Go** — see [Local mode on physical iPhone (no Expo Go)](#-local-mode-on-physical-iphone-no-expo-go).

### 3. Backend must listen on the LAN

Run the API on the same port as in the URL (e.g. `5050`). Allow connections from other devices on your network (firewall). Phone and Mac must be on the **same Wi‑Fi** (guest networks often isolate devices).

### 4. Quick check

- Wrong host → login may fail or home/accounts show no data.
- Correct LAN URL → same data as when testing on simulator against local Mongo.

### 5. Switch account on one device

Settings → **Switch Account** signs out, clears React Query cache and user-scoped storage (active org, preferences), then opens sign-in so another user can log in without leftover ledger data.

---

## 🤖 Android Build Commands

Build Android `.apk`:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
eas build -p android --profile preview
```

Build Android `.apk` with clear cache:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
eas build -p android --profile preview --clear-cache
```

Build Android `.aab`:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
eas build --platform android
```

Build Android production `.aab`:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
eas build -p android --profile production --clear-cache
```

---

## 🧰 Expo Maintenance Commands

Check package compatibility:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npx expo-doctor
npx expo install --check
```

Login to Expo:

```shell
expo login
```

Logout from Expo:

```shell
expo logout
```

Reset Metro cache:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npm start -- --reset-cache
```

Start Expo server:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npx expo start
```

---

## 📱 Install on iPhone for Free Using Xcode (No App Store, No Paid Developer Account)

This is the verified free method used for this project. It installs a **Release** build directly from Xcode to your own iPhone, so the app works without keeping the Expo/Metro terminal open.

> Important: iOS does not support Android-style permanent APK installation. With a free Apple ID, the app may expire after about 7 days. If that happens, reconnect the iPhone and install the Release build again.

---

### ✅ What You Need

1. A Mac with Xcode installed.
2. Your iPhone connected to the Mac using USB.
3. Your normal free Apple ID added in Xcode.
4. Developer Mode enabled on the iPhone.
5. The project dependencies installed in `mobile/`.

---

### 1️⃣ First-Time Setup on Mac

Open Terminal and run:

```shell
xcode-select --install
```

If it says the tools are already installed, continue.

Install mobile dependencies:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npm install
```

Generate the native iOS project if `mobile/ios` does not exist:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npx expo prebuild -p ios
```

Open the iOS project in Xcode:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
xed ios
```

---

### 2️⃣ Add Apple ID in Xcode

1. Open **Xcode**.
2. Go to **Xcode → Settings → Accounts**.
3. Click **+**.
4. Select **Apple ID**.
5. Sign in with your normal Apple ID.
6. Close Settings.

---

### 3️⃣ Enable Developer Mode on iPhone

On the iPhone:

1. Open **Settings**.
2. Go to **Privacy & Security**.
3. Tap **Developer Mode**.
4. Turn **Developer Mode ON**.
5. Restart the iPhone when prompted.
6. After restart, unlock the iPhone and confirm **Turn On**.

> Keep Developer Mode ON while using this free Xcode-installed app. If you turn it OFF, the app may stop launching and future installs from Xcode can fail.

---

### 4️⃣ Trust This Mac and Trust Developer Profile

1. Connect the iPhone to the Mac using USB.
2. Unlock the iPhone.
3. Tap **Trust This Computer** if prompted.
4. Enter the iPhone passcode.
5. After installing the app for the first time, open **Settings → General → VPN & Device Management**.
6. Tap your developer profile, for example `Apple Development: alamgirh389@gmail.com`.
7. Tap **Trust**.
8. Tap **Trust** again to confirm.

---

### 5️⃣ Configure Signing in Xcode

In Xcode:

1. Open the `HisabBoi` project.
2. Select the **HisabBoi** project in the left sidebar.
3. Select the **HisabBoi** target under **Targets**.
4. Open **Signing & Capabilities**.
5. Enable **Automatically manage signing**.
6. Set **Team** to your **Personal Team**.
7. Keep the Bundle Identifier as:

```text
com.alamgir.hisabboi
```

If Xcode says the bundle identifier is already used, change it to a unique value, for example:

```text
com.alamgir.hisabboi.local
```

---

### 6️⃣ Build and Install Release App Without Metro Terminal

Use this command to build a standalone **Release** app:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile/ios
xcodebuild -workspace HisabBoi.xcworkspace \
  -scheme HisabBoi \
  -configuration Release \
  -destination generic/platform=iOS \
  -derivedDataPath /Users/alamgirhossain/Library/Developer/Xcode/DerivedData/HisabBoiRelease \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=Y3Y73LS73V \
  CODE_SIGN_STYLE=Automatic \
  build
```

Install the Release app on the connected iPhone (unlock iPhone first):

```shell
xcrun devicectl device install app \
  --device 00008140-0004384608A2201C \
  /Users/alamgirhossain/Library/Developer/Xcode/DerivedData/HisabBoiRelease/Build/Products/Release-iphoneos/HisabBoi.app
```

Now unlock the iPhone and open **Hisab Boi** from the home screen.

> Device ID above is the current USB iPhone. If install fails with “device not found”, run `xcrun xctrace list devices` and replace the `--device` value.

> This Release install does not need `npx expo start`, Metro, or any terminal open while using the app.

---

### 7️⃣ Optional: Install Release App from Xcode UI

You can also do the same from Xcode:

1. Select your iPhone from the device selector at the top of Xcode.
2. Go to **Product → Scheme → Edit Scheme**.
3. Select **Run**.
4. Change **Build Configuration** from `Debug` to `Release`.
5. Click **Close**.
6. Press **Cmd + R**.
7. If macOS asks for the keychain password, enter your **Mac login password** and click **Always Allow**.

---

## 🔄 Refresh Free Apple ID After ~7 Days

With a **free Apple ID**, the iOS signing certificate expires about every **7 days**. When that happens, tapping **Hisab Boi** may show:

```text
"Hisab Boi" is No Longer Available
```

That means the old install is signed with an **expired certificate**. Building on the Mac alone does **not** fix the phone — you must **reinstall** the app on the iPhone.

Reconnect your iPhone and run **both** commands below (build + install).

**Before you run the commands:**

1. Connect the iPhone to the Mac with USB.
2. Unlock the iPhone.
3. Keep **Developer Mode** ON.
4. If prompted, tap **Trust This Computer** on the iPhone.

**Step 1 — Rebuild Release app and refresh Apple ID signing:**

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile/ios
xcodebuild -workspace HisabBoi.xcworkspace \
  -scheme HisabBoi \
  -configuration Release \
  -destination generic/platform=iOS \
  -derivedDataPath /Users/alamgirhossain/Library/Developer/Xcode/DerivedData/HisabBoiRelease \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=Y3Y73LS73V \
  CODE_SIGN_STYLE=Automatic \
  build
```

> `-allowProvisioningUpdates` tells Xcode to renew the free Apple ID provisioning profile with Apple. You may be asked to sign in to your Apple ID in Xcode.

**Step 2 — Install the refreshed app on the iPhone:**

```shell
xcrun devicectl device install app \
  --device 00008140-0004384608A2201C \
  /Users/alamgirhossain/Library/Developer/Xcode/DerivedData/HisabBoiRelease/Build/Products/Release-iphoneos/HisabBoi.app
```

Then open **Hisab Boi** on the iPhone.

> If the device ID changed, run `xcrun xctrace list devices` and update `--device`.

**If it still won’t open after install:**

1. On iPhone: long-press **Hisab Boi** → **Remove App** → **Delete App** (removes the expired copy).
2. Run **Step 1** and **Step 2** again.
3. On iPhone: **Settings → General → VPN & Device Management** → tap your developer profile (`Apple Development: …`) → **Trust**.
4. Open **Hisab Boi** again.

Your app data is usually kept if you only reinstall without deleting. If you delete the app first, local data may be lost.

**If the install command fails with “device not found”**, list connected devices and use your iPhone’s ID:

```shell
xcrun devicectl list devices
```

Replace `43B8F391-1D7E-51F4-B8C3-7B0552CE18DE` in the install command with the ID shown for your iPhone.

---

## 🔄 Install an Updated Version Later

When you change code and want the updated app on the iPhone:

1. Connect the iPhone to the Mac with USB.
2. Unlock the iPhone.
3. Keep Developer Mode ON.
4. Run the Release build again:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile/ios
xcodebuild -workspace HisabBoi.xcworkspace \
  -scheme HisabBoi \
  -configuration Release \
  -destination generic/platform=iOS \
  -derivedDataPath /Users/alamgirhossain/Library/Developer/Xcode/DerivedData/HisabBoiRelease \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=Y3Y73LS73V \
  CODE_SIGN_STYLE=Automatic \
  build
```

1. Install the new Release build:

```shell
xcrun devicectl device install app \
  --device 43B8F391-1D7E-51F4-B8C3-7B0552CE18DE \
  /Users/alamgirhossain/Library/Developer/Xcode/DerivedData/HisabBoiRelease/Build/Products/Release-iphoneos/HisabBoi.app
```

1. Open **Hisab Boi** on the iPhone.

The new install replaces the old app. App data normally stays unless you delete the app manually.

---

## 🧪 Debug Build vs Release Build

| Build Type | Needs Terminal/Metro? | Best For |
| --- | --- | --- |
| Debug (dev client) | Yes — `npm run dev` / `npx expo start --dev-client` | Day-to-day coding, live reload, local API |
| Release | No | Normal iPhone use, like an Android APK |

Use Debug only when actively developing. Use Release for normal daily use.

**Do not use Expo Go** for this project. The app depends on `expo-dev-client` and a newer Expo SDK than stock Expo Go may support. Always open the installed **Hisab Boi** app (Xcode / `expo run:ios` build).

---

## 💻 Local mode on physical iPhone (no Expo Go)

Use this when the phone is USB-connected (or on the same Wi‑Fi), the backend runs on your Mac, and you want the installed **Hisab Boi** app — **not** Expo Go.

There are two options:

| Option | App on phone | Metro needed? | When to use |
| --- | --- | --- | --- |
| **A. Dev client + Metro** | Debug / development build | Yes | Coding, hot reload, frequent JS changes |
| **B. Release + local API** | Release build (already installed) | No | Dogfood local Mongo/API like production |

---

### Option A — Dev client + Metro (recommended for coding)

Release builds **do not** load JS from Metro. If you only have the Release install, install a **Debug** build once (USB connected, iPhone unlocked):

**Install Debug once (pick one):**

From Xcode:

1. Select your iPhone in the device selector.
2. **Product → Scheme → Edit Scheme → Run → Build Configuration** = `Debug`.
3. Press **Cmd + R**.

Or from Terminal:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npx expo run:ios --device
```

> `expo run:ios` builds a native Debug app with the dev client and installs it over USB. After that you usually only need Metro, not a full native rebuild, until you change native modules / plugins.

**Every day — run local API + Metro:**

1. Point the app at your Mac (same Wi‑Fi, or USB + Mac sharing network). In `mobile/.env.local`:

```env
EXPO_PUBLIC_BASE_URL=http://YOUR_MAC_LAN_IP:5050/api
```

```shell
ipconfig getifaddr en0
```

2. Start the backend:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/backend
npm run dev
```

3. Start Metro with the **dev client** (not Expo Go):

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npm run dev
```

Equivalent:

```shell
npx expo start --dev-client --host lan
```

4. On first launch, iOS may ask **“Hisab Boi would like to find and connect to devices on your local network”** — tap **OK**. If you previously denied it (or see “Local Network Disabled”):

   - iPhone → **Settings → Privacy & Security → Local Network → Hisab Boi → ON**
   - If **Hisab Boi** is missing from that list, the build lacked Local Network keys — rebuild with the current `app.json` / `Info.plist`, or delete the app and reinstall Debug so the prompt appears again.

5. Open **Hisab Boi** on the iPhone (home screen icon). It should connect to Metro automatically. If discovery fails, enter the Metro URL manually (`http://YOUR_MAC_LAN_IP:8081`), or shake the device → **Configure Bundler**.

6. After changing `.env.local`, restart Metro with a clean cache:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/mobile
npx expo start --dev-client --host lan --clear
```

**USB tips**

- Keep the cable connected, iPhone unlocked, and **Trust This Computer** accepted.
- Phone and Mac should reach each other on the LAN for both API (`:5050`) and Metro (`:8081`). Guest Wi‑Fi that isolates clients will break this.
- If discovery fails, open Hisab Boi → enter the Metro URL manually (`http://YOUR_MAC_LAN_IP:8081`).

---

### Option B — Release build + local API (no Metro)

You already use this for the free Xcode Release install. The JS bundle and `EXPO_PUBLIC_*` values are **baked in at build time**, so:

1. Set local API in `mobile/.env.local`:

```env
EXPO_PUBLIC_BASE_URL=http://YOUR_MAC_LAN_IP:5050/api
```

2. Rebuild and reinstall **Release** (env change requires a new install — see **Install on iPhone for Free** / **Install an Updated Version Later**).

3. Start only the backend:

```shell
cd /Users/alamgirhossain/Themeforest/cash-book/backend
npm run dev
```

4. Open **Hisab Boi** on the phone. No Expo / Metro terminal needed.

To switch back to the deployed API, set:

```env
EXPO_PUBLIC_BASE_URL=https://cash-book-seven.vercel.app/api
```

…then rebuild + reinstall Release again.

---

### Quick checklist

| Goal | Build on phone | `.env.local` | Commands |
| --- | --- | --- | --- |
| Code with live reload, local API | Debug / dev client | Mac LAN IP → `:5050/api` | `backend: npm run dev` + `mobile: npm run dev` |
| Use Release like production, local API | Release | Mac LAN IP → `:5050/api` | Rebuild Release, then `backend: npm run dev` only |
| Use Release + production API | Release | Vercel URL | Rebuild Release if URL changed; no local servers |

---

## ❓ iPhone Install Troubleshooting

| Problem | Fix |
| --- | --- |
| App stays on splash forever | Debug build waiting for Metro — run `npm run dev` in `mobile/`, or install Release if you want offline use. |
| Expo Go won’t open / wrong SDK | Expected. Use the installed **Hisab Boi** app (dev client or Release), not Expo Go. See **Local mode on physical iPhone**. |
| Local Network Disabled / can’t find Metro | Allow Local Network for Hisab Boi (Settings → Privacy & Security → Local Network). Rebuild Debug after adding `NSLocalNetworkUsageDescription` + `NSBonjourServices` (`_expo._tcp`). Or enter Metro URL manually: `http://YOUR_MAC_LAN_IP:8081`. |
| Developer Mode disabled | iPhone → Settings → Privacy & Security → Developer Mode → ON. |
| Untrusted Developer | iPhone → Settings → General → VPN & Device Management → Trust your Apple Development profile. |
| Keychain popup appears | Enter the Mac login password, not the Apple ID password, then click **Always Allow**. |
| Sandbox build error | Confirm `ENABLE_USER_SCRIPT_SANDBOXING = NO`; this repo includes `mobile/plugins/with-ios-user-script-sandboxing.js`. |
| Device locked error | Unlock the iPhone and run the install/launch command again. |
| **"Hisab Boi" is No Longer Available** | Free Apple signing expired (~7 days). Run **both** build + install commands in **Refresh Free Apple ID After ~7 Days** (build alone is not enough). |
| App disappears or stops opening after days | Same as above — rebuild, reinstall, and re-trust the developer profile if needed. |
| iPhone not detected | Reconnect USB, unlock iPhone, tap **Trust This Computer**, then restart Xcode. |
| `pod install` fails on `hermes-engine` download | Network glitch downloading from Maven. Retry: `cd mobile/ios && pod install`. If it still fails, clear cache then retry: `rm -rf ~/Library/Caches/CocoaPods/Pods/External/hermes-engine && pod install`. |

---

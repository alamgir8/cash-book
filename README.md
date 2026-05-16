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
  -destination 'id=00008140-0004384608A2201C' \
  -derivedDataPath /Users/alamgirhossain/Library/Developer/Xcode/DerivedData/HisabBoiRelease \
  build
```

Install the Release app on the connected iPhone:

```shell
xcrun devicectl device install app \
  --device 43B8F391-1D7E-51F4-B8C3-7B0552CE18DE \
  /Users/alamgirhossain/Library/Developer/Xcode/DerivedData/HisabBoiRelease/Build/Products/Release-iphoneos/HisabBoi.app
```

Now unlock the iPhone and open **Hisab Boi** from the home screen.

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
  -destination 'id=00008140-0004384608A2201C' \
  -derivedDataPath /Users/alamgirhossain/Library/Developer/Xcode/DerivedData/HisabBoiRelease \
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
| Debug | Yes, run `npx expo start --dev-client --host lan` | Development and live debugging |
| Release | No | Normal iPhone use, like an Android APK |

Use Debug only when actively developing. Use Release for normal daily use.

---

## ❓ iPhone Install Troubleshooting

| Problem | Fix |
| --- | --- |
| App stays on splash forever | You probably installed Debug. Install Release using the commands above. |
| Developer Mode disabled | iPhone → Settings → Privacy & Security → Developer Mode → ON. |
| Untrusted Developer | iPhone → Settings → General → VPN & Device Management → Trust your Apple Development profile. |
| Keychain popup appears | Enter the Mac login password, not the Apple ID password, then click **Always Allow**. |
| Sandbox build error | Confirm `ENABLE_USER_SCRIPT_SANDBOXING = NO`; this repo includes `mobile/plugins/with-ios-user-script-sandboxing.js`. |
| Device locked error | Unlock the iPhone and run the install/launch command again. |
| App disappears or stops opening after days | Free Apple signing expired; rebuild and install the Release app again. |
| iPhone not detected | Reconnect USB, unlock iPhone, tap **Trust This Computer**, then restart Xcode. |

---

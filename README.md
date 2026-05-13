# hisab-boi
Hisab Boi Documentation

# 🍽️ React Native POS App (Multi-Tenant)

A sleek, multi-tenant Point of Sale system built using React Native + Expo + MERN stack.

---

## 🚀 Features

- ✅ Dynamic product data with variants & extras
- 🔄 Order parking, re-parking, and status tracking
- 📱 Multi-tab layout: POS | Cart | Bar | KDS | Completed Orders
- ⚡ Cloudinary image uploads
- 🧠 State with Zustand | Data with React Query

---

## 🖼️ UI Preview

| POS Tab | Bar Tab | Cart Tab |
|--------|---------|----------|
| ![POS](link-to-image) | ![Bar](link-to-image) | ![Cart](link-to-image) |

---

## ⚙️ Tech Stack

- **Frontend:** React Native + Expo
- **Backend:** Express.js + MongoDB + Node.js
- **State:** Zustand
- **Data Fetching:** React Query
- **Cloud Storage:** Cloudinary

---

## 🧪 Setup Instructions

```bash
git clone https://github.com/yourname/your-repo.git
cd your-repo
npm install
expo start


# Hisab Boi

## Quick start


- To run on local first you need to setup all .env file for backend and store

- Admin all .env.local file key
```shell


```



- Install Dependency
(To install node dependency go to the related folder then run this command)

```shell
npm install
```


- Run on Local

```shell
Run Admin : npm start
```






- To build apk for android with expo:


- To build .apk file

```shell
eas build -p android --profile preview
eas build -p android --profile preview --clear-cache

- To build .ipa file
eas build -p ios --profile preview --clear-cache
```

- To build .aab file


```shell
eas build --platform android
```


- To build .aab file

```shell
eas build --profile preview2

```

- To build .aab file for production

```shell
eas build -p android --profile production --clear-cache


```


- To check all package vulnerabilities and update
```shell
npx expo-doctor
npx expo install --check
```


- To Login in expo account from terminal
```shell
expo login
```


- To Login out in expo account from terminal
```shell
expo logout
```

build locally
eas build --platform android --local

npm start -- --reset-cache



```shell
To start the local server:
```
npx expo start

---

## 📱 Install on iPhone for Free (No App Store, No $99/year)

This method uses **AltStore** to sideload the app permanently on your personal iPhone using a free Apple ID.
The app auto-renews every 7 days in the background — you will never notice the expiry.

---

### ✅ Prerequisites

- Mac with Xcode installed
- iPhone connected to the same WiFi as Mac
- Free Apple ID (can be any Apple ID — does not need to be your main one)
- USB cable (needed only for first-time AltStore install)

---

### 🔧 Step 1 — Install Xcode Command Line Tools

Open Terminal on your Mac and run:

```shell
xcode-select --install
```

If already installed, it will say "already installed" — skip to next step.

---

### 📦 Step 2 — Build the IPA Locally

Navigate to the mobile folder and build:

```shell
cd /path/to/cash-book/mobile
eas build -p ios --profile preview --local
```

> This runs the build entirely on your Mac (no EAS cloud, no cost).
> It will take 5–15 minutes the first time.
> When done, a `.ipa` file is created inside the `build/` folder or printed as an output path.
> Note the full path to the `.ipa` file — you will need it in Step 5.

---

### 🖥️ Step 3 — Install AltServer on Your Mac

1. Go to **[altstore.io](https://altstore.io)** in your browser
2. Download **AltServer for Mac**
3. Open the downloaded `.dmg` file
4. Drag AltServer into your Applications folder
5. Open AltServer from Applications
6. You will see a **diamond icon** appear in your Mac menu bar (top-right)
7. Click the diamond icon → **Sign In** → enter your free Apple ID email and password

> AltServer only uses your Apple ID to sign apps — it does not post anything or access purchases.

---

### 📲 Step 4 — Install AltStore on Your iPhone

1. Connect your iPhone to your Mac with a **USB cable**
2. Click the AltServer diamond icon in the Mac menu bar
3. Click **Install AltStore**
4. Select your iPhone from the list
5. Enter your Apple ID email and password when prompted
6. Wait ~30 seconds — AltStore will appear on your iPhone home screen

**Then trust the certificate on your iPhone:**

1. Open **Settings** on iPhone
2. Go to **General → VPN & Device Management**
3. Tap your Apple ID email under "Developer App"
4. Tap **Trust "[your Apple ID]"**
5. Tap **Trust** again on the confirmation popup

> If you don't do this step, apps will show "Untrusted Developer" and won't open.

---

### 📥 Step 5 — Sideload the App onto Your iPhone

**Option A — Via AirDrop (easiest):**

1. Find the `.ipa` file on your Mac (from Step 2)
2. Right-click the `.ipa` → **Share → AirDrop** → select your iPhone
3. On iPhone, tap **Accept**
4. When prompted "Open with...", tap **AltStore**
5. AltStore signs and installs the app — takes about 30 seconds

**Option B — Via Files app:**

1. AirDrop or copy the `.ipa` to your iPhone's Files app
2. Open **AltStore** on iPhone
3. Tap **My Apps** tab (bottom)
4. Tap the **+** button (top-left corner)
5. Navigate to the `.ipa` file and tap it
6. AltStore installs and signs it

---

### 🔄 Step 6 — Setup Auto-Renewal (So It Never Expires)

The free Apple certificate expires every 7 days, but AltServer renews it automatically.

**Requirements for auto-renewal:**

- AltServer must be **running on your Mac** (it runs silently in the menu bar)
- Your Mac and iPhone must be on the **same WiFi network** at least once every 7 days

**Verify AltServer auto-starts on Mac login:**

1. Open **System Settings → General → Login Items**
2. Check that **AltServer** is in the list
3. If not, open AltServer manually from Applications — it adds itself automatically

> You never need to do anything manually. AltServer silently refreshes the certificate in the background.

---

### 🚀 Step 7 — Updating the App

Every time you add new features and want to update the app on your iPhone:

```shell
# 1. Build a new IPA
cd /path/to/cash-book/mobile
eas build -p ios --profile preview --local

# 2. AirDrop the new .ipa to iPhone → Open with AltStore
# AltStore replaces the old version — all your app data is preserved
```

---

### ❓ Troubleshooting

| Problem | Fix |
| --- | --- |
| "Untrusted Developer" error | Settings → General → VPN & Device Management → Trust your Apple ID |
| App not auto-renewing | Make sure AltServer is running on Mac and both devices are on same WiFi |
| AltStore shows "No Apple ID" | Click AltServer menu bar icon → Sign In again |
| Build fails with Xcode error | Run `xcode-select --install` and make sure Xcode is fully opened at least once |
| `.ipa` not showing in Files | Re-send via AirDrop or use a USB cable + Finder to copy to iPhone |
| "Maximum number of apps" error | Free Apple ID limit is 3 sideloaded apps total — delete one from AltStore first |

---

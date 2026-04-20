# SAHAYAK – That sees, listens and moves with you

**SAHAYAK** is a web-based assistive platform designed to empower **visually impaired and motor-impaired users** through voice interaction, emergency support, and seamless caregiver coordination.

> "Sahayak" means helper — and that’s exactly what this platform aims to be.

---

# 📌 Table of Contents

* Overview
* Features
* System Architecture
* Project Structure
* Demo
* Installation
* Usage
* Technologies Used
* Browser Support

---

# 🧠 Overview

SAHAYAK provides an **accessible, voice-enabled interface** that allows users to interact with digital systems without relying heavily on vision or physical input.

It supports:

*  Voice-based commands
*  Audio feedback (Text-to-Speech)
*  Emergency SOS alerts
*  Caregiver monitoring system

---

#  Features

##  For Users

*  **Voice Assistant** – Interact using natural voice commands
*  **Screen Reader** – Reads UI content aloud
*  **Document Reader** – Supports PDF, DOCX, TXT
*  **Emergency SOS** – One-tap emergency alert
*  **Voice Requests** – Send help requests to caregivers
*  **Request History** – Track all requests

---

##  For Caregivers

*  **User Monitoring** – Track linked users
*  **SOS Management** – Respond to emergency alerts
*  **Activity Tracking** – Monitor user actions and health signals

---

##  Accessibility Features

*  Speech Recognition (hands-free control)
*  Text-to-Speech (audio output)
*  High-contrast UI (low vision friendly)
*  Large touch targets (motor impairment support)
*  Offline support using localStorage

---

#  System Architecture

```
User Interaction (Voice / UI)
            ↓
   JavaScript Logic (script.js)
            ↓
   Browser APIs (Speech, Audio, Storage)
            ↓
   Data Storage (localStorage / Firebase)
            ↓
   UI Update (Dashboard / Alerts / Logs)
```

###  Flow Explanation:

1. User gives input (voice or click)
2. JavaScript processes command
3. API performs action (speech / storage / notification)
4. Data is stored and UI updates
5. Caregiver dashboard reflects changes

---

#  Project Structure

```
SAHAYAK/
│── index.html        # Main UI structure
│── style.css         # Styling and accessibility UI
│── script.js         # Core logic (voice, SOS, reminders)
│── app.js            # Backend/Firebase integration
│── image/            # Assets (logo, icons)
│── docs/             # Documentation files
```

###  File Roles:

* **index.html** → UI layout
* **style.css** → Design + responsiveness
* **script.js** → Core functionality
* **app.js** → Data handling (Firebase/demo mode)

---

# 🎥 Demo

To try the application:

1. Open `index.html` in a browser
2. Sign up as:

   * User 👤
   * Caregiver 👨‍⚕️
3. Test features like:

   * Voice assistant
   * SOS alert
   * Document reader

---

# ⚙️ Installation

##  Prerequisites

* Modern browser (Chrome recommended)
* Microphone access 🎤
* Speakers/headphones 🔊

---

##  Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/sahayak.git

# Open project
cd sahayak

# Run
Open index.html in browser
```

---

##  Optional (Firebase Setup)

1. Create Firebase project
2. Add config in `app.js`
3. Enable authentication + Firestore
4. Deploy on hosting

---

# 📖 Usage

##  Getting Started

1. Sign up (User/Caregiver)
2. Allow permissions
3. Access dashboard

---

##  Voice Commands

* "Read screen"
* "SOS" / "Help me"
* "Food", "Water", "Washroom"

---

##  Emergency SOS

* Click SOS button
* Alert sent to caregiver
* Audio confirmation plays

---

##  Document Reading

* Upload file (.txt/.pdf/.docx)
* System reads content aloud

---

#  Technologies Used

* **Frontend**: HTML5, CSS3, JavaScript

* **APIs**:
  * Web Speech API
  * Web Audio API
  * Notification API
  * FileReader API

* **Libraries**:
  * PDF.js
  * Mammoth.js

* **Storage**:
  * localStorage (offline mode)
  * Firebase (optional backend)

---

# 🌍 Browser Support

| Browser | Support                  |
| ------- | ------------------------ |
| Chrome  | ✅ Recommended            |
| Edge    | ✅                        |
| Firefox | ⚠️ Limited voice support |
| Safari  | ⚠️ Partial support       |

---

#  Final Note

> SAHAYAK is built to **bridge the accessibility gap** using simple, powerful web technologies.
 *Empowering independence through technology.*

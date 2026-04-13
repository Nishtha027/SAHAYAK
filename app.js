/* Sahayak - Accessibility-focused mobile web app
   - Screen navigation (sections show/hide)
   - Firebase Auth + Firestore (when configured)
   - Demo fallback (localStorage) when Firebase config is not set
*/

// =========================
// Firebase configuration
// =========================
const firebaseConfig = {
  // Replace these with your Firebase project config:
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // appId: "YOUR_APP_ID",
};

function isFirebaseConfigured() {
  const v = Object.values(firebaseConfig || {});
  if (!v.length) return false;
  return v.every((x) => typeof x === "string" && x.length > 0 && !x.startsWith("YOUR_"));
}

const MODE = {
  firebase: false,
};

let auth = null;
let db = null;

try {
  if (typeof firebase !== "undefined" && isFirebaseConfigured()) {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    MODE.firebase = true;
  }
} catch (e) {
  // Stay in demo mode
  MODE.firebase = false;
}

// =========================
// DOM utilities
// =========================
const $ = (id) => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ui = {
  shell: qs(".app-shell"),
  status: $("app-status"),
  toast: $("toast"),

  screens: {
    onboarding: $("screen-onboarding"),
    login: $("screen-login"),
    role: $("screen-role"),
    selection: $("screen-selection"),
    userHome: $("screen-user-home"),
    caregiverHome: $("screen-caregiver-home"),
    activity: $("screen-activity"),
    profile: $("screen-profile"),
  },

  navItems: qsa(".nav-item"),

  // Login
  loginEmail: $("login-email"),
  loginPassword: $("login-password"),
  btnGetStarted: $("btn-get-started"),
  btnLogin: $("btn-login"),
  btnSignup: $("btn-signup"),
  loginError: $("login-error"),

  // Role
  roleCards: qsa("[data-pick-role]"),
  selectionCards: qsa("[data-select-disability]"),

  // User features
  userHomeSubtitle: $("user-home-subtitle"),
  featureCards: qsa("[data-feature-key]"),
  featureLabels: qsa("[data-feature-label]"),
  btnReadScreen: $("btn-read-screen"),
  btnVoiceCommand: $("btn-voice-command"),
  btnEmergencySos: $("btn-emergency-sos"),
  btnStt: $("btn-stt"),
  sttOutput: $("transcriptionBox"),
  emotionOutput: $("emotionText"),
  sttSummary: $("summaryText"),
  ocrUpload: $("ocr-upload"),
  ocrOutput: $("ocr-output"),
  ocrPreviewWrap: $("ocr-preview-wrap"),
  ocrPreviewImg: $("ocr-preview-img"),
  ocrStatus: $("ocr-status"),
  sceneWorkspace: $("scene-workspace"),
  sceneLiveBlock: $("scene-live-block"),
  sceneVideo: $("scene-video"),
  sceneResultBlock: $("scene-result-block"),
  sceneCapturedImg: $("scene-captured-img"),
  sceneDescriptionText: $("scene-description-text"),
  btnCaptureScene: $("btn-capture-scene"),
  btnSoundAlert: $("btn-sound-alert"),
  btnVoiceAction: $("btn-voice-action"),
  btnEasyMode: $("btn-easy-mode"),

  // Activity
  activitySubtitle: $("activity-subtitle"),
  activityList: $("activity-list"),

  // Caregiver
  caregiverLinkInput: $("caregiver-link-email"),
  btnCaregiverLink: $("btn-caregiver-link"),
  cgUserEmail: $("cg-user-email"),
  cgUserDisability: $("cg-user-disability"),
  cgActivity: $("cg-activity"),
  cgAlerts: $("cg-alerts"),
  cgLastActivity: $("cg-last-activity"),
  cgMostUsed: $("cg-most-used"),
  cgActivityCount: $("cg-activity-count"),
  cgInactivityAlert: $("cg-inactivity-alert"),

  // Profile
  profileName: $("profile-name"),
  profileRole: $("profile-role"),
  profileDisability: $("profile-disability"),
  profileUid: $("profile-uid"),
  btnLogout: $("btn-logout"),
};

function setStatus(text) {
  ui.status.textContent = text || "";
}

let toastTimer = null;
function toast(message) {
  if (!message) return;
  ui.toast.textContent = message;
  ui.toast.classList.add("is-open");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("is-open"), 2200);
}

function showScreen(key) {
  Object.values(ui.screens)
    .filter(Boolean)
    .forEach((el) => el.classList.remove("is-active"));
  ui.screens[key]?.classList.add("is-active");

  const navVisible = key === "userHome" || key === "caregiverHome" || key === "activity" || key === "profile";
  ui.shell?.classList.toggle("nav-hidden", !navVisible);

}

function setNavActive(key) {
  ui.navItems.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.nav === key));
}

function formatWhen(ts) {
  const d = ts instanceof Date ? ts : new Date(ts || Date.now());
  return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

// =========================
// State + storage
// =========================
const LS = {
  session: "sahayak_session",
  role: "sahayak_role",
  disability: "sahayak_disability",
  demoUsers: "sahayak_demo_users",
  demoCaregivers: "sahayak_demo_caregivers",
  demoActivity: "sahayak_demo_activity_logs",
  demoAlerts: "sahayak_demo_alerts",
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const state = {
  user: null, // { uid, email, displayName }
  role: null, // "user" | "caregiver"
  disability: null,
  soundAlertMode: false,
  easyMode: false,
  lastSpeechText: "",
  currentDomainFeatures: [],
  caregiver: {
    linkedUserId: null,
  },
};

/** Latest live transcription text (kept in sync with #transcriptionBox). */
let currentText = "";

const DOMAIN_CONFIG = {
  "Visually Impaired": {
    subtitle: "Personalised tools for visually impaired support",
    quickActions: ["Voice Navigation", "Scene Description", "Screen Reader", "Text Recognition"],
  },
  "Hearing Impaired": {
    subtitle: "Personalised tools for hearing impaired support",
    quickActions: ["Live Transcription", "Emotion Tags", "Sound Alerts", "Summarizer"],
  },
  "Motor Impairment": {
    subtitle: "Personalised tools for motor impairment support",
    quickActions: ["Voice Commands", "Predictive Mode", "Simplified UI", "Compound Voice"],
  },
};

function persistRoleDisability() {
  if (state.role) localStorage.setItem(LS.role, state.role);
  if (state.disability) localStorage.setItem(LS.disability, state.disability);
}

function hydrateRoleDisability() {
  const r = localStorage.getItem(LS.role);
  const d = localStorage.getItem(LS.disability);
  if (r) state.role = r;
  if (d) state.disability = d;
}

// =========================
// Data layer (Firebase or Demo)
// =========================
function demoUidForEmail(email) {
  const base = (email || "demo").trim().toLowerCase();
  const safe = btoa(unescape(encodeURIComponent(base))).replaceAll("=", "").slice(0, 18);
  return `demo_${safe}`;
}

async function dataSignIn(email, password) {
  if (MODE.firebase) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  // Demo: accept any non-empty email/password
  if (!email || !password) throw new Error("missing_credentials");
  const uid = demoUidForEmail(email);
  const user = { uid, email, displayName: email.split("@")[0] || "Sahayak User" };
  state.user = user;
  saveJSON(LS.session, user);
  return user;
}

async function dataSignUp(email, password) {
  if (MODE.firebase) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const user = cred.user;
    await db.collection("users").doc(user.uid).set(
      {
        uid: user.uid,
        email: (user.email || email || "").toLowerCase(),
        role: "user",
      },
      { merge: true }
    );
    return user;
  }

  // Demo: create a local user profile
  if (!email || !password) throw new Error("missing_credentials");
  const uid = demoUidForEmail(email);
  const user = { uid, email, displayName: email.split("@")[0] || "Sahayak User" };
  state.user = user;
  saveJSON(LS.session, user);
  await upsertUserProfile(uid, {
    uid,
    email: String(email || "").toLowerCase(),
    role: "user",
    name: user.displayName,
  });
  return user;
}

async function dataSignOut() {
  if (MODE.firebase) return auth.signOut();
  localStorage.removeItem(LS.session);
  state.user = null;
}

function dataOnAuthChanged(cb) {
  if (MODE.firebase) {
    return auth.onAuthStateChanged((u) => cb(u));
  }
  // Demo: fire immediately with stored session
  const user = loadJSON(LS.session, null);
  cb(user);
  return () => {};
}

async function getUserProfile(uid) {
  if (!uid) return null;
  if (MODE.firebase) {
    const snap = await db.collection("users").doc(uid).get();
    return snap.exists ? snap.data() : null;
  }
  const users = loadJSON(LS.demoUsers, {});
  return users[uid] || null;
}

async function upsertUserProfile(uid, patch) {
  if (!uid) return;
  if (MODE.firebase) {
    await db.collection("users").doc(uid).set(patch, { merge: true });
    return;
  }
  const users = loadJSON(LS.demoUsers, {});
  users[uid] = { ...(users[uid] || {}), ...patch };
  saveJSON(LS.demoUsers, users);
}

async function getCaregiverProfile(uid) {
  if (!uid) return null;
  if (MODE.firebase) {
    const snap = await db.collection("caregivers").doc(uid).get();
    return snap.exists ? snap.data() : null;
  }
  const cgs = loadJSON(LS.demoCaregivers, {});
  return cgs[uid] || null;
}

async function upsertCaregiverProfile(uid, patch) {
  if (!uid) return;
  if (MODE.firebase) {
    await db.collection("caregivers").doc(uid).set(patch, { merge: true });
    return;
  }
  const cgs = loadJSON(LS.demoCaregivers, {});
  cgs[uid] = { ...(cgs[uid] || {}), ...patch };
  saveJSON(LS.demoCaregivers, cgs);
}

async function addActivityLog({ userId, feature }) {
  if (!userId || !feature) return;
  if (MODE.firebase) {
    await db.collection("activity_logs").add({
      userId,
      feature,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }
  const logs = loadJSON(LS.demoActivity, []);
  logs.unshift({ userId, feature, timestamp: Date.now() });
  saveJSON(LS.demoActivity, logs.slice(0, 200));
}

// Logs a dashboard feature usage entry for the signed-in user.
async function logActivity(featureName) {
  const userId = state.user?.uid;
  if (!userId || !featureName) return;
  await addActivityLog({ userId, feature: featureName });
}

async function findUserUidByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  if (MODE.firebase) {
    const snap = await db.collection("users").where("email", "==", normalized).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data() || {};
    return data.uid || doc.id || null;
  }

  const users = loadJSON(LS.demoUsers, {});
  const found = Object.entries(users).find(([, value]) => String(value?.email || "").toLowerCase() === normalized);
  return found ? found[0] : null;
}

// Links the current caregiver account to a user account by email.
async function linkCaregiver(userEmail) {
  const caregiverId = state.user?.uid;
  const normalizedEmail = String(userEmail || "").trim().toLowerCase();
  if (!caregiverId || !normalizedEmail) return null;
  const userId = await findUserUidByEmail(normalizedEmail);
  if (!userId) return null;

  state.caregiver.linkedUserId = userId;
  await upsertCaregiverProfile(caregiverId, {
    caregiverId,
    linkedUserId: userId,
    linkedUserEmail: normalizedEmail,
    role: "caregiver",
    email: state.user?.email || "",
  });
  return userId;
}

// Creates an emergency alert entry and returns when it is stored.
async function createEmergencyAlert() {
  const userId = state.user?.uid;
  if (!userId) return;

  if (MODE.firebase) {
    await db.collection("alerts").add({
      userId,
      status: "active",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const alerts = loadJSON(LS.demoAlerts, []);
  alerts.unshift({ userId, status: "active", timestamp: Date.now() });
  saveJSON(LS.demoAlerts, alerts.slice(0, 100));
}

function supportsSpeechRecognition() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function supportsSpeechSynthesis() {
  return typeof window.speechSynthesis !== "undefined" && window.speechSynthesis;
}

/** Single shared SpeechRecognition instance to avoid overlapping sessions. */
const speechRec = {
  instance: null,
  mode: null, // "voice_nav" | "live_stt" | "voice_cmd"
};

function getRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getSharedRecognition() {
  const Ctor = getRecognitionConstructor();
  if (!Ctor) return null;
  if (!speechRec.instance) {
    speechRec.instance = new Ctor();
  }
  return speechRec.instance;
}

function detachRecognitionHandlers(rec) {
  if (!rec) return;
  rec.onresult = null;
  rec.onerror = null;
  rec.onend = null;
  rec.onstart = null;
  rec.onspeechstart = null;
  rec.onspeechend = null;
}

function stopSharedRecognition(reason) {
  const rec = speechRec.instance;
  speechRec.mode = null;
  if (!rec) {
    syncListeningButtonLabels();
    return;
  }
  detachRecognitionHandlers(rec);
  try {
    rec.abort();
  } catch (e) {
    try {
      rec.stop();
    } catch (e2) {
      console.error("SpeechRecognition stop/abort failed:", e2);
    }
  }
  syncListeningButtonLabels();
  if (reason && typeof console !== "undefined" && console.debug) {
    console.debug("Speech recognition stopped:", reason);
  }
}

function recognitionErrorMessage(code) {
  const m = {
    "not-allowed": "Microphone permission denied. Allow access in browser settings.",
    "aborted": "Listening stopped.",
    "no-speech": "No speech detected. Try again.",
    "audio-capture": "No microphone found.",
    "network": "Network error for speech service.",
    "service-not-allowed": "Speech service not allowed.",
  };
  return m[code] || "Voice input failed.";
}

function getDefaultVoiceCommandButtonText() {
  return state.disability === "Motor Impairment" ? "Voice Commands" : "Voice Navigation";
}

function getDefaultSttButtonText() {
  return "Live Transcription";
}

function getDefaultReadScreenButtonText() {
  return state.disability === "Visually Impaired" ? "Screen Reader" : "Feature Action";
}

/** Dedicated Voice Action instance (separate from shared speechRec STT / nav). */
let recognition;
let isListening = false;

/** One-shot compound voice session (separate from voice action + shared STT). */
let compoundRecognition = null;

function syncListeningButtonLabels() {
  const navListening = speechRec.mode === "voice_nav";
  const sttListening = speechRec.mode === "live_stt";
  const voiceCmdListening = speechRec.mode === "voice_cmd";
  if (ui.btnVoiceCommand) {
    if (state.disability === "Motor Impairment") {
      ui.btnVoiceCommand.textContent = voiceCmdListening ? "Stop Voice Commands" : "Voice Commands";
    } else {
      ui.btnVoiceCommand.textContent = navListening ? "Stop Voice Navigation" : "Voice Navigation";
    }
  }
  if (ui.btnStt) {
    ui.btnStt.textContent = sttListening ? "Stop Transcription" : getDefaultSttButtonText();
  }
  if (ui.btnVoiceAction) {
    ui.btnVoiceAction.textContent = isListening ? "Stop Voice Action" : "Start Voice Action";
  }
}

// Reads the current screen text (or fallback) with browser TTS.
function stopSpeaking() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
  } catch (e) {
    console.error("speechSynthesis.cancel failed:", e);
  }
}

function speakText(text, onEnd) {
  const synth = window.speechSynthesis;
  if (!synth) {
    toast("Text to speech is not supported in this browser.");
    return;
  }
  const content = (text || "").trim() || "Welcome to Sahayak. Accessibility tools are ready.";
  try {
    synth.cancel();
  } catch (e) {
    console.error("speechSynthesis.cancel before speak:", e);
  }
  const utter = new SpeechSynthesisUtterance(content);
  utter.rate = 0.95;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (typeof onEnd === "function") onEnd();
  };
  utter.onerror = (ev) => {
    console.error("SpeechSynthesis utterance error:", ev);
    finish();
  };
  utter.onend = finish;
  synth.speak(utter);
}

function getActiveScreenText() {
  const active = qs(".app-screen.is-active");
  if (!active) return "";
  return active.innerText || active.textContent || "";
}

function getDomainConfig() {
  return DOMAIN_CONFIG[state.disability] || DOMAIN_CONFIG["Visually Impaired"];
}

function configureDomainDashboard() {
  const conf = getDomainConfig();
  state.currentDomainFeatures = conf.quickActions.slice();
  if (ui.userHomeSubtitle) ui.userHomeSubtitle.textContent = conf.subtitle;
  ui.featureLabels.forEach((labelEl) => {
    const key = labelEl.dataset.featureLabel;
    const idx = Number(String(key || "").split("-")[1]) - 1;
    labelEl.textContent = conf.quickActions[idx] || "Feature";
  });
  if (ui.btnVoiceCommand && speechRec.mode !== "voice_nav" && speechRec.mode !== "voice_cmd") {
    ui.btnVoiceCommand.textContent = getDefaultVoiceCommandButtonText();
  }
  if (ui.btnReadScreen && !(window.speechSynthesis && window.speechSynthesis.speaking)) {
    ui.btnReadScreen.textContent = getDefaultReadScreenButtonText();
  }
  if (ui.btnStt && speechRec.mode !== "live_stt") {
    ui.btnStt.textContent = getDefaultSttButtonText();
  }
  syncListeningButtonLabels();
}

function navigateByVoiceCommand(command) {
  const cmd = String(command || "").toLowerCase();
  if (cmd.includes("home") || cmd.includes("dashboard")) {
    goHome();
    return "Navigated to home.";
  }
  if (cmd.includes("profile")) {
    showScreen("profile");
    setNavActive("profile");
    return "Navigated to profile.";
  }
  if (cmd.includes("activity")) {
    showScreen("activity");
    setNavActive("activity");
    refreshActivityScreen();
    return "Navigated to activity.";
  }
  return "Command not recognized.";
}

async function runVoiceNavigation() {
  if (!supportsSpeechRecognition()) {
    toast("Voice recognition is not supported in this browser.");
    console.error("SpeechRecognition API unavailable");
    return;
  }

  if (speechRec.mode === "voice_nav") {
    stopSharedRecognition("user_toggle");
    toast("Voice navigation stopped.");
    return;
  }

  stopSharedRecognition("switch_mode");

  const recognition = getSharedRecognition();
  if (!recognition) {
    toast("Voice recognition is not supported in this browser.");
    return;
  }

  speechRec.mode = "voice_nav";
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = async (event) => {
    let display = "";
    for (let i = 0; i < event.results.length; i++) {
      display += event.results[i][0]?.transcript || "";
    }
    const trimmed = display.trim();
    if (trimmed) {
      setStatus(`Heard: ${trimmed}`);
    } else {
      setStatus("Listening for: home, activity, profile…");
    }

    let newFinal = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        newFinal += event.results[i][0]?.transcript || "";
      }
    }
    if (newFinal.trim()) {
      const message = navigateByVoiceCommand(newFinal.trim());
      toast(message);
      await logActivity("voice_navigation");
    }
  };

  recognition.onerror = (ev) => {
    console.error("Voice navigation recognition error:", ev?.error, ev);
    toast(recognitionErrorMessage(ev?.error || ""));
    if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
      stopSharedRecognition(ev.error);
    }
  };

  recognition.onend = () => {
    if (speechRec.mode === "voice_nav") {
      try {
        recognition.start();
      } catch (e) {
        console.error("Voice navigation restart failed:", e);
        speechRec.mode = null;
        syncListeningButtonLabels();
      }
    } else {
      syncListeningButtonLabels();
    }
  };

  try {
    recognition.start();
    setStatus("Listening for: home, activity, profile…");
    syncListeningButtonLabels();
  } catch (e) {
    console.error("Voice navigation start failed:", e);
    speechRec.mode = null;
    toast("Could not start voice navigation.");
    syncListeningButtonLabels();
  }
}

/** Short-lived toast-style popup (emotion / summarizer results). */
function showPopup(message) {
  const popup = document.createElement("div");
  popup.innerText = message;
  popup.style.position = "fixed";
  popup.style.bottom = "100px";
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";
  popup.style.background = "#8FAF8A";
  popup.style.color = "white";
  popup.style.padding = "12px 20px";
  popup.style.borderRadius = "20px";
  popup.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
  popup.style.zIndex = "999";
  popup.style.maxWidth = "min(90vw, 360px)";
  popup.style.textAlign = "center";
  popup.style.fontFamily = "inherit";
  popup.setAttribute("role", "status");
  popup.setAttribute("aria-live", "polite");

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 3000);
}

/** Hide legacy inline emotion/summary rows (results use popups only). */
function hideEmotionSummaryPanels() {
  ["emotionText", "summaryText"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.hidden = true;
      el.style.display = "none";
    }
  });
}

/**
 * Syncs transcription only (speech or manual). Emotion / summary are shown via quick-action popups.
 */
function updateTextFeatures(text) {
  const raw = text == null ? "" : String(text);
  console.log("Transcription:", raw);

  currentText = raw;
  state.lastSpeechText = raw.trim();

  const tb = document.getElementById("transcriptionBox");
  if (tb) tb.value = raw;
}

async function handleEmotionClick() {
  const raw = ui.sttOutput?.value ?? currentText ?? state.lastSpeechText ?? "";
  const text = String(raw).toLowerCase();

  let emotion = "Neutral";
  if (text.includes("sad") || text.includes("tired") || text.includes("bad")) {
    emotion = "Sad";
  } else if (text.includes("happy") || text.includes("good") || text.includes("great")) {
    emotion = "Happy";
  } else if (text.includes("angry") || text.includes("mad")) {
    emotion = "Angry";
  }

  showPopup("Emotion: " + emotion);
  await logActivity("emotion_tags");
}

async function handleSummaryClick() {
  const text = String(ui.sttOutput?.value ?? currentText ?? state.lastSpeechText ?? "").trim();

  if (!text) {
    showPopup("No input to summarize");
    return;
  }

  const summary = text.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  showPopup("Summary: " + summary);
  await logActivity("summarizer");
}

async function runLiveTranscription() {
  if (!supportsSpeechRecognition()) {
    toast("Speech recognition is not supported in this browser.");
    console.error("SpeechRecognition API unavailable");
    return;
  }

  if (speechRec.mode === "live_stt") {
    stopSharedRecognition("user_toggle");
    toast("Transcription stopped.");
    return;
  }

  stopSharedRecognition("switch_mode");

  const recognition = getSharedRecognition();
  if (!recognition) {
    toast("Speech recognition is not supported in this browser.");
    return;
  }

  speechRec.mode = "live_stt";
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let lastLogAt = 0;
  recognition.onresult = async (event) => {
    let line = "";
    for (let i = 0; i < event.results.length; i++) {
      line += event.results[i][0]?.transcript || "";
    }
    const text = line.trim();
    updateTextFeatures(text);
    const now = Date.now();
    const last = event.results[event.results.length - 1];
    if (text && last?.isFinal && now - lastLogAt > 2500) {
      lastLogAt = now;
      await logActivity("live_transcription");
    }
  };

  recognition.onerror = (ev) => {
    console.error("Live transcription error:", ev?.error, ev);
    toast(recognitionErrorMessage(ev?.error || ""));
    if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
      stopSharedRecognition(ev.error);
    }
  };

  recognition.onend = () => {
    if (speechRec.mode === "live_stt") {
      try {
        recognition.start();
      } catch (e) {
        console.error("Live transcription restart failed:", e);
        speechRec.mode = null;
        syncListeningButtonLabels();
      }
    } else {
      syncListeningButtonLabels();
    }
  };

  try {
    recognition.start();
    setStatus("Live transcription on — speak clearly");
    syncListeningButtonLabels();
  } catch (e) {
    console.error("Live transcription start failed:", e);
    speechRec.mode = null;
    toast("Could not start transcription.");
    syncListeningButtonLabels();
  }
}

async function runVoiceCommands() {
  if (!supportsSpeechRecognition()) {
    toast("Voice recognition is not supported in this browser.");
    console.error("SpeechRecognition API unavailable");
    return;
  }

  if (speechRec.mode === "voice_cmd") {
    stopSharedRecognition("user_toggle");
    toast("Voice commands stopped.");
    return;
  }

  stopSharedRecognition("switch_mode");

  const recognition = getSharedRecognition();
  if (!recognition) {
    toast("Voice recognition is not supported in this browser.");
    return;
  }

  speechRec.mode = "voice_cmd";
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = async (event) => {
    let text = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      text += event.results[i][0]?.transcript || "";
    }
    const raw = String(text || "").trim();
    const transcript = raw.toLowerCase();
    updateTextFeatures(raw);
    setStatus(`Voice command heard: ${raw || "…"}`);
    const last = event.results[event.results.length - 1];
    if (!last?.isFinal) return;

    if (transcript.includes("open emergency") || transcript.includes("emergency")) {
      await createEmergencyAlert();
      await logActivity("emergency");
      toast("Emergency triggered");
    } else if (transcript.includes("open profile")) {
      showScreen("profile");
      setNavActive("profile");
      toast("Profile opened");
    } else {
      toast("Voice action not recognized.");
    }
    await logActivity("voice_commands");
  };

  recognition.onerror = (ev) => {
    console.error("Voice commands error:", ev?.error, ev);
    toast(recognitionErrorMessage(ev?.error || ""));
    if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
      stopSharedRecognition(ev.error);
    }
  };

  recognition.onend = () => {
    if (speechRec.mode === "voice_cmd") {
      try {
        recognition.start();
      } catch (e) {
        console.error("Voice commands restart failed:", e);
        speechRec.mode = null;
        syncListeningButtonLabels();
      }
    } else {
      syncListeningButtonLabels();
    }
  };

  try {
    recognition.start();
    setStatus("Voice commands listening…");
    syncListeningButtonLabels();
  } catch (e) {
    console.error("Voice commands start failed:", e);
    speechRec.mode = null;
    toast("Could not start voice commands.");
    syncListeningButtonLabels();
  }
}

// ---- Sound Alert Mode: microphone + Web Audio API (AnalyserNode RMS) ----
const SOUND_ALERT_RMS_THRESHOLD = 0.03;
const SOUND_ALERT_COOLDOWN_MS = 3000;
const SOUND_ALERT_RANDOM_MESSAGES = ["Doorbell detected", "Alarm detected", "Someone speaking"];

let audioCtx;
let analyser;
let source;
let dataArray;
let soundMicListening = false;
let streamRef;
let animationId;
let soundAlertLastAlertAt = 0;

/** Shows messages and logs activity; 3s cooldown between alerts. */
function triggerSoundAlert() {
  const now = Date.now();
  // Allow first alert; then enforce cooldown between triggers.
  if (soundAlertLastAlertAt > 0 && now - soundAlertLastAlertAt < SOUND_ALERT_COOLDOWN_MS) return;
  soundAlertLastAlertAt = now;

  const detail = SOUND_ALERT_RANDOM_MESSAGES[Math.floor(Math.random() * SOUND_ALERT_RANDOM_MESSAGES.length)];
  toast(`Sound detected nearby — ${detail}`);
  setStatus("Listening...");
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  logActivity("sound_alert").catch((e) => console.error("logActivity sound_alert:", e));
}

/** One frame: sample mic, compute RMS, compare to threshold, reschedule if still listening. */
function detectSound() {
  if (!soundMicListening || !analyser || !dataArray) return;

  analyser.getByteTimeDomainData(dataArray);
  const n = dataArray.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = (dataArray[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / n);

  if (rms > SOUND_ALERT_RMS_THRESHOLD) {
    triggerSoundAlert();
  }

  if (soundMicListening) {
    animationId = requestAnimationFrame(detectSound);
  }
}

/** Tear down mic + graph + rAF so only one listener can run. */
function stopSoundDetection() {
  soundMicListening = false;

  if (animationId != null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (source) {
    try {
      source.disconnect();
    } catch (e) {
      console.error("Sound alert: source disconnect", e);
    }
    source = null;
  }

  if (analyser) {
    try {
      analyser.disconnect();
    } catch (e) {
      console.error("Sound alert: analyser disconnect", e);
    }
    analyser = null;
  }

  if (audioCtx) {
    audioCtx.close().catch((e) => console.error("Sound alert: AudioContext.close", e));
    audioCtx = null;
  }

  if (streamRef) {
    streamRef.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch (e) {
        console.error("Sound alert: track stop", e);
      }
    });
    streamRef = null;
  }

  dataArray = null;
}

/**
 * Request mic, build AudioContext → AnalyserNode, start rAF loop.
 * Always calls stopSoundDetection() first so multiple instances cannot stack.
 */
async function startSoundDetection() {
  stopSoundDetection();

  if (!navigator.mediaDevices?.getUserMedia) {
    console.error("Sound alert: getUserMedia not supported");
    toast("Microphone is not available in this browser.");
    return false;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    console.error("Sound alert: microphone error", e);
    alert("Microphone access required");
    return false;
  }

  streamRef = stream;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    console.error("Sound alert: AudioContext not supported");
    toast("Web Audio API is not supported.");
    streamRef.getTracks().forEach((t) => t.stop());
    streamRef = null;
    return false;
  }

  audioCtx = new AudioContextCtor();

  try {
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
  } catch (e) {
    console.error("Sound alert: AudioContext.resume", e);
  }

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.5;

  source = audioCtx.createMediaStreamSource(streamRef);
  source.connect(analyser);

  dataArray = new Uint8Array(analyser.fftSize);
  soundAlertLastAlertAt = -SOUND_ALERT_COOLDOWN_MS;

  soundMicListening = true;
  animationId = requestAnimationFrame(detectSound);
  return true;
}

async function toggleSoundAlertMode() {
  if (state.soundAlertMode || soundMicListening) {
    state.soundAlertMode = false;
    stopSoundDetection();
    if (ui.btnSoundAlert) ui.btnSoundAlert.textContent = "Sound Alert Mode: OFF";
    setStatus("Stopped");
    toast("Sound Alert Mode off");
    return;
  }

  const ok = await startSoundDetection();
  if (ok) {
    state.soundAlertMode = true;
    if (ui.btnSoundAlert) ui.btnSoundAlert.textContent = "Sound Alert Mode: ON";
    setStatus("Listening...");
    if (navigator.vibrate) navigator.vibrate(60);
  } else {
    state.soundAlertMode = false;
    if (ui.btnSoundAlert) ui.btnSoundAlert.textContent = "Sound Alert Mode: OFF";
    setStatus("Stopped");
  }
}

async function toggleSimplifiedUI() {
  state.easyMode = !state.easyMode;
  ui.shell?.classList.toggle("easy-mode", state.easyMode);
  if (ui.btnEasyMode) {
    ui.btnEasyMode.textContent = `Simplified UI: ${state.easyMode ? "ON" : "OFF"}`;
  }
  if (state.easyMode) await logActivity("simplified_ui");
}

const SCENE_DESCRIPTION_MESSAGES = [
  "A person in a room",
  "Indoor environment with objects",
  "Open space detected",
  "You are in a room with objects nearby",
  "A table and a doorway are within reach",
  "Clear path ahead; obstacles on the left",
  "Bright lighting; people may be nearby",
];

let sceneMediaStream = null;
let ocrPreviewObjectUrl = null;

function stopSceneCamera() {
  if (sceneMediaStream) {
    sceneMediaStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch (e) {
        console.error("Error stopping camera track:", e);
      }
    });
    sceneMediaStream = null;
  }
  if (ui.sceneVideo) {
    try {
      ui.sceneVideo.srcObject = null;
    } catch (e) {
      console.error("Error clearing video stream:", e);
    }
  }
}

function revokeOcrPreviewIfAny() {
  if (ocrPreviewObjectUrl) {
    try {
      URL.revokeObjectURL(ocrPreviewObjectUrl);
    } catch (e) {
      console.error("revokeObjectURL failed:", e);
    }
    ocrPreviewObjectUrl = null;
  }
  if (ui.ocrPreviewWrap) ui.ocrPreviewWrap.hidden = true;
  if (ui.ocrPreviewImg) ui.ocrPreviewImg.removeAttribute("src");
}

function pickSimulatedSceneDescription() {
  const list = SCENE_DESCRIPTION_MESSAGES;
  return list[Math.floor(Math.random() * list.length)];
}

async function runSceneDescription() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Camera is not available in this browser.");
    console.error("getUserMedia is not supported");
    return;
  }

  stopSceneCamera();

  if (ui.sceneResultBlock) ui.sceneResultBlock.hidden = true;
  if (ui.sceneCapturedImg) ui.sceneCapturedImg.removeAttribute("src");
  if (ui.sceneDescriptionText) ui.sceneDescriptionText.textContent = "";
  if (ui.sceneLiveBlock) ui.sceneLiveBlock.hidden = false;
  if (ui.sceneWorkspace) ui.sceneWorkspace.hidden = false;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      audio: false,
    });
  } catch (e1) {
    console.warn("Camera fallback (environment):", e1);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (e2) {
      console.error("Camera error:", e2);
      toast("Camera permission denied or unavailable.");
      if (ui.sceneWorkspace) ui.sceneWorkspace.hidden = true;
      return;
    }
  }

  sceneMediaStream = stream;
  if (ui.sceneVideo) {
    ui.sceneVideo.srcObject = stream;
    try {
      await ui.sceneVideo.play();
    } catch (e) {
      console.error("Video play failed:", e);
    }
  }

  setStatus("Camera on — tap Capture Scene");
  toast("Camera ready");
  ui.sceneWorkspace?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function captureSceneDescription() {
  const video = ui.sceneVideo;
  if (!video || !sceneMediaStream) {
    toast("Camera is not active.");
    return;
  }
  if (video.readyState < 2) {
    toast("Camera is still starting. Try again in a moment.");
    return;
  }
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    toast("Video is not ready yet.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    toast("Could not capture image.");
    console.error("Canvas 2D context unavailable");
    return;
  }
  try {
    ctx.drawImage(video, 0, 0);
  } catch (e) {
    console.error("drawImage failed:", e);
    toast("Could not capture image.");
    return;
  }

  let dataUrl;
  try {
    dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  } catch (e) {
    console.error("toDataURL failed:", e);
    toast("Could not capture image.");
    return;
  }

  stopSceneCamera();

  if (ui.sceneLiveBlock) ui.sceneLiveBlock.hidden = true;
  if (ui.sceneCapturedImg) ui.sceneCapturedImg.src = dataUrl;
  const desc = pickSimulatedSceneDescription();
  if (ui.sceneDescriptionText) ui.sceneDescriptionText.textContent = desc;
  if (ui.sceneResultBlock) ui.sceneResultBlock.hidden = false;

  setStatus(`Scene: ${desc}`);
  toast("Scene captured");
  await logActivity("scene_description");
}

async function performTesseractOcr(file) {
  if (!file) return;

  revokeOcrPreviewIfAny();
  ocrPreviewObjectUrl = URL.createObjectURL(file);
  if (ui.ocrPreviewImg) ui.ocrPreviewImg.src = ocrPreviewObjectUrl;
  if (ui.ocrPreviewWrap) ui.ocrPreviewWrap.hidden = false;
  if (ui.ocrStatus) ui.ocrStatus.textContent = "Reading text...";
  if (ui.ocrOutput) ui.ocrOutput.value = "";

  const TesseractLib = typeof Tesseract !== "undefined" ? Tesseract : null;
  if (!TesseractLib?.recognize) {
    console.error("Tesseract.js not loaded");
    if (ui.ocrStatus) ui.ocrStatus.textContent = "";
    if (ui.ocrOutput) ui.ocrOutput.value = "Unable to read text";
    toast("OCR library not loaded.");
    return;
  }

  try {
    const result = await TesseractLib.recognize(file, "eng");
    const text = (result?.data?.text ?? "").trim();
    if (ui.ocrOutput) ui.ocrOutput.value = text || "(No text detected)";
    if (ui.ocrStatus) ui.ocrStatus.textContent = "";
    setStatus(`OCR: ${file.name || "image"}`);
    toast("Text extracted");
    await logActivity("text_recognition");
  } catch (e) {
    console.error("Tesseract OCR failed:", e);
    if (ui.ocrOutput) ui.ocrOutput.value = "Unable to read text";
    if (ui.ocrStatus) ui.ocrStatus.textContent = "";
    toast("Unable to read text");
  }
}

async function runScreenReader() {
  if (!supportsSpeechSynthesis()) {
    toast("Text-to-speech is not supported in this browser.");
    console.error("speechSynthesis API unavailable");
    return;
  }

  const synth = window.speechSynthesis;
  if (synth.speaking) {
    stopSpeaking();
    if (ui.btnReadScreen) ui.btnReadScreen.textContent = getDefaultReadScreenButtonText();
    toast("Speaking stopped.");
    return;
  }

  const content = getActiveScreenText() || "Sahayak accessibility screen reader sample text.";
  if (ui.btnReadScreen) ui.btnReadScreen.textContent = "Stop Speaking";
  speakText(content, () => {
    if (ui.btnReadScreen) ui.btnReadScreen.textContent = getDefaultReadScreenButtonText();
  });
  await logActivity("screen_reader");
}

async function runTextRecognition() {
  const file = ui.ocrUpload?.files?.[0];
  if (!file) {
    toast("Upload an image first");
    if (ui.ocrOutput) ui.ocrOutput.value = "No file selected. Choose an image, then run Text Recognition.";
    return;
  }
  await performTesseractOcr(file);
}

async function runEmotionTags() {
  await handleEmotionClick();
}

async function runSummarizer() {
  await handleSummaryClick();
}

async function runPredictiveMode() {
  await predictiveMode();
}

function showStatus(msg) {
  const el = document.getElementById("voiceStatus");
  if (el) el.innerText = msg;
}

function stopVoiceAction() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      console.error("stopVoiceAction:", e);
    }
  }
  isListening = false;
  syncListeningButtonLabels();
}

function startVoiceAction() {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    alert("Voice recognition not supported in this browser");
    return;
  }

  if (isListening) {
    stopVoiceAction();
    showStatus("Stopped");
    return;
  }

  stopVoiceAction();
  stopSharedRecognition("voice_action");

  recognition = new SpeechRecognitionCtor();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = function (event) {
    const raw = event.results[0] && event.results[0][0] ? event.results[0][0].transcript : "";
    const text = String(raw).trim().toLowerCase();
    showStatus("You said: " + text);
    void handleVoiceCommand(text);
  };

  recognition.onerror = function (event) {
    const err = event.error || "unknown";
    console.error("Voice action error:", err, event);
    showStatus("Error: " + err);
    isListening = false;
    syncListeningButtonLabels();
  };

  recognition.onend = function () {
    isListening = false;
    syncListeningButtonLabels();
  };

  try {
    isListening = true;
    recognition.start();
    showStatus("Listening...");
    syncListeningButtonLabels();
  } catch (e) {
    console.error("Voice action start failed:", e);
    isListening = false;
    toast("Could not start voice recognition.");
    syncListeningButtonLabels();
  }
}

async function handleVoiceCommand(text) {
  const t = String(text || "").toLowerCase();
  if (t.includes("home")) {
    await goTo("home");
  } else if (t.includes("profile")) {
    await goTo("profile");
  } else if (t.includes("activity")) {
    await goTo("activity");
  } else if (t.includes("emergency") || t.includes("help")) {
    await triggerEmergency();
  } else {
    showStatus("Command not recognized");
  }
  await logActivity("voice_action");
}

async function goTo(screen) {
  const s = String(screen || "").toLowerCase();
  if (s === "home") {
    await goHome();
    toast("Home");
    return;
  }
  if (s === "profile") {
    showScreen("profile");
    setNavActive("profile");
    toast("Profile");
    return;
  }
  if (s === "activity") {
    showScreen("activity");
    setNavActive("activity");
    await refreshActivityScreen();
    toast("Activity");
  }
}

async function triggerEmergency() {
  await createEmergencyAlert();
  toast("Emergency alert sent");
}

async function runCompoundVoice() {
  await handleCompoundVoice();
}

function formatFeatureLabel(slug) {
  return String(slug || "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Runs the feature slug most often seen in activity_logs (demo or Firebase). */
async function executePredictiveFeature(featureSlug) {
  const slug = String(featureSlug || "");
  switch (slug) {
    case "voice_navigation":
      return runVoiceNavigation();
    case "live_transcription":
      return runLiveTranscription();
    case "screen_reader":
      return runScreenReader();
    case "scene_description":
      return runSceneDescription();
    case "text_recognition":
      return runTextRecognition();
    case "emotion_tags":
      return runEmotionTags();
    case "summarizer":
      return runSummarizer();
    case "sound_alerts":
    case "sound_alert":
      return toggleSoundAlertMode();
    case "voice_commands":
      return runVoiceCommands();
    case "simplified_ui":
      return toggleSimplifiedUI();
    case "voice_action":
      startVoiceAction();
      return;
    case "emergency":
      return triggerEmergency();
    default:
      showPopup(`Suggested: ${formatFeatureLabel(slug)} (open manually)`);
  }
}

/**
 * Loads activity_logs for the signed-in user, finds the most-used feature, shows a popup, then runs it.
 */
async function predictiveMode() {
  const userId = state.user?.uid;
  if (!userId) {
    showPopup("Sign in to use Predictive Mode");
    return;
  }

  try {
    const items = await listActivityLogs({ userId, limit: 200 });
    const filtered = items.filter((x) => x.feature && x.feature !== "predictive_mode");

    if (!filtered.length) {
      showPopup("No usage data yet");
      await logActivity("predictive_mode");
      return;
    }

    const count = {};
    filtered.forEach((x) => {
      const f = x.feature;
      count[f] = (count[f] || 0) + 1;
    });

    const mostUsed = Object.keys(count).reduce((a, b) => (count[a] >= count[b] ? a : b));
    const label = formatFeatureLabel(mostUsed);
    showPopup(`Opening your most used feature: ${label}`);
    await logActivity("predictive_mode");
    await executePredictiveFeature(mostUsed);
  } catch (e) {
    console.error("predictiveMode:", e);
    showPopup("Could not load activity");
    await logActivity("predictive_mode");
  }
}

function stopCompoundVoice() {
  if (!compoundRecognition) return;
  try {
    compoundRecognition.onresult = null;
    compoundRecognition.onerror = null;
    compoundRecognition.onend = null;
    compoundRecognition.abort();
  } catch (e) {
    console.error("stopCompoundVoice:", e);
  }
  compoundRecognition = null;
}

/**
 * Listens once for a phrase; may run multiple actions (e.g. profile + emergency) using includes().
 */
async function handleCompoundVoice() {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    showPopup("Voice recognition not supported");
    return;
  }

  stopCompoundVoice();
  stopSharedRecognition("compound_voice");
  stopVoiceAction();

  const rec = new SpeechRecognitionCtor();
  compoundRecognition = rec;
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onresult = async function (event) {
    const raw = event.results[0] && event.results[0][0] ? event.results[0][0].transcript : "";
    const text = String(raw).trim().toLowerCase();
    showPopup("You said: " + String(raw).trim());

    let matched = false;
    if (text.includes("home")) {
      await goTo("home");
      matched = true;
    }
    if (text.includes("profile")) {
      await goTo("profile");
      matched = true;
    }
    if (text.includes("activity")) {
      await goTo("activity");
      matched = true;
    }
    if (text.includes("emergency") || text.includes("help")) {
      await triggerEmergency();
      matched = true;
    }
    if (text.includes("voice")) {
      startVoiceAction();
      matched = true;
    }

    if (!String(raw).trim()) {
      showPopup("Try again");
    } else if (!matched) {
      showPopup("Try: home, profile, activity, emergency, voice");
    }

    await logActivity("compound_voice");
    compoundRecognition = null;
  };

  rec.onerror = function (ev) {
    const err = ev.error || "";
    if (err === "no-speech" || err === "audio-capture") showPopup("Try again");
    else if (err && err !== "aborted") showPopup("Error: " + err);
    console.error("Compound voice error:", ev);
    compoundRecognition = null;
  };

  rec.onend = function () {
    compoundRecognition = null;
  };

  try {
    rec.start();
  } catch (e) {
    console.error("handleCompoundVoice start:", e);
    showPopup("Could not start microphone");
    compoundRecognition = null;
  }
}

async function listActivityLogs({ userId, limit = 20 }) {
  if (!userId) return [];
  if (MODE.firebase) {
    const snap = await db
      .collection("activity_logs")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    const out = [];
    snap.forEach((doc) => {
      const d = doc.data();
      out.push({
        feature: d.feature,
        timestamp: d.timestamp ? d.timestamp.toDate() : new Date(),
      });
    });
    return out;
  }
  const logs = loadJSON(LS.demoActivity, []);
  return logs
    .filter((x) => x.userId === userId)
    .slice(0, limit)
    .map((x) => ({ feature: x.feature, timestamp: new Date(x.timestamp) }));
}

async function listEmergencyAlerts({ userId, limit = 10 }) {
  if (!userId) return [];
  if (MODE.firebase) {
    const snap = await db
      .collection("alerts")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    const out = [];
    snap.forEach((doc) => {
      const d = doc.data();
      out.push({
        status: d.status || "active",
        timestamp: d.timestamp ? d.timestamp.toDate() : new Date(),
      });
    });
    return out;
  }

  const alerts = loadJSON(LS.demoAlerts, []);
  return alerts
    .filter((x) => x.userId === userId)
    .slice(0, limit)
    .map((x) => ({ status: x.status || "active", timestamp: new Date(x.timestamp) }));
}

// =========================
// UI population
// =========================
function renderProfile({ name, role, disability, uid }) {
  ui.profileName.textContent = name || "–";
  ui.profileRole.textContent = role || "–";
  ui.profileDisability.textContent = disability || "Not set";
  ui.profileUid.textContent = uid || "–";
}

function renderActivityList(listEl, items) {
  if (!items || items.length === 0) {
    listEl.innerHTML = '<li class="activity-empty">No activity yet.</li>';
    return;
  }
  listEl.innerHTML = items
    .map((x) => `<li>${escapeHtml(x.feature)} • ${escapeHtml(formatWhen(x.timestamp))}</li>`)
    .join("");
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshActivityScreen() {
  const who = resolveActivityUserId();
  ui.activitySubtitle.textContent =
    state.role === "caregiver" ? "Your user's recent feature usage" : "Your recent feature usage";
  ui.activityList.innerHTML = '<li class="activity-empty">Loading…</li>';
  const items = await listActivityLogs({ userId: who, limit: 20 });
  renderActivityList(ui.activityList, items);
}

function resolveActivityUserId() {
  if (state.role === "caregiver") return state.caregiver.linkedUserId;
  return state.user?.uid || null;
}

async function refreshCaregiverDashboard() {
  ui.cgUserEmail.textContent = "–";
  ui.cgUserDisability.textContent = "–";
  ui.cgActivity.innerHTML = '<li class="activity-empty">No activity detected.</li>';
  ui.cgAlerts.innerHTML = '<li class="activity-empty">No alerts.</li>';
  if (ui.cgLastActivity) ui.cgLastActivity.textContent = "–";
  if (ui.cgMostUsed) ui.cgMostUsed.textContent = "–";
  if (ui.cgActivityCount) ui.cgActivityCount.textContent = "0";
  if (ui.cgInactivityAlert) ui.cgInactivityAlert.textContent = "No alert";

  const linked = state.caregiver.linkedUserId;
  if (!linked) return;

  const userProf = await getUserProfile(linked);
  if (userProf) {
    ui.cgUserEmail.textContent = userProf.email || "Unknown";
    ui.cgUserDisability.textContent = userProf.disability || "Not set";
  } else {
    ui.cgUserEmail.textContent = "Unknown";
    ui.cgUserDisability.textContent = "–";
  }

  const items = await listActivityLogs({ userId: linked, limit: 6 });
  const statsItems = await listActivityLogs({ userId: linked, limit: 50 });
  if (!items.length) {
    ui.cgActivity.innerHTML = '<li class="activity-empty">No activity detected.</li>';
  } else {
    ui.cgActivity.innerHTML = items
      .map((x) => `<li>User used ${escapeHtml(x.feature)} • ${escapeHtml(formatWhen(x.timestamp))}</li>`)
      .join("");
  }

  const alerts = await listEmergencyAlerts({ userId: linked, limit: 5 });
  if (alerts.length) {
    ui.cgAlerts.innerHTML = alerts
      .map((x) => `<li>${escapeHtml(x.status || "triggered")} • ${escapeHtml(formatWhen(x.timestamp))}</li>`)
      .join("");
  } else {
    ui.cgAlerts.innerHTML = '<li class="activity-empty">No alerts.</li>';
  }

  if (statsItems.length) {
    const last = statsItems[0];
    if (ui.cgLastActivity) ui.cgLastActivity.textContent = `${last.feature} • ${formatWhen(last.timestamp)}`;
    if (ui.cgActivityCount) ui.cgActivityCount.textContent = String(statsItems.length);

    const counts = {};
    statsItems.forEach((x) => {
      counts[x.feature] = (counts[x.feature] || 0) + 1;
    });
    const mostUsed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (ui.cgMostUsed) ui.cgMostUsed.textContent = mostUsed ? `${mostUsed[0]} (${mostUsed[1]})` : "–";

    const lastMs = new Date(last.timestamp).getTime();
    const inactivityMinutes = (Date.now() - lastMs) / 60000;
    if (ui.cgInactivityAlert) {
      ui.cgInactivityAlert.textContent =
        inactivityMinutes >= 10 ? "No activity detected for user" : "Active recently";
    }
  } else if (ui.cgInactivityAlert) {
    ui.cgInactivityAlert.textContent = "No activity detected for user";
  }
}

// =========================
// Navigation rules
// =========================
async function goHome() {
  if (state.role === "caregiver") {
    showScreen("caregiverHome");
    setNavActive("home");
    await refreshCaregiverDashboard();
    return;
  }
  showScreen("userHome");
  setNavActive("home");
}

async function routeAfterAuth() {
  if (!state.user) {
    showScreen("onboarding");
    setNavActive("home");
    return;
  }

  hydrateRoleDisability();

  // Sync role from Firestore profile when available.
  if (!state.role && state.user?.uid) {
    const profile = await getUserProfile(state.user.uid);
    if (profile?.role === "user" || profile?.role === "caregiver") {
      state.role = profile.role;
      localStorage.setItem(LS.role, state.role);
    }
  }

  setStatus(MODE.firebase ? "Connected" : "Demo mode");

  if (!state.role) {
    showScreen("role");
    setNavActive("home");
    return;
  }

  if (state.role === "user") {
    // Ensure a profile exists
    const existing = await getUserProfile(state.user.uid);
    if (!existing) {
      await upsertUserProfile(state.user.uid, {
        uid: state.user.uid,
        email: state.user.email || "",
        name: state.user.displayName || "Sahayak User",
        role: "user",
        disability: state.disability || "Visually Impaired",
        caregiverId: null,
        createdAt: MODE.firebase ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
      });
    }

    const prof = (await getUserProfile(state.user.uid)) || {};
    state.disability = prof.disability || state.disability || null;
    persistRoleDisability();

    if (!state.disability) {
      showScreen("selection");
      setNavActive("home");
      return;
    }

    configureDomainDashboard();

    renderProfile({
      name: prof.name || state.user.displayName || "Sahayak User",
      role: "user",
      disability: state.disability,
      uid: state.user.uid,
    });

    await goHome();
    return;
  }

  if (state.role === "caregiver") {
    const cg = await getCaregiverProfile(state.user.uid);
    if (!cg) {
      await upsertCaregiverProfile(state.user.uid, {
        caregiverId: state.user.uid,
        email: state.user.email || "",
        name: state.user.displayName || "Caregiver",
        linkedUserId: null,
        createdAt: MODE.firebase ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
      });
    }
    const cg2 = (await getCaregiverProfile(state.user.uid)) || {};
    state.caregiver.linkedUserId = cg2.linkedUserId || null;
    ui.caregiverLinkInput.value = cg2.linkedUserEmail || "";
    state.disability = state.disability || null;
    persistRoleDisability();

    if (!state.disability) {
      showScreen("selection");
      setNavActive("home");
      return;
    }

    renderProfile({
      name: cg2.name || state.user.displayName || "Caregiver",
      role: "caregiver",
      disability: null,
      uid: state.user.uid,
    });

    await goHome();
  }
}

// =========================
// Event handlers
// =========================
function runOnboardingAnimation() {
  const root = ui.screens.onboarding;
  if (!root) return;
  root.querySelector('[data-anim="title"]')?.classList.add("anim-in");
  root.querySelector('[data-anim="tagline"]')?.classList.add("anim-in-delay-1");
  root.querySelector('[data-anim="desc"]')?.classList.add("anim-in-delay-desc");
  root.querySelector('[data-anim="button"]')?.classList.add("anim-in-delay-2");
}

// Signs up a new user using email/password and creates base profile.
async function signup() {
  ui.loginError.textContent = "";
  const email = ui.loginEmail.value.trim();
  const password = ui.loginPassword.value.trim();

  if (!email || !password) {
    alert("Please enter email and password.");
    ui.loginError.textContent = "Please enter email and password.";
    return;
  }

  try {
    setStatus("Creating account…");
    const u = await dataSignUp(email, password);
    state.user = u ? { uid: u.uid, email: u.email || email, displayName: u.displayName || email.split("@")[0] } : null;
    toast("Account created");
    await routeAfterAuth();
  } catch (e) {
    setStatus(MODE.firebase ? "Connected" : "Demo mode");
    const message = MODE.firebase ? "Signup failed. Check email format or password rules." : "Demo signup failed.";
    ui.loginError.textContent = message;
    alert(message);
  }
}

// Logs in an existing user account.
async function login() {
  ui.loginError.textContent = "";
  const email = ui.loginEmail.value.trim();
  const password = ui.loginPassword.value.trim();

  if (!email || !password) {
    alert("Please enter email and password.");
    ui.loginError.textContent = "Please enter email and password.";
    return;
  }

  try {
    setStatus("Signing in…");
    const u = await dataSignIn(email, password);
    state.user = u ? { uid: u.uid, email: u.email || email, displayName: u.displayName || email.split("@")[0] } : null;
    toast("Signed in");
    await routeAfterAuth();
  } catch (e) {
    setStatus(MODE.firebase ? "Connected" : "Demo mode");
    const message = MODE.firebase
      ? "Login failed. Check credentials or Firebase settings."
      : "Demo login failed. Please enter any email and password.";
    ui.loginError.textContent = message;
    alert(message);
  }
}

// Signs out the current authenticated user and resets UI state.
async function logout() {
  stopSharedRecognition("logout");
  stopSpeaking();
  stopSceneCamera();
  stopSoundDetection();
  stopVoiceAction();
  stopCompoundVoice();
  state.soundAlertMode = false;
  if (ui.btnSoundAlert) ui.btnSoundAlert.textContent = "Sound Alert Mode: OFF";
  setStatus("");
  revokeOcrPreviewIfAny();
  if (ui.sceneWorkspace) ui.sceneWorkspace.hidden = true;
  if (ui.sceneLiveBlock) ui.sceneLiveBlock.hidden = false;
  if (ui.sceneResultBlock) ui.sceneResultBlock.hidden = true;
  if (ui.ocrStatus) ui.ocrStatus.textContent = "";
  await dataSignOut();
  state.user = null;
  state.role = null;
  state.disability = null;
  state.caregiver.linkedUserId = null;
  localStorage.removeItem(LS.role);
  localStorage.removeItem(LS.disability);
  ui.loginEmail.value = "";
  ui.loginPassword.value = "";
  ui.loginError.textContent = "";
  setStatus("");
  showScreen("onboarding");
  setNavActive("home");
  toast("Signed out");
  runOnboardingAnimation();
}

function bindEvents() {
  ui.btnGetStarted.addEventListener("click", () => {
    showScreen("login");
    ui.loginError.textContent = "";
    setNavActive("home");
  });

  ui.btnLogin.addEventListener("click", async () => {
    await login();
  });

  ui.btnSignup?.addEventListener("click", async () => {
    await signup();
  });

  ui.roleCards.forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.role = btn.dataset.pickRole;
      localStorage.setItem(LS.role, state.role);

      if (state.role === "user") {
        state.disability = null;
      }
      localStorage.removeItem(LS.disability);
      if (state.user?.uid) {
        if (state.role === "caregiver") {
          await upsertCaregiverProfile(state.user.uid, {
            caregiverId: state.user.uid,
            role: "caregiver",
          });
        } else {
          await upsertUserProfile(state.user.uid, {
            uid: state.user.uid,
            email: String(state.user.email || "").toLowerCase(),
            role: state.role,
          });
        }
      }
      toast("Role saved");
      showScreen("selection");
      setNavActive("home");
    });
  });

  ui.selectionCards.forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.disability = btn.dataset.selectDisability || "Visually Impaired";
      localStorage.setItem(LS.disability, state.disability);

      if (state.role === "user" && state.user?.uid) {
        await upsertUserProfile(state.user.uid, {
          uid: state.user.uid,
          email: String(state.user.email || "").toLowerCase(),
          role: "user",
          disability: state.disability,
        });
      }
      toast("Assistance type saved");
      await routeAfterAuth();
    });
  });

  ui.featureCards.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.featureKey;
      const index = Number(String(key || "").split("-")[1]) - 1;
      const action = state.currentDomainFeatures[index];
      if (!action) return;

      if (action === "Voice Navigation") {
        await runVoiceNavigation();
      } else if (action === "Scene Description") {
        await runSceneDescription();
      } else if (action === "Screen Reader") {
        await runScreenReader();
      } else if (action === "Text Recognition") {
        await runTextRecognition();
      } else if (action === "Live Transcription") {
        await runLiveTranscription();
      } else if (action === "Emotion Tags") {
        await runEmotionTags();
      } else if (action === "Sound Alerts") {
        await toggleSoundAlertMode();
      } else if (action === "Summarizer") {
        await runSummarizer();
      } else if (action === "Voice Commands") {
        await runVoiceCommands();
      } else if (action === "Predictive Mode") {
        await runPredictiveMode();
      } else if (action === "Simplified UI") {
        await toggleSimplifiedUI();
      } else if (action === "Compound Voice") {
        await runCompoundVoice();
      }
    });
  });

  ui.btnReadScreen?.addEventListener("click", async () => {
    await runScreenReader();
  });

  ui.btnVoiceCommand?.addEventListener("click", async () => {
    if (state.disability === "Motor Impairment") {
      await runVoiceCommands();
      return;
    }
    await runVoiceNavigation();
  });

  ui.btnStt?.addEventListener("click", async () => {
    await runLiveTranscription();
  });

  ui.btnEmergencySos?.addEventListener("click", async () => {
    await createEmergencyAlert();
    await logActivity("emergency");
    alert("Emergency SOS activated.");
    toast("Emergency alert sent");
  });

  ui.btnSoundAlert?.addEventListener("click", async () => {
    await toggleSoundAlertMode();
  });

  ui.btnVoiceAction?.addEventListener("click", async () => {
    await handleCompoundVoice();
  });

  ui.btnEasyMode?.addEventListener("click", async () => {
    await toggleSimplifiedUI();
  });

  ui.btnCaptureScene?.addEventListener("click", async () => {
    await captureSceneDescription();
  });

  ui.ocrUpload?.addEventListener("change", async () => {
    const file = ui.ocrUpload?.files?.[0];
    if (!file) {
      revokeOcrPreviewIfAny();
      if (ui.ocrOutput) ui.ocrOutput.value = "";
      if (ui.ocrStatus) ui.ocrStatus.textContent = "";
      return;
    }
    toast(`Image selected: ${file.name || "image"}`);
    await performTesseractOcr(file);
  });

  ui.navItems.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.nav;
      setNavActive(key);

      if (key === "home") return goHome();
      if (key === "activity") {
        showScreen("activity");
        await refreshActivityScreen();
        return;
      }
      if (key === "profile") {
        showScreen("profile");
        return;
      }
    });
  });

  ui.btnCaregiverLink.addEventListener("click", async () => {
    const uid = state.user?.uid;
    if (!uid) return;
    const enteredEmail = ui.caregiverLinkInput.value.trim().toLowerCase();
    if (!enteredEmail) {
      toast("Enter a user email to link");
      return;
    }
    const linkedUid = await linkCaregiver(enteredEmail);
    if (!linkedUid) {
      alert("User email not found. Please check and try again.");
      toast("User email not found");
      return;
    }
    if (MODE.firebase) {
      await upsertUserProfile(linkedUid, { caregiverId: uid });
    }
    toast("User linked");
    await refreshCaregiverDashboard();
  });

  ui.btnLogout.addEventListener("click", async () => {
    await logout();
  });

  document.getElementById("transcriptionBox")?.addEventListener("input", function () {
    updateTextFeatures(this.value);
  });
}

// =========================
// Initialize
// =========================
document.addEventListener("DOMContentLoaded", () => {
  setStatus(isFirebaseConfigured() ? "Connected" : "Demo mode");
  bindEvents();
  showScreen("onboarding");
  runOnboardingAnimation();
  hideEmotionSummaryPanels();
  window.startVoiceAction = startVoiceAction;

  dataOnAuthChanged(async (u) => {
    state.user = u ? { uid: u.uid, email: u.email || "", displayName: u.displayName || "" } : null;
    await routeAfterAuth();
  });
});


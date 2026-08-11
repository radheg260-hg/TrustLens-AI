"use strict";

/* =========================================================
   TRUSTLENS AI — DASHBOARD SCRIPT
   Phase 2.4.4
   Frontend Scanner + JWT + MongoDB Scan Storage
========================================================= */


const THEME_STORAGE_KEY = "trustLensTheme";

const byId = (id) =>
  document.getElementById(id);


/* =========================================================
   DOM ELEMENTS
========================================================= */

const sidebar = byId("sidebar");
const sidebarOverlay = byId("sidebarOverlay");
const menuButton = byId("menuButton");

const themeButton = byId("themeButton");
const logoutButton = byId("logoutButton");

const userName = byId("userName");
const userEmail = byId("userEmail");
const userAvatar = byId("userAvatar");
const welcomeText = byId("welcomeText");

const scanTabs =
  document.querySelectorAll(".scan-tab");

const scanPanels =
  document.querySelectorAll(".scan-panel");

const analyzeButton =
  byId("analyzeButton");

const dashboardMessage =
  byId("dashboardMessage");

const messageInput =
  byId("messageInput");

const messageCount =
  byId("messageCount");

const linkInput =
  byId("linkInput");


/* =========================================================
   SCREENSHOT ELEMENTS
========================================================= */

const screenshotInput =
  byId("screenshotInput");

const screenshotPreview =
  byId("screenshotPreview");

const selectedFileInfo =
  byId("selectedFileInfo");

const selectedFileName =
  byId("selectedFileName");

const selectedFileSize =
  byId("selectedFileSize");

const removeScreenshotButton =
  byId("removeScreenshotButton");

const ocrProgressSection =
  byId("ocrProgressSection");

const ocrStatusText =
  byId("ocrStatusText");

const ocrProgressPercentage =
  byId("ocrProgressPercentage");

const ocrProgressBar =
  byId("ocrProgressBar");

const extractedTextSection =
  byId("extractedTextSection");

const extractedText =
  byId("extractedText");

const editExtractedTextButton =
  byId("editExtractedTextButton");


/* =========================================================
   RESULT ELEMENTS
========================================================= */

const resultSection =
  byId("resultSection");

const resultTitle =
  byId("resultTitle");

const riskScore =
  byId("riskScore");

const riskProgressBar =
  byId("riskProgressBar");

const resultDescription =
  byId("resultDescription");

const resultReasons =
  byId("resultReasons");

const safetyAdvice =
  byId("safetyAdvice");

const resultScanType =
  byId("resultScanType");

const resultRiskLevel =
  byId("resultRiskLevel");

const signalsFound =
  byId("signalsFound");


/* =========================================================
   STATISTICS
========================================================= */

const totalScans =
  byId("totalScans");

const fraudScans =
  byId("fraudScans");

const safeScans =
  byId("safeScans");

const recentScans =
  byId("recentScans");


/* =========================================================
   STATE
========================================================= */

let selectedScanType = "message";

let screenshotObjectUrl = "";

let isOcrRunning = false;

let isAnalysisRunning = false;

/* =========================================================
   PHASE 2.4.5 — BACKEND SCAN STATE
========================================================= */

let backendScans = [];


/* =========================================================
   FRAUD RULES
========================================================= */

const messageRules = [

  {
    keywords: [
      "otp",
      "one time password",
      "verification code"
    ],

    points: 25,

    reason:
      "The content asks for an OTP or verification code."
  },

  {
    keywords: [
      "password",
      "passcode",
      "login password"
    ],

    points: 25,

    reason:
      "The content requests a password or login credential."
  },

  {
    keywords: [
      "upi pin",
      "atm pin",
      "pin number"
    ],

    points: 25,

    reason:
      "The content requests a PIN."
  },

  {
    keywords: [
      "cvv",
      "card number",
      "debit card",
      "credit card"
    ],

    points: 25,

    reason:
      "The content requests card or banking information."
  },

  {
    keywords: [
      "account blocked",
      "account will be blocked",
      "account suspended",
      "account closed"
    ],

    points: 20,

    reason:
      "The content threatens account blocking or suspension."
  },

  {
    keywords: [
      "urgent",
      "immediately",
      "hurry",
      "act now",
      "today only",
      "limited time"
    ],

    points: 12,

    reason:
      "The content uses urgency to pressure the user."
  },

  {
    keywords: [
      "lottery",
      "prize",
      "winner",
      "you won",
      "reward",
      "cashback"
    ],

    points: 15,

    reason:
      "The content promises an unexpected prize or reward."
  },

  {
    keywords: [
      "send money",
      "transfer money",
      "pay now",
      "payment required",
      "registration fee",
      "processing fee"
    ],

    points: 20,

    reason:
      "The content requests an immediate payment."
  },

  {
    keywords: [
      "upi payment",
      "upi id",
      "collect request",
      "scan qr",
      "scan the qr"
    ],

    points: 18,

    reason:
      "The content contains a UPI or QR payment request."
  },

  {
    keywords: [
      "kyc",
      "update kyc",
      "complete kyc"
    ],

    points: 15,

    reason:
      "The content uses a KYC verification request."
  },

  {
    keywords: [
      "verify account",
      "verify immediately",
      "complete verification",
      "click here"
    ],

    points: 12,

    reason:
      "The content asks for urgent account verification."
  },

  {
    keywords: [
      "work from home",
      "earn daily",
      "easy money",
      "no experience needed"
    ],

    points: 15,

    reason:
      "The content contains a suspicious easy-money or job offer."
  },

  {
    keywords: [
      "police case",
      "arrest warrant",
      "legal action",
      "cyber crime officer",
      "police officer"
    ],

    points: 20,

    reason:
      "The content uses legal or police threats."
  },

  {
    keywords: [
      "gift card",
      "crypto payment",
      "bitcoin payment"
    ],

    points: 20,

    reason:
      "The content requests a difficult-to-reverse payment method."
  },

  {
    keywords: [
      "anydesk",
      "teamviewer",
      "remote access",
      "screen sharing",
      "quick support"
    ],

    points: 30,

    reason:
      "The content asks the user to use remote-access software."
  }

];


/* =========================================================
   PAGE INITIALIZATION
========================================================= */

window.addEventListener(
  "DOMContentLoaded",
  async () => {

    loadSavedTheme();

    loadUserInformation();

    updateAnalyzeButtonText();


    try {

      const scans =
        await loadScansFromBackend();


      updateDashboardStatistics(
        scans
      );


      displayRecentScans(
        scans
      );


    } catch (error) {

      console.error(
        "Dashboard startup scan loading failed:",
        error
      );


      updateDashboardStatistics(
        []
      );


      displayRecentScans(
        []
      );


      showDashboardMessage(
        "Could not load your scan history from the server.",
        "error"
      );
    }

  }
);


/* =========================================================
   CURRENT USER
========================================================= */

function getCurrentUser() {

  const keys = [
    "trustLensCurrentUser",
    "currentUser",
    "loggedInUser",
    "trustLensUser",
    "userSession"
  ];


  for (const key of keys) {

    const raw =
      sessionStorage.getItem(key) ||
      localStorage.getItem(key);


    if (!raw) {
      continue;
    }


    try {

      const parsed =
        JSON.parse(raw);


      if (
        typeof parsed ===
        "string"
      ) {

        return {
          email: parsed
        };
      }


      return parsed;

    } catch {

      return {
        email: raw
      };
    }
  }


  return null;
}


/* =========================================================
   LOAD USER INFORMATION
========================================================= */

function loadUserInformation() {

  const currentUser =
    getCurrentUser();


  if (!currentUser) {
    return;
  }


  const email =
    currentUser.email ||
    currentUser.userEmail ||
    "user@example.com";


  let name =
    currentUser.name ||
    currentUser.fullName ||
    currentUser.username ||
    "";


  if (
    !name &&
    email.includes("@")
  ) {

    name =
      email
        .split("@")[0]
        .replace(
          /[._-]+/g,
          " "
        )
        .replace(
          /\b\w/g,
          (letter) =>
            letter.toUpperCase()
        );
  }


  if (!name) {
    name = "User";
  }


  if (userName) {
    userName.textContent =
      name;
  }


  if (userEmail) {
    userEmail.textContent =
      email;
  }


  if (userAvatar) {

    userAvatar.textContent =
      name
        .charAt(0)
        .toUpperCase();
  }


  if (welcomeText) {

    welcomeText.textContent =
      `Hello, ${name}!`;
  }
}


/* =========================================================
   THEME
========================================================= */

function loadSavedTheme() {

  const dark =
    localStorage.getItem(
      THEME_STORAGE_KEY
    ) === "dark";


  document.body.classList.toggle(
    "dark-mode",
    dark
  );


  if (themeButton) {

    themeButton.textContent =
      dark
        ? "☀️"
        : "🌙";
  }
}


if (themeButton) {

  themeButton.addEventListener(
    "click",
    () => {

      const dark =
        document.body.classList.toggle(
          "dark-mode"
        );


      localStorage.setItem(
        THEME_STORAGE_KEY,
        dark
          ? "dark"
          : "light"
      );


      themeButton.textContent =
        dark
          ? "☀️"
          : "🌙";

    }
  );
}


/* =========================================================
   SIDEBAR
========================================================= */

if (menuButton) {

  menuButton.addEventListener(
    "click",
    openSidebar
  );
}


if (sidebarOverlay) {

  sidebarOverlay.addEventListener(
    "click",
    closeSidebar
  );
}


function openSidebar() {

  sidebar?.classList.add(
    "active"
  );

  sidebarOverlay?.classList.add(
    "active"
  );
}


function closeSidebar() {

  sidebar?.classList.remove(
    "active"
  );

  sidebarOverlay?.classList.remove(
    "active"
  );
}


/* =========================================================
   LOGOUT
========================================================= */

if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    () => {

      if (
        !window.confirm(
          "Are you sure you want to logout?"
        )
      ) {
        return;
      }


      /*
        auth.js should normally handle the
        authentication storage.

        These are cleaned here as a fallback.
      */

      const userKeys = [
        "trustLensCurrentUser",
        "currentUser",
        "loggedInUser",
        "trustLensUser",
        "userSession"
      ];


      userKeys.forEach(
        (key) => {

          sessionStorage.removeItem(
            key
          );

          localStorage.removeItem(
            key
          );
        }
      );


      /*
        Try auth.js logout if available.
      */

      if (
        window.TrustLensAuth &&
        typeof window.TrustLensAuth.logout ===
          "function"
      ) {

        window.TrustLensAuth.logout();

        return;
      }


      window.location.href =
        "index.html";

    }
  );
}


/* =========================================================
   SCANNER TABS
========================================================= */

scanTabs.forEach(
  (tab) => {

    tab.addEventListener(
      "click",
      () => {

        selectedScanType =
          tab.dataset.type ||
          "message";


        scanTabs.forEach(
          (item) =>
            item.classList.remove(
              "active"
            )
        );


        scanPanels.forEach(
          (panel) =>
            panel.classList.remove(
              "active"
            )
        );


        tab.classList.add(
          "active"
        );


        byId(
          `${selectedScanType}Panel`
        )?.classList.add(
          "active"
        );


        clearDashboardMessage();

        hideResultSection();

        updateAnalyzeButtonText();

      }
    );
  }
);


/* =========================================================
   ANALYZE BUTTON LABEL
========================================================= */

function updateAnalyzeButtonText() {

  if (
    !analyzeButton ||
    isOcrRunning ||
    isAnalysisRunning
  ) {
    return;
  }


  const labels = {

    message:
      "<span>💬</span>Analyze Message",

    link:
      "<span>🔗</span>Analyze Website Link",

    screenshot:
      "<span>🖼️</span>Read and Analyze Screenshot"

  };


  analyzeButton.innerHTML =
    labels[selectedScanType] ||
    labels.message;
}


/* =========================================================
   MESSAGE CHARACTER COUNT
========================================================= */

if (
  messageInput &&
  messageCount
) {

  messageInput.addEventListener(
    "input",
    () => {

      messageCount.textContent =
        `${messageInput.value.length} characters`;

    }
  );
}


/* =========================================================
   MAIN ANALYZE BUTTON
========================================================= */

if (analyzeButton) {

  analyzeButton.addEventListener(
    "click",
    handleAnalyze
  );

}


/* =========================================================
   MAIN ANALYSIS CONTROLLER
========================================================= */

async function handleAnalyze() {

  if (
    isAnalysisRunning ||
    isOcrRunning
  ) {
    return;
  }


  clearDashboardMessage();

  let result = null;


  try {

    isAnalysisRunning = true;

    if (analyzeButton) {

      analyzeButton.disabled = true;
    }


    /* =====================================================
       RUN ANALYSIS
    ===================================================== */

    if (
      selectedScanType ===
      "message"
    ) {

      if (analyzeButton) {

        analyzeButton.innerHTML =
          "<span>⏳</span>Analyzing Message...";
      }


      result =
        analyzeMessage();


    } else if (
      selectedScanType ===
      "link"
    ) {

      if (analyzeButton) {

        analyzeButton.innerHTML =
          "<span>⏳</span>Analyzing Link...";
      }


      result =
        analyzeWebsiteLink();


    } else if (
      selectedScanType ===
      "screenshot"
    ) {

      result =
        await analyzeScreenshot();
    }


    /* =====================================================
       INVALID / EMPTY INPUT
    ===================================================== */

    if (!result) {

      return;
    }


    /* =====================================================
       SHOW RESULT
    ===================================================== */

    renderAnalysisResult(
      result
    );


    /* =====================================================
       SAVE TO MONGODB
    ===================================================== */

    try {

      await saveScanToBackend(
        result
      );


      /*
        IMPORTANT:
        After MongoDB saves the scan,
        reload the user's scans directly
        from the backend.

        No localStorage scan mirror is
        needed for dashboard statistics.
      */

      const scans =
        await loadScansFromBackend();


      updateDashboardStatistics(
        scans
      );


      displayRecentScans(
        scans
      );


      showDashboardMessage(
        "Analysis completed. The scan result was saved to your account.",
        "success"
      );


    } catch (saveError) {

      console.error(
        "TrustLens scan save error:",
        saveError
      );


      showDashboardMessage(
        `Analysis completed, but the scan could not be saved: ${saveError.message}`,
        "error"
      );
    }


  } catch (error) {

    console.error(
      "TrustLens analysis error:",
      error
    );


    showDashboardMessage(
      error.message ||
      "TrustLens could not complete the analysis.",
      "error"
    );


  } finally {

    isAnalysisRunning = false;


    if (analyzeButton) {

      analyzeButton.disabled =
        false;
    }


    updateAnalyzeButtonText();
  }
}

/* =========================================================
   MESSAGE ANALYSIS
========================================================= */

function analyzeMessage() {

  const originalText =
    messageInput?.value.trim() ||
    "";


  if (!originalText) {

    showDashboardMessage(
      "Please enter a message before analyzing.",
      "error"
    );

    return null;
  }


  const analysis =
    analyzeTextForFraud(
      originalText
    );


  return buildAnalysisResult({
    scanType:
      "Message",

    originalContent:
      originalText,

    score:
      analysis.score,

    reasons:
      analysis.reasons
  });
}


/* =========================================================
   TEXT FRAUD ANALYSIS
========================================================= */

function analyzeTextForFraud(
  text
) {

  const cleanText =
    String(text || "")
      .toLowerCase();


  let score = 0;

  const reasons = [];


  messageRules.forEach(
    (rule) => {

      const detected =
        rule.keywords.some(
          (keyword) =>
            cleanText.includes(
              keyword
            )
        );


      if (detected) {

        score +=
          rule.points;

        reasons.push(
          rule.reason
        );
      }

    }
  );


  const linkResult =
    detectLinksInMessage(
      cleanText
    );


  score +=
    linkResult.points;


  reasons.push(
    ...linkResult.reasons
  );


  const phoneResult =
    detectSuspiciousPhoneRequest(
      cleanText
    );


  score +=
    phoneResult.points;


  if (
    phoneResult.reason
  ) {

    reasons.push(
      phoneResult.reason
    );
  }


  return {

    score:
      Math.min(
        score,
        100
      ),

    reasons:
      [
        ...new Set(
          reasons
        )
      ]

  };
}


/* =========================================================
   LINK DETECTION IN MESSAGE
========================================================= */

function detectLinksInMessage(
  text
) {

  let points = 0;

  const reasons = [];


  const links =
    text.match(
      /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
    ) || [];


  if (links.length) {

    points += 10;

    reasons.push(
      "The content contains a website link."
    );
  }


  if (
    text.includes(
      "http://"
    )
  ) {

    points += 15;

    reasons.push(
      "The content contains a non-secure HTTP link."
    );
  }


  const shorteners = [
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "cutt.ly",
    "rb.gy",
    "shorturl.at"
  ];


  if (
    shorteners.some(
      (domain) =>
        text.includes(
          domain
        )
    )
  ) {

    points += 20;

    reasons.push(
      "The content contains a shortened URL that may hide its destination."
    );
  }


  return {
    points,
    reasons
  };
}


/* =========================================================
   SUSPICIOUS PHONE REQUEST
========================================================= */

function detectSuspiciousPhoneRequest(
  text
) {

  const phonePattern =
    /(?:\+91[\s-]?)?[6-9]\d{9}/;


  const hasPhone =
    phonePattern.test(
      text
    );


  const suspiciousWords = [
    "call now",
    "contact immediately",
    "whatsapp",
    "customer care",
    "support number",
    "helpline"
  ];


  const suspiciousContext =
    suspiciousWords.some(
      (word) =>
        text.includes(
          word
        )
    );


  if (
    hasPhone &&
    suspiciousContext
  ) {

    return {

      points: 12,

      reason:
        "The content asks you to contact an unverified phone number."

    };
  }


  return {
    points: 0,
    reason: ""
  };
}


/* =========================================================
   WEBSITE LINK ANALYSIS
========================================================= */

function analyzeWebsiteLink() {

  const originalLink =
    linkInput?.value.trim() ||
    "";


  if (!originalLink) {

    showDashboardMessage(
      "Please enter a website link before analyzing.",
      "error"
    );

    return null;
  }


  const analysis =
    analyzeUrlForFraud(
      originalLink
    );


  return buildAnalysisResult({

    scanType:
      "Website Link",

    originalContent:
      originalLink,

    score:
      analysis.score,

    reasons:
      analysis.reasons

  });
}


/* =========================================================
   URL FRAUD ANALYSIS
========================================================= */

function analyzeUrlForFraud(
  input
) {

  let score = 0;

  const reasons = [];


  const raw =
    String(input || "")
      .trim();


  let normalized =
    raw;


  if (
    !/^https?:\/\//i.test(
      normalized
    )
  ) {

    normalized =
      `https://${normalized}`;
  }


  let url;


  try {

    url =
      new URL(
        normalized
      );

  } catch {

    return {

      score: 70,

      reasons: [
        "The entered website address is not a valid URL."
      ]

    };
  }


  const hostname =
    url.hostname
      .toLowerCase();


  const fullUrl =
    normalized
      .toLowerCase();


  if (
    raw
      .toLowerCase()
      .startsWith(
        "http://"
      )
  ) {

    score += 20;

    reasons.push(
      "The website uses an unencrypted HTTP connection."
    );
  }


  const shorteners = [
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "cutt.ly",
    "rb.gy",
    "shorturl.at"
  ];


  if (
    shorteners.some(
      (domain) =>
        hostname === domain ||
        hostname.endsWith(
          `.${domain}`
        )
    )
  ) {

    score += 25;

    reasons.push(
      "The website uses a shortened URL that hides its final destination."
    );
  }


  if (
    hostname.includes(
      "xn--"
    )
  ) {

    score += 25;

    reasons.push(
      "The domain uses encoded characters that can sometimes be used for impersonation."
    );
  }


  const suspiciousDomainWords = [
    "verify",
    "secure",
    "login",
    "update",
    "kyc",
    "reward",
    "bonus",
    "claim",
    "account",
    "support"
  ];


  const domainWordCount =
    suspiciousDomainWords.filter(
      (word) =>
        hostname.includes(
          word
        )
    ).length;


  if (
    domainWordCount >= 2
  ) {

    score += 18;

    reasons.push(
      "The domain contains several words commonly used in phishing links."
    );
  }


  const suspiciousPathWords = [
    "verify-account",
    "update-kyc",
    "claim-reward",
    "free-gift",
    "urgent-login",
    "bank-login"
  ];


  if (
    suspiciousPathWords.some(
      (word) =>
        fullUrl.includes(
          word
        )
    )
  ) {

    score += 18;

    reasons.push(
      "The website path contains suspicious verification or reward language."
    );
  }


  const hyphenCount =
    (
      hostname.match(
        /-/g
      ) || []
    ).length;


  if (
    hyphenCount >= 3
  ) {

    score += 12;

    reasons.push(
      "The domain contains an unusual number of hyphens."
    );
  }


  if (
    hostname.length >
    45
  ) {

    score += 10;

    reasons.push(
      "The domain name is unusually long."
    );
  }


  const ipv4Pattern =
    /^\d{1,3}(?:\.\d{1,3}){3}$/;


  if (
    ipv4Pattern.test(
      hostname
    )
  ) {

    score += 25;

    reasons.push(
      "The website uses a raw IP address instead of a normal domain name."
    );
  }


  return {

    score:
      Math.min(
        score,
        100
      ),

    reasons:
      [
        ...new Set(
          reasons
        )
      ]

  };
}


/* =========================================================
   BUILD COMMON RESULT
========================================================= */

function buildAnalysisResult({
  scanType,
  originalContent,
  score,
  reasons
}) {

  const finalScore =
    Math.max(
      0,
      Math.min(
        Number(score) || 0,
        100
      )
    );


  const finalReasons =
    Array.isArray(
      reasons
    )
      ? reasons
      : [];


  let title;

  let description;

  let advice;

  let riskLevel;

  let resultClass;


  if (
    finalScore >= 60
  ) {

    title =
      "High Fraud Risk";

    riskLevel =
      "High Risk";

    resultClass =
      "danger-result";


    if (
      scanType ===
      "Website Link"
    ) {

      description =
        "This website link contains several suspicious patterns.";

      advice =
        "Do not open the link or enter personal details. Search for the official website manually.";

    } else if (
      scanType ===
      "Screenshot"
    ) {

      description =
        "The extracted screenshot text contains several common signs of fraud.";

      advice =
        "Do not reply, click unknown links, share an OTP or send money. Verify the sender independently.";

    } else {

      description =
        "This message contains several common fraud signals.";

      advice =
        "Do not reply, click unknown links, share an OTP or send money. Verify the sender independently.";

    }

  } else if (
    finalScore >= 25
  ) {

    if (
      scanType ===
      "Website Link"
    ) {

      title =
        "Suspicious Website Link";

    } else if (
      scanType ===
      "Screenshot"
    ) {

      title =
        "Suspicious Screenshot";

    } else {

      title =
        "Suspicious Message";
    }


    riskLevel =
      "Suspicious";

    resultClass =
      "warning-result";

    description =
      "Some warning signs were detected. Verify the content before taking action.";

    advice =
      "Use an official app, website or verified contact number before proceeding.";

  } else {

    title ="No Major Warning Signals";;

    riskLevel =
      "Low Risk";

    resultClass =
      "safe-result";

    description =
      "No major fraud pattern was detected by the current rules.";

    advice =
      "Remain cautious. Automated checking cannot guarantee complete safety.";

  }


  return {

    scanType,

    originalContent,

    score:
      finalScore,

    reasons:
      finalReasons,

    title,

    description,

    advice,

    riskLevel,

    resultClass

  };
}


/* =========================================================
   RENDER ANALYSIS RESULT
========================================================= */

function renderAnalysisResult(
  result
) {

  if (!resultSection) {
    return;
  }


  resultSection.className =
    `result-card ${result.resultClass}`;


  resultSection.classList.remove(
    "hidden"
  );


  if (resultTitle) {

    resultTitle.textContent =
      result.title;
  }


  if (riskScore) {

    riskScore.textContent =
      `${result.score}%`;
  }


  if (riskProgressBar) {

    riskProgressBar.style.width =
      `${result.score}%`;
  }


  if (resultDescription) {

    resultDescription.textContent =
      result.description;
  }


  if (safetyAdvice) {

    safetyAdvice.textContent =
      result.advice;
  }


  if (resultScanType) {

    resultScanType.textContent =
      result.scanType;
  }


  if (resultRiskLevel) {

    resultRiskLevel.textContent =
      result.riskLevel;
  }


  if (signalsFound) {

    signalsFound.textContent =
      result.reasons.length;
  }


  if (resultReasons) {

    resultReasons.innerHTML =
      "";


    const finalReasons =
      result.reasons.length
        ? result.reasons
        : [
            "No major warning signals were detected."
          ];


    finalReasons.forEach(
      (reason) => {

        const item =
          document.createElement(
            "li"
          );


        item.textContent =
          reason;


        resultReasons.appendChild(
          item
        );

      }
    );
  }


  resultSection.scrollIntoView({
    behavior:
      "smooth",

    block:
      "start"
  });
}


function hideResultSection() {

  resultSection?.classList.add(
    "hidden"
  );
}


/* =========================================================
   PHASE 2.4.4
   BACKEND SCAN STORAGE
========================================================= */

function getBackendScanType(
  scanType
) {

  const value =
    String(
      scanType || ""
    )
      .trim()
      .toLowerCase();


  if (
    value.includes(
      "link"
    ) ||
    value.includes(
      "website"
    )
  ) {

    return "link";
  }


  if (
    value.includes(
      "screenshot"
    ) ||
    value.includes(
      "image"
    )
  ) {

    return "screenshot";
  }


  return "message";
}


/* =========================================================
   GET JWT TOKEN
========================================================= */

function getTrustLensAccessToken() {

  /*
    First try the helper provided by auth.js.
  */

  if (
    window.TrustLensAuth &&
    typeof window.TrustLensAuth.getAccessToken ===
      "function"
  ) {

    const token =
      window.TrustLensAuth.getAccessToken();


    if (token) {
      return token;
    }
  }


  /*
    Fallback keys.

    This makes script.js tolerant if your
    auth.js uses one of these storage names.
  */

  const tokenKeys = [
    "trustLensAccessToken"
  ];


  for (
    const key of tokenKeys
  ) {

    const token =
      localStorage.getItem(
        key
      ) ||
      sessionStorage.getItem(
        key
      );


    if (token) {

      return token
        .replace(
          /^"|"$/g,
          ""
        )
        .trim();
    }
  }


  return "";
}


/* =========================================================
   AUTHENTICATED FETCH
========================================================= */

async function trustLensAuthenticatedFetch(
  url,
  options = {}
) {

  /*
    Prefer auth.js authenticatedFetch if
    your current auth.js provides it.
  */

  if (
    window.TrustLensAuth &&
    typeof window.TrustLensAuth.authenticatedFetch ===
      "function"
  ) {

    return window.TrustLensAuth
      .authenticatedFetch(
        url,
        options
      );
  }


  const token =
    getTrustLensAccessToken();


  if (!token) {

    throw new Error(
      "Your login session is missing. Please log in again."
    );
  }


  const headers =
    new Headers(
      options.headers ||
      {}
    );


  headers.set(
    "Authorization",
    `Bearer ${token}`
  );


  return fetch(
    url,
    {
      ...options,
      headers
    }
  );
}


/* =========================================================
   SAVE SCAN TO FLASK / MONGODB
========================================================= */

async function saveScanToBackend(
  result
) {

  const token =
    getTrustLensAccessToken();


  if (!token) {

    throw new Error(
      "Your login session is missing. Please sign in again."
    );
  }


  const payload = {

    scan_type:
      getBackendScanType(
        result.scanType
      ),

    title:
      result.title ||
      "Analysis Result",

    original_content:
      String(result.originalContent || "").trim(),

    score:
      Number(
        result.score
      ) || 0,

    risk_level:
      result.riskLevel ||
      "Low Risk",

    reasons:
      Array.isArray(
        result.reasons
      )
        ? result.reasons
        : [],

    advice:
      result.advice ||
      ""

  };


  let response;


  try {

    response =
      await trustLensAuthenticatedFetch(
        `${window.TrustLensAuth.apiBaseUrl}/api/scans`,
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify(
              payload
            )

        }
      );

  } catch (error) {

    console.error(
      "Backend connection failed:",
      error
    );


    throw new Error(
      "Could not connect to the TrustLens backend. Please try again shortly."
    );
  }


  let data = {};


  try {

    data =
      await response.json();

  } catch {

    data = {};
  }


  if (
    response.status === 401 ||
    response.status === 422
  ) {

    throw new Error(
      data.msg ||
      data.message ||
      "Your login session is invalid or expired. Please log in again."
    );
  }


  if (!response.ok) {

    throw new Error(
      data.message ||
      data.msg ||
      data.error ||
      `Backend returned HTTP ${response.status}.`
    );
  }


  if (
    !data.success ||
    !data.scan
  ) {

    throw new Error(
      "TrustLens received an incomplete response while saving the scan."
    );
  }


  console.log(
    "TrustLens MongoDB scan saved:",
    data.scan
  );


  return data.scan;
}

/* =========================================================
   PHASE 2.4.5
   LOAD CURRENT USER SCANS FROM MONGODB
========================================================= */

async function loadScansFromBackend() {

  const token =
    getTrustLensAccessToken();


  if (!token) {

    console.warn(
      "Cannot load scans: authentication token is missing."
    );

    backendScans = [];

    return [];
  }


  try {

    const response =
      await trustLensAuthenticatedFetch(
        `${window.TrustLensAuth.apiBaseUrl}/api/scans`,
        {
          method: "GET"
        }
      );


    let data = {};


    try {

      data =
        await response.json();

    } catch {

      data = {};
    }


    if (
      response.status === 401 ||
      response.status === 422
    ) {

      throw new Error(
        data.msg ||
        data.message ||
        "Your login session has expired."
      );
    }


    if (!response.ok) {

      throw new Error(
        data.message ||
        data.error ||
        `Unable to load scans. HTTP ${response.status}.`
      );
    }


    if (
      !data.success ||
      !Array.isArray(
        data.scans
      )
    ) {

      throw new Error(
        "TrustLens received an invalid scan-history response."
      );
    }


    backendScans =
      data.scans;


    console.log(
      `Loaded ${backendScans.length} scans from MongoDB.`
    );


    return backendScans;


  } catch (error) {

    console.error(
      "Unable to load MongoDB scans:",
      error
    );


    throw error;
  }
}


/* =========================================================
   LOCAL STORAGE
   TEMPORARY MIRROR ONLY
========================================================= */

/* =========================================================
   TEMPORARY LOCAL MIRROR
========================================================= */


/* =========================================================
   SAVE SCANS ARRAY
========================================================= */



/* =========================================================
   TEXT HELPERS
========================================================= */

function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


function shortenText(
  value,
  maximumLength = 120
) {

  const text =
    String(
      value || ""
    )
      .trim();


  if (
    text.length <=
    maximumLength
  ) {

    return text;
  }


  return (
    text.slice(
      0,
      maximumLength
    ) +
    "..."
  );
}


/* =========================================================
   CURRENT USER EMAIL
========================================================= */

function getCurrentUserEmail() {

  return String(
    getCurrentUser()?.email ||
    ""
  )
    .trim()
    .toLowerCase();
}


/* =========================================================
   LOCAL SCAN OWNERSHIP MIGRATION

   Temporary compatibility layer for history.js.
========================================================= */



/* =========================================================
   SCREENSHOT FILE SIZE
========================================================= */

function formatFileSize(
  bytes
) {

  const size =
    Number(bytes) || 0;


  if (
    size < 1024
  ) {

    return `${size} B`;
  }


  if (
    size <
    1024 * 1024
  ) {

    return `${
      (
        size /
        1024
      ).toFixed(1)
    } KB`;
  }


  return `${
    (
      size /
      (
        1024 *
        1024
      )
    ).toFixed(1)
  } MB`;
}


/* =========================================================
   SCREENSHOT RESET
========================================================= */

function resetScreenshot() {

  if (
    screenshotObjectUrl
  ) {

    URL.revokeObjectURL(
      screenshotObjectUrl
    );


    screenshotObjectUrl =
      "";
  }


  if (
    screenshotInput
  ) {

    screenshotInput.value =
      "";
  }


  if (
    screenshotPreview
  ) {

    screenshotPreview.src =
      "";

    screenshotPreview.style.display =
      "none";
  }


  selectedFileInfo
    ?.classList.add(
      "hidden"
    );


  ocrProgressSection
    ?.classList.add(
      "hidden"
    );


  extractedTextSection
    ?.classList.add(
      "hidden"
    );


  if (
    extractedText
  ) {

    extractedText.value =
      "";

    extractedText.readOnly =
      true;
  }


  if (
    ocrProgressBar
  ) {

    ocrProgressBar.style.width =
      "0%";
  }


  if (
    ocrProgressPercentage
  ) {

    ocrProgressPercentage.textContent =
      "0%";
  }


  clearDashboardMessage();
}


/* =========================================================
   SCREENSHOT FILE SELECTION
========================================================= */

if (
  screenshotInput
) {

  screenshotInput.addEventListener(
    "change",
    handleScreenshotSelection
  );
}


async function handleScreenshotSelection(
  event
) {

  const file =
    event.target
      ?.files?.[0];


  if (!file) {
    return;
  }


  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
  ];


  if (
    !allowedTypes.includes(
      file.type
    )
  ) {

    resetScreenshot();


    showDashboardMessage(
      "Please upload a PNG, JPG, JPEG or WebP image.",
      "error"
    );


    return;
  }


  const maxSize =
    8 * 1024 * 1024;


  if (
    file.size >
    maxSize
  ) {

    resetScreenshot();


    showDashboardMessage(
      "Screenshot is too large. Please upload an image smaller than 8 MB.",
      "error"
    );


    return;
  }


  if (
    screenshotObjectUrl
  ) {

    URL.revokeObjectURL(
      screenshotObjectUrl
    );
  }


  screenshotObjectUrl =
    URL.createObjectURL(
      file
    );


  if (
    screenshotPreview
  ) {

    screenshotPreview.src =
      screenshotObjectUrl;

    screenshotPreview.style.display =
      "block";
  }


  if (
    selectedFileName
  ) {

    selectedFileName.textContent =
      file.name;
  }


  if (
    selectedFileSize
  ) {

    selectedFileSize.textContent =
      formatFileSize(
        file.size
      );
  }


  selectedFileInfo
    ?.classList.remove(
      "hidden"
    );


  extractedTextSection
    ?.classList.add(
      "hidden"
    );


  if (
    extractedText
  ) {

    extractedText.value =
      "";
  }


  showDashboardMessage(
    "Screenshot selected. Click Analyze Screenshot to read and analyze it.",
    "info"
  );
}


/* =========================================================
   REMOVE SCREENSHOT
========================================================= */

if (
  removeScreenshotButton
) {

  removeScreenshotButton.addEventListener(
    "click",
    resetScreenshot
  );
}


/* =========================================================
   EDIT EXTRACTED TEXT
========================================================= */

if (
  editExtractedTextButton
) {

  editExtractedTextButton.addEventListener(
    "click",
    () => {

      if (
        !extractedText
      ) {

        return;
      }


      extractedText.readOnly =
        false;


      extractedText.focus();


      showDashboardMessage(
        "You can now correct the extracted text before analyzing again.",
        "info"
      );

    }
  );
}


/* =========================================================
   OCR
========================================================= */

async function extractScreenshotText(
  file
) {

  if (
    !window.Tesseract
  ) {

    throw new Error(
      "OCR could not start because Tesseract.js is unavailable."
    );
  }


  isOcrRunning =
    true;


  if (
    analyzeButton
  ) {

    analyzeButton.disabled =
      true;

    analyzeButton.innerHTML =
      "<span>👁️</span>Reading Screenshot...";
  }


  ocrProgressSection
    ?.classList.remove(
      "hidden"
    );


  if (
    ocrStatusText
  ) {

    ocrStatusText.textContent =
      "Preparing screenshot reader...";
  }


  if (
    ocrProgressPercentage
  ) {

    ocrProgressPercentage.textContent =
      "0%";
  }


  if (
    ocrProgressBar
  ) {

    ocrProgressBar.style.width =
      "0%";
  }


  try {

    const result =
      await window.Tesseract
        .recognize(
          file,
          "eng",
          {

            logger:
              (message) => {

                if (
                  message.status ===
                  "recognizing text"
                ) {

                  const progress =
                    Math.round(
                      (
                        message.progress ||
                        0
                      ) *
                      100
                    );


                  if (
                    ocrProgressPercentage
                  ) {

                    ocrProgressPercentage.textContent =
                      `${progress}%`;
                  }


                  if (
                    ocrProgressBar
                  ) {

                    ocrProgressBar.style.width =
                      `${progress}%`;
                  }


                  if (
                    ocrStatusText
                  ) {

                    ocrStatusText.textContent =
                      "Reading text from screenshot...";
                  }
                }

              }

          }
        );


    const text =
      String(
        result?.data?.text ||
        ""
      )
        .trim();


    if (!text) {

      throw new Error(
        "No readable text was detected in this screenshot."
      );
    }


    if (
      ocrProgressPercentage
    ) {

      ocrProgressPercentage.textContent =
        "100%";
    }


    if (
      ocrProgressBar
    ) {

      ocrProgressBar.style.width =
        "100%";
    }


    if (
      ocrStatusText
    ) {

      ocrStatusText.textContent =
        "Screenshot text extracted successfully.";
    }


    if (
      extractedText
    ) {

      extractedText.value =
        text;

      extractedText.readOnly =
        true;
    }


    extractedTextSection
      ?.classList.remove(
        "hidden"
      );


    return text;

  } finally {

    isOcrRunning =
      false;


    if (
      analyzeButton
    ) {

      analyzeButton.disabled =
        false;
    }


    updateAnalyzeButtonText();
  }
}


/* =========================================================
   SCREENSHOT ANALYSIS
========================================================= */

async function analyzeScreenshot() {

  const file =
    screenshotInput
      ?.files?.[0];


  let text =
    String(
      extractedText?.value ||
      ""
    )
      .trim();


  if (
    !file &&
    !text
  ) {

    showDashboardMessage(
      "Please upload a screenshot before analyzing.",
      "error"
    );


    return null;
  }


  /*
    If OCR text already exists because the
    user corrected it, reuse it.
  */

  if (
    !text
  ) {

    text =
      await extractScreenshotText(
        file
      );
  }


  const analysis =
    analyzeTextForFraud(
      text
    );


  return buildAnalysisResult({

    scanType:
      "Screenshot",

    originalContent:
      text,

    score:
      analysis.score,

    reasons:
      analysis.reasons

  });
}


/* =========================================================
   DASHBOARD MESSAGE
========================================================= */

function showDashboardMessage(
  message,
  type = ""
) {

  if (
    !dashboardMessage
  ) {

    return;
  }


  dashboardMessage.textContent =
    message;


  dashboardMessage.classList.remove(
    "error",
    "success",
    "info"
  );


  if (
    message &&
    type
  ) {

    dashboardMessage.classList.add(
      type
    );
  }
}


function clearDashboardMessage() {

  showDashboardMessage(
    ""
  );
}


/* =========================================================
   USER SCANS
========================================================= */



/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function updateDashboardStatistics(
  scans = backendScans
) {

  const safeArray =
    Array.isArray(scans)
      ? scans
      : [];


  const total =
    safeArray.length;


  const highRisk =
    safeArray.filter(
      (scan) =>
        Number(
          scan.score
        ) >= 60
    ).length;


  const safe =
    safeArray.filter(
      (scan) =>
        Number(
          scan.score
        ) < 25
    ).length;


  if (totalScans) {

    totalScans.textContent =
      total;
  }


  if (fraudScans) {

    fraudScans.textContent =
      highRisk;
  }


  if (safeScans) {

    safeScans.textContent =
      safe;
  }
}


/* =========================================================
   RECENT SCANS
========================================================= */

function displayRecentScans(
  scans = backendScans
) {

  if (!recentScans) {
    return;
  }


  const safeArray =
    Array.isArray(scans)
      ? [...scans]
      : [];


  const latestScans =
    safeArray
      .sort(
        (first, second) =>
          new Date(
            second.created_at ||
            0
          ).getTime() -
          new Date(
            first.created_at ||
            0
          ).getTime()
      )
      .slice(
        0,
        5
      );


  if (
    latestScans.length === 0
  ) {

    recentScans.innerHTML = `
      <div class="empty-state">

        <div
          class="empty-state-icon"
          aria-hidden="true"
        >
          📂
        </div>

        <h3>
          No scans yet
        </h3>

        <p>
          Your latest results will appear here.
        </p>

      </div>
    `;

    return;
  }


  recentScans.innerHTML =
    latestScans
      .map(
        (scan) => {

          const score =
            Number(
              scan.score
            ) || 0;


          let riskClass =
            "recent-safe";

          let riskLabel =
            scan.risk_level ||
            "Low Risk";


          if (
            score >= 60
          ) {

            riskClass =
              "recent-high-risk";

          } else if (
            score >= 25
          ) {

            riskClass =
              "recent-suspicious";
          }


          const backendType =
            String(
              scan.scan_type ||
              "message"
            )
              .toLowerCase();


          let type =
            "Message";

          let icon =
            "💬";


          if (
            backendType ===
            "link"
          ) {

            type =
              "Website Link";

            icon =
              "🔗";
          }


          if (
            backendType ===
            "screenshot"
          ) {

            type =
              "Screenshot";

            icon =
              "🖼️";
          }


          return `
            <button
              type="button"
              class="recent-scan-item"
              data-recent-scan-id="${escapeHTML(
                scan.id ||
                ""
              )}"
            >

              <div class="recent-scan-main">

                <div
                  class="recent-scan-icon"
                  aria-hidden="true"
                >
                  ${icon}
                </div>

                <div>

                  <strong>
                    ${escapeHTML(
                      type
                    )}
                  </strong>

                  <p>
                    ${escapeHTML(
                      shortenText(
                        scan.original_content ||
                        "",
                        95
                      )
                    )}
                  </p>

                </div>

              </div>


              <div class="recent-scan-result">

                <strong>
                  ${score}%
                </strong>

                <span
                  class="${riskClass}"
                >
                  ${escapeHTML(
                    riskLabel
                  )}
                </span>

              </div>

            </button>
          `;

        }
      )
      .join("");
}


/* =========================================================
   RECENT SCAN → HISTORY
========================================================= */

if (
  recentScans
) {

  recentScans.addEventListener(
    "click",
    (event) => {

      const item =
        event.target.closest(
          "[data-recent-scan-id]"
        );


      if (!item) {
        return;
      }


      const scanId =
        item.dataset
          .recentScanId;


      if (!scanId) {
        return;
      }


      sessionStorage.setItem(
        "trustlensSelectedScan",
        scanId
      );


      window.location.href =
        "history.html";

    }
  );
}


/* =========================================================
   CLOSE SIDEBAR BUTTON
========================================================= */

const closeSidebarButton =
  byId(
    "closeSidebarButton"
  );


if (
  closeSidebarButton
) {

  closeSidebarButton.addEventListener(
    "click",
    closeSidebar
  );
}


/* =========================================================
   CONTACT FORM
========================================================= */

const contactForm =
  byId("contactForm");

const contactName =
  byId("contactName");

const contactEmail =
  byId("contactEmail");

const contactCategory =
  byId("contactCategory");

const contactSubject =
  byId("contactSubject");

const contactMessage =
  byId("contactMessage");

const contactPrivacyCheck =
  byId("contactPrivacyCheck");

const contactFormMessage =
  byId("contactFormMessage");

const contactSubmitButton =
  byId("contactSubmitButton");

const contactSubjectCount =
  byId("contactSubjectCount");

const contactMessageCount =
  byId("contactMessageCount");


/* =========================================================
   CONTACT COUNTERS
========================================================= */

function updateContactCounters() {

  if (
    contactSubject &&
    contactSubjectCount
  ) {

    contactSubjectCount.textContent =
      `${contactSubject.value.length}/100`;
  }


  if (
    contactMessage &&
    contactMessageCount
  ) {

    contactMessageCount.textContent =
      `${contactMessage.value.length}/1000`;
  }
}


contactSubject
  ?.addEventListener(
    "input",
    updateContactCounters
  );


contactMessage
  ?.addEventListener(
    "input",
    updateContactCounters
  );


updateContactCounters();


/* =========================================================
   PREFILL CONTACT USER
========================================================= */

function prefillContactUser() {

  const user =
    getCurrentUser();


  if (!user) {
    return;
  }


  if (
    contactName &&
    !contactName.value
  ) {

    contactName.value =
      user.name ||
      user.fullName ||
      "";
  }


  if (
    contactEmail &&
    !contactEmail.value
  ) {

    contactEmail.value =
      user.email ||
      "";
  }
}


prefillContactUser();


/* =========================================================
   CONTACT FORM SUBMIT
========================================================= */

if (
  contactForm
) {

  contactForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const name =
        String(
          contactName?.value ||
          ""
        )
          .trim();


      const email =
        String(
          contactEmail?.value ||
          ""
        )
          .trim();


      const category =
        String(
          contactCategory?.value ||
          ""
        )
          .trim();


      const subject =
        String(
          contactSubject?.value ||
          ""
        )
          .trim();


      const message =
        String(
          contactMessage?.value ||
          ""
        )
          .trim();


      /* ===============================================
         FRONTEND VALIDATION
      =============================================== */

      if (!name) {

        showContactFormMessage(
          "Please enter your name.",
          "error"
        );

        return;
      }


      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
          .test(
            email
          )
      ) {

        showContactFormMessage(
          "Please enter a valid email address.",
          "error"
        );

        return;
      }


      if (!category) {

        showContactFormMessage(
          "Please select a category.",
          "error"
        );

        return;
      }


      if (
        subject.length <
        3
      ) {

        showContactFormMessage(
          "Please enter a clear subject.",
          "error"
        );

        return;
      }


      if (
        subject.length >
        100
      ) {

        showContactFormMessage(
          "Subject must be 100 characters or fewer.",
          "error"
        );

        return;
      }


      if (
        message.length <
        10
      ) {

        showContactFormMessage(
          "Please provide a little more detail.",
          "error"
        );

        return;
      }


      if (
        message.length >
        1000
      ) {

        showContactFormMessage(
          "Message must be 1000 characters or fewer.",
          "error"
        );

        return;
      }


      if (
        contactPrivacyCheck &&
        !contactPrivacyCheck.checked
      ) {

        showContactFormMessage(
          "Please confirm the privacy notice.",
          "error"
        );

        return;
      }


      /* ===============================================
         SUBMIT STATE
      =============================================== */

      if (
        contactSubmitButton
      ) {

        contactSubmitButton.disabled =
          true;

        contactSubmitButton.textContent =
          "Sending...";
      }


      showContactFormMessage(
        "Sending your message...",
        "info"
      );


      try {

        /* =============================================
           SEND TO FLASK BACKEND
        ============================================= */

        const response =
          await trustLensAuthenticatedFetch(
            `${window.TrustLensAuth.apiBaseUrl}/api/contact`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  name,
                  email,
                  category,
                  subject,
                  message
                })
            }
          );


        let data = {};


        try {

          data =
            await response.json();

        } catch {

          data = {};
        }


        /* =============================================
           AUTH ERRORS
        ============================================= */

        if (
          response.status === 401 ||
          response.status === 422
        ) {

          throw new Error(
            data.msg ||
            data.message ||
            "Your login session is invalid or expired."
          );
        }


        /* =============================================
           BACKEND ERRORS
        ============================================= */

        if (!response.ok) {

          throw new Error(
            data.message ||
            data.error ||
            data.msg ||
            `Request failed with HTTP ${response.status}.`
          );
        }


        if (!data.success) {

          throw new Error(
            data.message ||
            "TrustLens could not send your message."
          );
        }


        /* =============================================
           SUCCESS
        ============================================= */

        showContactFormMessage(
          data.message ||
          "Your message has been sent successfully.",
          "success"
        );


        contactForm.reset();


        prefillContactUser();

        updateContactCounters();


      } catch (error) {

        console.error(
          "Contact form submission failed:",
          error
        );


        showContactFormMessage(
          error.message ||
          "TrustLens could not send your message.",
          "error"
        );


      } finally {

        if (
          contactSubmitButton
        ) {

          contactSubmitButton.disabled =
            false;

          contactSubmitButton.textContent =
            "Send Message";
        }
      }

    }
  );
}

/* =========================================================
   CONTACT MESSAGE
========================================================= */

function showContactFormMessage(
  message,
  type = ""
) {

  if (
    !contactFormMessage
  ) {

    return;
  }


  contactFormMessage.textContent =
    message;


  contactFormMessage.classList.remove(
    "error",
    "success",
    "info"
  );


  if (
    message &&
    type
  ) {

    contactFormMessage.classList.add(
      type
    );
  }
}


/* =========================================================
   FAQ
========================================================= */

document
  .querySelectorAll(
    ".contact-faq-question"
  )
  .forEach(
    (question) => {

      question.addEventListener(
        "click",
        () => {

          const item =
            question.closest(
              ".contact-faq-item"
            );


          const answer =
            item?.querySelector(
              ".contact-faq-answer"
            );


          const symbol =
            question.querySelector(
              ".contact-faq-symbol"
            );


          const currentlyOpen =
            question.getAttribute(
              "aria-expanded"
            ) === "true";


          question.setAttribute(
            "aria-expanded",
            currentlyOpen
              ? "false"
              : "true"
          );


          item?.classList.toggle(
            "active",
            !currentlyOpen
          );


          if (
            answer
          ) {

            answer.style.maxHeight =
              currentlyOpen
                ? ""
                : `${answer.scrollHeight}px`;
          }


          if (
            symbol
          ) {

            symbol.textContent =
              currentlyOpen
                ? "+"
                : "−";
          }

        }
      );

    }
  );


/* =========================================================
   STORAGE SYNC
========================================================= */

window.addEventListener(
  "storage",
  (event) => {

    if (
      event.key ===
      THEME_STORAGE_KEY
    ) {

      loadSavedTheme();
    }

  }
);

/* =========================================================
   HASH → SCANNER
========================================================= */

if (
  window.location.hash ===
  "#scannerSection"
) {

  window.setTimeout(
    () => {

      byId(
        "scannerSection"
      )
        ?.scrollIntoView({
          behavior:
            "smooth",

          block:
            "start"
        });

    },
    150
  );
}


/* =========================================================
   TRUSTLENS SHARED API

   history.js depends on these functions.
========================================================= */

window.TrustLensApp =
Object.freeze({

  storageKeys: {
    theme:
      THEME_STORAGE_KEY
  },

  getCurrentUser,

  escapeHTML,

  shortenText

});
/* =========================================================
   FINAL STARTUP COMPATIBILITY
========================================================= */

/* =========================================================
   TRUSTLENS SHARED API

   history.js depends on these functions.
========================================================= */

window.TrustLensApp =
  Object.freeze({

    storageKeys: {
      theme:
        THEME_STORAGE_KEY
    },

    getCurrentUser,

    escapeHTML,

    shortenText

  });
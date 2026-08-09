"use strict";

/* =========================================================
   TRUSTLENS AI — AUTH V3
   Phase 2.3 Backend Authentication

   Backend:
   Flask + MongoDB + JWT

   Handles:
   - Login
   - Signup
   - JWT storage
   - Current user session
   - Protected-page session validation
   - Remember email
   - Password visibility
   - Password strength
   - Logout
   - Forgot-password UI preparation
========================================================= */

(() => {

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const API_BASE_URL =
    "https://trustlens-ai-1dhy.onrender.com";

  const API_ENDPOINTS = Object.freeze({
    register:
      `${API_BASE_URL}/api/auth/register`,

    login:
      `${API_BASE_URL}/api/auth/login`,

    me:
      `${API_BASE_URL}/api/auth/me`
  });


  const STORAGE_KEYS = Object.freeze({
    accessToken:
      "trustLensAccessToken",

    currentUser:
      "trustLensCurrentUser",

    rememberedEmail:
      "trustLensRememberedEmail"
  });


  const PAGE_URLS = Object.freeze({
    login:
      "index.html",

    signup:
      "signup.html",

    dashboard:
      "dashboard.html"
  });


  const PROTECTED_PAGES = [
    "dashboard.html",
    "history.html",
    "about.html",
    "contact.html"
  ];


  /* =======================================================
     GENERAL DOM HELPERS
  ======================================================= */

  const byId = (id) =>
    document.getElementById(id);


  function getFirstElement(...ids) {

    for (const id of ids) {

      const element =
        document.getElementById(id);

      if (element) {
        return element;
      }
    }

    return null;
  }


  function normaliseEmail(value) {

    return String(value || "")
      .trim()
      .toLowerCase();
  }


  function normaliseName(value) {

    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }


  function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
      .test(
        normaliseEmail(email)
      );
  }


  function redirectTo(page) {

    window.location.href = page;
  }


  /* =======================================================
     SAFE STORAGE
  ======================================================= */

  function readJSON(key, fallback = null) {

    try {

      const raw =
        localStorage.getItem(key);

      if (!raw) {
        return fallback;
      }

      return JSON.parse(raw);

    } catch (error) {

      console.error(
        `Unable to read ${key}:`,
        error
      );

      return fallback;
    }
  }


  function writeJSON(key, value) {

    try {

      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      return true;

    } catch (error) {

      console.error(
        `Unable to save ${key}:`,
        error
      );

      return false;
    }
  }


  function removeStorageKey(key) {

    try {

      localStorage.removeItem(key);

    } catch (error) {

      console.error(
        `Unable to remove ${key}:`,
        error
      );
    }
  }


  /* =======================================================
     TOKEN + SESSION
  ======================================================= */

  function getAccessToken() {

    try {

      return localStorage.getItem(
        STORAGE_KEYS.accessToken
      ) || "";

    } catch {

      return "";
    }
  }


  function saveAccessToken(token) {

    try {

      localStorage.setItem(
        STORAGE_KEYS.accessToken,
        token
      );

      return true;

    } catch (error) {

      console.error(
        "Unable to save access token:",
        error
      );

      return false;
    }
  }


  function saveCurrentUser(user) {

    return writeJSON(
      STORAGE_KEYS.currentUser,
      user
    );
  }


  function getCurrentUser() {

    return readJSON(
      STORAGE_KEYS.currentUser,
      null
    );
  }


  function clearAuthSession() {

    removeStorageKey(
      STORAGE_KEYS.accessToken
    );

    removeStorageKey(
      STORAGE_KEYS.currentUser
    );
  }


  function isLoggedIn() {

    return Boolean(
      getAccessToken() &&
      getCurrentUser()
    );
  }


  function logout() {

    clearAuthSession();

    redirectTo(
      PAGE_URLS.login
    );
  }


  /* =======================================================
     EXPOSE AUTH TO OTHER FILES
  ======================================================= */

  window.TrustLensAuth =
    Object.freeze({

      getCurrentUser,

      getAccessToken,

      isLoggedIn,

      logout,

      apiBaseUrl:
        API_BASE_URL,

      async authenticatedFetch(
        url,
        options = {}
      ) {

        const token =
          getAccessToken();

        const headers = {
          ...(options.headers || {})
        };

        if (token) {

          headers.Authorization =
            `Bearer ${token}`;
        }

        return fetch(
          url,
          {
            ...options,
            headers
          }
        );
      }

    });


  /* =======================================================
     API REQUEST HELPER
  ======================================================= */

  async function apiRequest(
    url,
    options = {}
  ) {

    let response;

    try {

      response = await fetch(
        url,
        options
      );

    } catch (error) {

      console.error(
        "Backend connection failed:",
        error
      );

      throw new Error(
        "Cannot connect to TrustLens backend. Make sure Flask is running."
      );
    }


    let data = {};

    try {

      data = await response.json();

    } catch {

      data = {};
    }


    if (!response.ok) {

      throw new Error(
        data.message ||
        data.msg ||
        data.error ||
        "Request failed."
      );
    }


    return data;
  }


  /* =======================================================
     FORM HELPERS
  ======================================================= */

  function setFieldError(
    input,
    errorElement,
    message
  ) {

    if (input) {

      input.classList.remove(
        "input-success"
      );

      input.classList.add(
        "input-error"
      );

      input.setAttribute(
        "aria-invalid",
        "true"
      );
    }


    if (errorElement) {

      errorElement.textContent =
        message || "";
    }
  }


  function setFieldSuccess(
    input,
    errorElement
  ) {

    if (input) {

      input.classList.remove(
        "input-error"
      );

      input.classList.add(
        "input-success"
      );

      input.setAttribute(
        "aria-invalid",
        "false"
      );
    }


    if (errorElement) {

      errorElement.textContent =
        "";
    }
  }


  function clearFieldState(
    input,
    errorElement
  ) {

    if (input) {

      input.classList.remove(
        "input-error",
        "input-success"
      );

      input.setAttribute(
        "aria-invalid",
        "false"
      );
    }


    if (errorElement) {

      errorElement.textContent =
        "";
    }
  }


  function showFormMessage(
    element,
    message = "",
    type = ""
  ) {

    if (!element) {
      return;
    }


    element.textContent =
      message;


    element.classList.remove(
      "error",
      "success",
      "info"
    );


    if (
      message &&
      type
    ) {

      element.classList.add(
        type
      );
    }
  }


  function setButtonLoading(
    button,
    loading,
    loadingText = "Please wait..."
  ) {

    if (!button) {
      return;
    }


    if (loading) {

      if (
        !button.dataset
          .originalContent
      ) {

        button.dataset
          .originalContent =
          button.innerHTML;
      }


      button.disabled =
        true;

      button.classList.add(
        "loading"
      );


      button.innerHTML = `
        <span aria-hidden="true">
          ⏳
        </span>

        <span>
          ${loadingText}
        </span>
      `;

      return;
    }


    button.disabled =
      false;

    button.classList.remove(
      "loading"
    );


    if (
      button.dataset
        .originalContent
    ) {

      button.innerHTML =
        button.dataset
          .originalContent;
    }
  }


  /* =======================================================
     PASSWORD CHECKS
  ======================================================= */

  function getPasswordChecks(
    password
  ) {

    const value =
      String(password || "");


    return {

      length:
        value.length >= 8,

      letter:
        /[A-Za-z]/.test(
          value
        ),

      number:
        /\d/.test(
          value
        ),

      uppercase:
        /[A-Z]/.test(
          value
        ),

      lowercase:
        /[a-z]/.test(
          value
        ),

      special:
        /[^A-Za-z0-9]/.test(
          value
        )

    };
  }


  function isAcceptedPassword(
    password
  ) {

    const checks =
      getPasswordChecks(
        password
      );


    return (
      checks.length &&
      checks.letter &&
      checks.number
    );
  }


  function calculatePasswordStrength(
    password
  ) {

    const value =
      String(password || "");


    if (!value) {

      return {
        className:
          "empty",

        label:
          "Not entered"
      };
    }


    const checks =
      getPasswordChecks(
        value
      );


    let score = 0;


    if (checks.length) {
      score += 1;
    }

    if (value.length >= 12) {
      score += 1;
    }

    if (checks.uppercase) {
      score += 1;
    }

    if (checks.lowercase) {
      score += 1;
    }

    if (checks.number) {
      score += 1;
    }

    if (checks.special) {
      score += 1;
    }


    if (score <= 1) {

      return {
        className:
          "very-weak",

        label:
          "Very weak"
      };
    }


    if (score === 2) {

      return {
        className:
          "weak",

        label:
          "Weak"
      };
    }


    if (score === 3) {

      return {
        className:
          "medium",

        label:
          "Medium"
      };
    }


    if (score === 4) {

      return {
        className:
          "strong",

        label:
          "Strong"
      };
    }


    return {
      className:
        "very-strong",

      label:
        "Very strong"
    };
  }


  /* =======================================================
     PASSWORD STRENGTH UI
  ======================================================= */

  function updatePasswordStrength(
    password
  ) {

    const bar =
      getFirstElement(
        "passwordStrengthBar",
        "signupPasswordStrengthBar"
      );


    const label =
      getFirstElement(
        "passwordStrengthLabel",
        "passwordStrengthValue",
        "passwordStrengthText"
      );


    const strength =
      calculatePasswordStrength(
        password
      );


    const states = [
      "empty",
      "very-weak",
      "weak",
      "medium",
      "strong",
      "very-strong"
    ];


    if (bar) {

      bar.classList.remove(
        ...states
      );

      bar.classList.add(
        strength.className
      );
    }


    if (label) {

      label.classList.remove(
        ...states
      );

      label.classList.add(
        strength.className
      );

      label.textContent =
        strength.label;
    }
  }


  function setRequirement(
    element,
    complete
  ) {

    if (!element) {
      return;
    }


    element.classList.toggle(
      "completed",
      complete
    );


    element.classList.remove(
      "failed"
    );
  }


  function updatePasswordRequirements(
    password,
    confirmation
  ) {

    const checks =
      getPasswordChecks(
        password
      );


    setRequirement(
      byId(
        "requirementLength"
      ),
      checks.length
    );


    setRequirement(
      byId(
        "requirementLetter"
      ),
      checks.letter
    );


    setRequirement(
      byId(
        "requirementNumber"
      ),
      checks.number
    );


    setRequirement(
      byId(
        "requirementMatch"
      ),
      Boolean(password) &&
      Boolean(confirmation) &&
      password === confirmation
    );
  }


  /* =======================================================
     PASSWORD VISIBILITY
  ======================================================= */

  function initialisePasswordToggles() {

    const buttons =
      document.querySelectorAll(
        ".password-toggle-button"
      );


    buttons.forEach(
      (button) => {

        if (
          button.dataset
            .authInitialised ===
          "true"
        ) {

          return;
        }


        button.dataset
          .authInitialised =
          "true";


        button.addEventListener(
          "click",
          () => {

            const wrapper =
              button.closest(
                ".auth-input-wrapper"
              );


            const input =
              wrapper?.querySelector(
                'input[type="password"], input[type="text"]'
              );


            if (!input) {
              return;
            }


            const currentlyVisible =
              input.type ===
              "text";


            input.type =
              currentlyVisible
                ? "password"
                : "text";


            button.textContent =
              currentlyVisible
                ? "👁️"
                : "🙈";


            button.setAttribute(
              "aria-label",
              currentlyVisible
                ? "Show password"
                : "Hide password"
            );


            button.setAttribute(
              "aria-pressed",
              currentlyVisible
                ? "false"
                : "true"
            );


            input.focus();
          }
        );

      }
    );
  }


  /* =======================================================
     LOGIN
  ======================================================= */

  function initialiseLogin() {

    const form =
      byId("loginForm");


    if (
      !form ||
      form.dataset
        .authInitialised ===
        "true"
    ) {

      return;
    }


    form.dataset
      .authInitialised =
      "true";


    const emailInput =
      byId("loginEmail");


    const passwordInput =
      byId("loginPassword");


    const rememberInput =
      byId("rememberMe");


    const emailError =
      byId("loginEmailError");


    const passwordError =
      byId(
        "loginPasswordError"
      );


    const formMessage =
      byId("loginMessage");


    const submitButton =
      byId("loginButton") ||
      form.querySelector(
        '[type="submit"]'
      );


    /* Remembered email */

    try {

      const remembered =
        localStorage.getItem(
          STORAGE_KEYS
            .rememberedEmail
        );


      if (
        remembered &&
        emailInput
      ) {

        emailInput.value =
          remembered;


        if (rememberInput) {

          rememberInput.checked =
            true;
        }
      }

    } catch {
      // Ignore
    }


    emailInput
      ?.addEventListener(
        "input",
        () => {

          clearFieldState(
            emailInput,
            emailError
          );


          showFormMessage(
            formMessage
          );
        }
      );


    passwordInput
      ?.addEventListener(
        "input",
        () => {

          clearFieldState(
            passwordInput,
            passwordError
          );


          showFormMessage(
            formMessage
          );
        }
      );


    form.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();


        const email =
          normaliseEmail(
            emailInput?.value
          );


        const password =
          String(
            passwordInput?.value ||
            ""
          );


        let valid = true;


        clearFieldState(
          emailInput,
          emailError
        );


        clearFieldState(
          passwordInput,
          passwordError
        );


        showFormMessage(
          formMessage
        );


        if (!email) {

          setFieldError(
            emailInput,
            emailError,
            "Please enter your email address."
          );

          valid = false;

        } else if (
          !isValidEmail(
            email
          )
        ) {

          setFieldError(
            emailInput,
            emailError,
            "Please enter a valid email address."
          );

          valid = false;
        }


        if (!password) {

          setFieldError(
            passwordInput,
            passwordError,
            "Please enter your password."
          );

          valid = false;
        }


        if (!valid) {

          showFormMessage(
            formMessage,
            "Please correct the highlighted fields.",
            "error"
          );

          return;
        }


        setButtonLoading(
          submitButton,
          true,
          "Signing in..."
        );


        try {

          const data =
            await apiRequest(
              API_ENDPOINTS.login,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    email,
                    password
                  })
              }
            );


          if (
            !data.access_token ||
            !data.user
          ) {

            throw new Error(
              "Login response is incomplete."
            );
          }


          saveAccessToken(
            data.access_token
          );


          saveCurrentUser(
            data.user
          );


          if (
            rememberInput?.checked
          ) {

            localStorage.setItem(
              STORAGE_KEYS
                .rememberedEmail,
              email
            );

          } else {

            removeStorageKey(
              STORAGE_KEYS
                .rememberedEmail
            );
          }


          setFieldSuccess(
            emailInput,
            emailError
          );


          setFieldSuccess(
            passwordInput,
            passwordError
          );


          showFormMessage(
            formMessage,
            "Login successful. Opening your dashboard...",
            "success"
          );


          window.setTimeout(
            () => {

              redirectTo(
                PAGE_URLS.dashboard
              );

            },
            500
          );


        } catch (error) {

          console.error(
            "Login failed:",
            error
          );


          setFieldError(
            passwordInput,
            passwordError,
            ""
          );


          showFormMessage(
            formMessage,
            error.message,
            "error"
          );


        } finally {

          setButtonLoading(
            submitButton,
            false
          );
        }
      }
    );
  }


  /* =======================================================
     SIGNUP
  ======================================================= */

  function initialiseSignup() {

    const form =
      byId("signupForm");


    if (
      !form ||
      form.dataset
        .authInitialised ===
        "true"
    ) {

      return;
    }


    form.dataset
      .authInitialised =
      "true";


    const nameInput =
      byId("signupName");


    const emailInput =
      byId("signupEmail");


    const passwordInput =
      byId("signupPassword");


    const confirmPasswordInput =
      byId(
        "confirmSignupPassword"
      );


    const termsInput =
      byId("acceptTerms");


    const nameError =
      byId("signupNameError");


    const emailError =
      byId("signupEmailError");


    const passwordError =
      byId(
        "signupPasswordError"
      );


    const confirmError =
      getFirstElement(
        "confirmSignupPasswordError",
        "signupConfirmPasswordError"
      );


    const termsError =
      getFirstElement(
        "acceptTermsError",
        "signupTermsError"
      );


    const formMessage =
      byId("signupMessage");


    const submitButton =
      byId("signupButton") ||
      form.querySelector(
        '[type="submit"]'
      );


    const termsContainer =
      termsInput?.closest(
        ".signup-terms"
      ) ||
      termsInput?.closest(
        ".remember-checkbox"
      );


    function refreshPasswordUI() {

      const password =
        String(
          passwordInput?.value ||
          ""
        );


      const confirmation =
        String(
          confirmPasswordInput
            ?.value ||
          ""
        );


      updatePasswordStrength(
        password
      );


      updatePasswordRequirements(
        password,
        confirmation
      );
    }


    nameInput
      ?.addEventListener(
        "input",
        () => {

          clearFieldState(
            nameInput,
            nameError
          );

          showFormMessage(
            formMessage
          );
        }
      );


    emailInput
      ?.addEventListener(
        "input",
        () => {

          clearFieldState(
            emailInput,
            emailError
          );

          showFormMessage(
            formMessage
          );
        }
      );


    passwordInput
      ?.addEventListener(
        "input",
        () => {

          clearFieldState(
            passwordInput,
            passwordError
          );

          clearFieldState(
            confirmPasswordInput,
            confirmError
          );

          refreshPasswordUI();

          showFormMessage(
            formMessage
          );
        }
      );


    confirmPasswordInput
      ?.addEventListener(
        "input",
        () => {

          clearFieldState(
            confirmPasswordInput,
            confirmError
          );

          refreshPasswordUI();

          showFormMessage(
            formMessage
          );
        }
      );


    termsInput
      ?.addEventListener(
        "change",
        () => {

          termsContainer
            ?.classList.remove(
              "signup-terms-error"
            );


          if (termsError) {
            termsError.textContent =
              "";
          }


          showFormMessage(
            formMessage
          );
        }
      );


    refreshPasswordUI();


    form.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();


        const name =
          normaliseName(
            nameInput?.value
          );


        const email =
          normaliseEmail(
            emailInput?.value
          );


        const password =
          String(
            passwordInput?.value ||
            ""
          );


        const confirmation =
          String(
            confirmPasswordInput
              ?.value ||
            ""
          );


        let valid = true;


        clearFieldState(
          nameInput,
          nameError
        );


        clearFieldState(
          emailInput,
          emailError
        );


        clearFieldState(
          passwordInput,
          passwordError
        );


        clearFieldState(
          confirmPasswordInput,
          confirmError
        );


        showFormMessage(
          formMessage
        );


        termsContainer
          ?.classList.remove(
            "signup-terms-error"
          );


        if (termsError) {
          termsError.textContent =
            "";
        }


        if (
          !name ||
          name.length < 2
        ) {

          setFieldError(
            nameInput,
            nameError,
            "Please enter your full name."
          );

          valid = false;
        }


        if (!email) {

          setFieldError(
            emailInput,
            emailError,
            "Please enter your email address."
          );

          valid = false;

        } else if (
          !isValidEmail(email)
        ) {

          setFieldError(
            emailInput,
            emailError,
            "Please enter a valid email address."
          );

          valid = false;
        }


        if (
          !isAcceptedPassword(
            password
          )
        ) {

          setFieldError(
            passwordInput,
            passwordError,
            "Use at least 8 characters with at least one letter and one number."
          );

          valid = false;
        }


        if (!confirmation) {

          setFieldError(
            confirmPasswordInput,
            confirmError,
            "Please confirm your password."
          );

          valid = false;

        } else if (
          password !==
          confirmation
        ) {

          setFieldError(
            confirmPasswordInput,
            confirmError,
            "Passwords do not match."
          );

          valid = false;
        }


        if (
          termsInput &&
          !termsInput.checked
        ) {

          termsContainer
            ?.classList.add(
              "signup-terms-error"
            );


          if (termsError) {

            termsError.textContent =
              "Please accept the safety notice.";
          }


          valid = false;
        }


        if (!valid) {

          showFormMessage(
            formMessage,
            "Please correct the highlighted fields.",
            "error"
          );

          return;
        }


        setButtonLoading(
          submitButton,
          true,
          "Creating account..."
        );


        try {

          const data =
            await apiRequest(
              API_ENDPOINTS.register,
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
                    password
                  })
              }
            );


          try {

            localStorage.setItem(
              STORAGE_KEYS
                .rememberedEmail,
              email
            );

          } catch {
            // Ignore
          }


          setFieldSuccess(
            nameInput,
            nameError
          );


          setFieldSuccess(
            emailInput,
            emailError
          );


          showFormMessage(
            formMessage,
            data.message ||
            "Account created successfully.",
            "success"
          );


          if (submitButton) {

            submitButton.classList.add(
              "success"
            );

            submitButton.disabled =
              true;


            submitButton.innerHTML = `
              <span aria-hidden="true">
                ✓
              </span>

              <span>
                Account Created
              </span>
            `;
          }


          window.setTimeout(
            () => {

              redirectTo(
                PAGE_URLS.login
              );

            },
            1000
          );


        } catch (error) {

          console.error(
            "Signup failed:",
            error
          );


          showFormMessage(
            formMessage,
            error.message,
            "error"
          );


          setButtonLoading(
            submitButton,
            false
          );
        }
      }
    );
  }


  /* =======================================================
     DEMO LOGIN
  ======================================================= */

  function initialiseDemoLogin() {

    const button =
      byId("demoLoginButton");


    if (!button) {
      return;
    }


    button.addEventListener(
      "click",
      () => {

        const message =
          byId("loginMessage");


        showFormMessage(
          message,
          "Demo login will be connected to the backend after the main authentication flow is completed.",
          "info"
        );
      }
    );
  }


  /* =======================================================
     FORGOT PASSWORD MODAL
  ======================================================= */

  function initialiseForgotPassword() {

    const openButton =
      byId("forgotPasswordButton");


    const modal =
      byId("forgotPasswordModal");


    if (
      !openButton ||
      !modal
    ) {

      return;
    }


    const overlay =
      byId(
        "forgotPasswordOverlay"
      );


    const closeButton =
      byId(
        "closeForgotPasswordModal"
      );


    const resetForm =
      byId(
        "forgotPasswordForm"
      );


    const resetMessage =
      byId(
        "resetPasswordMessage"
      );


    function openModal() {

      modal.classList.remove(
        "hidden"
      );


      modal.setAttribute(
        "aria-hidden",
        "false"
      );


      document.body.style
        .overflow =
        "hidden";


      byId("resetEmail")
        ?.focus();
    }


    function closeModal() {

      modal.classList.add(
        "hidden"
      );


      modal.setAttribute(
        "aria-hidden",
        "true"
      );


      document.body.style
        .overflow =
        "";


      openButton.focus();
    }


    openButton.addEventListener(
      "click",
      openModal
    );


    closeButton
      ?.addEventListener(
        "click",
        closeModal
      );


    overlay
      ?.addEventListener(
        "click",
        closeModal
      );


    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "Escape" &&
          !modal.classList
            .contains("hidden")
        ) {

          closeModal();
        }
      }
    );


    /*
      Password reset API has not been created
      in backend/routes/auth.py yet.

      Prevent frontend from pretending that a
      backend password was changed.
    */

    resetForm
      ?.addEventListener(
        "submit",
        (event) => {

          event.preventDefault();


          showFormMessage(
            resetMessage,
            "Backend password reset will be enabled in the next authentication step.",
            "info"
          );
        }
      );
  }


  /* =======================================================
     VALIDATE JWT SESSION
  ======================================================= */

  async function validateBackendSession() {

    const token =
      getAccessToken();


    if (!token) {

      return false;
    }


    try {

      const data =
        await apiRequest(
          API_ENDPOINTS.me,
          {
            method:
              "GET",

            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );


      if (!data.user) {
        return false;
      }


      saveCurrentUser(
        data.user
      );


      return true;


    } catch (error) {

      console.warn(
        "Session validation failed:",
        error.message
      );


      clearAuthSession();


      return false;
    }
  }


  /* =======================================================
     PROTECTED PAGE CHECK
  ======================================================= */

  function getCurrentPageName() {

    const pathname =
      window.location.pathname;


    const name =
      pathname
        .split("/")
        .pop();


    return (
      name ||
      "index.html"
    );
  }


  function isProtectedPage() {

    return PROTECTED_PAGES.includes(
      getCurrentPageName()
    );
  }


  async function protectCurrentPage() {

    if (
      !isProtectedPage()
    ) {

      return;
    }


    if (!getAccessToken()) {

      clearAuthSession();

      redirectTo(
        PAGE_URLS.login
      );

      return;
    }


    const valid =
      await validateBackendSession();


    if (!valid) {

      redirectTo(
        PAGE_URLS.login
      );
    }
  }


  /* =======================================================
     LOGOUT BUTTONS
  ======================================================= */

  function initialiseLogoutButtons() {

    const buttons =
      document.querySelectorAll(
        "#logoutButton, [data-logout]"
      );


    buttons.forEach(
      (button) => {

        if (
          button.dataset
            .logoutInitialised ===
          "true"
        ) {

          return;
        }


        button.dataset
          .logoutInitialised =
          "true";


        button.addEventListener(
          "click",
          logout
        );
      }
    );
  }


  /* =======================================================
     EXISTING LOGIN SESSION
  ======================================================= */

  function showExistingSessionNotice() {

    if (
      getCurrentPageName() !==
      "index.html"
    ) {

      return;
    }


    const user =
      getCurrentUser();


    if (!user) {
      return;
    }


    const message =
      byId("loginMessage");


    if (!message) {
      return;
    }


    showFormMessage(
      message,
      `You are currently signed in as ${user.email}. Logging in again will replace this session.`,
      "info"
    );
  }


  /* =======================================================
     INITIALIZATION
  ======================================================= */

  async function initialiseAuth() {

    initialisePasswordToggles();

    initialiseLogin();

    initialiseSignup();

    initialiseDemoLogin();

    initialiseForgotPassword();

    initialiseLogoutButtons();

    showExistingSessionNotice();

    await protectCurrentPage();
  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialiseAuth,
      {
        once: true
      }
    );

  } else {

    initialiseAuth();
  }

})();
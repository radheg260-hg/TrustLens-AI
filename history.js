"use strict";

/* =========================================================
   TRUSTLENS AI — HISTORY PAGE
   Phase 2.4.6

   Backend powered:
   - GET    /api/scans
   - DELETE /api/scans/:id
   - DELETE /api/scans

   Uses:
   - JWT authentication
   - MongoDB scan history
   - Search
   - Filters
   - Details modal
   - Delete one scan
   - Clear all history
========================================================= */

(() => {

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const API_BASE_URL =
    "https://trustlens-ai-1dhy.onrender.com";


  const API_ENDPOINTS = Object.freeze({

    scans:
      `${API_BASE_URL}/api/scans`

  });


  /* =======================================================
     DEPENDENCIES
  ======================================================= */

  const auth =
    window.TrustLensAuth;


  const app =
    window.TrustLensApp;


  if (!auth) {

    console.error(
      "TrustLensAuth is unavailable. Make sure auth.js loads before history.js."
    );

    return;
  }


  /* =======================================================
     DOM HELPERS
  ======================================================= */

  const byId = (id) =>
    document.getElementById(id);


  /* =======================================================
     MAIN ELEMENTS
  ======================================================= */

  const historyList =
    byId("historyList");


  const historyEmptyState =
    byId("historyEmptyState");


  const historySearchInput =
    byId("historySearchInput");


  const historyFilter =
    byId("historyFilter");


  const historyResultCount =
    byId("historyResultCount");


  const clearHistoryButton =
    byId("clearHistoryButton");


  /* =======================================================
     DETAILS MODAL
  ======================================================= */

  const historyDetailsModal =
    byId("historyDetailsModal");


  const historyModalOverlay =
    byId("historyModalOverlay");


  const closeHistoryModalButton =
    byId("closeHistoryModalButton");


  const historyModalContent =
    byId("historyModalContent");


  /* =======================================================
     CLEAR HISTORY MODAL
  ======================================================= */

  const historyConfirmModal =
    byId("historyConfirmModal");


  const historyConfirmOverlay =
    byId("historyConfirmOverlay");


  const cancelClearHistoryButton =
    byId("cancelClearHistoryButton");


  const confirmClearHistoryButton =
    byId("confirmClearHistoryButton");


  /* =======================================================
     STATE
  ======================================================= */

  let backendScans = [];

  let selectedScanId = "";

  let historyLoading = false;

  let deletingScan = false;

  let clearingHistory = false;


  /* =======================================================
     SAFE TEXT
  ======================================================= */

  function escapeHTML(
    value
  ) {

    if (
      app &&
      typeof app.escapeHTML ===
        "function"
    ) {

      return app.escapeHTML(
        value ?? ""
      );
    }


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
    maximumLength = 170
  ) {

    if (
      app &&
      typeof app.shortenText ===
        "function"
    ) {

      return app.shortenText(
        value,
        maximumLength
      );
    }


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
      ).trimEnd() +
      "..."
    );
  }


  /* =======================================================
     AUTHENTICATED REQUEST
  ======================================================= */

  async function authenticatedRequest(
    url,
    options = {}
  ) {

    if (
      typeof auth.authenticatedFetch !==
        "function"
    ) {

      throw new Error(
        "Authenticated requests are unavailable."
      );
    }


    let response;


    try {

      response =
        await auth.authenticatedFetch(
          url,
          options
        );

    } catch (error) {

      console.error(
        "Backend connection failed:",
        error
      );


      throw new Error(
        "Could not connect to the TrustLens backend."
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
        "Your login session is invalid or expired."
      );
    }


    if (!response.ok) {

      throw new Error(
        data.message ||
        data.error ||
        data.msg ||
        `Request failed with HTTP ${response.status}.`
      );
    }


    return data;
  }


  /* =======================================================
     NORMALIZE BACKEND SCAN
  ======================================================= */

  function normalizeBackendScan(
    scan
  ) {

    const rawType =
      String(
        scan?.scan_type ||
        scan?.scanType ||
        "message"
      )
        .trim()
        .toLowerCase();


    let displayType =
      "Message";


    if (
      rawType === "link"
    ) {

      displayType =
        "Website Link";
    }


    if (
      rawType ===
      "screenshot"
    ) {

      displayType =
        "Screenshot";
    }


    return {

      id:
        String(
          scan?.id ||
          scan?._id ||
          ""
        ),

      scanType:
        displayType,

      backendType:
        rawType,

      title:
        scan?.title ||
        "Analysis Result",

      originalContent:
        scan?.original_content ||
        scan?.originalContent ||
        "",

      score:
        Math.max(
          0,
          Math.min(
            Number(
              scan?.score
            ) || 0,
            100
          )
        ),

      riskLevel:
        scan?.risk_level ||
        scan?.riskLevel ||
        "Low Risk",

      reasons:
        Array.isArray(
          scan?.reasons
        )
          ? scan.reasons
          : [],

      advice:
        scan?.advice ||
        "",

      createdAt:
        scan?.created_at ||
        scan?.timestamp ||
        scan?.createdAt ||
        ""

    };
  }


  /* =======================================================
     LOAD HISTORY FROM MONGODB
  ======================================================= */

  async function loadHistoryFromBackend() {

    if (historyLoading) {
      return backendScans;
    }


    historyLoading = true;


    if (historyList) {

      historyList.setAttribute(
        "aria-busy",
        "true"
      );
    }


    try {

      const data =
        await authenticatedRequest(
          API_ENDPOINTS.scans,
          {
            method: "GET"
          }
        );


      if (
        !data.success ||
        !Array.isArray(
          data.scans
        )
      ) {

        throw new Error(
          "Invalid scan history response."
        );
      }


      backendScans =
        data.scans
          .map(
            normalizeBackendScan
          )
          .sort(
            (
              first,
              second
            ) => {

              return (
                new Date(
                  second.createdAt ||
                  0
                ).getTime() -
                new Date(
                  first.createdAt ||
                  0
                ).getTime()
              );
            }
          );


      console.log(
        `History loaded ${backendScans.length} scans from MongoDB.`
      );


      return backendScans;


    } finally {

      historyLoading = false;


      if (historyList) {

        historyList.setAttribute(
          "aria-busy",
          "false"
        );
      }
    }
  }


  /* =======================================================
     DATE HELPERS
  ======================================================= */

  function formatScanDate(
    timestamp
  ) {

    const date =
      new Date(
        timestamp
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "Unknown date";
    }


    const difference =
      Date.now() -
      date.getTime();


    const minute =
      60 * 1000;


    const hour =
      60 * minute;


    const day =
      24 * hour;


    if (
      difference >= 0 &&
      difference < minute
    ) {

      return "Just now";
    }


    if (
      difference >= 0 &&
      difference < hour
    ) {

      const minutes =
        Math.max(
          1,
          Math.floor(
            difference /
            minute
          )
        );


      return `${minutes} minute${
        minutes === 1
          ? ""
          : "s"
      } ago`;
    }


    if (
      difference >= 0 &&
      difference < day
    ) {

      const hours =
        Math.max(
          1,
          Math.floor(
            difference /
            hour
          )
        );


      return `${hours} hour${
        hours === 1
          ? ""
          : "s"
      } ago`;
    }


    if (
      difference >= 0 &&
      difference <
        day * 7
    ) {

      const days =
        Math.max(
          1,
          Math.floor(
            difference /
            day
          )
        );


      return `${days} day${
        days === 1
          ? ""
          : "s"
      } ago`;
    }


    return new Intl
      .DateTimeFormat(
        "en-IN",
        {
          day:
            "2-digit",

          month:
            "short",

          year:
            "numeric"
        }
      )
      .format(
        date
      );
  }


  function formatFullScanDate(
    timestamp
  ) {

    const date =
      new Date(
        timestamp
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "Unknown date";
    }


    return new Intl
      .DateTimeFormat(
        "en-IN",
        {
          day:
            "2-digit",

          month:
            "long",

          year:
            "numeric",

          hour:
            "2-digit",

          minute:
            "2-digit"
        }
      )
      .format(
        date
      );
  }


  /* =======================================================
     SCAN TYPE HELPERS
  ======================================================= */

  function getScanTypeCategory(
    scanType
  ) {

    const type =
      String(
        scanType || ""
      )
        .trim()
        .toLowerCase();


    if (
      type.includes(
        "link"
      ) ||
      type.includes(
        "website"
      )
    ) {

      return "link";
    }


    if (
      type.includes(
        "screenshot"
      ) ||
      type.includes(
        "image"
      )
    ) {

      return "screenshot";
    }


    return "message";
  }


  function getScanIcon(
    scanType
  ) {

    const type =
      getScanTypeCategory(
        scanType
      );


    if (
      type === "link"
    ) {

      return "🔗";
    }


    if (
      type ===
      "screenshot"
    ) {

      return "🖼️";
    }


    return "💬";
  }


  /* =======================================================
     RISK HELPERS
  ======================================================= */

  function getRiskData(
    score
  ) {

    const numericScore =
      Math.max(
        0,
        Math.min(
          Number(score) || 0,
          100
        )
      );


    if (
      numericScore >= 60
    ) {

      return {

        label:
          "High Risk",

        category:
          "high",

        className:
          "history-risk-high"

      };
    }


    if (
      numericScore >= 25
    ) {

      return {

        label:
          "Suspicious",

        category:
          "suspicious",

        className:
          "history-risk-suspicious"

      };
    }


    return {

      label:
        "Low Risk",

      category:
        "safe",

      className:
        "history-risk-safe"

    };
  }


  /* =======================================================
     SEARCH
  ======================================================= */

  function matchesSearch(
    scan,
    searchTerm
  ) {

    if (!searchTerm) {
      return true;
    }


    const searchable =
      [
        scan.title,
        scan.riskLevel,
        scan.originalContent,
        scan.advice,
        scan.scanType,
        ...scan.reasons
      ]
        .join(" ")
        .toLowerCase();


    return searchable.includes(
      searchTerm
    );
  }


  /* =======================================================
     FILTER
  ======================================================= */

  function matchesFilter(
    scan,
    filterValue
  ) {

    const filter =
      String(
        filterValue ||
        "all"
      )
        .trim()
        .toLowerCase();


    if (
      filter === "all"
    ) {

      return true;
    }


    const risk =
      getRiskData(
        scan.score
      );


    if (
      filter === "high"
    ) {

      return (
        risk.category ===
        "high"
      );
    }


    if (
      filter ===
      "suspicious"
    ) {

      return (
        risk.category ===
        "suspicious"
      );
    }


    if (
      filter === "safe"
    ) {

      return (
        risk.category ===
        "safe"
      );
    }


    if (
      [
        "message",
        "link",
        "screenshot"
      ].includes(
        filter
      )
    ) {

      return (
        getScanTypeCategory(
          scan.scanType
        ) ===
        filter
      );
    }


    return true;
  }


  /* =======================================================
     FILTERED HISTORY
  ======================================================= */

  function getFilteredScans() {

    const searchTerm =
      String(
        historySearchInput?.value ||
        ""
      )
        .trim()
        .toLowerCase();


    const filterValue =
      historyFilter?.value ||
      "all";


    return backendScans
      .filter(
        (scan) =>
          matchesSearch(
            scan,
            searchTerm
          )
      )
      .filter(
        (scan) =>
          matchesFilter(
            scan,
            filterValue
          )
      );
  }


  /* =======================================================
     RESULT COUNT
  ======================================================= */

  function updateResultCount(
    visible,
    total
  ) {

    if (
      !historyResultCount
    ) {

      return;
    }


    if (
      visible === total
    ) {

      historyResultCount.textContent =
        `${total} scan${
          total === 1
            ? ""
            : "s"
        }`;


      return;
    }


    historyResultCount.textContent =
      `${visible} of ${total} scans`;
  }


  /* =======================================================
     CLEAR BUTTON
  ======================================================= */

  function updateClearButton() {

    if (
      !clearHistoryButton
    ) {

      return;
    }


    const disabled =
      backendScans.length ===
      0;


    clearHistoryButton.disabled =
      disabled;


    clearHistoryButton.setAttribute(
      "aria-disabled",
      disabled
        ? "true"
        : "false"
    );
  }


  /* =======================================================
     EMPTY STATE
  ======================================================= */

  function updateEmptyState(
    visibleCount
  ) {

    if (
      !historyEmptyState
    ) {

      return;
    }


    const heading =
      historyEmptyState.querySelector(
        "h3"
      );


    const paragraph =
      historyEmptyState.querySelector(
        "p"
      );


    if (
      visibleCount > 0
    ) {

      historyEmptyState.classList.add(
        "hidden"
      );


      return;
    }


    historyEmptyState.classList.remove(
      "hidden"
    );


    if (
      backendScans.length ===
      0
    ) {

      if (heading) {

        heading.textContent =
          "No scan history yet";
      }


      if (paragraph) {

        paragraph.textContent =
          "Your completed TrustLens analyses will appear here.";
      }


      return;
    }


    if (heading) {

      heading.textContent =
        "No matching scans found";
    }


    if (paragraph) {

      paragraph.textContent =
        "Try changing your search text or selecting a different filter.";
    }
  }


  /* =======================================================
     CREATE HISTORY CARD
  ======================================================= */

  function createHistoryCard(
    scan
  ) {

    const risk =
      getRiskData(
        scan.score
      );


    return `
      <article
        class="history-item"
        data-scan-id="${escapeHTML(
          scan.id
        )}"
      >

        <div
          class="history-item-icon"
          aria-hidden="true"
        >
          ${getScanIcon(
            scan.scanType
          )}
        </div>


        <div class="history-item-content">

          <div class="history-item-top">

            <div>

              <span class="history-item-type">
                ${escapeHTML(
                  scan.scanType
                )}
              </span>


              <h3>
                ${escapeHTML(
                  scan.title ||
                  risk.label
                )}
              </h3>

            </div>


            <div class="history-item-score">

              <strong>
                ${scan.score}%
              </strong>


              <span
                class="${risk.className}"
              >
                ${escapeHTML(
                  scan.riskLevel ||
                  risk.label
                )}
              </span>

            </div>

          </div>


          <p class="history-item-preview">
            ${escapeHTML(
              shortenText(
                scan.originalContent ||
                "Content not available",
                170
              )
            )}
          </p>


          <div class="history-item-bottom">

            <span class="history-item-date">

              <span aria-hidden="true">
                🕒
              </span>

              ${escapeHTML(
                formatScanDate(
                  scan.createdAt
                )
              )}

            </span>


            <div class="history-item-actions">

              <button
                type="button"
                class="history-view-button"
                data-history-action="view"
                data-scan-id="${escapeHTML(
                  scan.id
                )}"
              >
                View Details
              </button>


              <button
                type="button"
                class="history-delete-button"
                data-history-action="delete"
                data-scan-id="${escapeHTML(
                  scan.id
                )}"
              >
                Delete
              </button>

            </div>

          </div>

        </div>

      </article>
    `;
  }


  /* =======================================================
     DISPLAY HISTORY
  ======================================================= */

  function displayHistory() {

    if (!historyList) {
      return;
    }


    const filteredScans =
      getFilteredScans();


    updateResultCount(
      filteredScans.length,
      backendScans.length
    );


    updateClearButton();


    updateEmptyState(
      filteredScans.length
    );


    if (
      filteredScans.length ===
      0
    ) {

      historyList.innerHTML =
        "";

      return;
    }


    historyList.innerHTML =
      filteredScans
        .map(
          createHistoryCard
        )
        .join("");
  }


  /* =======================================================
     MODAL BODY LOCK
  ======================================================= */

  function updateModalBodyLock() {

    const detailsOpen =
      historyDetailsModal
        ?.classList
        .contains(
          "active"
        );


    const confirmOpen =
      historyConfirmModal
        ?.classList
        .contains(
          "active"
        );


    document.body.classList.toggle(
      "modal-open",
      Boolean(
        detailsOpen ||
        confirmOpen
      )
    );
  }


  /* =======================================================
     DETAILS MODAL
  ======================================================= */

  function openDetailsModal(
    scanId
  ) {

    const scan =
      backendScans.find(
        (item) =>
          String(
            item.id
          ) ===
          String(
            scanId
          )
      );


    if (
      !scan ||
      !historyDetailsModal ||
      !historyModalContent
    ) {

      return;
    }


    selectedScanId =
      String(
        scanId
      );


    const risk =
      getRiskData(
        scan.score
      );


    const reasons =
      scan.reasons.length
        ? scan.reasons
        : [
            "No major warning signals were detected."
          ];


    const reasonsHTML =
      reasons
        .map(
          (reason) => `
            <li>
              ${escapeHTML(
                reason
              )}
            </li>
          `
        )
        .join("");


    historyModalContent.innerHTML = `

      <div class="history-modal-result">

        <div>

          <span>
            ${getScanIcon(
              scan.scanType
            )}

            ${escapeHTML(
              scan.scanType
            )}
          </span>


          <h3>
            ${escapeHTML(
              scan.title ||
              risk.label
            )}
          </h3>


          <p>
            ${escapeHTML(
              formatFullScanDate(
                scan.createdAt
              )
            )}
          </p>

        </div>


        <div class="history-modal-score">
          ${scan.score}%
        </div>

      </div>


      <div class="risk-track">

        <div
          class="progress-fill"
          style="width: ${scan.score}%"
        ></div>

      </div>


      <div class="history-modal-summary">

        <div>

          <span>
            Scan Type
          </span>

          <strong>
            ${escapeHTML(
              scan.scanType
            )}
          </strong>

        </div>


        <div>

          <span>
            Risk Level
          </span>

          <strong>
            ${escapeHTML(
              scan.riskLevel ||
              risk.label
            )}
          </strong>

        </div>


        <div>

          <span>
            Signals Found
          </span>

          <strong>
            ${reasons.length}
          </strong>

        </div>

      </div>


      <section class="history-modal-section">

        <h3>
          Analyzed Content
        </h3>


        <div class="history-original-content">
          ${escapeHTML(
            scan.originalContent ||
            "Content not available"
          )}
        </div>

      </section>


      <section class="history-modal-section">

        <h3>
          Detected Signals
        </h3>


        <ul>
          ${reasonsHTML}
        </ul>

      </section>


      <section
        class="history-modal-section history-modal-advice"
      >

        <h3>
          Safety Advice
        </h3>


        <p>
          ${escapeHTML(
            scan.advice ||
            "Verify the sender or website independently before taking action."
          )}
        </p>

      </section>


      <div class="history-modal-actions">

        <button
          type="button"
          class="danger-button"
          data-modal-action="delete"
          data-scan-id="${escapeHTML(
            scan.id
          )}"
        >
          Delete This Scan
        </button>

      </div>
    `;


    historyDetailsModal.classList.add(
      "active"
    );


    historyDetailsModal.setAttribute(
      "aria-hidden",
      "false"
    );


    updateModalBodyLock();


    window.setTimeout(
      () => {

        closeHistoryModalButton
          ?.focus();

      },
      50
    );
  }


  function closeDetailsModal() {

    if (
      !historyDetailsModal
    ) {

      return;
    }


    historyDetailsModal.classList.remove(
      "active"
    );


    historyDetailsModal.setAttribute(
      "aria-hidden",
      "true"
    );


    selectedScanId =
      "";


    updateModalBodyLock();
  }


  /* =======================================================
     DELETE ONE SCAN FROM MONGODB
  ======================================================= */

  async function deleteScan(
    scanId
  ) {

    if (
      !scanId ||
      deletingScan
    ) {

      return;
    }


    const exists =
      backendScans.some(
        (scan) =>
          String(
            scan.id
          ) ===
          String(
            scanId
          )
      );


    if (!exists) {

      window.alert(
        "This scan could not be found."
      );

      return;
    }


    const confirmed =
      window.confirm(
        "Delete this scan from your TrustLens history?"
      );


    if (!confirmed) {
      return;
    }


    deletingScan =
      true;


    try {

      const data =
        await authenticatedRequest(
          `${API_ENDPOINTS.scans}/${encodeURIComponent(
            scanId
          )}`,
          {
            method:
              "DELETE"
          }
        );


      if (!data.success) {

        throw new Error(
          data.message ||
          "Unable to delete scan."
        );
      }


      backendScans =
        backendScans.filter(
          (scan) =>
            String(
              scan.id
            ) !==
            String(
              scanId
            )
        );


      if (
        selectedScanId ===
        String(
          scanId
        )
      ) {

        closeDetailsModal();
      }


      displayHistory();


      console.log(
        "MongoDB scan deleted:",
        scanId
      );


    } catch (error) {

      console.error(
        "Delete scan failed:",
        error
      );


      window.alert(
        error.message ||
        "TrustLens could not delete this scan."
      );


    } finally {

      deletingScan =
        false;
    }
  }


  /* =======================================================
     CLEAR HISTORY MODAL
  ======================================================= */

  function openClearHistoryModal() {

    if (
      backendScans.length ===
      0
    ) {

      return;
    }


    if (
      !historyConfirmModal
    ) {

      clearCurrentUserHistory();

      return;
    }


    historyConfirmModal.classList.add(
      "active"
    );


    historyConfirmModal.setAttribute(
      "aria-hidden",
      "false"
    );


    updateModalBodyLock();


    window.setTimeout(
      () => {

        cancelClearHistoryButton
          ?.focus();

      },
      50
    );
  }


  function closeClearHistoryModal() {

    if (
      !historyConfirmModal
    ) {

      return;
    }


    historyConfirmModal.classList.remove(
      "active"
    );


    historyConfirmModal.setAttribute(
      "aria-hidden",
      "true"
    );


    updateModalBodyLock();
  }


  /* =======================================================
     CLEAR CURRENT USER HISTORY FROM MONGODB
  ======================================================= */

  async function clearCurrentUserHistory() {

    if (
      clearingHistory ||
      backendScans.length ===
        0
    ) {

      return;
    }


    clearingHistory =
      true;


    if (
      confirmClearHistoryButton
    ) {

      confirmClearHistoryButton.disabled =
        true;

      confirmClearHistoryButton.textContent =
        "Clearing...";
    }


    try {

      const data =
        await authenticatedRequest(
          API_ENDPOINTS.scans,
          {
            method:
              "DELETE"
          }
        );


      if (!data.success) {

        throw new Error(
          data.message ||
          "Unable to clear scan history."
        );
      }


      backendScans =
        [];


      closeClearHistoryModal();

      closeDetailsModal();

      displayHistory();


      console.log(
        `MongoDB history cleared. Deleted ${data.deleted_count ?? 0} scans.`
      );


    } catch (error) {

      console.error(
        "Clear scan history failed:",
        error
      );


      window.alert(
        error.message ||
        "TrustLens could not clear your scan history."
      );


    } finally {

      clearingHistory =
        false;


      if (
        confirmClearHistoryButton
      ) {

        confirmClearHistoryButton.disabled =
          false;

        confirmClearHistoryButton.textContent =
          "Clear History";
      }
    }
  }


  /* =======================================================
     HISTORY CLICK
  ======================================================= */

  function handleHistoryClick(
    event
  ) {

    const button =
      event.target.closest(
        "[data-history-action]"
      );


    if (!button) {
      return;
    }


    const action =
      button.dataset
        .historyAction;


    const scanId =
      button.dataset
        .scanId;


    if (!scanId) {
      return;
    }


    if (
      action === "view"
    ) {

      openDetailsModal(
        scanId
      );

      return;
    }


    if (
      action === "delete"
    ) {

      deleteScan(
        scanId
      );
    }
  }


  /* =======================================================
     MODAL ACTIONS
  ======================================================= */

  function handleModalAction(
    event
  ) {

    const button =
      event.target.closest(
        "[data-modal-action]"
      );


    if (!button) {
      return;
    }


    if (
      button.dataset
        .modalAction ===
      "delete"
    ) {

      deleteScan(
        button.dataset
          .scanId
      );
    }
  }


  /* =======================================================
     DASHBOARD → HISTORY
  ======================================================= */

  function openDashboardSelectedScan() {

    let selectedId =
      "";


    try {

      selectedId =
        sessionStorage.getItem(
          "trustlensSelectedScan"
        ) || "";


      sessionStorage.removeItem(
        "trustlensSelectedScan"
      );

    } catch (error) {

      console.error(
        "Unable to read selected scan:",
        error
      );

      return;
    }


    if (!selectedId) {
      return;
    }


    const exists =
      backendScans.some(
        (scan) =>
          String(
            scan.id
          ) ===
          String(
            selectedId
          )
      );


    if (!exists) {

      console.warn(
        "Selected dashboard scan was not found in MongoDB history."
      );

      return;
    }


    openDetailsModal(
      selectedId
    );
  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function initialiseHistoryEvents() {

    historySearchInput
      ?.addEventListener(
        "input",
        displayHistory
      );


    historyFilter
      ?.addEventListener(
        "change",
        displayHistory
      );


    historyList
      ?.addEventListener(
        "click",
        handleHistoryClick
      );


    clearHistoryButton
      ?.addEventListener(
        "click",
        openClearHistoryModal
      );


    closeHistoryModalButton
      ?.addEventListener(
        "click",
        closeDetailsModal
      );


    historyModalOverlay
      ?.addEventListener(
        "click",
        closeDetailsModal
      );


    historyModalContent
      ?.addEventListener(
        "click",
        handleModalAction
      );


    cancelClearHistoryButton
      ?.addEventListener(
        "click",
        closeClearHistoryModal
      );


    historyConfirmOverlay
      ?.addEventListener(
        "click",
        closeClearHistoryModal
      );


    confirmClearHistoryButton
      ?.addEventListener(
        "click",
        clearCurrentUserHistory
      );


    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key !==
          "Escape"
        ) {

          return;
        }


        if (
          historyConfirmModal
            ?.classList
            .contains(
              "active"
            )
        ) {

          closeClearHistoryModal();

          return;
        }


        if (
          historyDetailsModal
            ?.classList
            .contains(
              "active"
            )
        ) {

          closeDetailsModal();
        }
      }
    );
  }


  /* =======================================================
     INITIALIZATION
  ======================================================= */

  async function initialiseHistoryPage() {

    if (!historyList) {
      return;
    }


    initialiseHistoryEvents();


    try {

      await loadHistoryFromBackend();


      displayHistory();


      openDashboardSelectedScan();


    } catch (error) {

      console.error(
        "TrustLens history startup failed:",
        error
      );


      backendScans =
        [];


      displayHistory();


      window.alert(
        error.message ||
        "TrustLens could not load your scan history."
      );
    }
  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialiseHistoryPage,
      {
        once: true
      }
    );

  } else {

    initialiseHistoryPage();
  }

})();
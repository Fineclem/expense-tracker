// Dashboard app for the expense tracker
(function () {
  const api = (path, opts = {}) => {
    const token = localStorage.getItem("token");
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {}
    );
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch("/api" + path, Object.assign({ headers }, opts)).then(
      async (res) => {
        const body = await res.json().catch(() => ({}));

        // Handle token expiration
        if (!res.ok && res.status === 401 && body.error === "Invalid token") {
          console.log("Token expired, redirecting to login");
          localStorage.removeItem("token");
          window.location.href = "/login";
          return;
        }

        if (!res.ok) throw body;
        return body;
      }
    );
  };

  let currentExpenses = [];
  let currentPeriod = "daily";
  let userBudget = {
    monthly_budget: 0.0,
    weekly_budget: 0.0,
    daily_budget: 0.0,
  };

  // LocalStorage functions
  const storage = {
    getUserKey(key) {
      const token = localStorage.getItem("token");
      if (!token) return key;

      try {
        const tokenData = JSON.parse(atob(token.split(".")[1]));
        const userId = tokenData.id || tokenData.userId || "default";
        return `${key}_${userId}`;
      } catch (err) {
        return `${key}_default`;
      }
    },

    // Save expenses to localStorage
    saveExpenses(expenses) {
      try {
        localStorage.setItem(
          this.getUserKey("expenses"),
          JSON.stringify(expenses)
        );
      } catch (err) {}
    },

    // Load expenses from localStorage
    loadExpenses() {
      try {
        const stored = localStorage.getItem(this.getUserKey("expenses"));
        const expenses = stored ? JSON.parse(stored) : [];

        return expenses;
      } catch (err) {
        return [];
      }
    },

    // Save budget
    saveBudget(budget) {
      try {
        localStorage.setItem(this.getUserKey("budget"), JSON.stringify(budget));
      } catch (err) {}
    },

    // Load budget
    loadBudget() {
      try {
        const stored = localStorage.getItem(this.getUserKey("budget"));
        const budget = stored
          ? JSON.parse(stored)
          : {
              monthly_budget: 1000.0,
              weekly_budget: 250.0,
              daily_budget: 35.0,
            };

        return budget;
      } catch (err) {
        return {
          monthly_budget: 1000.0,
          weekly_budget: 250.0,
          daily_budget: 35.0,
        };
      }
    },

    // Save username to localStorage
    saveUsername(username) {
      try {
        localStorage.setItem(this.getUserKey("username"), username);
      } catch (err) {}
    },

    // Load username from localStorage
    loadUsername() {
      try {
        const stored = localStorage.getItem(this.getUserKey("username"));

        return stored || "User";
      } catch (err) {
        return "User";
      }
    },

    // Save username to localStorage
    saveUsername(username) {
      try {
        localStorage.setItem("username", username);
      } catch (err) {}
    },

    // Load username from localStorage
    loadUsername() {
      try {
        const username = localStorage.getItem("username") || "User";

        return username;
      } catch (err) {
        return "User";
      }
    },

    // Clear user data (for logout)
    clearUserData() {
      try {
        localStorage.removeItem(this.getUserKey("expenses"));
        localStorage.removeItem(this.getUserKey("budget"));
        localStorage.removeItem("username");
      } catch (err) {}
    },
  };

  function updateUserInfo(userName = "") {
    // Handle different possible name formats
    const displayName = userName || storage.loadUsername();

    // Save username to localStorage for future use
    if (userName && userName !== "User") {
      storage.saveUsername(userName);
    }

    // Update sidebar user info
    const userNameSidebar = document.getElementById("user-name-sidebar");
    if (userNameSidebar) {
      userNameSidebar.textContent = `Welcome, ${displayName.toUpperCase()}!`;
    } else {
      console.error("user-name-sidebar element not found");
    }
  }

  function handleLogout(e) {
    e.preventDefault();

    // Show logout confirmation and loading state
    const logoutBtn = e.target.closest("#logout-btn");
    const originalContent = logoutBtn.innerHTML;

    // Update button
    logoutBtn.disabled = true;
    logoutBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    logoutBtn.title = "Logging out...";

    // Show logout toast
    showLogoutToast("Logging out...", "info");

    setTimeout(() => {
      localStorage.removeItem("token");

      showLogoutToast("Logged out successfully!", "success");

      setTimeout(() => {
        window.location.href = "/login";
      }, 800);
    }, 500);
  }

  // Logout toast function
  function showLogoutToast(message, type = "info") {
    const existingToast = document.getElementById("logout-toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.id = "logout-toast";
    toast.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    toast.style.cssText = `
      top: 20px;
      right: 20px;
      z-index: 9999;
      min-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: none;
      animation: slideInRight 0.3s ease-out;
    `;

    const iconMap = {
      info: "bi-info-circle",
      success: "bi-check-circle",
      warning: "bi-exclamation-triangle",
    };

    toast.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="bi ${iconMap[type]} me-2"></i>
        <div class="flex-grow-1">${message}</div>
        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert"></button>
      </div>
    `;

    document.body.appendChild(toast);

    // Auto remove after delay
    if (type === "info") {
      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.animation = "slideOutRight 0.3s ease-in";
          setTimeout(() => {
            if (toast.parentNode) {
              toast.remove();
            }
          }, 300);
        }
      }, 2000);
    }
  }

  // Check authentication and load user info
  function checkAuth() {
    const token = localStorage.getItem("token");

    if (!token) {
      console.log("No token found, redirecting to login");

      window.location.href = "/login";
      return;
    }

    console.log("Checking token validity...");

    const storedUsername = storage.loadUsername();
    if (storedUsername && storedUsername !== "User") {
      updateUserInfo(storedUsername);
      loadDashboardData();
      setCurrentDate();
      displayCurrentDate();
      updateDailyIcon();
      initializeEventListeners();
      return;
    }

    // If no stored username, try to get it from API
    api("/me")
      .then((data) => {
        const userName =
          data.user?.name ||
          data.user?.username ||
          data.user?.displayName ||
          "User";

        // Save username to localStorage
        storage.saveUsername(userName);

        updateUserInfo(userName);
        loadDashboardData();
        setCurrentDate();
        displayCurrentDate();
        updateDailyIcon();
        initializeEventListeners();
      })
      .catch((err) => {
        localStorage.removeItem("token");

        if (err.error === "Invalid token") {
          alert("Your session has expired. Please log in again.");
        }

        window.location.href = "/login";
      });
  }

  // Set current date as default
  function setCurrentDate() {
    const dateInput = document.querySelector('input[name="date"]');
    if (dateInput && !dateInput.value) {
      const today = new Date().toISOString().split("T")[0];
      dateInput.value = today;
    }
  }

  // Display current date in the dashboard header
  function displayCurrentDate() {
    const currentDateElement = document.getElementById("current-date");
    const currentDateMobileElement = document.getElementById(
      "current-date-mobile"
    );

    if (currentDateElement || currentDateMobileElement) {
      const today = new Date();
      const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      };
      const formattedDate = today.toLocaleDateString("en-US", options);

      // Update both desktop and mobile date displays
      if (currentDateElement) {
        currentDateElement.textContent = formattedDate;
      }
      if (currentDateMobileElement) {
        currentDateMobileElement.textContent = formattedDate;
      }
    }
  }

  // Update daily icon
  function updateDailyIcon() {
    const dailyIcon = document.getElementById("daily-icon");
    if (dailyIcon) {
      const today = new Date();
      const dayOfMonth = today.getDate();

      // Replace the calendar icon with the day number
      dailyIcon.innerHTML = dayOfMonth;
      dailyIcon.classList.add("dynamic-day");

      const fullDate = today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      dailyIcon.setAttribute("title", fullDate);
    }
  }

  // Initialize all event listeners
  function initializeEventListeners() {
    document
      .getElementById("expense-form")
      .addEventListener("submit", handleAddExpense);

    document.querySelectorAll(".period-btn").forEach((btn) => {
      btn.addEventListener("click", handlePeriodChange);
    });

    const quickAddBtn = document.getElementById("quick-add-btn");
    if (quickAddBtn) {
      quickAddBtn.addEventListener("click", () => {
        document.querySelector('input[name="amount"]').focus();
      });
    }

    // Initialize sidebar navigation
    initializeSidebarNavigation();
  }

  // Initialize sidebar navigation functionality
  function initializeSidebarNavigation() {
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.querySelector(".main-content");

    if (sidebarToggle && sidebar && mainContent) {
      sidebarToggle.addEventListener("click", () => {
        // Check if mobile view
        if (window.innerWidth <= 768) {
          sidebar.classList.toggle("show");
        } else {
          sidebar.classList.toggle("collapsed");
          mainContent.classList.toggle("expanded");
        }
      });

      // Close sidebar when clicking outside on mobile
      document.addEventListener("click", (e) => {
        if (
          window.innerWidth <= 768 &&
          sidebar.classList.contains("show") &&
          !sidebar.contains(e.target) &&
          !sidebarToggle.contains(e.target)
        ) {
          sidebar.classList.remove("show");
        }
      });

      // Handle window resize
      window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
          sidebar.classList.remove("show");
        }
      });
    }

    // Navigation link functionality
    const navLinks = document.querySelectorAll(".sidebar-nav .nav-link");
    const contentSections = document.querySelectorAll(".content-section");
    const pageTitle = document.getElementById("page-title");

    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetSection = link.getAttribute("data-section");
        navigateToSection(targetSection, true);
      });
    });

    // Quick action buttons that switch sections
    const quickActionBtns = document.querySelectorAll("[data-section]");
    quickActionBtns.forEach((btn) => {
      if (!btn.classList.contains("nav-link")) {
        btn.addEventListener("click", (e) => {
          const targetSection = btn.getAttribute("data-section");
          navigateToSection(targetSection, true);
        });
      }
    });

    // Logout functionality
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }

    // Handle browser back/forward navigation
    window.addEventListener("popstate", (e) => {
      const section = e.state?.section || getCurrentSectionFromUrl();
      navigateToSection(section, false);
    });

    const initialSection = getCurrentSectionFromUrl();
    if (initialSection !== "dashboard") {
      navigateToSection(initialSection, false);
    }
  }

  function getCurrentSectionFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/dashboard\/(.+)/);
    return match ? match[1] : "dashboard";
  }

  // Navigate to a specific section
  function navigateToSection(targetSection, pushHistory = true) {
    const navLinks = document.querySelectorAll(".sidebar-nav .nav-link");
    const contentSections = document.querySelectorAll(".content-section");
    const pageTitle = document.getElementById("page-title");

    // Update active nav link
    navLinks.forEach((l) => l.classList.remove("active"));
    const targetNavLink = document.querySelector(
      `.sidebar-nav .nav-link[data-section="${targetSection}"]`
    );
    if (targetNavLink) {
      targetNavLink.classList.add("active");
    }

    // Show target section
    contentSections.forEach((section) => {
      section.classList.remove("active");
    });

    const targetElement = document.getElementById(`${targetSection}-section`);
    if (targetElement) {
      targetElement.classList.add("active");
    }

    // Update page title
    if (pageTitle) {
      const sectionTitles = {
        dashboard: "Dashboard",
        expenses: "Expenses",
        budget: "Budget",
        reports: "Reports",
        categories: "Categories",
      };
      pageTitle.textContent = sectionTitles[targetSection] || "Dashboard";
    }

    if (pushHistory) {
      const newUrl =
        targetSection === "dashboard"
          ? "/dashboard"
          : `/dashboard/${targetSection}`;
      history.pushState({ section: targetSection }, "", newUrl);
    }

    handleSectionSwitch(targetSection);
  }

  function handleSectionSwitch(section) {
    switch (section) {
      case "dashboard":
        loadDashboardData();
        break;
      case "expenses":
        setTimeout(() => {
          const amountInput = document.querySelector(
            '#expenses-section input[name="amount"]'
          );
          if (amountInput) {
            amountInput.focus();
          }
        }, 100);
        break;
      case "budget":
        loadBudget();
        break;
      case "reports":
        if (document.getElementById("reports-section")) {
          loadReports();
        } else {
          showComingSoonMessage("reports");
        }
        break;
      case "categories":
        loadCategories();
        break;
    }
  }

  // Categories sections
  function showComingSoonMessage(sectionName) {
    const sectionElement = document.getElementById(`${sectionName}-section`);
    if (sectionElement && !sectionElement.querySelector(".coming-soon")) {
      sectionElement.innerHTML = `
        <div class="coming-soon text-center py-5">
          <i class="bi bi-tools fs-1 text-muted mb-3 d-block"></i>
          <h4 class="text-muted">Coming Soon</h4>
          <p class="text-muted">The ${
            sectionName.charAt(0).toUpperCase() + sectionName.slice(1)
          } section is under development.</p>
          <button class="btn btn-primary" onclick="document.querySelector('.sidebar-nav .nav-link[data-section=\\"dashboard\\"]').click()">
            <i class="bi bi-arrow-left me-2"></i>Back to Dashboard
          </button>
        </div>
      `;
    }
  }

  // Handle adding new expense
  function handleAddExpense(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      amount: parseFloat(fd.get("amount")),
      category: fd.get("category"),
      note: fd.get("note"),
      date: fd.get("date") || new Date().toISOString().split("T")[0],
    };

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Adding...';

    try {
      // Create expense object
      const expense = {
        id: Date.now(),
        amount: payload.amount,
        category: payload.category || "Other",
        note: payload.note || "",
        date: payload.date,
        created_at: new Date().toISOString(),
      };

      // Add to current expenses
      currentExpenses.unshift(expense);

      // Save to localStorage
      storage.saveExpenses(currentExpenses);

      // Update UI
      e.target.reset();
      setCurrentDate();
      loadDashboardData();
      showSuccessToast("Expense added successfully!");
    } catch (err) {
      showErrorToast("Failed to add expense");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  // Handle period change
  function handlePeriodChange(e) {
    // Update active button
    document
      .querySelectorAll(".period-btn")
      .forEach((btn) => btn.classList.remove("active"));
    e.target.classList.add("active");

    currentPeriod = e.target.getAttribute("data-period");
    loadReports();
  }

  // Load all dashboard data
  function loadDashboardData() {
    showLoadingState();
    Promise.all([loadExpenses(), loadReports(), loadBudget()])
      .then(() => {
        loadStats(); // Load stats after expenses are loaded
        updateBudgetProgress(); // Update budget progress bars
        hideLoadingState();
      })
      .catch((err) => {
        console.error("Error loading dashboard data:", err);
        hideLoadingState();
        // Don't throw the error to prevent it from bubbling up to delete function
      });
  }

  // Show loading state
  function showLoadingState() {
    document.getElementById("loading-expenses").style.display = "block";
  }

  // Hide loading state
  function hideLoadingState() {
    document.getElementById("loading-expenses").style.display = "none";
  }

  // Load expenses
  function loadExpenses() {
    return new Promise((resolve) => {
      try {
        // Load from localStorage
        currentExpenses = storage.loadExpenses();

        const container = document.getElementById("expense-list");
        const countBadge = document.getElementById("expense-count");

        countBadge.textContent = `${currentExpenses.length} expenses`;

        if (currentExpenses.length === 0) {
          container.innerHTML = `
            <div class="text-center text-muted py-4">
              <i class="bi bi-receipt fs-1 mb-3 d-block"></i>
              <p>No expenses recorded yet</p>
              <small>Add your first expense to get started!</small>
            </div>
          `;
          resolve();
          return;
        }

        container.innerHTML = "";
        currentExpenses.forEach((expense, index) => {
          const expenseElement = createExpenseElement(expense, index);
          container.appendChild(expenseElement);
        });

        // Also update Recent Activity on dashboard
        updateRecentActivity(currentExpenses.slice(0, 5)); // Show last 5 expenses
        resolve();
      } catch (err) {
        const container = document.getElementById("expense-list");
        container.innerHTML = `
          <div class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle fs-1 mb-3 d-block"></i>
            <p>Error loading expenses</p>
          </div>
        `;
        resolve();
      }
    });
  }

  function createExpenseElement(expense, index) {
    const div = document.createElement("div");
    div.className = "expense-item fade-in";
    div.style.animationDelay = `${index * 0.1}s`;

    const categoryClass = `category-${expense.category.toLowerCase()}`;
    const categoryIcon = getCategoryIcon(expense.category);

    div.setAttribute("data-expense-id", expense.id);

    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div class="d-flex align-items-center flex-grow-1">
          <div class="me-3">
            <i class="bi ${categoryIcon} fs-4 text-primary"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex align-items-center mb-1">
              <span class="fw-bold me-2">${expense.category}</span>
              <span class="category-badge ${categoryClass}">${
      expense.category
    }</span>
            </div>
            <div class="text-muted small mb-1">${
              expense.note || "No note"
            }</div>
            <div class="text-muted small">
              <i class="bi bi-calendar3 me-1"></i>${formatDate(expense.date)}
            </div>
          </div>
        </div>
        <div class="text-end d-flex align-items-center">
          <div class="me-3">
            <div class="fw-bold fs-5 text-primary">₦${parseFloat(
              expense.amount
            ).toFixed(2)}</div>
            <div class="text-muted small">${
              expense.created_at ? formatTime(expense.created_at) : ""
            }</div>
          </div>
          <div class="dropup">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
              <i class="bi bi-three-dots-vertical"></i>
            </button>
            <ul class="dropdown-menu">
              <li><a class="dropdown-item" href="#" onclick="editExpense(${
                expense.id
              })">
                <i class="bi bi-pencil me-2"></i>Edit
              </a></li>
              <li><a class="dropdown-item text-danger" href="#" onclick="deleteExpense(${
                expense.id
              })">
                <i class="bi bi-trash me-2"></i>Delete
              </a></li>
            </ul>
          </div>
        </div>
      </div>
    `;

    return div;
  }

  // Update Recent Activity section on dashboard
  function updateRecentActivity(recentExpenses) {
    const container = document.getElementById("recent-activity");
    if (!container) return;

    if (recentExpenses.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-receipt fs-1 mb-3 d-block"></i>
          <p>No recent activity</p>
          <small>Add your first expense to get started!</small>
        </div>
      `;
      return;
    }

    let html = '<div class="recent-activity-list">';
    recentExpenses.forEach((expense, index) => {
      const categoryIcon = getCategoryIcon(expense.category);
      const timeAgo = getTimeAgo(expense.created_at || expense.date);

      html += `
        <div class="recent-activity-item d-flex align-items-center py-2 ${
          index < recentExpenses.length - 1 ? "border-bottom" : ""
        }">
          <div class="me-3">
            <i class="bi ${categoryIcon} text-primary fs-5"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <span class="fw-semibold">${expense.category}</span>
                <div class="text-muted small">${expense.note || "No note"}</div>
              </div>
              <div class="text-end">
                <div class="fw-bold text-primary">₦${parseFloat(
                  expense.amount
                ).toFixed(2)}</div>
                <div class="text-muted small">${timeAgo}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += `
      <div class="text-center mt-3">
        <button class="btn btn-outline-primary mb-2 btn-sm" onclick="navigateToSection('expenses', true)">
          <i class="bi bi-arrow-right me-1"></i>View All Expenses
        </button>
      </div>
    </div>`;

    container.innerHTML = html;
  }

  // Get time ago string
  function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  }

  // Get category icon
  function getCategoryIcon(category) {
    const icons = {
      Food: "bi-cup-hot",
      Transportation: "bi-car-front",
      Entertainment: "bi-film",
      Utilities: "bi-lightning",
      Healthcare: "bi-heart-pulse",
      Shopping: "bi-bag",
      Other: "bi-three-dots",
    };
    return icons[category] || "bi-three-dots";
  }

  // Format date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year:
          date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  }

  // Format time
  function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // Load reports with enhanced visualization
  function loadReports() {
    return new Promise((resolve) => {
      try {
        // Generate reports from localStorage data
        const expenses = storage.loadExpenses();
        const rows = generateReportsFromExpenses(expenses, currentPeriod);

        // Store data for PDF generation
        window.currentReportData = rows || [];
        const output = document.getElementById("report-output");

        if (!rows || rows.length === 0) {
          output.innerHTML = `
            <div class="text-center text-muted py-4">
              <i class="bi bi-graph-up fs-1 mb-3 d-block"></i>
              <p>No data available for ${currentPeriod} view</p>
            </div>
          `;
          resolve();
          return;
        }

        // Create enhanced report visualization
        let html = '<div class="report-data">';

        rows.slice(0, 10).forEach((row, index) => {
          const periodLabel = row.period || "";
          const amount = parseFloat(row.total || 0);
          const maxAmount = Math.max(
            ...rows.map((r) => parseFloat(r.total || 0))
          );
          const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

          html += `
            <div class="report-item mb-3 fade-in" style="animation-delay: ${
              index * 0.1
            }s">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-semibold">${periodLabel}</span>
                <span class="fw-bold text-primary">₦${amount.toFixed(2)}</span>
              </div>
              <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-gradient" style="width: ${percentage}%; background: var(--primary-gradient);"></div>
              </div>
            </div>
          `;
        });

        html += "</div>";
        output.innerHTML = html;
        resolve();
      } catch (err) {
        document.getElementById("report-output").innerHTML = `
          <div class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle fs-1 mb-3 d-block"></i>
            <p>Error loading reports</p>
          </div>
        `;
        resolve();
      }
    });
  }

  // Generate reports from expenses data
  function generateReportsFromExpenses(expenses, period) {
    if (!expenses || expenses.length === 0) return [];

    const reports = {};

    expenses.forEach((expense) => {
      const date = new Date(expense.date);
      let periodKey;

      switch (period) {
        case "weekly":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split("T")[0];
          break;
        case "monthly":
          periodKey = date.toISOString().slice(0, 7); // YYYY-MM
          break;
        default: // daily
          periodKey = expense.date.split("T")[0];
      }

      if (!reports[periodKey]) {
        reports[periodKey] = {
          period: periodKey,
          total: 0,
        };
      }

      reports[periodKey].total += parseFloat(expense.amount || 0);
    });

    return Object.values(reports)
      .sort((a, b) => new Date(b.period) - new Date(a.period))
      .slice(0, 10);
  }

  // Load and update stats cards
  function loadStats() {
    if (currentExpenses.length === 0) {
      updateStatsCards({
        totalSpent: 0,
        todaySpent: 0,
        todayCount: 0,
        avgDaily: 0,
        topCategory: "None",
        topCategoryAmount: 0,
      });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    // Calculate total spent this month
    const monthlyExpenses = currentExpenses.filter((e) => {
      const expenseDate = e.date.split("T")[0];
      return expenseDate.startsWith(thisMonth);
    });
    const totalSpent = monthlyExpenses.reduce(
      (sum, e) => sum + parseFloat(e.amount || 0),
      0
    );

    // Calculate today's expenses
    const todayExpenses = currentExpenses.filter((e) => {
      const expenseDate = e.date.split("T")[0];
      return expenseDate === today;
    });
    const todaySpent = todayExpenses.reduce(
      (sum, e) => sum + parseFloat(e.amount || 0),
      0
    );

    // Calculate daily average for last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push(date.toISOString().split("T")[0]);
    }

    const last7DaysExpenses = currentExpenses.filter((e) => {
      const expenseDate = e.date.split("T")[0];
      return last7Days.includes(expenseDate);
    });
    const avgDaily =
      last7DaysExpenses.length > 0
        ? last7DaysExpenses.reduce(
            (sum, e) => sum + parseFloat(e.amount || 0),
            0
          ) / 7
        : 0;

    // Find top category this month
    const categoryTotals = {};
    monthlyExpenses.forEach((e) => {
      const category = e.category || "Other";
      categoryTotals[category] =
        (categoryTotals[category] || 0) + parseFloat(e.amount || 0);
    });

    const topCategory =
      Object.keys(categoryTotals).length > 0
        ? Object.keys(categoryTotals).reduce((a, b) =>
            categoryTotals[a] > categoryTotals[b] ? a : b
          )
        : "None";

    const topCategoryAmount = categoryTotals[topCategory] || 0;

    updateStatsCards({
      totalSpent,
      todaySpent,
      todayCount: todayExpenses.length,
      avgDaily,
      topCategory,
      topCategoryAmount,
    });
  }

  // Update stats cards with animation
  function updateStatsCards(stats) {
    animateValue("total-spent", stats.totalSpent, "₦");
    animateValue("today-spent", stats.todaySpent, "₦");
    animateValue("avg-daily", stats.avgDaily, "₦");

    document.getElementById(
      "today-count"
    ).textContent = `${stats.todayCount} transactions`;
    document.getElementById("top-category").textContent = stats.topCategory;
    document.getElementById(
      "top-category-amount"
    ).textContent = `₦${stats.topCategoryAmount.toFixed(2)}`;
  }

  // Animate number values
  function animateValue(elementId, endValue, prefix = "") {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = 0;
    const duration = 1000;
    const startTime = performance.now();

    function updateValue(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = startValue + (endValue - startValue) * progress;

      element.textContent = `${prefix}${currentValue.toFixed(2)}`;

      if (progress < 1) {
        requestAnimationFrame(updateValue);
      }
    }

    requestAnimationFrame(updateValue);
  }

  // Show success toast
  function showSuccessToast(message) {
    showToast(message, "success");
  }

  // Show error toast
  function showErrorToast(message) {
    showToast(message, "danger");
  }

  // Create toast container
  function getToastContainer() {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  // Generic toast function with proper stacking
  function showToast(message, type = "info") {
    const container = getToastContainer();

    const toast = document.createElement("div");
    toast.className = `alert alert-${type} alert-dismissible fade show`;
    toast.style.cssText = `
      min-width: 300px;
      max-width: 400px;
      pointer-events: auto;
      margin: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: none;
      animation: slideInRight 0.3s ease-out;
    `;

    toast.innerHTML = `
      <div class="d-flex align-items-start">
        <div class="flex-grow-1">${message}</div>
        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert"></button>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = "slideOutRight 0.3s ease-in";
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();

            if (container.children.length === 0) {
              container.remove();
            }
          }
        }, 300);
      }
    }, 4000);

    const closeBtn = toast.querySelector(".btn-close");
    closeBtn.addEventListener("click", () => {
      toast.style.animation = "slideOutRight 0.3s ease-in";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();

          if (container.children.length === 0) {
            container.remove();
          }
        }
      }, 300);
    });
  }

  // Edit expense function
  window.editExpense = function (expenseId) {
    const expense = currentExpenses.find((e) => e.id === expenseId);
    if (!expense) {
      showErrorToast("Expense not found");
      return;
    }

    const form = document.getElementById("edit-expense-form");
    form.querySelector('input[name="amount"]').value = expense.amount;
    form.querySelector('select[name="category"]').value = expense.category;
    form.querySelector('input[name="date"]').value = expense.date;
    form.querySelector('input[name="note"]').value = expense.note || "";

    // Store the expense ID for saving
    document
      .getElementById("save-expense-edit")
      .setAttribute("data-expense-id", expenseId);

    const modal = new bootstrap.Modal(
      document.getElementById("editExpenseModal")
    );
    modal.show();
  };

  function saveExpenseEdit() {
    const saveBtn = document.getElementById("save-expense-edit");
    const expenseId = saveBtn.getAttribute("data-expense-id");

    if (!expenseId) {
      showErrorToast("Expense ID not found");
      return;
    }

    const form = document.getElementById("edit-expense-form");
    const fd = new FormData(form);
    const payload = {
      amount: fd.get("amount"),
      category: fd.get("category"),
      note: fd.get("note"),
      date: fd.get("date"),
    };

    // Show loading state
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Saving...';

    try {
      // Find and update the expense in currentExpenses array
      const expenseIndex = currentExpenses.findIndex((e) => e.id == expenseId);
      if (expenseIndex > -1) {
        // Update the expense with new data
        currentExpenses[expenseIndex] = {
          ...currentExpenses[expenseIndex],
          amount: parseFloat(payload.amount),
          category: payload.category,
          note: payload.note,
          date: payload.date,
          updated_at: new Date().toISOString(),
        };

        // Save updated expenses to localStorage
        storage.saveExpenses(currentExpenses);

        const modal = bootstrap.Modal.getInstance(
          document.getElementById("editExpenseModal")
        );
        modal.hide();
        loadDashboardData();
        showSuccessToast("Expense updated successfully!");
      } else {
        showErrorToast("Expense not found");
      }
    } catch (err) {
      console.error("Error updating expense:", err);
      showErrorToast("Failed to update expense");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  }

  // Delete expense function
  window.deleteExpense = function (expenseId) {
    const expense = currentExpenses.find((e) => e.id === expenseId);
    if (!expense) {
      showErrorToast("Expense not found");
      return;
    }

    // Create confirmation modal
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "deleteExpenseModal";
    modal.style.zIndex = "9999";
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title text-danger">Delete Expense</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3 d-block"></i>
            <p>Are you sure you want to delete this expense?</p>
            <div class="bg-light p-3 rounded mb-3">
              <strong>${expense.category}</strong><br>
              <span class="text-primary fs-5">$${parseFloat(
                expense.amount
              ).toFixed(2)}</span><br>
              <small class="text-muted">${expense.note || "No note"}</small>
            </div>
            <p class="text-muted small">This action cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" onclick="confirmDeleteExpense(${expenseId})">
              <i class="bi bi-trash me-2"></i>Delete
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();

    // Clean up modal when hidden
    modal.addEventListener("hidden.bs.modal", () => {
      modal.remove();
    });
  };

  // Confirm delete expense
  window.confirmDeleteExpense = function (expenseId) {
    // Show loading state
    const deleteBtn = document.querySelector("#deleteExpenseModal .btn-danger");
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML =
      '<i class="bi bi-hourglass-split me-2"></i>Deleting...';

    try {
      console.log("Attempting to delete expense with ID:", expenseId);

      // Remove from currentExpenses array
      const expenseIndex = currentExpenses.findIndex((e) => e.id == expenseId);
      console.log("Found expense at index:", expenseIndex);

      if (expenseIndex > -1) {
        currentExpenses.splice(expenseIndex, 1);
        console.log(
          "Expense removed from array. Remaining expenses:",
          currentExpenses.length
        );

        // Save updated expenses to localStorage
        storage.saveExpenses(currentExpenses);
        console.log("Expenses saved to localStorage");

        // Close modal properly first
        console.log("Closing modal...");

        const modalElement = document.getElementById("deleteExpenseModal");
        if (modalElement) {
          try {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
              console.log("Using Bootstrap modal instance to hide");
              modal.hide();
            } else {
              console.log("No Bootstrap instance found, removing manually");
              // Manual cleanup
              const backdrop = document.querySelector(".modal-backdrop");
              if (backdrop) backdrop.remove();
              modalElement.remove();
              document.body.classList.remove("modal-open");
              document.body.style.overflow = "";
              document.body.style.paddingRight = "";
            }
          } catch (err) {
            console.log("Error with Bootstrap modal, removing manually:", err);
            // Fallback: manual cleanup
            const backdrop = document.querySelector(".modal-backdrop");
            if (backdrop) backdrop.remove();
            modalElement.remove();
            document.body.classList.remove("modal-open");
            document.body.style.overflow = "";
            document.body.style.paddingRight = "";
          }
        } else {
          console.log("Modal element not found");
        }

        // Restore button state after modal is handled
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;

        console.log("Loading dashboard data...");
        loadDashboardData();
        showSuccessToast("Expense deleted successfully!");
        console.log("Delete operation completed successfully");
      } else {
        console.log("Expense not found in array");
        // Restore button state before showing error
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;
        showErrorToast("Expense not found");
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
      console.error("Error stack:", err.stack);
      // Restore button state before showing error
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;
      }
      showErrorToast("Failed to delete expense: " + err.message);
    }
  };

  // Load user budget
  function loadBudget() {
    return new Promise((resolve) => {
      try {
        userBudget = storage.loadBudget();
        updateBudgetDisplay();
        resolve();
      } catch (err) {
        userBudget = {
          monthly_budget: 1000.0,
          weekly_budget: 250.0,
          daily_budget: 35.0,
        };
        updateBudgetDisplay();
        resolve();
      }
    });
  }

  // Update budget display
  function updateBudgetDisplay() {
    document.getElementById(
      "daily-budget"
    ).textContent = `₦${userBudget.daily_budget.toFixed(2)}`;
    document.getElementById(
      "weekly-budget"
    ).textContent = `₦${userBudget.weekly_budget.toFixed(2)}`;
    document.getElementById(
      "monthly-budget"
    ).textContent = `₦${userBudget.monthly_budget.toFixed(2)}`;

    // Monthly Remaining will be calculated

    // Also update the form inputs
    const monthlyInput = document.querySelector('input[name="monthly_budget"]');
    const weeklyInput = document.querySelector('input[name="weekly_budget"]');
    const dailyInput = document.querySelector('input[name="daily_budget"]');

    if (monthlyInput) monthlyInput.value = userBudget.monthly_budget.toFixed(2);
    if (weeklyInput) weeklyInput.value = userBudget.weekly_budget.toFixed(2);
    if (dailyInput) dailyInput.value = userBudget.daily_budget.toFixed(2);
  }

  // Update budget progress bars
  function updateBudgetProgress() {
    if (currentExpenses.length === 0) {
      const remainingElement = document.getElementById("budget-remaining");
      if (remainingElement) {
        remainingElement.className = "fw-bold text-success";
        remainingElement.innerHTML = `<i class="bi bi-check-circle me-1"></i>₦${userBudget.monthly_budget.toFixed(
          2
        )}`;
      }
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    // Calculate current week (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const weekStart = monday.toISOString().split("T")[0];

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekEnd = sunday.toISOString().split("T")[0];

    // Calculate spending
    const todaySpent = currentExpenses
      .filter((e) => e.date.split("T")[0] === today)
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    const weekSpent = currentExpenses
      .filter((e) => {
        const expenseDate = e.date.split("T")[0];
        return expenseDate >= weekStart && expenseDate <= weekEnd;
      })
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    const monthSpent = currentExpenses
      .filter((e) => e.date.split("T")[0].startsWith(thisMonth))
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    // Update progress bars
    updateProgressBar("daily-progress", todaySpent, userBudget.daily_budget);
    updateProgressBar("weekly-progress", weekSpent, userBudget.weekly_budget);
    updateProgressBar(
      "monthly-progress",
      monthSpent,
      userBudget.monthly_budget
    );

    // Update budget remaining with enhanced styling
    const monthlyRemaining = userBudget.monthly_budget - monthSpent;
    const remainingElement = document.getElementById("budget-remaining");
    const monthlyPercentage = (monthSpent / userBudget.monthly_budget) * 100;

    remainingElement.textContent = `₦${Math.abs(monthlyRemaining).toFixed(2)}`;

    if (monthlyRemaining < 0) {
      remainingElement.className = "fw-bold text-danger";
      remainingElement.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>-₦${Math.abs(
        monthlyRemaining
      ).toFixed(2)}`;
    } else if (monthlyPercentage >= 90) {
      remainingElement.className = "fw-bold text-warning";
      remainingElement.innerHTML = `<i class="bi bi-exclamation-circle me-1"></i>₦${monthlyRemaining.toFixed(
        2
      )}`;
    } else if (monthlyPercentage >= 75) {
      remainingElement.className = "fw-bold text-info";
      remainingElement.innerHTML = `<i class="bi bi-info-circle me-1"></i>₦${monthlyRemaining.toFixed(
        2
      )}`;
    } else {
      remainingElement.className = "fw-bold text-success";
      remainingElement.innerHTML = `<i class="bi bi-check-circle me-1"></i>₦${monthlyRemaining.toFixed(
        2
      )}`;
    }
  }

  // Update individual progress bar with enhanced color coding
  function updateProgressBar(elementId, spent, budget) {
    const progressBar = document.getElementById(elementId);
    const actualPercentage = budget > 0 ? (spent / budget) * 100 : 0;
    const displayPercentage = Math.min(actualPercentage, 100);

    progressBar.style.width = `${displayPercentage}%`;

    // Enhanced color coding with smooth transitions
    if (actualPercentage >= 100) {
      progressBar.className =
        "progress-bar bg-danger progress-bar-striped progress-bar-animated";
      progressBar.style.background = "linear-gradient(45deg, #dc3545, #c82333)";
    } else if (actualPercentage >= 90) {
      progressBar.className = "progress-bar";
      progressBar.style.background = "linear-gradient(90deg, #fd7e14, #dc3545)";
    } else if (actualPercentage >= 75) {
      // Approaching limit - warning orange
      progressBar.className = "progress-bar bg-warning";
      progressBar.style.background = "linear-gradient(90deg, #ffc107, #fd7e14)";
    } else if (actualPercentage >= 50) {
      // Moderate usage - info blue
      progressBar.className = "progress-bar bg-info";
      progressBar.style.background = "linear-gradient(90deg, #17a2b8, #138496)";
    } else {
      // Safe zone - success green
      progressBar.className = "progress-bar bg-success";
      progressBar.style.background = "linear-gradient(90deg, #28a745, #20c997)";
    }

    // Add pulsing animation when over budget
    if (actualPercentage >= 100) {
      progressBar.style.animation = "pulse-danger 2s infinite";
    } else {
      progressBar.style.animation = "none";
    }

    // Update the budget text color based on status
    updateBudgetTextColor(elementId, actualPercentage, spent, budget);
  }

  function updateBudgetTextColor(elementId, percentage, spent, budget) {
    const budgetType = elementId.replace("-progress", "");
    const budgetElement = document.getElementById(`${budgetType}-budget`);
    const parentContainer = budgetElement?.closest(".mb-3");

    if (parentContainer) {
      parentContainer.classList.remove(
        "budget-safe",
        "budget-warning",
        "budget-danger",
        "budget-exceeded"
      );

      // Add appropriate status class
      if (percentage >= 100) {
        parentContainer.classList.add("budget-exceeded");
      } else if (percentage >= 90) {
        parentContainer.classList.add("budget-danger");
      } else if (percentage >= 75) {
        parentContainer.classList.add("budget-warning");
      } else {
        parentContainer.classList.add("budget-safe");
      }
    }

    // Show exceeded amount if over budget
    if (percentage >= 100) {
      const exceededAmount = spent - budget;
      const exceededElement =
        parentContainer?.querySelector(".exceeded-amount");

      if (!exceededElement) {
        const exceededDiv = document.createElement("div");
        exceededDiv.className = "exceeded-amount text-danger small mt-1";
        exceededDiv.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>Over by ₦${exceededAmount.toFixed(
          2
        )}`;
        parentContainer?.appendChild(exceededDiv);
      } else {
        exceededElement.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>Over by ₦${exceededAmount.toFixed(
          2
        )}`;
      }
    } else {
      const exceededElement =
        parentContainer?.querySelector(".exceeded-amount");
      if (exceededElement) {
        exceededElement.remove();
      }
    }
  }

  // Open budget modal
  window.openBudgetModal = function () {
    document.querySelector('input[name="monthly_budget"]').value =
      userBudget.monthly_budget;
    document.querySelector('input[name="weekly_budget"]').value =
      userBudget.weekly_budget;
    document.querySelector('input[name="daily_budget"]').value =
      userBudget.daily_budget;

    const modal = new bootstrap.Modal(document.getElementById("budgetModal"));
    modal.show();
  };

  // Save budget settings

  function setupBudgetAutoCalculation() {
    const monthlyInput = document.querySelector('input[name="monthly_budget"]');
    const weeklyInput = document.querySelector('input[name="weekly_budget"]');
    const dailyInput = document.querySelector('input[name="daily_budget"]');

    if (monthlyInput && weeklyInput && dailyInput) {
      monthlyInput.addEventListener("input", function () {
        const monthlyAmount = parseFloat(this.value) || 0;
        if (monthlyAmount > 0) {
          const weeklyAmount = monthlyAmount / 4.33;

          const dailyAmount = monthlyAmount / 30;

          // Update the input fields
          weeklyInput.value = weeklyAmount.toFixed(2);
          dailyInput.value = dailyAmount.toFixed(2);
        } else {
          weeklyInput.value = "";
          dailyInput.value = "";
        }
      });
    }
  }

  window.saveBudgetSettings = function () {
    console.log("saveBudgetSettings called");

    const form = document.getElementById("budget-form");
    if (!form) {
      console.error("Budget form not found");
      showErrorToast("Budget form not found");
      return;
    }

    const fd = new FormData(form);
    const payload = {
      monthly_budget: parseFloat(fd.get("monthly_budget")),
      weekly_budget: parseFloat(fd.get("weekly_budget")),
      daily_budget: parseFloat(fd.get("daily_budget")),
    };

    console.log("Parsed payload:", payload);

    // Validate inputs
    if (
      payload.monthly_budget <= 0 ||
      payload.weekly_budget <= 0 ||
      payload.daily_budget <= 0
    ) {
      console.error("Invalid budget amounts:", payload);
      showErrorToast("All budget amounts must be greater than zero");
      return;
    }

    if (
      isNaN(payload.monthly_budget) ||
      isNaN(payload.weekly_budget) ||
      isNaN(payload.daily_budget)
    ) {
      console.error("NaN values in budget:", payload);
      showErrorToast("Please enter valid budget amounts");
      return;
    }

    // Show loading state
    const saveBtn =
      document.querySelector("#budget-form .btn-primary") ||
      document.querySelector('button[onclick="saveBudgetSettings()"]');

    if (!saveBtn) {
      console.error("Save button not found");
      return;
    }

    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Saving...';

    try {
      // Save to localStorage
      userBudget = {
        id: Date.now(),
        monthly_budget: payload.monthly_budget,
        weekly_budget: payload.weekly_budget,
        daily_budget: payload.daily_budget,
        updated_at: new Date().toISOString(),
      };

      storage.saveBudget(userBudget);

      updateBudgetDisplay();
      updateBudgetProgress();
      showSuccessToast("Budget settings updated successfully!");
    } catch (err) {
      console.error("Error saving budget:", err);
      showErrorToast("Failed to update budget settings");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  };

  // Check for budget alerts
  function checkBudgetAlerts(newExpenseAmount) {
    const today = new Date().toISOString().split("T")[0];
    const todaySpent =
      currentExpenses
        .filter((e) => e.date.split("T")[0] === today)
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) +
      newExpenseAmount;

    if (todaySpent > userBudget.daily_budget) {
      showWarningToast(
        `Daily budget exceeded! Spent: ₦${todaySpent.toFixed(
          2
        )} / Budget: ₦${userBudget.daily_budget.toFixed(2)}`
      );
    } else if (todaySpent > userBudget.daily_budget * 0.8) {
      showWarningToast(
        `Approaching daily budget limit: ₦${todaySpent.toFixed(
          2
        )} / ₦${userBudget.daily_budget.toFixed(2)}`
      );
    }
  }

  // Show warning toast
  function showWarningToast(message) {
    showToast(message, "warning");
  }

  // Update the handleAddExpense function to include budget alerts
  const originalHandleAddExpense = handleAddExpense;
  handleAddExpense = function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const amount = parseFloat(fd.get("amount"));

    // Check budget before adding
    checkBudgetAlerts(amount);

    // Call original function
    return originalHandleAddExpense.call(this, e);
  };

  // Edit expense function
  // window.editExpense = function (expenseId) {
  //   const expense = currentExpenses.find((e) => e.id === expenseId);
  //   if (!expense) {
  //     showErrorToast("Expense not found");
  //     return;
  //   }

  //   // Populate the existing modal with expense data
  //   const form = document.getElementById("edit-expense-form");
  //   form.querySelector('input[name="amount"]').value = expense.amount;
  //   form.querySelector('select[name="category"]').value = expense.category;
  //   form.querySelector('input[name="date"]').value = expense.date;
  //   form.querySelector('input[name="note"]').value = expense.note || "";

  //   // Store the expense ID for saving
  //   document
  //     .getElementById("save-expense-edit")
  //     .setAttribute("data-expense-id", expenseId);

  //   // Show the modal
  //   const modal = new bootstrap.Modal(
  //     document.getElementById("editExpenseModal")
  //   );
  //   modal.show();
  // };

  // Delete expense function
  // window.deleteExpense = function (expenseId) {
  //   const expense = currentExpenses.find((e) => e.id === expenseId);
  //   if (!expense) {
  //     showErrorToast("Expense not found");
  //     return;
  //   }

  //   // Populate the existing modal with expense details
  //   const expenseDetails = document.getElementById("expense-details");
  //   expenseDetails.innerHTML = `
  //     <strong>${expense.category}</strong><br>
  //     <span class="text-primary fs-5">$${parseFloat(expense.amount).toFixed(
  //       2
  //     )}</span><br>
  //     <small class="text-muted">${expense.note || "No note"}</small>
  //   `;

  //   // Store the expense ID for deletion
  //   document
  //     .getElementById("confirm-delete-expense")
  //     .setAttribute("data-expense-id", expenseId);

  //   // Show the modal
  //   const modal = new bootstrap.Modal(
  //     document.getElementById("deleteExpenseModal")
  //   );
  //   modal.show();
  // };

  // Save expense edit - updated to work with the HTML modal
  function saveExpenseEdit() {
    const saveBtn = document.getElementById("save-expense-edit");
    const expenseId = saveBtn.getAttribute("data-expense-id");

    if (!expenseId) {
      showErrorToast("Expense ID not found");
      return;
    }

    const form = document.getElementById("edit-expense-form");
    const fd = new FormData(form);
    const payload = {
      amount: fd.get("amount"),
      category: fd.get("category"),
      note: fd.get("note"),
      date: fd.get("date"),
    };

    // Show loading state
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Saving...';

    try {
      // Find and update the expense in currentExpenses array
      const expenseIndex = currentExpenses.findIndex((e) => e.id == expenseId);
      if (expenseIndex > -1) {
        // Update the expense with new data
        currentExpenses[expenseIndex] = {
          ...currentExpenses[expenseIndex],
          amount: parseFloat(payload.amount),
          category: payload.category,
          note: payload.note,
          date: payload.date,
          updated_at: new Date().toISOString(),
        };

        // Save updated expenses to localStorage
        storage.saveExpenses(currentExpenses);

        const modal = bootstrap.Modal.getInstance(
          document.getElementById("editExpenseModal")
        );
        modal.hide();
        loadDashboardData();
        showSuccessToast("Expense updated successfully!");
      } else {
        showErrorToast("Expense not found");
      }
    } catch (err) {
      console.error("Error updating expense:", err);
      showErrorToast("Failed to update expense");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  }

  // Confirm delete expense
  function confirmDeleteExpense() {
    const deleteBtn = document.getElementById("confirm-delete-expense");
    const expenseId = deleteBtn.getAttribute("data-expense-id");

    if (!expenseId) {
      showErrorToast("Expense ID not found");
      return;
    }

    // Show loading state
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML =
      '<i class="bi bi-hourglass-split me-2"></i>Deleting...';

    try {
      // Remove from currentExpenses array
      const expenseIndex = currentExpenses.findIndex((e) => e.id == expenseId);
      if (expenseIndex > -1) {
        currentExpenses.splice(expenseIndex, 1);

        // Save updated expenses to localStorage
        storage.saveExpenses(currentExpenses);

        // Close modal properly first
        console.log("Closing modal...");

        const modalElement = document.getElementById("deleteExpenseModal");
        if (modalElement) {
          try {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
              console.log("Using Bootstrap modal instance to hide");
              modal.hide();
            } else {
              console.log("No Bootstrap instance found, removing manually");
              // Manual cleanup
              const backdrop = document.querySelector(".modal-backdrop");
              if (backdrop) backdrop.remove();
              modalElement.remove();
              document.body.classList.remove("modal-open");
              document.body.style.overflow = "";
              document.body.style.paddingRight = "";
            }
          } catch (err) {
            console.log("Error with Bootstrap modal, removing manually:", err);
            // Fallback: manual cleanup
            const backdrop = document.querySelector(".modal-backdrop");
            if (backdrop) backdrop.remove();
            modalElement.remove();
            document.body.classList.remove("modal-open");
            document.body.style.overflow = "";
            document.body.style.paddingRight = "";
          }
        } else {
          console.log("Modal element not found");
        }

        // Restore button state after modal is handled
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;

        loadDashboardData();
        showSuccessToast("Expense deleted successfully!");
      } else {
        // Restore button state before showing error
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;
        showErrorToast("Expense not found");
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
      // Restore button state before showing error
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;
      }
      showErrorToast("Failed to delete expense");
    }
  }

  // Add event listeners for modal buttons
  document.addEventListener("DOMContentLoaded", function () {
    // Setup budget auto-calculation
    setupBudgetAutoCalculation();

    // Edit expense save button
    const saveEditBtn = document.getElementById("save-expense-edit");
    if (saveEditBtn) {
      saveEditBtn.addEventListener("click", saveExpenseEdit);
    }

    // Delete expense confirm button
    const confirmDeleteBtn = document.getElementById("confirm-delete-expense");
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener("click", confirmDeleteExpense);
    }
  });

  // Load categories data
  function loadCategories() {
    if (currentExpenses.length === 0) {
      loadExpenses().then(() => {
        displayCategoriesData();
      });
    } else {
      displayCategoriesData();
    }
  }

  // Display categories data
  function displayCategoriesData() {
    const categories = calculateCategoryData();
    updateCategoryStats(categories);
    displayCategoryList(categories);
    displayCategoryChart(categories);
  }

  // Calculate category data from expenses
  function calculateCategoryData() {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyExpenses = currentExpenses.filter((e) =>
      e.date.startsWith(thisMonth)
    );

    const categoryData = {};
    const defaultCategories = [
      "Food",
      "Transportation",
      "Entertainment",
      "Utilities",
      "Healthcare",
      "Shopping",
      "Other",
    ];

    // Initialize all categories
    defaultCategories.forEach((cat) => {
      categoryData[cat] = {
        name: cat,
        total: 0,
        count: 0,
        percentage: 0,
        icon: getCategoryIcon(cat),
        color: getCategoryColor(cat),
      };
    });

    // Calculate totals
    const totalMonthlySpent = monthlyExpenses.reduce(
      (sum, e) => sum + parseFloat(e.amount || 0),
      0
    );

    monthlyExpenses.forEach((expense) => {
      const category = expense.category || "Other";
      if (categoryData[category]) {
        categoryData[category].total += parseFloat(expense.amount || 0);
        categoryData[category].count += 1;
      }
    });

    // Calculate percentages
    Object.keys(categoryData).forEach((cat) => {
      if (totalMonthlySpent > 0) {
        categoryData[cat].percentage =
          (categoryData[cat].total / totalMonthlySpent) * 100;
      }
    });

    return categoryData;
  }

  // Update category statistics
  function updateCategoryStats(categories) {
    const categoriesWithExpenses = Object.values(categories).filter(
      (cat) => cat.total > 0
    );
    const totalCategories = categoriesWithExpenses.length;

    // Find most used category (based on transaction count, with amount as tiebreaker)
    const mostUsed = Object.values(categories).reduce(
      (max, cat) => {
        if (cat.count > max.count) return cat;
        if (cat.count === max.count && cat.total > max.total) return cat;
        return max;
      },
      { count: 0, total: 0, name: "None" }
    );

    // Find category with highest percentage
    const highestPercentage = Object.values(categories).reduce(
      (max, cat) => (cat.percentage > max.percentage ? cat : max),
      { percentage: 0, name: "None" }
    );

    // Calculate total monthly spending
    const totalMonthly = Object.values(categories).reduce(
      (sum, cat) => sum + cat.total,
      0
    );

    document.getElementById("total-categories").textContent = totalCategories;
    document.getElementById("most-used-category").textContent = mostUsed.name;
    document.getElementById("highest-percentage-category").textContent = `${
      highestPercentage.name
    } (${highestPercentage.percentage.toFixed(1)}%)`;
    document.getElementById(
      "category-expenses"
    ).textContent = `₦${totalMonthly.toFixed(2)}`;
  }

  // Display category list
  function displayCategoryList(categories) {
    const container = document.getElementById("category-list");
    const sortedCategories = Object.values(categories)
      .filter((cat) => cat.total > 0)
      .sort((a, b) => b.total - a.total);

    if (sortedCategories.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-tags fs-1 mb-3 d-block"></i>
          <p>No expenses recorded this month</p>
          <small>Add some expenses to see category breakdown</small>
        </div>
      `;
      return;
    }

    let html = "";
    sortedCategories.forEach((category, index) => {
      html += `
        <div class="category-item mb-3 fade-in" style="animation-delay: ${
          index * 0.1
        }s">
          <div class="d-flex align-items-center justify-content-between p-3 border rounded">
            <div class="d-flex align-items-center">
              <div class="category-icon me-3" style="background: ${
                category.color
              }">
                <i class="bi ${category.icon} text-white"></i>
              </div>
              <div>
                <h6 class="mb-1">${category.name}</h6>
                <small class="text-muted">${category.count} transaction${
        category.count !== 1 ? "s" : ""
      }</small>
              </div>
            </div>
            <div class="text-end">
              <div class="fw-bold fs-5 text-primary">₦${category.total.toFixed(
                2
              )}</div>
              <small class="text-muted">${category.percentage.toFixed(
                1
              )}%</small>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Display category chart (simple bar chart)
  function displayCategoryChart(categories) {
    const container = document.getElementById("category-chart");
    const sortedCategories = Object.values(categories)
      .sort((a, b) => b.total - a.total)
      .slice(0, 7); // Show all 7 categories

    if (sortedCategories.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <p>No categories available</p>
        </div>
      `;
      return;
    }

    const maxAmount = Math.max(...sortedCategories.map((cat) => cat.total));

    let html = "";
    sortedCategories.forEach((category, index) => {
      const width =
        maxAmount > 0
          ? (category.total / maxAmount) * 100
          : category.total > 0
          ? 10
          : 0;
      html += `
        <div class="chart-item mb-3 fade-in" style="animation-delay: ${
          index * 0.1
        }s">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <span class="fw-semibold">${category.name}</span>
            <span class="text-primary fw-bold">₦${category.total.toFixed(
              2
            )}</span>
          </div>
          <div class="progress" style="height: 12px;">
            <div class="progress-bar" style="width: ${width}%; background: ${
        category.color
      }"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Get category color
  function getCategoryColor(category) {
    const colors = {
      Food: "#FF6B6B",
      Transportation: "#4ECDC4",
      Entertainment: "#45B7D1",
      Utilities: "#FFA07A",
      Healthcare: "#98D8C8",
      Shopping: "#F7DC6F",
      Other: "#BB8FCE",
    };
    return colors[category] || "#6C757D";
  }

  // PDF Download functionality
  window.downloadReport = function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    if (currentExpenses.length === 0) {
      showErrorToast("No expenses available to generate statement");
      return;
    }

    // Get user info and current date
    const today = new Date();
    const userName =
      document
        .getElementById("user-name-sidebar")
        ?.textContent?.replace("Welcome, ", "")
        .replace("!", "") || "User";

    // Sort expenses by date
    const sortedExpenses = [...currentExpenses].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    // Calculate running balance (starting from budget)
    const monthlyBudget = userBudget.monthly_budget || 0;
    let runningBalance = monthlyBudget;

    // PDF Header - Bank Statement Style
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text("FINECLEM_EXPENSE TRACKER", 20, 25);
    doc.text("EXPENSE STATEMENT", 20, 35);

    // Account Info
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Account Holder: ${userName}`, 20, 50);
    doc.text(
      `Statement Period: ${new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}`,
      20,
      58
    );
    doc.text(
      `Generated: ${today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })} at ${today.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`,
      20,
      66
    );
    doc.text(`Statement Date: ${today.toLocaleDateString()}`, 140, 50);
    doc.text(`Account Type: Expense Tracking`, 140, 58);

    // Account Summary Box
    doc.setDrawColor(200, 200, 200);
    doc.rect(20, 75, 170, 25);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("ACCOUNT SUMMARY", 25, 83);

    const totalExpenses = sortedExpenses.reduce(
      (sum, exp) => sum + parseFloat(exp.amount),
      0
    );
    const remainingBalance = monthlyBudget - totalExpenses;

    doc.text(`Opening Balance: NGN ${monthlyBudget.toFixed(2)}`, 25, 91);
    doc.text(`Total Expenses: NGN ${totalExpenses.toFixed(2)}`, 100, 91);
    doc.text(`Closing Balance: NGN ${remainingBalance.toFixed(2)}`, 25, 97);
    doc.text(`Number of Transactions: ${sortedExpenses.length}`, 100, 97);

    // Transaction Table Header
    let yPosition = 115;
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.setTextColor(0, 0, 0);

    // Table headers
    doc.text("DATE", 25, yPosition);
    doc.text("TIME", 45, yPosition);
    doc.text("DESCRIPTION", 65, yPosition);
    doc.text("CATEGORY", 115, yPosition);
    doc.text("AMOUNT", 150, yPosition);
    doc.text("BALANCE", 175, yPosition);

    // Header line
    doc.setDrawColor(0, 0, 0);
    doc.line(20, yPosition + 2, 190, yPosition + 2);
    yPosition += 8;

    // Transaction rows
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);

    // Reset running balance for forward calculation
    runningBalance = monthlyBudget;

    sortedExpenses.forEach((expense, index) => {
      if (yPosition > 270) {
        // New page
        doc.addPage();
        yPosition = 30;

        // Repeat headers on new page
        doc.setFont(undefined, "bold");
        doc.setFontSize(9);
        doc.text("DATE", 25, yPosition);
        doc.text("TIME", 45, yPosition);
        doc.text("DESCRIPTION", 65, yPosition);
        doc.text("CATEGORY", 115, yPosition);
        doc.text("AMOUNT", 150, yPosition);
        doc.text("BALANCE", 175, yPosition);
        doc.line(20, yPosition + 2, 190, yPosition + 2);
        yPosition += 8;
        doc.setFont(undefined, "normal");
        doc.setFontSize(8);
      }

      // Calculate balance after this transaction
      runningBalance -= parseFloat(expense.amount);

      // Format date and time
      const expenseDate = new Date(expense.date);
      const formattedDate = expenseDate.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
      });

      // Format time - use created_at if available, otherwise use a default time
      let formattedTime = "12:00";
      if (expense.created_at) {
        const createdDate = new Date(expense.created_at);
        formattedTime = createdDate.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }

      // Truncate description if too long
      const description = (expense.note || "No description").substring(0, 20);
      const category = expense.category || "Other";
      const amount = parseFloat(expense.amount);

      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(248, 249, 250);
        doc.rect(20, yPosition - 4, 170, 6, "F");
      }

      // Transaction data
      doc.setTextColor(0, 0, 0);
      doc.text(formattedDate, 25, yPosition);
      doc.text(formattedTime, 45, yPosition);
      doc.text(description, 65, yPosition);
      doc.text(category, 115, yPosition);

      // Amount in red (debit)
      doc.setTextColor(220, 53, 69);
      doc.text(`-NGN ${amount.toFixed(2)}`, 150, yPosition);

      // Balance
      if (runningBalance >= 0) {
        doc.setTextColor(40, 167, 69);
      } else {
        doc.setTextColor(220, 53, 69);
      }
      doc.text(`NGN ${runningBalance.toFixed(2)}`, 175, yPosition);

      yPosition += 6;
    });

    // Footer section
    yPosition += 10;
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 30;
    }

    // Summary footer
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPosition, 190, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, "bold");
    doc.text("STATEMENT SUMMARY", 25, yPosition);
    yPosition += 8;

    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.text(`Total Debits: NGN ${totalExpenses.toFixed(2)}`, 25, yPosition);
    doc.text(
      `Account Balance: NGN ${remainingBalance.toFixed(2)}`,
      25,
      yPosition + 6
    );

    if (remainingBalance < 0) {
      doc.setTextColor(220, 53, 69);
      doc.text("⚠ Account is over budget", 25, yPosition + 12);
    } else if (remainingBalance < monthlyBudget * 0.1) {
      doc.setTextColor(255, 193, 7);
      doc.text("⚠ Low balance warning", 25, yPosition + 12);
    }

    // Page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(108, 117, 125);
      doc.text(`Page ${i} of ${pageCount}`, 170, 285);
      doc.text("Expense Tracker - Confidential", 20, 285);
    }

    // Download
    const fileName = `expense-statement-${
      today.toISOString().split("T")[0]
    }.pdf`;
    doc.save(fileName);

    showSuccessToast("Fineclem_expense_statement downloaded successfully!");
  };

  // Save Budget Settings function
  window.saveBudgetSettings = function () {
    const form = document.getElementById("budget-form");
    const fd = new FormData(form);

    const monthlyBudget = parseFloat(fd.get("monthly_budget"));
    const weeklyBudget = parseFloat(fd.get("weekly_budget"));
    const dailyBudget = parseFloat(fd.get("daily_budget"));

    if (!monthlyBudget || monthlyBudget <= 0) {
      showErrorToast("Please enter a valid monthly budget");
      return;
    }

    const payload = {
      monthly_budget: monthlyBudget,
      weekly_budget: weeklyBudget,
      daily_budget: dailyBudget,
    };

    const saveBtn = document.querySelector(
      '#budget-form button[type="button"]'
    );
    if (!saveBtn) {
      showErrorToast("Save button not found");
      return;
    }

    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Saving...';

    try {
      // Save to localStorage instead of API call
      userBudget = {
        id: Date.now(),
        monthly_budget: payload.monthly_budget,
        weekly_budget: payload.weekly_budget,
        daily_budget: payload.daily_budget,
        updated_at: new Date().toISOString(),
      };

      storage.saveBudget(userBudget);

      updateBudgetDisplay();
      updateBudgetProgress();
      showSuccessToast("Budget settings updated successfully!");
    } catch (err) {
      console.error("Error saving budget:", err);
      showErrorToast("Failed to update budget settings");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  };

  // Auto-calculate weekly and daily budgets when monthly budget changes
  function setupBudgetAutoCalculation() {
    const monthlyInput = document.querySelector('input[name="monthly_budget"]');

    if (monthlyInput) {
      monthlyInput.addEventListener("input", function () {
        const monthlyAmount = parseFloat(this.value);

        if (monthlyAmount && monthlyAmount > 0) {
          // Calculate weekly budget (monthly / 4.33 weeks per month)
          const weeklyAmount = monthlyAmount / 4.33;

          // Calculate daily budget (monthly / 30 days per month)
          const dailyAmount = monthlyAmount / 30;

          // Update the form inputs
          const weeklyInput = document.querySelector(
            'input[name="weekly_budget"]'
          );
          const dailyInput = document.querySelector(
            'input[name="daily_budget"]'
          );

          if (weeklyInput) {
            weeklyInput.value = weeklyAmount.toFixed(2);
          }

          if (dailyInput) {
            dailyInput.value = dailyAmount.toFixed(2);
          }
        }
      });
    }
  }

  // Initialize dashboard
  checkAuth();

  window.navigateToSection = navigateToSection;
})();

// Authentication logic for signup and login pages
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
        if (!res.ok) throw body;
        return body;
      }
    );
  };

  // Check if user is already logged in
  function checkAuthStatus() {
    const token = localStorage.getItem("token");
    if (token) {
      // User is already logged in, redirect to dashboard
      window.location.href = "/dashboard";
      return true;
    }
    return false;
  }

  function showError(message) {
    const existingAlert = document.querySelector(".alert-danger");
    if (existingAlert) {
      existingAlert.remove();
    }

    const alert = document.createElement("div");
    alert.className = "alert alert-danger alert-dismissible fade show";
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const cardBody = document.querySelector(".card-body");
    cardBody.insertBefore(alert, cardBody.firstChild);

    // Auto-dismiss error after 5 seconds
    setTimeout(() => {
      if (alert && alert.parentNode) {
        alert.classList.remove("show");
        alert.classList.add("fade");
        setTimeout(() => {
          if (alert.parentNode) {
            alert.remove();
          }
        }, 150);
      }
    }, 5000);
  }

  // Block UI functionality
  function blockUI(form, submitButton, message = "Processing...") {
    // Disable form
    const inputs = form.querySelectorAll("input, button");
    inputs.forEach((input) => (input.disabled = true));

    // Update submit button
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            ${message}
        `;

    // Add overlay
    const overlay = document.createElement("div");
    overlay.id = "form-overlay";
    overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            border-radius: 12px;
        `;

    const card = form.closest(".card");
    if (card) {
      card.style.position = "relative";
      card.appendChild(overlay);
    }

    return { originalText, inputs };
  }

  function unblockUI(form, submitButton, originalText) {
    // Enable form
    const inputs = form.querySelectorAll("input, button");
    inputs.forEach((input) => (input.disabled = false));

    // Restore submit button
    submitButton.innerHTML = originalText;

    // Remove overlay
    const overlay = document.getElementById("form-overlay");
    if (overlay) {
      overlay.remove();
    }

    const card = form.closest(".card");
    if (card) {
      card.style.position = "";
    }
  }

  // Show success message
  function showSuccess(message) {
    showToast(message, "success");
  }

  // Toast notification system
  function showToast(message, type = "success") {
    // Remove existing toast
    const existingToast = document.getElementById("auth-toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.id = "auth-toast";
    toast.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    toast.style.cssText = `
      top: 20px;
      right: 20px;
      z-index: 9999;
      min-width: 350px;
      max-width: 400px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.15);
      border: none;
      border-radius: 12px;
      animation: slideInRight 0.4s ease-out;
    `;

    const iconMap = {
      success: "bi-check-circle-fill",
      error: "bi-exclamation-triangle-fill",
      info: "bi-info-circle-fill",
    };

    toast.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="bi ${iconMap[type]} me-3 fs-5"></i>
        <div class="flex-grow-1 fw-semibold">${message}</div>
        <button type="button" class="btn-close ms-2" data-bs-dismiss="alert"></button>
      </div>
    `;

    document.body.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = "slideOutRight 0.4s ease-in";
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 400);
      }
    }, 4000);

    // Handle manual close
    const closeBtn = toast.querySelector(".btn-close");
    closeBtn.addEventListener("click", () => {
      toast.style.animation = "slideOutRight 0.4s ease-in";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 400);
    });
  }

  // Password validation
  function validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    if (password.length < minLength) {
      return "Password must be at least 8 characters long";
    }
    if (!hasUpperCase) {
      return "Password must contain at least one uppercase letter";
    }
    if (!hasLowerCase) {
      return "Password must contain at least one lowercase letter";
    }
    if (!hasNumbers) {
      return "Password must contain at least one number";
    }
    return null;
  }

  // Email validation
  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return null;
  }

  // Initialize page
  function init() {
    if (checkAuthStatus()) {
      return;
    }

    // Handle signup form
    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
      signupForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const fd = new FormData(e.target);
        const name = fd.get("name").trim();
        const email = fd.get("email").trim();
        const password = fd.get("password");

        if (!name) {
          showError("Please enter your full name");
          return;
        }

        const emailError = validateEmail(email);
        if (emailError) {
          showError(emailError);
          return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
          showError(passwordError);
          return;
        }

        // Block UI
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const { originalText } = blockUI(
          e.target,
          submitBtn,
          "Creating Account..."
        );

        const payload = { name, email, password };
        api("/signup", { method: "POST", body: JSON.stringify(payload) })
          .then((data) => {
            // Don't store token immediately, let user login
            showSuccess(
              "Account created successfully! Please login with your credentials."
            );
            setTimeout(() => {
              window.location.href = "/login";
            }, 2000);
          })
          .catch((err) => {
            unblockUI(e.target, submitBtn, originalText);
            showError(err.error || "Signup failed. Please try again.");
          });
      });
    }

    // Handle login form
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const fd = new FormData(e.target);
        const email = fd.get("email").trim();
        const password = fd.get("password");

        // Client-side validation
        const emailError = validateEmail(email);
        if (emailError) {
          showError(emailError);
          return;
        }

        if (!password) {
          showError("Please enter your password");
          return;
        }

        // Block UI
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const { originalText } = blockUI(e.target, submitBtn, "Signing In...");

        const payload = { email, password };
        api("/login", { method: "POST", body: JSON.stringify(payload) })
          .then((data) => {
            localStorage.setItem("token", data.token);
            showSuccess("Login successful! Redirecting...");
            setTimeout(() => {
              window.location.href = "/dashboard";
            }, 1000);
          })
          .catch((err) => {
            unblockUI(e.target, submitBtn, originalText);
            showError(
              err.error || "Login failed. Please check your credentials."
            );
          });
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

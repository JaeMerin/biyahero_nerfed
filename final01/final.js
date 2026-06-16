import supabase from "./auth.js";

// ============================================================
// SECTION 1 — FARE MATRIX POPUP
// ============================================================

const urlParams = new URLSearchParams(window.location.search);
console.log("code param:", urlParams.get("code"));

document.addEventListener("DOMContentLoaded", function () {
    const btn     = document.getElementById("viewFareBtn");
    const popup   = document.getElementById("farePopup");
    const closeBtn = document.querySelector(".close-icon");

    if (btn && popup) {
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            popup.style.display = "block";
            document.body.style.overflow = "hidden";
        });

        closeBtn.onclick = function () {
            popup.style.display = "none";
            document.body.style.overflow = "auto";
        };

        window.addEventListener("click", function (event) {
            if (event.target === popup) {
                popup.style.display = "none";
                document.body.style.overflow = "auto";
            }
        });
    }
});

// ============================================================
// GLOBAL FIX — RECOVERY DETECTION (ADDED, SAFE)
// ============================================================

const isRecovery =
    window.location.hash.includes("access_token");

function toggleFormFields(isActive, formSelector) {
    const fields = document.querySelectorAll(`${formSelector} input, ${formSelector} button`);
    fields.forEach(field => {
        field.disabled = !isActive;
    });
}
// ============================================================
// SECTION 2 — LOGIN / REGISTER WRAPPER TOGGLE
// ============================================================

// ============================================================
// SECTION 2 — LOGIN / REGISTER WRAPPER TOGGLE
// ============================================================

const wrapper      = document.querySelector(".wrapper");
const registerLink = document.querySelector(".register-link");
const loginLink    = document.querySelector(".login-link");

if (wrapper) {
    toggleFormFields(true, '.form-box.login');
    toggleFormFields(false, '.form-box.register');
}

if (registerLink) registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    wrapper.classList.add('active');
    toggleFormFields(false, '.form-box.login');
    toggleFormFields(true, '.form-box.register');

    // Disable forgot password link when on register view
    const forgotLink = document.getElementById("forgotPasswordLink");
    if (forgotLink) {
        forgotLink.style.pointerEvents = "none";
        forgotLink.style.opacity = "0.4";
    }
});

if (loginLink) loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    wrapper.classList.remove('active');
    toggleFormFields(true, '.form-box.login');
    toggleFormFields(false, '.form-box.register');

    // Re-enable forgot password link when back on login view
    const forgotLink = document.getElementById("forgotPasswordLink");
    if (forgotLink) {
        forgotLink.style.pointerEvents = "";
        forgotLink.style.opacity = "";
    }
});

// ============================================================
// SECTION 3 — PASSWORD VISIBILITY TOGGLES
// ============================================================

function setupToggle(inputId, toggleId) {
    const passwordField = document.getElementById(inputId);
    const toggleIcon    = document.getElementById(toggleId);
    if (!passwordField || !toggleIcon) return;

    toggleIcon.onclick = function () {
        const isHidden = passwordField.type === "password";
        passwordField.type = isHidden ? "text" : "password";
        toggleIcon.classList.toggle("bx-hide",  !isHidden);
        toggleIcon.classList.toggle("bx-show",   isHidden);
    };
}

setupToggle("loginPassword",    "toggleLoginPassword");
setupToggle("registerPassword", "toggleRegisterPassword");

// ============================================================
// SECTION 4 — LOGIN POPUP
// ============================================================

const loginBtn  = document.getElementById("loginBtn");
const logPopup  = document.getElementById("loginPopup");
const logClose  = document.querySelector(".close-login");

if (loginBtn && logPopup) {
    loginBtn.onclick = function (e) {
        e.preventDefault();
        logPopup.style.display = "block";
        document.body.style.overflow = "hidden";
    };

    logClose.onclick = function () {
        logPopup.style.display = "none";
        document.body.style.overflow = "auto";
    };

    window.addEventListener("click", function (event) {
        if (event.target === logPopup) {
            logPopup.style.display = "none";
            document.body.style.overflow = "auto";
        }
    });

}


// ============================================================
// SECTION 5 — DARK MODE
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("darkToggle");
    if (!toggle) return;

    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        toggle.checked = true;
    }

    toggle.addEventListener("change", () => {
        const enabled = toggle.checked;
        document.body.classList.toggle("dark-mode", enabled);
        localStorage.setItem("darkMode", enabled ? "enabled" : "disabled");
    });
});

// ============================================================
// SECTION 6 — MOBILE MENU
// ============================================================

const menuToggle = document.getElementById("menuToggle");
const navGroup   = document.getElementById("navGroup");

if (menuToggle && navGroup) {
    menuToggle.addEventListener("click", () => {
        navGroup.classList.toggle("active");
        const icon = menuToggle.querySelector("i");
        if (icon) {
            icon.classList.toggle("bx-menu");
            icon.classList.toggle("bx-x");
        }
    });
}

// ============================================================
// SECTION 7 — AUTH STATE (FIXED)
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    const loginBtn  = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    if (!loginBtn || !logoutBtn) return;

    const { data: { user } } = await supabase.auth.getUser();

    loginBtn.style.display  = user ? "none"  : "block";
    logoutBtn.style.display = user ? "block" : "none";

    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = window.location.origin;
    });
});

// ============================================================
// SECTION 8 — ROUTE INFO VISIBILITY
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const routeInfo = document.getElementById("routeInfo");
    if (!routeInfo) return;

    const observer = new MutationObserver(() => {
        routeInfo.style.display =
            routeInfo.innerHTML.trim() !== "" ? "block" : "none";
    });

    observer.observe(routeInfo, {
        childList: true,
        subtree: true,
        characterData: true
    });

    document.getElementById("exitBtn")?.addEventListener("click", () => {
        routeInfo.innerHTML = "";
        routeInfo.style.display = "none";
    });
});

// ============================================================
// SECTION 9 — FORGOT PASSWORD
// ============================================================

const forgotLink  = document.getElementById("forgotPasswordLink");
const forgotModal = document.getElementById("forgotModal");
const closeModal  = document.querySelector(".close-modal");

if (forgotLink && forgotModal) {
    forgotLink.addEventListener("click", (e) => {
        e.preventDefault();
        forgotModal.classList.add("active");
    });

    closeModal.addEventListener("click", () => {
        forgotModal.classList.remove("active");
    });

    document.getElementById("sendResetLink").addEventListener("click", async () => {
        const email = document.getElementById("resetEmail").value.trim();

        if (!email) {
            alert("Please enter your email.");
            return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: "https://biyaheroes.netlify.app/index.html"
        });

        if (error) {
            alert(error.message);
            return;
        }

        alert("Password reset link sent!");
        forgotModal.classList.remove("active");
    });
}
document.addEventListener("DOMContentLoaded", () => {

    function openResetModal() {
        console.log("openResetModal called"); // debug
        const modal = document.getElementById("resetPasswordModal");
        if (!modal) {
            console.error("Modal not found in DOM!");
            return;
        }
        modal.style.display = "flex";

        const form = document.getElementById("resetForm");
        if (!form || form.dataset.bound) return;
        form.dataset.bound = "true";

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const newPassword     = document.getElementById("newPassword").value;
            const confirmPassword = document.getElementById("confirmPassword").value;
            const messageBox      = document.getElementById("message");

            if (newPassword !== confirmPassword) {
                messageBox.textContent = "Passwords do not match.";
                return;
            }

            const { error } = await supabase.auth.updateUser({ password: newPassword });

            if (error) {
                messageBox.textContent = error.message;
                return;
            }

            alert("Password updated successfully!");
            await supabase.auth.signOut();
            window.location.href = "/index.html";
        });
    }

    // METHOD 1 — catch the event if it fires after listener is ready
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth event:", event); // debug
        if (event === "PASSWORD_RECOVERY") {
            openResetModal();
        }
    });

    // METHOD 2 — catch it if the event already fired before listener registered
    supabase.auth.getSession().then(({ data: { session } }) => {
        console.log("getSession result:", session); // debug
        const hash = window.location.hash;
        const isRecovery =
            hash.includes("type=recovery") ||
            hash.includes("access_token");

        if (session && isRecovery) {
            openResetModal();
        }
    });

    // METHOD 3 — nuclear fallback, check hash directly
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
        console.log("Hash recovery detected, opening modal"); // debug
        // slight delay to let Supabase process the token first
        setTimeout(openResetModal, 500);
    }

    

});

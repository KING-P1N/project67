// ======================= FORM HANDLING =======================

function toggleForm(formType) {
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  const signupBtn = document.getElementById("signupBtn");
  const loginBtn = document.getElementById("loginBtn");

  if (formType === "signup") {
    signupForm.style.display = "block";
    loginForm.style.display = "none";
    signupBtn.classList.add("active");
    loginBtn.classList.remove("active");
  } else {
    signupForm.style.display = "none";
    loginForm.style.display = "block";
    signupBtn.classList.remove("active");
    loginBtn.classList.add("active");
  }
}

function handleSignup(event) {
  event.preventDefault();

  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();
  const confirm = document.getElementById("signup-confirm").value.trim();
  const accountType = document.getElementById("account-type").value;

  // Validation
  if (!email || !password || !confirm) {
    alert("⚠️ All fields are required!");
    return;
  }

  if (password.length < 6) {
    alert("⚠️ Password must be at least 6 characters!");
    return;
  }

  if (password !== confirm) {
    alert("⚠️ Passwords do not match!");
    return;
  }

  if (!accountType) {
    alert("⚠️ Please select an account type!");
    return;
  }

  // Store user data in localStorage
  const userData = {
    email: email,
    password: password,
    accountType: accountType,
    createdAt: new Date().toLocaleString(),
  };

  localStorage.setItem("currentUser", JSON.stringify(userData));
  localStorage.setItem("userEmail_" + email, JSON.stringify(userData));

  console.log("✓ User registered:", userData);

  // Route based on account type
  if (accountType === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "index.html";
  }
}

function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    alert("⚠️ Please enter email and password!");
    return;
  }

  // Check if user exists in localStorage
  const storedUser = localStorage.getItem("userEmail_" + email);

  if (!storedUser) {
    alert("⚠️ User not found! Please sign up first.");
    return;
  }

  const userData = JSON.parse(storedUser);

  if (userData.password !== password) {
    alert("⚠️ Incorrect password!");
    return;
  }

  // Store current user session
  localStorage.setItem("currentUser", JSON.stringify(userData));

  console.log("✓ User logged in:", userData);

  // Route based on account type
  if (userData.accountType === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "index.html";
  }
}

// ======================= CAROUSEL HANDLING =======================

let currentSlide = 0;

function updateCarousel() {
  const track = document.getElementById("carouselTrack");
  const dots = document.querySelectorAll(".dot");

  track.style.transform = `translateX(-${currentSlide * 100}%)`;

  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentSlide);
  });
}

function moveCarousel(direction) {
  const slides = document.querySelectorAll(".carousel-slide");
  const totalSlides = slides.length;

  currentSlide = (currentSlide + direction + totalSlides) % totalSlides;
  updateCarousel();
}

function goToSlide(slideIndex) {
  currentSlide = slideIndex;
  updateCarousel();
}

// ======================= LOGOUT FUNCTION =======================

function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "home.html";
}

// ======================= PAGE GUARDS =======================

// Check if user is logged in when on protected pages (index.html, admin.html)
function checkAuth() {
  const currentPage = window.location.pathname;

  if (
    currentPage.includes("sites.html") ||
    currentPage.includes("admin.html")
  ) {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      alert("⚠️ Please login first!");
      window.location.href = "home.html";
    }
  }
}

// Run auth check on page load
document.addEventListener("DOMContentLoaded", function () {
  checkAuth();
});

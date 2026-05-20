// ======================= FORM HANDLING =======================

function toggleForm(formType) {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const signupBtn = document.getElementById('signupBtn');
    const loginBtn = document.getElementById('loginBtn');

    if (formType === 'signup') {
        signupForm.style.display = 'block';
        loginForm.style.display = 'none';
        signupBtn.classList.add('active');
        loginBtn.classList.remove('active');
    } else {
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
        signupBtn.classList.remove('active');
        loginBtn.classList.add('active');
    }
}

function handleSignup(event) {
    event.preventDefault();

    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const confirm = document.getElementById('signup-confirm').value.trim();
    const accountType = 'user';

    // Validation
    if (!email || !password || !confirm) {
        alert('⚠️ All fields are required!');
        return;
    }

    if (password.length < 6) {
        alert('⚠️ Password must be at least 6 characters!');
        return;
    }

    if (password !== confirm) {
        alert('⚠️ Passwords do not match!');
        return;
    }

    

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'SIGNING UP...';
    submitBtn.disabled = true;

    // Create user with Firebase Authentication
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;

            // Save user profile to Firestore
            return db.collection('users').doc(user.uid).set({
                email: email,
                password: password,
                accountType: accountType,
                createdAt: new Date().toLocaleString(),
                uid: user.uid
            });
        })
        .then(() => {
            console.log('✓ User registered successfully');
            
            // Store account type in localStorage for quick access
            localStorage.setItem('userAccountType', accountType);

            window.location.href = 'hub.html';
        })
        .catch((error) => {
            console.error('❌ Signup error:', error.message);
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;

            if (error.code === 'auth/email-already-in-use') {
                alert('⚠️ Email is already registered!');
            } else if (error.code === 'auth/invalid-email') {
                alert('⚠️ Invalid email address!');
            } else if (error.code === 'auth/weak-password') {
                alert('⚠️ Password is too weak!');
            } else {
                alert('⚠️ Error: ' + error.message);
            }
        });
}

function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
        alert('⚠️ Please enter email and password!');
        return;
    }

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'LOGGING IN...';
    submitBtn.disabled = true;

    // Sign in with Firebase Authentication
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;

            // Get user profile from Firestore
            return db.collection('users').doc(user.uid).get()
                .then((docSnapshot) => {
                    if (docSnapshot.exists) {
                        const userData = docSnapshot.data();
                        localStorage.setItem('userAccountType', userData.accountType);
                        localStorage.setItem('userEmail', userData.email);

                        console.log('✓ User logged in:', userData);

                        window.location.href = 'hub.html';
                    }
                });
        })
        .catch((error) => {
            console.error('❌ Login error:', error.message);
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;

            if (error.code === 'auth/user-not-found') {
                alert('⚠️ No account found with this email!');
            } else if (error.code === 'auth/wrong-password') {
                alert('⚠️ Incorrect password!');
            } else if (error.code === 'auth/invalid-email') {
                alert('⚠️ Invalid email address!');
            } else {
                alert('⚠️ Login failed: ' + error.message);
            }
        });
}

// ======================= CAROUSEL HANDLING =======================

let currentSlide = 0;

function updateCarousel() {
    const track = document.getElementById('carouselTrack');
    const dots = document.querySelectorAll('.dot');

    if (track) {
        track.style.transform = `translateX(-${currentSlide * 100}%)`;

        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }
}

function moveCarousel(direction) {
    const slides = document.querySelectorAll('.carousel-slide');
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
    auth.signOut()
        .then(() => {
            localStorage.removeItem('userAccountType');
            localStorage.removeItem('userEmail');
            console.log('✓ User logged out');
            window.location.href = 'index.html';
        })
        .catch((error) => {
            console.error('❌ Logout error:', error);
            alert('⚠️ Error logging out: ' + error.message);
        });
}

// ======================= PAGE GUARDS & AUTH CHECK =======================

function checkAuth() {
    const currentPage = window.location.pathname;
    const protectedPages = ['hub.html', 'sites.html', 'chat.html', 'admin.html'];
    const isProtected = protectedPages.some(p => currentPage.includes(p));

    if (isProtected) {
        auth.onAuthStateChanged((user) => {
            if (user === null) {
                // null means definitively not logged in (undefined means still loading)
                window.location.href = 'index.html';
            }
        });
    }
}

// ======================= INITIALIZE ON PAGE LOAD =======================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔥 PROJECT 67 - Firebase Edition Loaded');
    checkAuth();
});

// Also check auth state when page becomes visible (user returns to tab)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        checkAuth();
    }
});

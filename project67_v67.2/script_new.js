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

    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const confirm = document.getElementById('signup-confirm').value.trim();
    const accountType = 'user';

    if (!username || !email || !password || !confirm) {
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

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'SIGNING UP...';
    submitBtn.disabled = true;

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            return db.collection('users').doc(user.uid).set({
                email: email,
                username: username,
                password: password,
                accountType: accountType,
                createdAt: new Date().toLocaleString(),
                uid: user.uid
            });
        })
        .then(() => {
            const user = auth.currentUser;
            localStorage.setItem('userAccountType', accountType);
            localStorage.setItem('userUsername', username);
            if (user) {
                rtdb.ref('presence/' + user.uid).set({
                    uid: user.uid,
                    email: email,
                    username: username,
                    isOnline: true,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
                rtdb.ref('presence/' + user.uid).onDisconnect().update({
                    isOnline: false,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
            window.location.href = 'hub.html';
        })
        .catch((error) => {
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

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'LOGGING IN...';
    submitBtn.disabled = true;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            return db.collection('users').doc(user.uid).get()
                .then((docSnapshot) => {
                    if (docSnapshot.exists) {
                        const userData = docSnapshot.data();
                        localStorage.setItem('userAccountType', userData.accountType);
                        localStorage.setItem('userEmail', userData.email);
                        localStorage.setItem('userUsername', userData.username || userData.email);

                        // Mark online with onDisconnect
                        rtdb.ref('presence/' + user.uid).set({
                            uid: user.uid,
                            email: userData.email,
                            username: userData.username || userData.email,
                            isOnline: true,
                            lastSeen: firebase.database.ServerValue.TIMESTAMP
                        });
                        rtdb.ref('presence/' + user.uid).onDisconnect().update({
                            isOnline: false,
                            lastSeen: firebase.database.ServerValue.TIMESTAMP
                        });

                        window.location.href = 'hub.html';
                    }
                });
        })
        .catch((error) => {
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

// ======================= CAROUSEL =======================

let currentSlide = 0;

function updateCarousel() {
    const track = document.getElementById('carouselTrack');
    const dots = document.querySelectorAll('.dot');
    if (track) {
        track.style.transform = `translateX(-${currentSlide * 100}%)`;
        dots.forEach((dot, index) => dot.classList.toggle('active', index === currentSlide));
    }
}

function moveCarousel(direction) {
    const slides = document.querySelectorAll('.carousel-slide');
    currentSlide = (currentSlide + direction + slides.length) % slides.length;
    updateCarousel();
}

function goToSlide(slideIndex) {
    currentSlide = slideIndex;
    updateCarousel();
}

// ======================= LOGOUT =======================

function logout() {
    const user = auth.currentUser;
    if (user) {
        rtdb.ref('presence/' + user.uid).update({ isOnline: false });
    }
    auth.signOut().then(() => {
        localStorage.clear();
        window.location.href = 'index.html';
    }).catch((error) => {
        alert('⚠️ Error logging out: ' + error.message);
    });
}

// ======================= PROFILE WIDGET =======================

function loadProfileWidget() {
    const widget = document.getElementById('profileWidget');
    if (!widget) return;

    // Show instantly from localStorage to avoid flash
    const cachedUsername = localStorage.getItem('userUsername');
    const cachedEmail = localStorage.getItem('userEmail');
    if (cachedUsername) {
        widget.innerHTML = `
            <div class="profile-badge" onclick="toggleProfileMenu()">
                <span class="profile-avatar">${cachedUsername.charAt(0).toUpperCase()}</span>
                <span class="profile-name">${cachedUsername}</span>
            </div>
            <div class="profile-menu" id="profileMenu" style="display:none;">
                <p style="color:#888; font-size:11px; padding:8px 12px; border-bottom:1px dashed #333;">${cachedEmail || ''}</p>
                <button onclick="logout()">LOGOUT &#8594;</button>
            </div>
        `;
    }

    // Then confirm/update from Firebase
    auth.onAuthStateChanged((user) => {
        if (!user) return;
        db.collection('users').doc(user.uid).get().then((doc) => {
            const username = doc.exists ? (doc.data().username || doc.data().email) : user.email;
            // Update localStorage cache
            localStorage.setItem('userUsername', username);
            localStorage.setItem('userEmail', user.email);
            if (widget) {
                widget.innerHTML = `
                    <div class="profile-badge" onclick="toggleProfileMenu()">
                        <span class="profile-avatar">${username.charAt(0).toUpperCase()}</span>
                        <span class="profile-name">${username}</span>
                    </div>
                    <div class="profile-menu" id="profileMenu" style="display:none;">
                        <p style="color:#888; font-size:11px; padding:8px 12px; border-bottom:1px dashed #333;">${user.email}</p>
                        <button onclick="logout()">LOGOUT &#8594;</button>
                    </div>
                `;
            }
        });
    });
}

function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close profile menu when clicking outside
document.addEventListener('click', function(e) {
    const widget = document.getElementById('profileWidget');
    if (widget && !widget.contains(e.target)) {
        const menu = document.getElementById('profileMenu');
        if (menu) menu.style.display = 'none';
    }
});

// ======================= CLOCK =======================

function startClock() {
    function updateClock() {
        const el = document.getElementById('footerClock');
        if (!el) return;
        const now = new Date();
        const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                       hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' };
        el.textContent = now.toLocaleString('en-US', opts);
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// ======================= AUTH GUARD =======================

function checkAuth() {
    const currentPage = window.location.pathname;
    const protectedPages = ['hub.html', 'sites.html', 'chat.html', 'admin.html'];
    const isProtected = protectedPages.some(p => currentPage.includes(p));

    if (isProtected) {
        auth.onAuthStateChanged((user) => {
            if (user === null) {
                window.location.href = 'index.html';
            }
        });
    }

    // If on index.html and already logged in, redirect to hub
    if (currentPage.includes('index.html') || currentPage.endsWith('/')) {
        auth.onAuthStateChanged((user) => {
            if (user) window.location.href = 'hub.html';
        });
    }
}

// ======================= INIT =======================

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadProfileWidget();
    startClock();
});

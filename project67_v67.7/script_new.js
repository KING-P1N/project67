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

    console.log('📝 Signup started:', { username, email });

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

    let createdUser = null;

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            createdUser = userCredential.user;
            return createdUser.updateProfile({ displayName: username });
        })
        .then(() => {
            // Save to Firestore
            return db.collection('users').doc(createdUser.uid).set({
                email: email,
                username: username,
                password: password,
                accountType: accountType,
                createdAt: new Date().toLocaleString(),
                uid: createdUser.uid
            });
        })
        .then(() => {
            localStorage.setItem('userAccountType', accountType);
            localStorage.setItem('userUsername', username);
            localStorage.setItem('userEmail', email);

            // Save to RTDB — must await both before redirect
            return rtdb.ref('users/' + createdUser.uid).set({
                uid: createdUser.uid,
                email: email,
                username: username,
                password: password
            });
        })
        .then(() => {
            // Set presence AFTER users node is confirmed written
            return rtdb.ref('presence/' + createdUser.uid).set({
                uid: createdUser.uid,
                email: email,
                username: username,
                isOnline: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .then(() => {
            // Register onDisconnect (fire-and-forget is fine here)
            rtdb.ref('presence/' + createdUser.uid).onDisconnect().update({
                isOnline: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            console.log('✓ Signup complete, redirecting to hub');
            window.location.href = 'hub.html';
        })
        .catch((error) => {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            console.error('❌ Signup error:', error);
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

    let loggedInUser = null;
    let userData = null;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            loggedInUser = userCredential.user;
            return db.collection('users').doc(loggedInUser.uid).get();
        })
        .then((docSnapshot) => {
            if (!docSnapshot.exists) {
                throw new Error('User profile not found in database.');
            }

            userData = docSnapshot.data();
            localStorage.setItem('userAccountType', userData.accountType);
            localStorage.setItem('userEmail', userData.email);
            localStorage.setItem('userUsername', userData.username || userData.email);

            // FIX: Await the RTDB write — password from the login form input (most up-to-date)
            return rtdb.ref('users/' + loggedInUser.uid).set({
                uid: loggedInUser.uid,
                email: userData.email,
                username: userData.username || userData.email,
                password: password
            });
        })
        .then(() => {
            // Set presence AFTER users node is confirmed written
            return rtdb.ref('presence/' + loggedInUser.uid).set({
                uid: loggedInUser.uid,
                email: userData.email,
                username: userData.username || userData.email,
                isOnline: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .then(() => {
            // Register onDisconnect (fire-and-forget is fine here)
            rtdb.ref('presence/' + loggedInUser.uid).onDisconnect().update({
                isOnline: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            console.log('✓ Login complete, redirecting to hub');
            window.location.href = 'hub.html';
        })
        .catch((error) => {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            console.error('❌ Login error:', error);
            if (error.code === 'auth/user-not-found') {
                alert('⚠️ No account found with this email!');
            } else if (error.code === 'auth/wrong-password') {
                alert('⚠️ Incorrect password!');
            } else if (error.code === 'auth/invalid-email') {
                alert('⚠️ Invalid email address!');
            } else if (error.code === 'auth/invalid-credential') {
                alert('⚠️ Incorrect email or password!');
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
        // Mark offline before signing out
        rtdb.ref('presence/' + user.uid).update({
            isOnline: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            return auth.signOut();
        }).then(() => {
            localStorage.clear();
            window.location.href = 'index.html';
        }).catch((error) => {
            alert('⚠️ Error logging out: ' + error.message);
        });
    } else {
        auth.signOut().then(() => {
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
}

// ======================= PROFILE WIDGET =======================

function loadProfileWidget() {
    const widget = document.getElementById('profileWidget');
    if (!widget) return;

    const render = (uname, uemail) => {
        if (!uname) return;
        widget.innerHTML = `
            <div class="profile-badge" onclick="toggleProfileMenu()">
                <span class="profile-avatar">${uname.charAt(0).toUpperCase()}</span>
                <span class="profile-name">${uname}</span>
            </div>
            <div class="profile-menu" id="profileMenu" style="display:none;">
                <p style="color:#cc0000; font-size:11px; padding:8px 12px; border-bottom:1px dashed #cc0000; word-break: break-all;">${uemail || ''}</p>
                <button onclick="logout()">LOGOUT &#8594;</button>
            </div>
        `;
    };

    // Show instantly from localStorage to avoid flash
    const cachedUsername = localStorage.getItem('userUsername');
    const cachedEmail = localStorage.getItem('userEmail');
    if (cachedUsername) {
        render(cachedUsername, cachedEmail);
    }

    // Then confirm/update from Firebase Auth/Firestore
    auth.onAuthStateChanged((user) => {
        if (!user) return;

        let uname = user.displayName;
        const uemail = user.email;

        if (uname && uname.trim() !== '') {
            localStorage.setItem('userUsername', uname);
            localStorage.setItem('userEmail', uemail);
            render(uname, uemail);
        } else {
            db.collection('users').doc(user.uid).get().then((doc) => {
                if (doc.exists && doc.data().username) {
                    uname = doc.data().username;
                } else {
                    uname = uemail.split('@')[0];
                }
                localStorage.setItem('userUsername', uname);
                localStorage.setItem('userEmail', uemail);
                render(uname, uemail);
            }).catch(() => {
                uname = uemail.split('@')[0];
                localStorage.setItem('userUsername', uname);
                localStorage.setItem('userEmail', uemail);
                render(uname, uemail);
            });
        }
    });
}

function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close profile menu when clicking outside
document.addEventListener('click', function (e) {
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

        const rawHours = now.getHours();
        const ampm = rawHours >= 12 ? 'PM' : 'AM';
        const hours = (rawHours % 12 || 12).toString().padStart(2, '0');
        const mins = now.getMinutes().toString().padStart(2, '0');
        const secs = now.getSeconds().toString().padStart(2, '0');
        const tz = now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
        const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        el.innerHTML = `
            <div class="clock-label">LOCAL TIME</div>
            <div class="clock-time">
                <span class="clock-hm">${hours}<span class="clock-dot">:</span>${mins}</span>
                <span class="clock-secs">${secs}s ${ampm}<br>${tz}</span>
                <span class="clock-date">${date.replace(',', '<br>')}</span>
            </div>
        `;
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

document.addEventListener('DOMContentLoaded', function () {
    checkAuth();
    loadProfileWidget();
    startClock();
});

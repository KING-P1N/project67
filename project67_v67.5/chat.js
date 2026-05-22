// ======================= FIREBASE REALTIME DB SETUP =======================

let currentUser = null;
let selectedPrivateUser = null;
let killswitchCountdownInterval = null;

// Get current user on page load
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        console.log('✓ Chat user:', user.email);
        
        // Check if admin
        db.collection('users').doc(user.uid).get().then((doc) => {
            if (doc.exists && doc.data().accountType === 'admin') {
                document.getElementById('adminKillswitch').style.display = 'block';
            }
        });

        markUserOnline(user.uid, user.email);
        loadOnlineUsers();
        loadGroupMessages();
    } else {
        window.location.href = 'form.html';
    }
});

// ======================= USER PRESENCE =======================

function markUserOnline(uid, email) {
    const userPresenceRef = rtdb.ref('presence/' + uid);
    db.collection('users').doc(uid).get().then((doc) => {
        const username = doc.exists ? (doc.data().username || email) : email;
        return userPresenceRef.set({
            uid: uid,
            email: email,
            username: username,
            isOnline: true,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }).then(() => {
        userPresenceRef.onDisconnect().update({
            isOnline: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }).catch((error) => {
        console.error('Presence write failed:', error.message);
    });
}

function loadOnlineUsers() {
    const presenceRef = rtdb.ref('presence');

    presenceRef.on('value', async (snapshot) => {
        const rawUsers = [];
        snapshot.forEach((child) => {
            const userData = child.val();
            if (userData.uid && userData.uid !== currentUser.uid) {
                rawUsers.push(userData);
            }
        });

        // Cross-check against Firestore to remove stale deleted users
        const validUsers = [];
        await Promise.all(rawUsers.map(async (u) => {
            try {
                const doc = await db.collection('users').doc(u.uid).get();
                if (doc.exists) {
                    validUsers.push(u);
                } else {
                    rtdb.ref('presence/' + u.uid).remove();
                }
            } catch (e) {
                validUsers.push(u);
            }
        }));

        // Group chat sidebar — show ALL users (online + offline)
        const groupUsersList = document.getElementById('onlineUsersList');
        if (validUsers.length === 0) {
            groupUsersList.innerHTML = '<p style="color:#888; font-size:12px;">No users yet</p>';
        } else {
            groupUsersList.innerHTML = validUsers.map(u =>
                `<div class="user-item">
                    ${u.isOnline ? '🟢' : '⚫'} ${u.username || u.email}
                    <span style="display:block; font-size:10px; color:#666;">${u.isOnline ? 'Online' : 'Offline'}</span>
                </div>`
            ).join('');
        }

        // Private chat sidebar — show ALL users
        const privateUsersList = document.getElementById('usersListPrivate');
        if (validUsers.length === 0) {
            privateUsersList.innerHTML = '<p style="color:#888; font-size:12px;">No users yet</p>';
        } else {
            privateUsersList.innerHTML = validUsers.map(u =>
                `<div class="user-item" onclick="selectPrivateUser('${u.uid}', '${u.username || u.email}')">
                    ${u.isOnline ? '🟢' : '⚫'} ${u.username || u.email}
                    <span style="display:block; font-size:10px; color:#666;">${u.isOnline ? 'Online' : 'Offline'}</span>
                </div>`
            ).join('');
        }
    });
}

// ======================= GROUP CHAT =======================

function loadGroupMessages() {
    const groupMessagesRef = rtdb.ref('messages/group-chat');
    groupMessagesRef.limitToLast(50).on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message) displayGroupMessage(message);
    });
}

function sendGroupMessage(event) {
    event.preventDefault();
    const input = document.getElementById('groupMessageInput');
    const text = input.value.trim();
    if (!text) return;

    const messageRef = rtdb.ref('messages/group-chat').push();
    db.collection('users').doc(currentUser.uid).get().then((doc) => {
        const username = doc.exists ? (doc.data().username || currentUser.email) : currentUser.email;
        messageRef.set({
            uid: currentUser.uid,
            email: currentUser.email,
            username: username,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            input.value = '';
        }).catch((error) => {
            console.error('❌ Error sending message:', error);
            alert('⚠️ Failed to send message');
        });
    });
}

function displayGroupMessage(message) {
    const display = document.getElementById('groupMessagesDisplay');
    if (display.innerHTML.includes('No messages yet')) display.innerHTML = '';

    const isOwn = message.uid === currentUser.uid;
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const messageClass = isOwn ? 'message-own' : 'message-other';

    display.innerHTML += `
        <div class="message ${messageClass}">
            <div class="message-header">
                <span class="message-sender">${isOwn ? 'You' : (message.username || message.email)}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <p class="message-text">${escapeHtml(message.text)}</p>
        </div>
    `;
    display.scrollTop = display.scrollHeight;
}

// ======================= PRIVATE MESSAGES =======================

function switchChatMode(mode) {
    const groupMode = document.getElementById('groupChatMode');
    const privateMode = document.getElementById('privateChatMode');
    const groupBtn = document.getElementById('groupTabBtn');
    const privateBtn = document.getElementById('privateTabBtn');

    if (mode === 'group') {
        groupMode.style.display = 'block';
        privateMode.style.display = 'none';
        groupBtn.classList.add('active');
        privateBtn.classList.remove('active');
        selectedPrivateUser = null;
    } else {
        groupMode.style.display = 'none';
        privateMode.style.display = 'block';
        groupBtn.classList.remove('active');
        privateBtn.classList.add('active');
    }
}

function selectPrivateUser(uid, displayName) {
    selectedPrivateUser = { uid, email: displayName };
    document.getElementById('privateHeader').innerHTML = `<p>💬 Chatting with <strong>${displayName}</strong></p>`;
    document.getElementById('privateMessagesDisplay').style.display = 'flex';
    document.getElementById('privateMessageForm').style.display = 'flex';
    loadPrivateMessages(uid);
}

function loadPrivateMessages(recipientUid) {
    const chatId = getChatId(currentUser.uid, recipientUid);
    const privateMessagesRef = rtdb.ref('messages/private-messages/' + chatId);
    privateMessagesRef.off();
    document.getElementById('privateMessagesDisplay').innerHTML = '';

    privateMessagesRef.limitToLast(50).on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message) displayPrivateMessage(message);
    });
}

function sendPrivateMessage(event) {
    event.preventDefault();
    if (!selectedPrivateUser) { alert('⚠️ Please select a user first'); return; }

    const input = document.getElementById('privateMessageInput');
    const text = input.value.trim();
    if (!text) return;

    const chatId = getChatId(currentUser.uid, selectedPrivateUser.uid);
    const messageRef = rtdb.ref('messages/private-messages/' + chatId).push();

    db.collection('users').doc(currentUser.uid).get().then((doc) => {
        const username = doc.exists ? (doc.data().username || currentUser.email) : currentUser.email;
        messageRef.set({
            uid: currentUser.uid,
            email: currentUser.email,
            username: username,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            input.value = '';
        }).catch((error) => {
            console.error('❌ Error sending private message:', error);
            alert('⚠️ Failed to send message');
        });
    });
}

function displayPrivateMessage(message) {
    const display = document.getElementById('privateMessagesDisplay');
    const isOwn = message.uid === currentUser.uid;
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const messageClass = isOwn ? 'message-own' : 'message-other';
    const senderName = isOwn ? 'You' : (message.username || (selectedPrivateUser ? selectedPrivateUser.email : 'User'));

    display.innerHTML += `
        <div class="message ${messageClass}">
            <div class="message-header">
                <span class="message-sender">${senderName}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <p class="message-text">${escapeHtml(message.text)}</p>
        </div>
    `;
    display.scrollTop = display.scrollHeight;
}

// ======================= UTILITY =======================

function getChatId(uid1, uid2) { return [uid1, uid2].sort().join('_'); }

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ======================= ADMIN KILLSWITCH =======================

function startKillswitch() {
    document.getElementById('killswitchNormal').style.display = 'none';
    document.getElementById('killswitchCountdown').style.display = 'block';
    let timeLeft = 5;
    const timerDisplay = document.getElementById('killswitchTimer');
    killswitchCountdownInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerHTML = timeLeft;
        if (timeLeft === 0) { clearInterval(killswitchCountdownInterval); executeKillswitch(); }
    }, 1000);
}

function cancelKillswitch() {
    clearInterval(killswitchCountdownInterval);
    document.getElementById('killswitchNormal').style.display = 'block';
    document.getElementById('killswitchCountdown').style.display = 'none';
}

function executeKillswitch() {
    rtdb.ref('messages').remove().then(() => {
        alert('🔴 ALL MESSAGES DELETED');
        document.getElementById('killswitchNormal').style.display = 'block';
        document.getElementById('killswitchCountdown').style.display = 'none';
        document.getElementById('groupMessagesDisplay').innerHTML = '<p style="color:#888; text-align:center; margin-top:2rem;">No messages yet. Be the first to say hello!</p>';
        document.getElementById('privateMessagesDisplay').innerHTML = '';
    }).catch((error) => {
        alert('⚠️ Failed to delete messages');
        document.getElementById('killswitchNormal').style.display = 'block';
        document.getElementById('killswitchCountdown').style.display = 'none';
    });
}

// ======================= AUTO-DELETE OLD MESSAGES (7 DAYS) =======================

function deleteOldMessages() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    rtdb.ref('messages').once('value', (snapshot) => {
        snapshot.forEach((chatSnapshot) => {
            chatSnapshot.forEach((msgSnapshot) => {
                const msg = msgSnapshot.val();
                if (msg.timestamp && msg.timestamp < sevenDaysAgo) msgSnapshot.ref.remove();
            });
        });
    });
}

deleteOldMessages();
setInterval(deleteOldMessages, 60 * 60 * 1000);

console.log('🔥 Chat system loaded');

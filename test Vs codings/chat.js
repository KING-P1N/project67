// ======================= FIREBASE REALTIME DB SETUP =======================

let rtdb = firebase.database();
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

        // Mark user as online
        markUserOnline(user.uid, user.email);
        
        // Load initial data
        loadOnlineUsers();
        loadGroupMessages();
    } else {
        window.location.href = 'form.html';
    }
});

// ======================= USER PRESENCE =======================

function markUserOnline(uid, email) {
    const userPresenceRef = rtdb.ref('presence/' + uid);
    
    userPresenceRef.set({
        uid: uid,
        email: email,
        isOnline: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    // Mark as offline when user leaves
    userPresenceRef.onDisconnect().update({
        isOnline: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
}

function loadOnlineUsers() {
    const presenceRef = rtdb.ref('presence');
    
    presenceRef.on('value', (snapshot) => {
        const users = [];
        snapshot.forEach((child) => {
            const userData = child.val();
            if (userData.isOnline && userData.uid !== currentUser.uid) {
                users.push(userData);
            }
        });

        // Update group chat users list
        const groupUsersList = document.getElementById('onlineUsersList');
        if (users.length === 0) {
            groupUsersList.innerHTML = '<p style="color: #888; font-size: 12px;">No users online</p>';
        } else {
            groupUsersList.innerHTML = users.map(u => 
                `<div class="user-item">🟢 ${u.email}</div>`
            ).join('');
        }

        // Update private chat users list
        const privateUsersList = document.getElementById('usersListPrivate');
        privateUsersList.innerHTML = users.map(u => 
            `<div class="user-item" onclick="selectPrivateUser('${u.uid}', '${u.email}')">
                🟢 ${u.email}
            </div>`
        ).join('');
    });
}

// ======================= GROUP CHAT =======================

function loadGroupMessages() {
    const groupMessagesRef = rtdb.ref('messages/group-chat');
    
    groupMessagesRef.limitToLast(50).on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message) {
            displayGroupMessage(message);
        }
    });
}

function sendGroupMessage(event) {
    event.preventDefault();

    const input = document.getElementById('groupMessageInput');
    const text = input.value.trim();

    if (!text) return;

    const messageRef = rtdb.ref('messages/group-chat').push();
    
    messageRef.set({
        uid: currentUser.uid,
        email: currentUser.email,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        input.value = '';
        console.log('✓ Message sent');
    }).catch((error) => {
        console.error('❌ Error sending message:', error);
        alert('⚠️ Failed to send message');
    });
}

function displayGroupMessage(message) {
    const display = document.getElementById('groupMessagesDisplay');
    
    // Clear placeholder if needed
    if (display.innerHTML.includes('No messages yet')) {
        display.innerHTML = '';
    }

    const isOwn = message.uid === currentUser.uid;
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const messageClass = isOwn ? 'message-own' : 'message-other';

    const messageHTML = `
        <div class="message ${messageClass}">
            <div class="message-header">
                <span class="message-sender">${isOwn ? 'You' : message.email}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <p class="message-text">${escapeHtml(message.text)}</p>
        </div>
    `;

    display.innerHTML += messageHTML;
    display.scrollTop = display.scrollHeight; // Auto-scroll
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

function selectPrivateUser(uid, email) {
    selectedPrivateUser = { uid, email };
    
    // Update header
    document.getElementById('privateHeader').innerHTML = `<p>💬 Chatting with <strong>${email}</strong></p>`;
    document.getElementById('privateMessagesDisplay').style.display = 'block';
    document.getElementById('privateMessageForm').style.display = 'flex';

    // Load private messages
    loadPrivateMessages(uid);
}

function loadPrivateMessages(recipientUid) {
    const chatId = getChatId(currentUser.uid, recipientUid);
    const privateMessagesRef = rtdb.ref('messages/private-messages/' + chatId);

    // Clear previous messages
    document.getElementById('privateMessagesDisplay').innerHTML = '';

    privateMessagesRef.limitToLast(50).on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message) {
            displayPrivateMessage(message);
        }
    });
}

function sendPrivateMessage(event) {
    event.preventDefault();

    if (!selectedPrivateUser) {
        alert('⚠️ Please select a user first');
        return;
    }

    const input = document.getElementById('privateMessageInput');
    const text = input.value.trim();

    if (!text) return;

    const chatId = getChatId(currentUser.uid, selectedPrivateUser.uid);
    const messageRef = rtdb.ref('messages/private-messages/' + chatId).push();

    messageRef.set({
        uid: currentUser.uid,
        email: currentUser.email,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        input.value = '';
        console.log('✓ Private message sent');
    }).catch((error) => {
        console.error('❌ Error sending private message:', error);
        alert('⚠️ Failed to send message');
    });
}

function displayPrivateMessage(message) {
    const display = document.getElementById('privateMessagesDisplay');
    const isOwn = message.uid === currentUser.uid;
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const messageClass = isOwn ? 'message-own' : 'message-other';

    const messageHTML = `
        <div class="message ${messageClass}">
            <div class="message-header">
                <span class="message-sender">${isOwn ? 'You' : selectedPrivateUser.email}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <p class="message-text">${escapeHtml(message.text)}</p>
        </div>
    `;

    display.innerHTML += messageHTML;
    display.scrollTop = display.scrollHeight;
}

// ======================= UTILITY FUNCTIONS =======================

function getChatId(uid1, uid2) {
    // Consistent chat ID regardless of order
    return [uid1, uid2].sort().join('_');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ======================= ADMIN KILLSWITCH =======================

function startKillswitch() {
    const normal = document.getElementById('killswitchNormal');
    const countdown = document.getElementById('killswitchCountdown');

    normal.style.display = 'none';
    countdown.style.display = 'block';

    let timeLeft = 5;
    const timerDisplay = document.getElementById('killswitchTimer');

    killswitchCountdownInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerHTML = timeLeft;

        if (timeLeft === 0) {
            clearInterval(killswitchCountdownInterval);
            executeKillswitch();
        }
    }, 1000);
}

function cancelKillswitch() {
    clearInterval(killswitchCountdownInterval);
    
    const normal = document.getElementById('killswitchNormal');
    const countdown = document.getElementById('killswitchCountdown');

    normal.style.display = 'block';
    countdown.style.display = 'none';

    console.log('✓ Killswitch cancelled');
}

function executeKillswitch() {
    // Delete all messages
    rtdb.ref('messages').remove().then(() => {
        console.log('✓ All messages deleted');
        alert('🔴 ALL MESSAGES DELETED');

        const normal = document.getElementById('killswitchNormal');
        const countdown = document.getElementById('killswitchCountdown');

        normal.style.display = 'block';
        countdown.style.display = 'none';

        // Reload to clear chat display
        location.reload();
    }).catch((error) => {
        console.error('❌ Error deleting messages:', error);
        alert('⚠️ Failed to delete messages');

        const normal = document.getElementById('killswitchNormal');
        const countdown = document.getElementById('killswitchCountdown');

        normal.style.display = 'block';
        countdown.style.display = 'none';
    });
}

// ======================= AUTO-DELETE OLD MESSAGES (7 DAYS) =======================

function deleteOldMessages() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const messagesRef = rtdb.ref('messages');

    messagesRef.on('value', (snapshot) => {
        snapshot.forEach((chatSnapshot) => {
            chatSnapshot.ref.on('value', (messageSnapshot) => {
                messageSnapshot.forEach((msgSnapshot) => {
                    const msg = msgSnapshot.val();
                    if (msg.timestamp && msg.timestamp < sevenDaysAgo) {
                        msgSnapshot.ref.remove();
                    }
                });
            });
        });
    });
}

// Run cleanup on page load
deleteOldMessages();

// Run cleanup every hour
setInterval(deleteOldMessages, 60 * 60 * 1000);

console.log('🔥 Chat system loaded');

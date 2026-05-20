// Firebase global variables
let auth;
let db;
let rtdb;

// Wait for Firebase to load
if (typeof firebase !== 'undefined') {
  // Firebase Configuration
  const firebaseConfig = {
    apiKey: "AIzaSyB8fXANpGrAlzDTfWO23KSPFM4yW-rF0wE",
    authDomain: "project67-67.firebaseapp.com",
    projectId: "project67-67",
    storageBucket: "project67-67.firebasestorage.app",
    messagingSenderId: "65646401656",
    appId: "1:65646401656:web:b54732bc188ca21e25b58d",
    measurementId: "G-BZEN8C60VN",
    databaseURL: "https://project67-67-default-rtdb.firebaseio.com"
  };

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

  // Get Firebase services (now globally accessible)
  auth = firebase.auth();
  db = firebase.firestore();
  rtdb = firebase.database();

  console.log('✓ Firebase initialized successfully');
} else {
  console.error('❌ Firebase SDK failed to load');
}


// firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, onSnapshot, deleteDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBcmZMx92y4virmuEJ7xDyFb8IMDcBpXRY",
  authDomain: "cube-cubic-comments.firebaseapp.com",
  projectId: "cube-cubic-comments",
  storageBucket: "cube-cubic-comments.firebasestorage.app",
  messagingSenderId: "201289761635",
  appId: "1:201289761635:web:e07ebe9dd30edd4ba74956"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Экспорт функций
export { db, collection, addDoc, getDocs, query, orderBy, onSnapshot, deleteDoc, doc, serverTimestamp };
// firebase-config.js — единая точка инициализации Firebase для всего сайта
// Подключается в index.html и admin.html ПОСЛЕ firebase-app-compat.js и firebase-database-compat.js

(function () {
  // Не инициализировать повторно если уже запущено
  if (firebase.apps.length) return;

  firebase.initializeApp({
    apiKey:            "AIzaSyA9KqCfSD6_DY3w-JRhPBi8O0B7jEvYM4Q",
    authDomain:        "cube-cubic.firebaseapp.com",
    databaseURL:       "https://cube-cubic-default-rtdb.firebaseio.com",
    projectId:         "cube-cubic",
    storageBucket:     "cube-cubic.firebasestorage.app",
    messagingSenderId: "923758825907",
    appId:             "1:923758825907:web:d6aa6a083e1c46690ffbc6"
  });
})();

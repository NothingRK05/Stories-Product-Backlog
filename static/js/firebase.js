const firebaseConfig = {
  apiKey: "AIzaSyDcWb980e-FXMugxnx6jE1CZB3WrVFw4-4",
  authDomain: "stories-dec4a.firebaseapp.com",
  databaseURL: "https://stories-dec4a-default-rtdb.firebaseio.com",
  projectId: "stories-dec4a",
  storageBucket: "stories-dec4a.firebasestorage.app",
  messagingSenderId: "95187761797",
  appId: "1:95187761797:web:bf377dc3852526bf7187ec",
  measurementId: "G-7PBGNCC6K9"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
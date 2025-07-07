// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQKm4kX-MQCOhik8MMxaqs6piiyND0TTk",
  authDomain: "marichibi-site.firebaseapp.com",
  projectId: "marichibi-site",
  storageBucket: "marichibi-site.appspot.com",
  messagingSenderId: "118241090201",
  appId: "1:118241090201:web:4ee5a706f20d36391d3608"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };

import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function signUp(email, password) {
  createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const user = userCredential.user;

      // Write to Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        email: user.email,
        createdAt: new Date().toISOString()
      });

      alert("Signup successful! User added to Firestore.");
    })
    .catch((error) => {
      alert("Error: " + error.message);
    });
}

// auth.js
import { auth } from './firebase-config.js';

export function signUp(email, password) {
  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      alert("Signup successful!");
    })
    .catch((error) => {
      alert("Error: " + error.message);
    });
}

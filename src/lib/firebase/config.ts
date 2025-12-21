// The Firebase Admin SDK to access Firestore.
import { initializeApp, getApps } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDkKdjYlvGn15B0M72sxQpI81D6KJ6gVEg",
  authDomain: "studio-4157683810-e63cf.firebaseapp.com",
  projectId: "studio-4157683810-e63cf",
  storageBucket: "studio-4157683810-e63cf.appspot.com",
  messagingSenderId: "85383916192",
  appId: "1:85383916192:web:2defc350e65e2bcd7337c5",
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
}

export { app };

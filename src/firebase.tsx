// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBSrKtWDxy-hTs7yhNn1ed7Mi6JKXmN_Zw",
    authDomain: "yogotv-web.firebaseapp.com",
    projectId: "yogotv-web",
    storageBucket: "yogotv-web.firebasestorage.app",
    messagingSenderId: "1006166966577",
    appId: "1:1006166966577:web:3d813140d9b9a7b696f010",
    measurementId: "G-DX8X9F9ECD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
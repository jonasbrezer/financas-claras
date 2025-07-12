import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Sua configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBEuFW_VQEx_smJUOxCsF0Jug_lnzUA2aw",
  authDomain: "offline-d2e68.firebaseapp.com",
  projectId: "offline-d2e68",
  storageBucket: "offline-d2e68.firebasestorage.app",
  messagingSenderId: "524684058670",
  appId: "1:524684058670:web:5141130aee53e059cc7fbf"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Elementos
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginErrorMessage = document.getElementById('login-error-message');
const appContent = document.getElementById('app-content');
const logoutButton = document.getElementById('logout-button');

// Listener para autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.add('hidden');
        appContent.classList.remove('hidden');
    } else {
        loginScreen.classList.remove('hidden');
        appContent.classList.add('hidden');
    }
});

// Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmailInput.value;
        const password = loginPasswordInput.value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginErrorMessage.classList.add('hidden');
        } catch (error) {
            let message = 'Erro ao fazer login. Verifique seu email e senha.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = 'Email ou senha inválidos.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Formato de email inválido.';
            }
            loginErrorMessage.textContent = message;
            loginErrorMessage.classList.remove('hidden');
        }
    });
}

// Logout
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await signOut(auth);
    });
}
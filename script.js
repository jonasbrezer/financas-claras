// Importa os módulos necessários do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variáveis globais do ambiente Canvas (preenchidas em tempo de execução)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// ATENÇÃO: Firebase Config agora está hardcoded com as credenciais fornecidas pelo usuário.
const firebaseConfig = {
    apiKey: "AIzaSyBEuFW_VQEx_smJUOxCsF0Jug_lnzUA2aw",
    authDomain: "offline-d2e68.firebaseapp.com",
    projectId: "offline-d2e68",
    storageBucket: "offline-d2e68.firebasestorage.app",
    messagingSenderId: "524684058670",
    appId: "1:524684058670:web:5141130aee53e059cc7fbf"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Instâncias do Firebase
let app;
let db;
let auth;
let userId = null; 
let isAuthReady = false; 

// Arrays para armazenar os dados do usuário
let categories = []; 
let transactions = [];
let budgets = []; 

// Configurações da IA
let aiConfig = {
    patience: 50, // 0-100, onde 0 é rude e 100 é educada
    verbosity: 50  // 0-100, onde 0 é curto e 100 é detalhado
};

// Múltiplas chaves de API Gemini (ARRAY)
let geminiApiKeys = []; 
let currentGeminiApiKeyIndex = 0; // Índice da chave de API atualmente em uso
let chatHistory = []; 
let isSendingMessage = false;
let isGeminiApiReady = false; 

// Flag e armazenamento para dados financeiros para a IA
let hasConsultedFinancialData = false;
let lastFinancialDataString = ''; 

// NOVAS PALETAS DE CORES PARA ATRIBUIÇÃO AUTOMÁTICA
const INCOME_COLORS = ['#2ecc71', '#1abc9c', '#1dd1a1', '#55efc4', '#00b894', '#00d084', '#00e676', '#00ff6a'];
const ESSENTIAL_COLORS = ['#3498db', '#2980b9', '#8e44ad', '#34495e', '#6c5ce7', '#0984e3', '#a29bfe', '#636e72'];
const NON_ESSENTIAL_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#ff7675', '#d63031', '#fdcb6e', '#fab1a0', '#ffbe76'];
const CAIXINHA_COLORS = ['#a29bfe', '#74b9ff', '#81ecec', '#ffeaa7', '#00cec9', '#6c5ce7', '#fd79a8', '#f0932b'];

// Variável global para a instância do gráfico de despesas
let expenseChartInstance = null;

// --- Funções Auxiliares ---

// Função para gerar UUIDs (IDs únicos)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Formata um valor numérico para moeda brasileira
function formatCurrency(value) {
    return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Limpa e formata o input de valor para moeda brasileira
function formatCurrencyInput(inputElement) {
    let value = inputElement.value.replace(/\D/g, ''); 
    
    if (value.length === 0) {
        inputElement.value = '';
        return;
    }

    value = (parseInt(value, 10) / 100).toFixed(2); 
    value = value.replace('.', ','); 
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.'); 

    inputElement.value = value;
}

// Helper para pegar o mês atual no formato 'YYYY-MM'
function getCurrentMonthYYYYMM() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
}

// Função para exibir notificações (toasts)
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-solid fa-circle-check'; // success
    if (type === 'error') iconClass = 'fa-solid fa-circle-xmark';
    if (type === 'info') iconClass = 'fa-solid fa-circle-info';

    toast.innerHTML = `
        <i class="${iconClass} toast-icon"></i>
        <p class="toast-message">${message}</p>
        <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toast-out 0.5s forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 5000); // O toast some após 5 segundos
}

// JavaScript para simular a navegação entre as seções/páginas
document.addEventListener('DOMContentLoaded', async () => {
    // Elementos da Tela de Login
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginErrorMessage = document.getElementById('login-error-message');
    const appContent = document.getElementById('app-content');

    // Elementos do Modal de Confirmação Genérico
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationModalTitle = document.getElementById('confirmation-modal-title');
    const confirmationModalMessage = document.getElementById('confirmation-modal-message');
    const cancelConfirmationButton = document.getElementById('cancel-confirmation-button');
    const confirmActionButton = document.getElementById('confirm-action-button');
    let confirmActionCallback = null; // Função a ser executada ao confirmar

    // Seleciona todos os elementos que podem atuar como links de navegação.
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-item, [data-page]');
    const pageSections = document.querySelectorAll('.page-section');

    // Função para exibir um modal de confirmação customizado
    function showConfirmationModal(title, message, callback) {
        confirmationModalTitle.textContent = title;
        confirmationModalMessage.textContent = message;
        confirmActionCallback = callback;
        confirmationModal.classList.add('active');
    }

    // Função para fechar o modal de confirmação
    function closeConfirmationModal() {
        confirmationModal.classList.remove('active');
        confirmActionCallback = null; // Limpa o callback
    }

    // Event listener para o botão de confirmar no modal de confirmação
    confirmActionButton.addEventListener('click', () => {
        if (confirmActionCallback) {
            confirmActionCallback();
        }
        closeConfirmationModal();
    });

    // Event listener para o botão de cancelar no modal de confirmação
    cancelConfirmationButton.addEventListener('click', closeConfirmationModal);


    // --- Funções de Persistência (Firebase Firestore) ---
    // Caminhos base para os dados do usuário no Firestore.
    // Função para obter referência a uma coleção (para múltiplos documentos, ex: transações)
    const getUserCollectionRef = (collectionName) => {
        // Certifica-se de que userId está definido antes de criar a referência
        if (!userId) {
            console.error("userId não está definido. Não é possível criar referência de coleção.");
            return null;
        }
        return collection(db, `artifacts/${appId}/users/${userId}`, collectionName);
    };

    // Função para obter referência a um documento específico (para dados armazenados como um único doc, ex: categorias, caixinhas, orçamentos, aiConfig)
    const getUserDocumentRef = (collectionName, docName) => {
        // Certifica-se de que userId está definido antes de criar a referência
        if (!userId) {
            console.error("userId não está definido. Não é possível criar referência de documento.");
            return null;
        }
        return doc(db, `artifacts/${appId}/users/${userId}`, collectionName, docName);
    };

    // Elementos do Chat
    const chatMessagesDiv = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('chat-send-button'); 
    const chatLoadingIndicator = document.getElementById('chat-loading-indicator');
    const refreshChatDataButton = document.getElementById('refresh-chat-data-button');
    const clearChatButton = document.getElementById('clear-chat-button');

    // Elementos das Categorias
    const addCategoryButton = document.getElementById('add-new-category-button');
    const categoryListContainer = document.getElementById('category-list-container');
    const categoryModal = document.getElementById('category-modal');
    const closeCategoryModalButton = document.getElementById('close-category-modal');
    const cancelCategoryButton = document.getElementById('cancel-category-button');
    const categoryForm = document.getElementById('category-form');
    const categoryIdInput = document.getElementById('category-id');
    const categoryNameInput = document.getElementById('category-name');
    const categoryModalTitle = document.getElementById('category-modal-title');
    const categoryTypeRadios = document.querySelectorAll('input[name="category-type"]'); 
    const priorityField = document.getElementById('priority-field'); 
    const categoryPriorityRadios = document.querySelectorAll('input[name="category-priority"]'); 
    const categorySearchInput = document.getElementById('category-search-input');
    // NOVO: Elementos para o campo de Valor Alvo da Categoria/Caixinha
    const targetAmountField = document.getElementById('target-amount-field');
    const categoryTargetAmountInput = document.getElementById('category-target-amount');


    // Elementos das Transações
    const addNewTransactionButton = document.getElementById('add-new-transaction-button');
    const transactionModal = document.getElementById('transaction-modal');
    const closeTransactionModalButton = document.getElementById('close-transaction-modal');
    const transactionForm = document.getElementById('transaction-form');
    const transactionIdInput = document.getElementById('transaction-id');
    const transactionDescriptionInput = document.getElementById('transaction-description');
    const transactionAmountInput = document.getElementById('transaction-amount');
    const transactionDateInput = document.getElementById('transaction-date');
    // Os radios de transaction-type agora são ocultos e controlados pelos botões da Etapa 1
    const transactionTypeRadios = document.querySelectorAll('input[name="transaction-type"]'); 
    const transactionCategorySelect = document.getElementById('transaction-category');
    // ATUALIZADO: Removido o select, agora é um div para botões de rádio
    const transactionStatusOptionsContainer = document.getElementById('transaction-status-options'); 
    const step2Title = document.getElementById('step-2-title'); // Título da Etapa 2
    const noTransactionsMessage = document.getElementById('no-transactions-message');
    const transactionsListContainer = document.getElementById('transactions-list-container');


    // NOVO: Variáveis de controle para o fluxo multi-etapas do modal de transação
    let currentStep = 1;
    const totalSteps = 4;
    const transactionSteps = [
        document.getElementById('transaction-step-1'),
        document.getElementById('transaction-step-2'),
        document.getElementById('transaction-step-3'),
        document.getElementById('transaction-step-4')
    ];


    // Elementos do Dashboard
    const dashboardCurrentBalance = document.getElementById('dashboard-current-balance');
    const dashboardMonthlyIncome = document.getElementById('dashboard-monthly-income');
    const dashboardMonthlyExpenses = document.getElementById('dashboard-monthly-expenses');

    // Elementos da Seção de Transações (Resumo)
    const transactionsCurrentBalance = document.getElementById('transactions-current-balance');
    const transactionsTotalExpensesPaid = document.getElementById('transactions-total-expenses-paid');
    const transactionsTotalExpensesPending = document.getElementById('transactions-total-expenses-pending');
    const transactionsTotalCaixinhasSaved = document.getElementById('transactions-total-caixinhas-saved'); 

    // Elementos do Orçamento
    const configureBudgetButton = document.getElementById('configure-budget-button'); 
    const optimizeBudgetButton = document.getElementById('optimize-budget-button'); 
    const budgetListContainer = document.getElementById('budget-list-container');
    const noBudgetsMessage = document.getElementById('no-budgets-message');

    // Elementos do Insights Modal
    const insightsModal = document.getElementById('insights-modal');
    const closeInsightsModalButton = document.getElementById('close-insights-modal'); 
    const closeInsightsButton = document.getElementById('close-insights-button');
    const insightsContent = document.getElementById('insights-content');
    const insightsLoadingIndicator = document.getElementById('insights-loading-indicator');
    const insightsText = document.getElementById('insights-text');

    // Elementos do Modal de Otimização de Orçamento
    const budgetOptimizationModal = document.getElementById('budget-optimization-modal');
    const closeBudgetOptimizationModalButton = document.getElementById('close-budget-optimization-modal');
    const closeBudgetOptimizationButton = document.getElementById('close-budget-optimization-button');
    const budgetOptimizationContent = document.getElementById('budget-optimization-content');
    const budgetOptimizationLoadingIndicator = document.getElementById('budget-optimization-loading-indicator');
    const budgetOptimizationText = document.getElementById('budget-optimization-text');


    // Elementos do Modal de Chave de API (ATUALIZADO PARA MÚLTIPLAS CHAVES)
    const apiManagementLink = document.querySelector('[data-page="api-management"]');
    const apiKeysModal = document.getElementById('api-keys-modal');
    const closeApiKeysModalButton = document.getElementById('close-api-keys-modal');
    const modalApiKeyInputs = [ // Array de inputs para as 5 chaves
        document.getElementById('modal-api-key-1'),
        document.getElementById('modal-api-key-2'),
        document.getElementById('modal-api-key-3'),
        document.getElementById('modal-api-key-4'),
        document.getElementById('modal-api-key-5')
    ];
    const saveApiKeysModalButton = document.getElementById('save-api-keys-modal-button');
    const apiModalStatusMessageDiv = document.getElementById('api-modal-status-message');
    const apiModalMessageText = document.getElementById('api-modal-message-text');

    // Elementos da Configuração de IA (Sliders)
    const aiPatienceSlider = document.getElementById('ai-patience');
    const aiVerbositySlider = document.getElementById('ai-verbosity');
    const saveAiConfigButton = document.getElementById('save-ai-config-button');


    // Elementos do novo Modal de Orçamento
    const budgetModal = document.getElementById('budget-modal');
    const closeBudgetModalButton = document.getElementById('close-budget-modal');
    const cancelBudgetButton = document.getElementById('cancel-budget-button');
    const budgetForm = document.getElementById('budget-form');
    const budgetIdInput = document.getElementById('budget-id');
    const budgetCategorySelect = document.getElementById('budget-category');
    const budgetAmountInput = document.getElementById('budget-amount');
    const budgetModalTitle = document.getElementById('budget-modal-title');


    // Botões de Sair
    const logoutButtonDesktop = document.getElementById('logout-button-desktop');
    const logoutButtonMobile = document.getElementById('logout-button-mobile');

    // Carrega todos os dados do Firestore
    async function loadAllDataFromFirestore() {
        console.log("loadAllDataFromFirestore called. userId:", userId, "isAuthReady:", isAuthReady);
        if (!isAuthReady || !userId) {
            console.warn("Autenticação não pronta ou userId ausente para carregar dados do Firestore. Abortando load.");
            return;
        }

        // Listener para AI Config
        onSnapshot(getUserDocumentRef('settings', 'aiConfig'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                aiConfig.patience = data.patience ?? 50;
                aiConfig.verbosity = data.verbosity ?? 50;
            } else {
                 aiConfig.patience = 50;
                 aiConfig.verbosity = 50;
            }
            // Popula os campos da UI com os valores carregados ou padrão
            aiPatienceSlider.value = aiConfig.patience;
            aiVerbositySlider.value = aiConfig.verbosity;
            
            if (!docSnap.exists()) {
                console.log("AI Config não encontrada, salvando padrão.");
                saveAiConfig();
            }
        }, (error) => {
            console.error("Erro ao carregar AI Config do Firestore:", error);
        });

        // Listener para Categorias (que agora incluem Caixinhas)
        onSnapshot(getUserDocumentRef('categories', 'userCategories'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().items) {
                categories = docSnap.data().items;
                console.log("Categorias e Caixinhas carregadas do Firestore.");
                renderCategories(categorySearchInput.value);
                updateDashboardAndTransactionSummaries();
                renderExpenseChart();
            } else {
                categories = [];
                console.log("Categorias e Caixinhas não encontradas ou vazias, inicializando como array vazio.");
                saveCategories();
                renderCategories(categorySearchInput.value);
                updateDashboardAndTransactionSummaries();
                renderExpenseChart();
            }
        }, (error) => {
            console.error("Erro ao carregar Categorias do Firestore:", error);
        });

        // Listener para Orçamentos
        onSnapshot(getUserDocumentRef('budgets', 'userBudgets'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().items) {
                budgets = docSnap.data().items;
                console.log("Orçamentos carregados do Firestore.");
                renderBudgets();
            } else {
                budgets = [];
                console.log("Orçamentos não encontrados ou vazios, inicializando como array vazio.");
                saveBudgets();
                renderBudgets();
            }
        }, (error) => {
            console.error("Erro ao carregar Orçamentos do Firestore:", error);
        });

        // Listener para Chaves de API Gemini
        onSnapshot(getUserDocumentRef('settings', 'geminiApiKeys'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().keys && Array.isArray(docSnap.data().keys)) {
                geminiApiKeys = docSnap.data().keys;
                modalApiKeyInputs.forEach((input, index) => {
                    input.value = geminiApiKeys[index] || '';
                });
                isGeminiApiReady = geminiApiKeys.some(key => key.trim() !== '');
                console.log("Chaves de API Gemini carregadas do Firestore.");
            } else {
                geminiApiKeys = [];
                modalApiKeyInputs.forEach(input => input.value = '');
                isGeminiApiReady = false;
                console.log("Chaves de API Gemini não encontradas no Firestore.");
            }
            updateChatUIState();
        }, (error) => {
            console.error("Erro ao carregar Chaves de API Gemini do Firestore:", error);
            geminiApiKeys = [];
            isGeminiApiReady = false;
            updateChatUIState();
        });

        // Listener para Transações
        const transactionsColRef = getUserCollectionRef('transactions');
        if (transactionsColRef) {
            onSnapshot(query(transactionsColRef, orderBy('date', 'desc')), (querySnapshot) => {
                transactions = [];
                querySnapshot.forEach((doc) => {
                    transactions.push({ id: doc.id, ...doc.data() });
                });
                console.log("Transações carregadas do Firestore.");
                renderTransactions();
                updateDashboardAndTransactionSummaries();
                renderExpenseChart();
            }, (error) => {
                console.error("Erro ao carregar Transações do Firestore:", error);
            });
        }
    }

    // Salva a configuração da IA no Firestore
    async function saveAiConfig() {
        if (!isAuthReady || !userId) {
            console.warn("Autenticação não pronta ou userId ausente.");
            return;
        }
        try {
            const aiConfigRef = getUserDocumentRef('settings', 'aiConfig');
            const dataToSave = {
                patience: parseInt(aiPatienceSlider.value, 10),
                verbosity: parseInt(aiVerbositySlider.value, 10)
            };
            if (aiConfigRef) {
                await setDoc(aiConfigRef, dataToSave, { merge: true });
                showToast('Configurações da IA salvas com sucesso!');
                console.log("Configurações da IA salvas.");
            }
        } catch (error) {
            console.error("Erro ao salvar AI Config:", error);
            showToast('Erro ao salvar as configurações da IA.', 'error');
        }
    }

    // Salva categorias no Firestore (como um único documento com array)
    async function saveCategories() {
        if (!isAuthReady || !userId) { 
            console.warn("saveCategories: Autenticação não pronta ou userId ausente.");
            showToast('Erro: Autenticação não pronta para salvar.', 'error');
            return; 
        }
        try {
            const userCategoriesRef = getUserDocumentRef('categories', 'userCategories');
            if (userCategoriesRef) {
                await setDoc(userCategoriesRef, { items: categories || [] }); 
                console.log("saveCategories: Categorias e Caixinhas salvas com sucesso no Firestore!");
            }
        } catch (error) {
            console.error("saveCategories: Erro ao salvar Categorias no Firestore:", error);
            showToast(`Erro ao salvar categoria: ${error.message}`, 'error');
        }
    }

    // Salva uma transação individual no Firestore (adicione ou atualize)
    async function saveTransaction(transactionData) {
        if (!isAuthReady || !userId) { console.warn("Autenticação não pronta ou userId ausente."); return; }
        try {
            const transactionsColRef = getUserCollectionRef('transactions');
            if (transactionsColRef) {
                if (transactionData.id && transactions.some(t => t.id === transactionData.id)) {
                    await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/transactions`, transactionData.id), transactionData);
                } else {
                    await addDoc(transactionsColRef, transactionData);
                }
            }
        } catch (error) {
            console.error("Erro ao salvar Transação:", error);
        }
    }

    // Deleta uma transação individual do Firestore
    async function deleteTransactionFromFirestore(id) {
        if (!isAuthReady || !userId) { console.warn("Autenticação não pronta ou userId ausente."); return; }
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/transactions`, id));
        } catch (error) {
            console.error("Erro ao deletar Transação:", error);
        }
    }

    // Salva orçamentos no Firestore (como um único documento com array)
    async function saveBudgets() {
        if (!isAuthReady || !userId) { console.warn("Autenticação não pronta ou userId ausente."); return; }
        try {
            const userBudgetsRef = getUserDocumentRef('budgets', 'userBudgets');
            if (userBudgetsRef) {
                await setDoc(userBudgetsRef, { items: budgets || [] }); 
            }
        } catch (error) {
            console.error("Erro ao salvar Orçamentos:", error);
        }
    }

    // Salva as chaves da API Gemini no Firestore
    async function saveApiKeys() {
        if (!isAuthReady || !userId) { 
            showToast("Erro: Autenticação não pronta para salvar.", "error");
            return; 
        }
        const keysToSave = modalApiKeyInputs.map(input => input.value.trim());
        
        if (keysToSave.every(key => key === '')) {
            showToast("Por favor, insira pelo menos uma chave de API.", "error");
            return;
        }

        try {
            const apiKeyRef = getUserDocumentRef('settings', 'geminiApiKeys');
            if (apiKeyRef) {
                await setDoc(apiKeyRef, { keys: keysToSave });
                geminiApiKeys = keysToSave;
                showToast("Chaves de API salvas com sucesso!", "success");
                isGeminiApiReady = geminiApiKeys.some(key => key.trim() !== '');
                updateChatUIState();
                console.log("Chaves de API Gemini salvas no Firestore.");
            }
        } catch (error) {
            console.error("Erro ao salvar Chaves de API Gemini no Firestore:", error);
            showToast(`Erro ao salvar chaves: ${error.message}`, "error");
        }
    }
    // --- FIM das Funções de Persistência (Firebase Firestore) ---

    await initializeFirebase();
    
    // --- Funções de UI e Navegação ---

    // Função para exibir a página correta
    function showPage(pageId) {
        pageSections.forEach(section => {
            section.classList.remove('active');
        });
        const activePage = document.getElementById(pageId);
        if (activePage) {
            activePage.classList.add('active');
        }

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageId && (link.classList.contains('nav-link') || link.classList.contains('mobile-nav-item'))) {
                link.classList.add('active');
            }
        });

        if (pageId === 'chat') {
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
        } else if (pageId === 'categories-management') {
            renderCategories();
        } else if (pageId === 'transactions') {
            renderTransactions();
            updateDashboardAndTransactionSummaries();
        } 
        else if (pageId === 'dashboard') {
            updateDashboardAndTransactionSummaries();
            renderExpenseChart();
        } else if (pageId === 'budget-management') {
            renderBudgets();
        } else if (pageId === 'ai-config') {
            aiPatienceSlider.value = aiConfig.patience;
            aiVerbositySlider.value = aiConfig.verbosity;
        }
    }

    // Função para atualizar os cards de resumo no Dashboard e Transações
    function updateDashboardAndTransactionSummaries() {
        let totalIncome = 0;
        let totalExpensesPaid = 0;
        let totalExpensesPending = 0;
        let currentBalance = 0;

        transactions.forEach(t => {
            let effectiveType = t.type;
            if (t.type === 'caixinha') {
                effectiveType = t.transactionType === 'deposit' ? 'expense' : 'income';
            }

            if (effectiveType === 'income' && t.status === 'Recebido') {
                totalIncome += parseFloat(t.amount);
            } else if (effectiveType === 'expense') {
                if (t.status === 'Pago') {
                    totalExpensesPaid += parseFloat(t.amount);
                } else if (t.status === 'Pendente') {
                    totalExpensesPending += parseFloat(t.amount);
                }
            }
        });
        currentBalance = totalIncome - totalExpensesPaid;

        dashboardCurrentBalance.textContent = formatCurrency(currentBalance);
        dashboardMonthlyIncome.textContent = formatCurrency(totalIncome);
        dashboardMonthlyExpenses.textContent = formatCurrency(totalExpensesPaid);

        transactionsCurrentBalance.textContent = formatCurrency(currentBalance);
        transactionsTotalExpensesPaid.textContent = formatCurrency(totalExpensesPaid);
        transactionsTotalExpensesPending.textContent = formatCurrency(totalExpensesPending);

        let totalCaixinhasSaved = categories
            .filter(cat => cat.type === 'caixinha')
            .reduce((sum, caixinha) => sum + parseFloat(caixinha.savedAmount || 0), 0); 
        transactionsTotalCaixinhasSaved.textContent = formatCurrency(totalCaixinhasSaved); 
    }


    // --- Funções de Gerenciamento de Categorias ---

    function getNextAvailableColor(type, priority = null) {
        let palette;
        if (type === 'income') {
            palette = INCOME_COLORS;
        } else if (type === 'expense') {
            palette = (priority === 'essential') ? ESSENTIAL_COLORS : NON_ESSENTIAL_COLORS;
        } else if (type === 'caixinha') {
            palette = CAIXINHA_COLORS;
        } else {
            return '#9E9E9E';
        }

        const relevantCategories = categories.filter(cat => {
            if (cat.type !== type) return false;
            if (type === 'expense' && cat.priority !== priority) return false;
            return true;
        });

        const usedColors = new Set(relevantCategories.map(cat => cat.color));

        for (const color of palette) {
            if (!usedColors.has(color)) {
                return color;
            }
        }

        return palette[relevantCategories.length % palette.length];
    }

    function renderCategories(filter = '') {
        categoryListContainer.innerHTML = '';

        const filteredCategories = categories.filter(cat => 
            cat.name.toLowerCase().includes(filter.toLowerCase())
        );

        if (filteredCategories.length === 0 && filter === '') {
            categoryListContainer.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma categoria ou caixinha cadastrada. Adicione uma nova!</p>';
        } else if (filteredCategories.length === 0 && filter !== '') {
            categoryListContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Nenhuma categoria ou caixinha encontrada para "${filter}".</p>`;
        }

        filteredCategories.forEach(category => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'bg-white p-4 rounded-lg shadow-sm flex items-center justify-between';
            
            let typeDisplay = '';
            let priorityDisplay = '';
            let savedAmountDisplay = '';
            let progressHtml = '';

            if (category.type === 'income') {
                typeDisplay = 'Receita';
            } else if (category.type === 'expense') {
                typeDisplay = 'Despesa';
                priorityDisplay = category.priority ? ` (${category.priority === 'essential' ? 'Essencial' : 'Não Essencial'})` : '';
            } else if (category.type === 'caixinha') {
                typeDisplay = 'Caixinha';
                const saved = parseFloat(category.savedAmount || 0);
                const target = parseFloat(category.targetAmount || 0);
                const progress = (target > 0) ? (saved / target) * 100 : 0;
                const progressBarColor = progress >= 100 ? 'bg-green-500' : (progress > 50 ? 'bg-blue-500' : 'bg-yellow-500');

                savedAmountDisplay = ` - Guardado: ${formatCurrency(saved)} / Alvo: ${formatCurrency(target)}`;
                progressHtml = `
                    <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                        <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${Math.min(100, progress)}%"></div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">${progress.toFixed(0)}% Concluído</p>
                `;
            }

            categoryItem.innerHTML = `
                <div class="flex items-center">
                    <div class="w-6 h-6 rounded-full mr-3" style="background-color: ${category.color};"></div>
                    <div>
                        <p class="font-medium text-lg">${category.name}</p>
                        <p class="text-sm text-gray-500">${typeDisplay}${priorityDisplay}${savedAmountDisplay}</p>
                        ${progressHtml}
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="text-gray-500 hover:text-blue-500 p-1 rounded-full edit-category-button" data-id="${category.id}">
                        <i class="fa-solid fa-pen-to-square text-lg"></i>
                    </button>
                    <button class="text-gray-500 hover:text-red-500 p-1 rounded-full delete-category-button" data-id="${category.id}">
                        <i class="fa-solid fa-trash-can text-lg"></i>
                    </button>
                </div>
            `;
            categoryListContainer.appendChild(categoryItem);
        });
    }

    function openCategoryModal(category = null) {
        categoryModal.classList.add('active');
        categoryForm.reset();
        categoryTargetAmountInput.value = '';

        if (category) {
            categoryModalTitle.textContent = 'Editar Categoria';
            categoryIdInput.value = category.id;
            categoryNameInput.value = category.name;
            document.querySelector(`input[name="category-type"][value="${category.type}"]`).checked = true;
            
            if (category.type === 'expense') {
                priorityField.style.display = 'block';
                document.querySelector(`input[name="category-priority"][value="${category.priority || 'essential'}"]`).checked = true;
            } else {
                priorityField.style.display = 'none';
            }

            if (category.type === 'caixinha') {
                targetAmountField.style.display = 'block';
                categoryTargetAmountInput.value = (parseFloat(category.targetAmount || 0) * 100).toFixed(0);
                formatCurrencyInput(categoryTargetAmountInput);
            } else {
                targetAmountField.style.display = 'none';
            }

        } else {
            categoryModalTitle.textContent = 'Adicionar Nova Categoria ou Caixinha';
            categoryIdInput.value = '';
            categoryNameInput.value = '';
            document.querySelector('input[name="category-type"][value="expense"]').checked = true;
            priorityField.style.display = 'block';
            document.querySelector(`input[name="category-priority"][value="essential"]`).checked = true;
            targetAmountField.style.display = 'none';
        }
    }

    function closeCategoryModal() {
        categoryModal.classList.remove('active');
        categoryForm.reset();
    }

    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = categoryIdInput.value;
        const name = categoryNameInput.value.trim();
        const type = document.querySelector('input[name="category-type"]:checked').value;
        
        if (!name) {
            showToast('O nome da categoria é obrigatório!', 'error');
            return;
        }
        
        let priority = (type === 'expense') ? document.querySelector('input[name="category-priority"]:checked').value : null;
        let targetAmount = null;
        let savedAmount = null;

        if (type === 'caixinha') {
            const targetAmountFormatted = categoryTargetAmountInput.value.replace(/\./g, '').replace(',', '.');
            targetAmount = parseFloat(targetAmountFormatted) || 0;
            if (id) {
                const existingCategory = categories.find(cat => cat.id === id);
                savedAmount = existingCategory ? existingCategory.savedAmount : 0;
            } else {
                savedAmount = 0;
            }
        }

        if (id) {
            const index = categories.findIndex(cat => cat.id === id);
            if (index !== -1) {
                const originalCategory = categories[index];
                const mudouTipo = originalCategory.type !== type;
                const mudouPrioridade = originalCategory.priority !== priority;
                                        
                let newColor = originalCategory.color; 
                                        
                if (mudouTipo || mudouPrioridade) {
                    newColor = getNextAvailableColor(type, priority);
                }
                categories[index] = { 
                    ...originalCategory, 
                    name, 
                    type, 
                    priority, 
                    color: newColor,
                    targetAmount: targetAmount,
                    savedAmount: savedAmount
                };
            }
        } else {
            const newColor = getNextAvailableColor(type, priority);
            const newCategory = { 
                id: generateUUID(), 
                name, 
                type, 
                priority, 
                color: newColor,
                targetAmount: targetAmount,
                savedAmount: savedAmount
            };
                                
            categories.push(newCategory);
        }
        await saveCategories();
        showToast('Categoria salva com sucesso!');
        closeCategoryModal();
    });

    categoryListContainer.addEventListener('click', (e) => {
        if (e.target.closest('.edit-category-button')) {
            const id = e.target.closest('.edit-category-button').dataset.id;
            const categoryToEdit = categories.find(cat => cat.id === id);
            if (categoryToEdit) {
                openCategoryModal(categoryToEdit);
            }
        } else if (e.target.closest('.delete-category-button')) {
            const id = e.target.closest('.delete-category-button').dataset.id;
            const categoryToDelete = categories.find(cat => cat.id === id);

            showConfirmationModal(
                "Confirmar Exclusão",
                `Tem certeza que deseja excluir a categoria "${categoryToDelete.name}"? Todas as transações associadas a ela ficarão sem categoria.`,
                async () => {
                    categories = categories.filter(cat => cat.id !== id);
                    const transactionsToUpdate = transactions.filter(t => t.categoryId === id);
                    for (const t of transactionsToUpdate) {
                        t.categoryId = 'unknown';
                        t.transactionType = null;
                        t.caixinhaId = null;
                        await saveTransaction(t);
                    }
                    await saveCategories();
                    showToast('Categoria excluída.', 'info');
                    updateDashboardAndTransactionSummaries();
                }
            );
        }
    });

    categoryTypeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            const selectedType = event.target.value;
            priorityField.style.display = (selectedType === 'expense') ? 'block' : 'none';
            targetAmountField.style.display = (selectedType === 'caixinha') ? 'block' : 'none';
            if (selectedType !== 'caixinha') {
                categoryTargetAmountInput.value = '';
            }
        });
    });

    categoryTargetAmountInput.addEventListener('input', () => {
        formatCurrencyInput(categoryTargetAmountInput);
    });


    // --- Funções de Gerenciamento de Transações ---

    function populateTransactionCategories(selectedTransactionType = null) {
        transactionCategorySelect.innerHTML = '<option value="">Selecione uma Categoria</option>';

        let filteredCategories = [];
        if (selectedTransactionType === 'expense' || selectedTransactionType === 'income') {
            filteredCategories = categories.filter(cat => cat.type === selectedTransactionType);
        } else if (selectedTransactionType === 'deposit' || selectedTransactionType === 'withdraw') {
            filteredCategories = categories.filter(cat => cat.type === 'caixinha');
        }

        if (filteredCategories.length > 0) {
            filteredCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name; 
                transactionCategorySelect.appendChild(option);
            });
        } else {
            transactionCategorySelect.innerHTML += '<option value="" disabled>Nenhuma categoria disponível</option>';
        }
    }


    function renderTransactions() {
        transactionsListContainer.innerHTML = `
            <div class="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        `; 

        if (transactions.length === 0) {
            transactionsListContainer.innerHTML += '<p class="text-center text-gray-500 py-4" id="no-transactions-message">Nenhuma transação cadastrada ainda.</p>';
            return;
        }

        const groupedTransactions = transactions.reduce((acc, transaction) => {
            const date = transaction.date;
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(transaction);
            return acc;
        }, {});

        const sortedDates = Object.keys(groupedTransactions).sort((a, b) => new Date(b) - new Date(a));

        sortedDates.forEach(date => {
            const dateGroupDiv = document.createElement('div');
            dateGroupDiv.className = 'mb-6 relative pl-8';

            const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

            dateGroupDiv.innerHTML = `
                <div class="timeline-bullet-date">
                    <i class="fa-solid fa-calendar-days text-sm"></i>
                </div>
                <h3 class="text-xl font-semibold mb-3 ml-2">${formattedDate}</h3>
                <div class="space-y-3"></div>
            `;
            const transactionsForDateDiv = dateGroupDiv.querySelector('.space-y-3');

            groupedTransactions[date].sort((a, b) => new Date(b.date) - new Date(a.date) || a.description.localeCompare(b.description))
            .forEach(transaction => {
                let categoryName = 'Categoria Desconhecida';
                let bulletColor = '#9E9E9E';
                let amountColorClass = '';
                let amountPrefix = '';

                const category = categories.find(cat => cat.id === transaction.categoryId);
                if (category) {
                    categoryName = category.name;
                    bulletColor = category.color;
                }

                if (transaction.type === 'income') {
                    amountColorClass = 'text-[var(--color-green-positive)]';
                    amountPrefix = '+';
                } else if (transaction.type === 'expense') {
                    amountColorClass = 'text-[var(--color-red-negative)]';
                    amountPrefix = '-';
                } else if (transaction.type === 'caixinha') {
                    if (transaction.transactionType === 'deposit') {
                        amountColorClass = 'text-[var(--color-red-negative)]';
                        amountPrefix = '-';
                    } else if (transaction.transactionType === 'withdraw') {
                        amountColorClass = 'text-[var(--color-green-positive)]';
                        amountPrefix = '+';
                    }
                }
                
                const isPaidOrReceived = (transaction.status === 'Pago' || transaction.status === 'Recebido' || transaction.status === 'Confirmado');
                const bulletClass = isPaidOrReceived ? 'transaction-bullet paid' : 'transaction-bullet';
                const bulletStyle = isPaidOrReceived ? `background-color: ${bulletColor};` : `border: 3px solid ${bulletColor};`;
                
                const statusIndicatorText = isPaidOrReceived ? '' : 'Pendente';
                const statusIndicatorHtml = statusIndicatorText ? `<p class="text-xs text-yellow-600">${statusIndicatorText}</p>` : '';

                const transactionItem = document.createElement('div');
                transactionItem.className = `bg-white p-4 rounded-lg shadow-sm flex justify-between items-center relative pl-8`; 
                transactionItem.innerHTML = `
                    <div class="${bulletClass}" style="${bulletStyle}"></div>
                    <div class="flex-grow min-w-0">
                        <p class="font-medium truncate text-gray-800">${categoryName}</p>
                        ${statusIndicatorHtml}
                        <p class="text-sm text-gray-500 truncate">${transaction.description}</p>
                    </div>
                    <div class="flex items-center space-x-2 ml-4">
                        <p class="font-bold text-lg ${amountColorClass}">${amountPrefix} ${formatCurrency(transaction.amount)}</p>
                        <div class="relative">
                            <button class="transaction-menu-button p-2 rounded-full hover:bg-gray-100" data-id="${transaction.id}">
                                <i class="fa-solid fa-ellipsis-vertical text-gray-500"></i>
                            </button>
                            <div class="transaction-menu-dropdown absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 hidden">
                                <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 edit-transaction-button" data-id="${transaction.id}">Editar</a>
                                <a href="#" class="block px-4 py-2 text-sm text-red-500 hover:bg-gray-100 delete-transaction-button" data-id="${transaction.id}">Apagar</a>
                            </div>
                        </div>
                    </div>
                `;
                transactionsForDateDiv.appendChild(transactionItem);
            });
            transactionsListContainer.appendChild(dateGroupDiv);
        });
        if (transactions.length > 0) {
            noTransactionsMessage.classList.add('hidden');
        } else {
            noTransactionsMessage.classList.remove('hidden');
        }
    }

    function updateTransactionStatusOptions(transactionType) {
        const statusContainer = document.getElementById('transaction-status-options');
        statusContainer.innerHTML = '';
        let options = [];
        if (transactionType === 'income') {
            options = [{ value: 'Recebido', label: 'Recebido' }, { value: 'Pendente', label: 'Pendente' }];
        } else if (transactionType === 'expense') {
            options = [{ value: 'Pago', label: 'Pago' }, { value: 'Pendente', label: 'Pendente' }];
        } else {
            options = [{ value: 'Confirmado', label: 'Confirmado' }];
        }

        options.forEach((opt, index) => {
            const wrapper = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'transaction-status-radio';
            input.id = `status-${opt.value}`;
            input.value = opt.value;
            input.className = 'hidden peer';
            if (index === 0) input.checked = true;

            const label = document.createElement('label');
            label.htmlFor = `status-${opt.value}`;
            label.textContent = opt.label;
            label.className = 'px-4 py-2 border rounded-lg cursor-pointer transition peer-checked:bg-[var(--color-blue-primary)] peer-checked:text-white peer-checked:border-[var(--color-blue-primary)]';
            
            wrapper.appendChild(input);
            wrapper.appendChild(label);
            statusContainer.appendChild(wrapper);
        });
    }

    function goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > totalSteps) {
            console.error("Tentativa de ir para uma etapa inválida:", stepNumber);
            return;
        }
        currentStep = stepNumber;
        transactionSteps.forEach((step, index) => {
            step.classList.toggle('hidden', index + 1 !== currentStep);
        });

        if (currentStep === 2) {
            const selectedType = document.querySelector('input[name="transaction-type"]:checked').value;
            populateTransactionCategories(selectedType);
            updateTransactionStatusOptions(selectedType);
            transactionAmountInput.focus();
        } else if (currentStep === 3) {
            transactionDescriptionInput.focus();
        } else if (currentStep === 4) {
            if (transactionIdInput.value) {
                const transactionToEdit = transactions.find(t => t.id === transactionIdInput.value);
                if (transactionToEdit) {
                    const statusRadio = document.querySelector(`input[name="transaction-status-radio"][value="${transactionToEdit.status}"]`);
                    if (statusRadio) {
                        statusRadio.checked = true;
                    }
                }
            }
            const firstStatusRadio = transactionStatusOptionsContainer.querySelector('input[type="radio"]');
            if (firstStatusRadio) {
                firstStatusRadio.focus();
            }
        }
    }

    function openTransactionModal(transaction = null) {
        transactionModal.classList.add('active');
        transactionForm.reset();
        transactionDateInput.valueAsDate = new Date();
        
        if (transaction) {
            transactionIdInput.value = transaction.id;
            transactionDescriptionInput.value = transaction.description;
            transactionAmountInput.value = (parseFloat(transaction.amount) * 100).toFixed(0);
            formatCurrencyInput(transactionAmountInput);
            transactionDateInput.value = transaction.date;

            let typeToSelect = transaction.type;
            if (transaction.type === 'caixinha') {
                typeToSelect = transaction.transactionType;
            }
            const typeButton = document.querySelector(`.step-1-type-button[data-type="${typeToSelect}"]`);
            if (typeButton) {
                document.querySelectorAll('.step-1-type-button').forEach(btn => btn.classList.remove('selected'));
                typeButton.classList.add('selected');
                document.querySelector(`input[name="transaction-type"][value="${typeToSelect}"]`).checked = true;
            }
            
            populateTransactionCategories(typeToSelect);
            transactionCategorySelect.value = transaction.categoryId;
            updateTransactionStatusOptions(typeToSelect);
            goToStep(2);
        } else {
            transactionIdInput.value = '';
            goToStep(1);
            document.querySelectorAll('.step-1-type-button').forEach(button => {
                button.classList.remove('selected');
            });
        }
    }

    function closeTransactionModal() {
        transactionModal.classList.remove('active');
        transactionForm.reset();
        currentStep = 1;
    }

    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const typeSelectedInStep1 = document.querySelector('input[name="transaction-type"]:checked').value;
        
        const id = transactionIdInput.value;
        const description = transactionDescriptionInput.value.trim();
        
        const amountFormatted = transactionAmountInput.value.replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(amountFormatted);

        const date = transactionDateInput.value;
        const status = document.querySelector('input[name="transaction-status-radio"]:checked').value; 
        const categoryId = transactionCategorySelect.value;

        let transactionTypeForCaixinha = null;
        let transactionCategoryType = null;

        if (isNaN(amount) || !date || !status || !categoryId) {
            showToast("Por favor, preencha todos os campos da transação.", "error");
            return;
        }

        const selectedCategory = categories.find(cat => cat.id === categoryId);

        if (!selectedCategory) {
            showToast("Categoria selecionada não encontrada.", "error");
            return;
        }

        transactionCategoryType = selectedCategory.type;

        if (selectedCategory.type === 'caixinha') {
            if (typeSelectedInStep1 === 'deposit') {
                transactionTypeForCaixinha = 'deposit';
                selectedCategory.savedAmount = (selectedCategory.savedAmount || 0) + amount;
            } else if (typeSelectedInStep1 === 'withdraw') {
                transactionTypeForCaixinha = 'withdraw';
                if ((selectedCategory.savedAmount || 0) < amount) {
                    showToast("Valor de resgate maior que o saldo da caixinha.", "error");
                    return;
                }
                selectedCategory.savedAmount -= amount;
            }
            await saveCategories();
        }

        const transactionData = { 
            description, 
            amount, 
            date, 
            type: transactionCategoryType,
            categoryId, 
            status 
        };

        if (id) {
            transactionData.id = id;
        } else {
            transactionData.id = generateUUID();
        }

        if (transactionCategoryType === 'caixinha') {
            transactionData.transactionType = transactionTypeForCaixinha;
            transactionData.caixinhaId = selectedCategory.id;
        }

        await saveTransaction(transactionData);
        showToast('Transação salva com sucesso!');
        closeTransactionModal();
    });

    transactionsListContainer.addEventListener('click', (e) => {
        const menuButton = e.target.closest('.transaction-menu-button');
        if (menuButton) {
            e.stopPropagation();
            const dropdown = menuButton.nextElementSibling;
            document.querySelectorAll('.transaction-menu-dropdown').forEach(openDropdown => {
                if (openDropdown !== dropdown) {
                    openDropdown.classList.add('hidden');
                }
            });
            dropdown.classList.toggle('hidden');
            return;
        }

        if (e.target.closest('.edit-transaction-button')) {
            const id = e.target.closest('.edit-transaction-button').dataset.id;
            const transactionToEdit = transactions.find(t => t.id === id);
            if (transactionToEdit) {
                openTransactionModal(transactionToEdit);
            }
        } else if (e.target.closest('.delete-transaction-button')) {
            const id = e.target.closest('.delete-transaction-button').dataset.id;
            showConfirmationModal(
                "Confirmar Exclusão",
                "Tem certeza que deseja excluir esta transação?",
                async () => {
                    const deletedTransaction = transactions.find(t => t.id === id);
                    if (deletedTransaction && deletedTransaction.type === 'caixinha' && deletedTransaction.caixinhaId) {
                        const caixinha = categories.find(c => c.id === deletedTransaction.caixinhaId);
                        if (caixinha) {
                            if (deletedTransaction.transactionType === 'deposit') {
                                caixinha.savedAmount -= parseFloat(deletedTransaction.amount);
                            } else if (deletedTransaction.transactionType === 'withdraw') {
                                caixinha.savedAmount += parseFloat(deletedTransaction.amount);
                            }
                            await saveCategories();
                        }
                    }
                    await deleteTransactionFromFirestore(id);
                    showToast('Transação excluída.', 'info');
                }
            );
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.transaction-menu-button') && !e.target.closest('.transaction-menu-dropdown')) {
            document.querySelectorAll('.transaction-menu-dropdown').forEach(dropdown => {
                dropdown.classList.add('hidden');
            });
        }
    });

    transactionAmountInput.addEventListener('input', () => {
        formatCurrencyInput(transactionAmountInput);
    });


    // --- Funções de Gerenciamento de Orçamento ---
    function openBudgetModal(budget = null) {
        budgetForm.reset();
        budgetCategorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
            
        const expenseCategories = categories.filter(c => c.type === 'expense');
        expenseCategories.forEach(cat => {
            const isAlreadyBudgeted = budgets.some(b => b.categoryId === cat.id && b.month === getCurrentMonthYYYYMM());
            if (!budget && isAlreadyBudgeted) return;
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            budgetCategorySelect.appendChild(option);
        });

        if (budget) {
            budgetModalTitle.textContent = 'Editar Orçamento';
            budgetIdInput.value = budget.id;
            budgetCategorySelect.value = budget.categoryId;
            budgetCategorySelect.disabled = true;
            budgetAmountInput.value = (parseFloat(budget.amount) * 100).toFixed(0);
            formatCurrencyInput(budgetAmountInput);
        } else {
            budgetModalTitle.textContent = 'Novo Orçamento Mensal';
            budgetIdInput.value = '';
            budgetCategorySelect.disabled = false;
        }
        budgetModal.classList.add('active');
    }

    function closeBudgetModal() {
        budgetModal.classList.remove('active');
    }

    function renderBudgets() {
        budgetListContainer.innerHTML = '';
        const currentMonthBudgets = budgets.filter(b => b.month === getCurrentMonthYYYYMM());
        if (currentMonthBudgets.length === 0) {
            budgetListContainer.innerHTML = '<p class="text-center text-gray-500 py-4 col-span-full">Nenhum orçamento configurado para este mês.</p>';
            return;
        }
        noBudgetsMessage.classList.add('hidden');

        currentMonthBudgets.forEach(budget => {
            const category = categories.find(c => c.id === budget.categoryId);
            if (!category) return;
            
            const totalSpent = transactions.filter(t => 
                    t.categoryId === budget.categoryId && 
                    t.type === 'expense' &&
                    t.date.startsWith(getCurrentMonthYYYYMM()) &&
                    (t.status === 'Pago' || t.status === 'Recebido')
                ).reduce((sum, t) => sum + parseFloat(t.amount), 0);

            const progress = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
            const remaining = budget.amount - totalSpent;
            const progressBarColor = progress >= 100 ? 'bg-red-500' : (progress > 80 ? 'bg-yellow-500' : 'bg-green-500');
            
            const budgetCard = document.createElement('div');
            budgetCard.className = 'bg-white p-4 rounded-lg shadow-md flex flex-col justify-between';
            budgetCard.innerHTML = `
                <div>
                    <div class="flex items-center mb-2">
                        <div class="w-4 h-4 rounded-full mr-2" style="background-color: ${category.color};"></div>
                        <p class="font-semibold text-lg">${category.name}</p>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 my-2">
                        <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${Math.min(100, progress)}%;"></div>
                    </div>
                    <div class="text-xs flex justify-between">
                        <span class="text-gray-600">${formatCurrency(totalSpent)} de ${formatCurrency(budget.amount)}</span>
                        <span class="font-bold ${remaining < 0 ? 'text-red-500' : 'text-green-600'}">${progress.toFixed(0)}%</span>
                    </div>
                </div>
                <div class="flex justify-end mt-3">
                    <button class="text-gray-500 hover:text-blue-500 p-1 rounded-full edit-budget-button" data-id="${budget.id}">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="text-gray-500 hover:text-red-500 p-1 rounded-full delete-budget-button" data-id="${budget.id}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            budgetListContainer.appendChild(budgetCard);
        });
    }

    // --- Funções de Otimização de Orçamento com IA (NOVA) ---
    async function openBudgetOptimizationModal() {
        budgetOptimizationModal.classList.add('active');
        budgetOptimizationText.innerHTML = '';
        budgetOptimizationLoadingIndicator.classList.remove('hidden');

        const activeApiKey = getActiveGeminiApiKey();
        if (!isGeminiApiReady || !activeApiKey) {
            budgetOptimizationText.innerHTML = '<p class="text-red-500">O assistente de IA não está configurado. Por favor, insira sua chave da API Gemini nas "Mais Opções".</p>';
            budgetOptimizationLoadingIndicator.classList.add('hidden');
            return;
        }

        let budgetDataString = "";
        if (budgets.length > 0) {
            budgetDataString += "<strong>Orçamentos configurados:</strong><br><br>";
            budgets.forEach(budget => {
                const category = categories.find(c => c.id === budget.categoryId);
                const categoryName = category ? category.name : 'Categoria Desconhecida';
                const actualSpent = transactions.filter(t => 
                    t.categoryId === budget.categoryId && t.type === 'expense' && (t.status === 'Pago' || t.status === 'Recebido')
                ).reduce((sum, t) => sum + parseFloat(t.amount), 0);
                const remaining = budget.amount - actualSpent;
                budgetDataString += `- Categoria: ${categoryName}, Orçado: ${formatCurrency(budget.amount)}, Gasto Real: ${formatCurrency(actualSpent)}, Saldo: ${formatCurrency(remaining)}<br>`;
            });
        } else {
            budgetDataString += "Nenhum orçamento configurado. Por favor, configure alguns orçamentos para obter sugestões.<br>";
        }
        budgetDataString += "<br>--- Fim dos Dados de Orçamento ---<br><br>";

        const optimizationPrompt =
            `Com base nos seguintes dados de orçamento do usuário, forneça sugestões claras e acionáveis para otimizar os gastos e gerenciar melhor o dinheiro. ` +
            `Seja direto, prático e objetivo, como um consultor financeiro que não hesita em apontar onde o usuário pode melhorar. ` +
            `Use títulos em negrito (<strong>), listas não ordenadas (<ul>, <li>) e quebras de linha (<br>). ` +
            `NUNCA use Markdown (*, **, _, #, etc.). ` +
            `Aqui estão os dados: <br><br>${budgetDataString}`;

        try {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${activeApiKey}`;
            
            const payload = {
                contents: [{ role: "user", parts: [{ text: optimizationPrompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 800
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ]
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const aiResponseText = result.candidates[0].content.parts[0].text;
                budgetOptimizationText.innerHTML = aiResponseText;
            } else if (result.error) {
                budgetOptimizationText.innerHTML = `<p class="text-red-500">Erro da API: ${result.error.message || 'Erro desconhecido da API Gemini.'}</p>`;
                console.error('Erro da API Gemini para Otimização de Orçamento:', result.error);
            } else {
                budgetOptimizationText.innerHTML = '<p class="text-red-500">Não foi possível gerar sugestões de otimização de orçamento neste momento.</p>';
            }
        } catch (error) {
            budgetOptimizationText.innerHTML = `<p class="text-red-500">Erro ao comunicar com a IA para otimização. Verifique sua conexão. Detalhes: ${error.message || 'Erro desconhecido'}</p>`;
            console.error('Erro ao chamar a API Gemini para Otimização de Orçamento:', error);
        } finally {
            budgetOptimizationLoadingIndicator.classList.add('hidden');
        }
    }

    function closeBudgetOptimizationModal() {
        budgetOptimizationModal.classList.remove('active');
    }


    // --- Funções do Chat com IA ---
    function appendMessage(sender, text, type = 'text') {
        const messageDiv = document.createElement('div');
        const bubbleDiv = document.createElement('div');

        if (sender === 'user') {
            messageDiv.className = 'flex justify-end';
            bubbleDiv.className = 'bg-[var(--color-blue-primary)] text-white p-3 rounded-xl rounded-br-none max-w-xs md:max-w-md shadow-sm';
        } else {
            messageDiv.className = 'flex justify-start';
            bubbleDiv.className = 'bg-gray-100 text-gray-800 p-3 rounded-xl rounded-bl-none max-w-xs md:max-w-md shadow-sm';
            if (type === 'error') {
                bubbleDiv.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-400');
            }
        }

        bubbleDiv.innerHTML = text; 
        messageDiv.appendChild(bubbleDiv);
        chatMessagesDiv.appendChild(messageDiv);

        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }

    function getFinancialDataForAI() {
        let dataString = "";

        // Resumo Financeiro Principal
        dataString += "<strong>Resumo Financeiro Principal:</strong><br>";
        dataString += `- Saldo Atual: ${transactionsCurrentBalance.textContent}<br>`;
        dataString += `- Despesas Pagas no Mês: ${transactionsTotalExpensesPaid.textContent}<br>`;
        dataString += `- Despesas Pendentes no Mês: ${transactionsTotalExpensesPending.textContent}<br>`;
        dataString += `- Total Guardado (Caixinhas): ${transactionsTotalCaixinhasSaved.textContent}<br><br>`;

        dataString += "<strong>Categorias e Caixinhas Cadastradas:</strong><br>";
        if (categories.length > 0) {
            categories.forEach(cat => {
                let categoryDetails = `- ${cat.name} (Tipo: ${cat.type})`;
                if (cat.type === 'expense' && cat.priority) {
                    categoryDetails += `, Prioridade: ${cat.priority === 'essential' ? 'Essencial' : 'Não Essencial'}`;
                } else if (cat.type === 'caixinha') {
                    categoryDetails += `, Guardado: ${formatCurrency(cat.savedAmount || 0)}, Alvo: ${formatCurrency(cat.targetAmount || 0)}`;
                }
                dataString += `${categoryDetails}<br>`; 
            });
        } else {
            dataString += "Nenhuma categoria ou caixinha cadastrada.<br>";
        }
        dataString += "<br>";

        dataString += "<strong>Orçamentos por Categoria:</strong><br>";
        if (budgets.length > 0) {
            budgets.forEach(budget => {
                const category = categories.find(c => c.id === budget.categoryId);
                const categoryName = category ? category.name : 'Categoria Desconhecida';
                const actualSpent = transactions.filter(t => 
                    t.categoryId === budget.categoryId && t.type === 'expense' && (t.status === 'Pago' || t.status === 'Recebido')
                ).reduce((sum, t) => sum + parseFloat(t.amount), 0);
                const remaining = budget.amount - actualSpent;
                dataString += `- ${categoryName}: Orçado ${formatCurrency(budget.amount)}, Gasto ${formatCurrency(actualSpent)}, Restante ${formatCurrency(remaining)}<br>`;
            });
        } else {
            dataString += "Nenhum orçamento configurado.<br>";
        }
        dataString += "<br>";

        dataString += "<strong>Últimas Transações (Recentes):</strong><br>";
        if (transactions.length > 0) {
            const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
            const recentTransactions = sortedTransactions.slice(0, 10);

            recentTransactions.forEach(t => {
                let categoryDisplay = '';
                let transactionTypeDetail = '';

                const category = categories.find(cat => cat.id === t.categoryId);
                if (category) {
                    categoryDisplay = `(Categoria: ${category.name})`;
                } else {
                    categoryDisplay = `(Categoria: Desconhecida)`;
                }
                
                if (t.type === 'caixinha') { 
                    transactionTypeDetail = t.transactionType === 'deposit' ? 'Depósito para Caixinha' : 'Resgate de Caixinha';
                } else {
                    transactionTypeDetail = t.type === 'income' ? 'Receita' : 'Despesa';
                }
                
                const amountPrefix = (t.type === 'income' || (t.type === 'caixinha' && t.transactionType === 'withdraw')) ? '+' : '-';
                dataString += `- ${new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}: ${t.description || categoryDisplay}, ${amountPrefix} ${formatCurrency(t.amount)} ${categoryDisplay} [Tipo: ${transactionTypeDetail}, Status: ${t.status}]<br>`;
            });
        } else {
            dataString += "Nenhuma transação registrada.<br>";
        }
        dataString += "<br>--- Fim dos Dados Financeiros ---<br><br>";
        return dataString;
    }

    function getActiveGeminiApiKey() {
        for (const key of geminiApiKeys) {
            if (key && key.trim() !== '') {
                return key.trim();
            }
        }
        return null;
    }

    async function sendChatMessage(userMessage) {
        if (isSendingMessage) return;
        if (userMessage.trim() === '') return;

        const activeApiKey = getActiveGeminiApiKey();
        if (!isGeminiApiReady || !activeApiKey) {
            appendMessage('ai', 'O assistente de IA não está configurado. Por favor, insira sua chave da API Gemini nas "Mais Opções".', 'error');
            return;
        }

        isSendingMessage = true;
        appendMessage('user', userMessage);
        chatInput.value = '';
        chatLoadingIndicator.classList.remove('hidden');
        
        const baseSystemInstruction = `Você é um assistente financeiro. Sua personalidade é definida por dois parâmetros: Paciência (0 = rude, 100 = educado) e Verbosidade (0 = curto e direto, 100 = detalhado). A configuração atual é: Paciência: ${aiConfig.patience}, Verbosidade: ${aiConfig.verbosity}. Use essa configuração para moldar seu tom e o comprimento das suas respostas.

Você tem acesso a um resumo financeiro e ao histórico da conversa. Baseie suas respostas nessas informações.

Hierarquia de Dados:
- Tudo começa com uma Transação.
- Cada Transação está ligada a uma Categoria.
- Categorias podem ser 'receita', 'despesa' ou 'caixinha'.
- Despesas podem ser 'essencial' ou 'não essencial'.
- Caixinhas são metas com um 'valor alvo'.

Seu Papel:
1.  Analisar os dados e o chat para dar conselhos contextualizados.
2.  NÃO FAZER CÁLCULOS. Use os dados prontos que o app fornece (ex: Saldo Atual).
3.  Orientar o usuário a usar o app (ex: "Vá para Transações e adicione..."). Não execute ações.
4.  Usar HTML básico para formatação: <strong>, <br>, <ul>, <li>. NUNCA use Markdown (*, #, etc.).

Seu objetivo é ser um cérebro financeiro confiável e adaptável, seguindo as regras de personalidade.`;

        let currentFinancialData = '';
        const refreshKeywords = ["atualizar dados", "recarregar dados", "consultar dados", "verificar finanças", "novos dados", "dados atuais", "meus dados", "favor, atualize meus dados financeiros"]; 
        const needsRefresh = refreshKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

        if (!hasConsultedFinancialData || needsRefresh) {
            currentFinancialData = getFinancialDataForAI();
            lastFinancialDataString = currentFinancialData;
            hasConsultedFinancialData = true;
            appendMessage('ai', 'Carregando e analisando seus dados financeiros para a nossa conversa. Isso pode levar um momento...', 'info');
        } else {
            currentFinancialData = lastFinancialDataString;
        }

        const fullHistory = [{ role: "user", parts: [{ text: baseSystemInstruction }] }, { role: "model", parts: [{ text: "Entendido. Estou pronto para ajudar." }] }, ...chatHistory];

        const contentsPayload = [
            ...fullHistory,
            { role: "user", parts: [{ text: `(Dados Financeiros Atuais: ${currentFinancialData}) ${userMessage}` }] }
        ];

        try {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${activeApiKey}`;
            
            const payload = {
                contents: contentsPayload, 
                generationConfig: {
                    temperature: 0.7, 
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 800
                },
                safetySettings: [ 
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ]
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const aiResponseText = result.candidates[0].content.parts[0].text;
                appendMessage('ai', aiResponseText);
                
                chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
                chatHistory.push({ role: "model", parts: [{ text: aiResponseText }] });

                if (chatHistory.length > 20) { 
                    chatHistory = chatHistory.slice(chatHistory.length - 20);
                }
            } else if (result.error) {
                const errorMessage = result.error.message || 'Erro desconhecido da API Gemini.';
                appendMessage('ai', `Erro da API: ${errorMessage}`, 'error');
            } else {
                appendMessage('ai', 'Erro: Não consegui obter uma resposta válida da IA.', 'error');
            }
        } catch (error) {
            console.error('Erro ao chamar a API Gemini:', error);
            appendMessage('ai', `Erro de comunicação com a IA. Verifique sua conexão e chave de API. Detalhes: ${error.message || 'Erro desconhecido'}`, 'error');
        } finally {
            chatLoadingIndicator.classList.add('hidden');
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
            isSendingMessage = false; 
        }
    }


    // --- Funções de Insights Financeiros ---
    async function openInsightsModal() {
        insightsModal.classList.add('active');
        insightsText.innerHTML = '';
        insightsLoadingIndicator.classList.remove('hidden');

        const activeApiKey = getActiveGeminiApiKey();
        if (!isGeminiApiReady || !activeApiKey) {
            insightsText.innerHTML = '<p class="text-red-500">O assistente de IA não está configurado. Por favor, insira sua chave da API Gemini nas "Mais Opções".</p>';
            insightsLoadingIndicator.classList.add('hidden');
            return;
        }

        const financialData = getFinancialDataForAI();

        const insightPrompt =
            `Analise os seguintes dados financeiros do usuário e forneça insights e recomendações úteis. ` +
            `Seja objetivo, encorajador e focado em ações práticas. ` +
            `Estruture a resposta com títulos em negrito usando <strong>, listas não ordenadas com <ul> e <li>, e quebras de linha com <br>. ` +
            `Mantenha o tone de um assistente financeiro útil. ` +
            `NUNCA use Markdown (*, **, _, #, etc.).` +
            `Aqui estão os dados: <br><br>${financialData}`;

        try {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${activeApiKey}`;
            
            const payload = {
                contents: [{ role: "user", parts: [{ text: insightPrompt }] }],
                generationConfig: {
                    temperature: 0.7, 
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 800
                },
                safetySettings: [ 
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ]
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const aiResponseText = result.candidates[0].content.parts[0].text;
                insightsText.innerHTML = aiResponseText;
            } else if (result.error) {
                insightsText.innerHTML = `<p class="text-red-500">Erro da API: ${result.error.message || 'Erro desconhecido da API Gemini.'}</p>`;
                console.error('Erro da API Gemini para Insights:', result.error);
            } else {
                insightsText.innerHTML = '<p class="text-red-500">Não foi possível gerar insights financeiros neste momento.</p>';
            }
        } catch (error) {
            insightsText.innerHTML = `<p class="text-red-500">Erro ao comunicar com a IA para insights. Verifique sua conexão. Detalhes: ${error.message || 'Erro desconhecido'}</p>`;
            console.error('Erro ao chamar a API Gemini para Insights:', error);
        } finally {
            insightsLoadingIndicator.classList.add('hidden');
        }
    }


    function closeInsightsModal() {
        insightsModal.classList.remove('active');
    }

    // --- Funções do Modal de Chave de API ---
    function openApiKeysModal() {
        apiKeysModal.classList.add('active');
    }

    function closeApiKeysModal() {
        apiKeysModal.classList.remove('active');
    }

    // --- Configuração e Inicialização do Firebase ---
    async function initializeFirebase() {
        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    userId = user.uid;
                    isAuthReady = true;
                    loginScreen.classList.add('hidden');
                    appContent.classList.remove('hidden');
                    console.log("Usuário autenticado:", userId);
                    setTimeout(async () => {
                        await loadAllDataFromFirestore();
                        showPage('dashboard');
                    }, 100);
                } else {
                    userId = null;
                    isAuthReady = false;
                    loginScreen.classList.remove('hidden');
                    appContent.classList.add('hidden');
                    console.log("Usuário não autenticado. Mostrando tela de login.");
                }
            });
            
            try {
                await signInAnonymously(auth);
                console.log("Login anônimo bem-sucedido.");
            } catch (error) {
                console.error("Falha no login anônimo:", error);
                loginErrorMessage.textContent = `Erro de autenticação: ${error.message}.`;
                loginErrorMessage.classList.remove('hidden');
            }

        } catch (error) {
            console.error("Erro ao inicializar Firebase:", error);
            loginErrorMessage.textContent = `Erro crítico ao iniciar: ${error.message}`;
            loginErrorMessage.classList.remove('hidden');
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            try {
                await signInWithEmailAndPassword(auth, email, password);
                loginErrorMessage.classList.add('hidden');
            } catch (error) {
                let message = 'Erro ao fazer login. Verifique seu e-mail e senha.';
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    message = 'E-mail ou senha inválidos.';
                }
                loginErrorMessage.textContent = message;
                loginErrorMessage.classList.remove('hidden');
                console.error("Erro de login:", error.message);
            }
        });
    }

    if (logoutButtonDesktop) {
        logoutButtonDesktop.addEventListener('click', async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error("Erro ao sair:", error.message);
            }
        });
    }

    if (logoutButtonMobile) {
        logoutButtonMobile.addEventListener('click', async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error("Erro ao sair:", error.message);
            }
        });
    }

    updateChatUIState();
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); 
            const pageId = e.currentTarget.dataset.page;
            showPage(pageId);
        });
    });

    if (sendButton) {
        sendButton.addEventListener('click', () => sendChatMessage(chatInput.value));
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage(chatInput.value);
            }
        });
    }
    if (refreshChatDataButton) {
        refreshChatDataButton.addEventListener('click', () => {
            chatHistory = []; 
            hasConsultedFinancialData = false;
            sendChatMessage("Por favor, atualize os meus dados financeiros.");
        });
    }
    
    if (clearChatButton) {
        clearChatButton.addEventListener('click', () => {
            chatMessagesDiv.innerHTML = '';
            chatHistory = [];
            hasConsultedFinancialData = false;
            appendMessage('ai', 'Chat limpo. Como posso te ajudar a começar de novo?', 'info');
        });
    }


    const generateInsightsButton = document.getElementById('generate-insights-button');
    if (generateInsightsButton) {
        generateInsightsButton.addEventListener('click', openInsightsModal);
    }

    if (optimizeBudgetButton) {
        optimizeBudgetButton.addEventListener('click', openBudgetOptimizationModal);
    }

    if (closeBudgetOptimizationModalButton) {
        closeBudgetOptimizationModalButton.addEventListener('click', closeBudgetOptimizationModal);
    }
    if (closeBudgetOptimizationButton) {
        closeBudgetOptimizationButton.addEventListener('click', closeBudgetOptimizationModal);
    }

    function updateChatUIState() {
        const hasValidKey = geminiApiKeys.some(key => key.trim() !== '');
        if (hasValidKey) {
            isGeminiApiReady = true;
            chatInput.disabled = false;
            sendButton.disabled = false;
            refreshChatDataButton.disabled = false;
            chatInput.placeholder = "Digite sua mensagem...";
            const initialAiMessage = chatMessagesDiv.querySelector('.flex.justify-start .bg-gray-100');
            if (initialAiMessage && initialAiMessage.textContent.includes('Por favor, insira sua chave')) {
                chatMessagesDiv.innerHTML = '';
                appendMessage('ai', 'Assistente de IA pronto! Como posso ajudar?', 'info');
            }
        } else {
            isGeminiApiReady = false;
            chatInput.disabled = true;
            sendButton.disabled = true;
            refreshChatDataButton.disabled = true;
            chatInput.placeholder = "Assistente não configurado...";
        }
    }

    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', () => openCategoryModal());
    }
    if (closeCategoryModalButton) {
        closeCategoryModalButton.addEventListener('click', closeCategoryModal);
    }
    if (cancelCategoryButton) {
        cancelCategoryButton.addEventListener('click', closeCategoryModal);
    }

    if (addNewTransactionButton) {
        addNewTransactionButton.addEventListener('click', () => openTransactionModal());
    }
    if (closeTransactionModalButton) {
        closeTransactionModalButton.addEventListener('click', closeTransactionModal);
    }
    document.querySelectorAll('.step-1-type-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.step-1-type-button').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');

            const type = button.dataset.type;
            document.querySelector(`input[name="transaction-type"][value="${type}"]`).checked = true;
                    
            const titleMap = {
                income: 'Nova Receita',
                expense: 'Nova Despesa',
                deposit: 'Guardar Dinheiro',
                withdraw: 'Resgatar Dinheiro'
            };
            step2Title.textContent = titleMap[type];
            populateTransactionCategories(type);
                    
            goToStep(2);
        });
    });
    document.querySelectorAll('.step-next-button').forEach(button => {
        button.addEventListener('click', () => {
            goToStep(currentStep + 1);
        });
    });
    document.querySelectorAll('.step-back-button').forEach(button => {
        button.addEventListener('click', () => {
            goToStep(currentStep - 1);
        });
    });
    document.getElementById('cancel-transaction-button-step1').addEventListener('click', closeTransactionModal);

    if (closeInsightsModalButton) {
        closeInsightsModalButton.addEventListener('click', closeInsightsModal);
    }
    if (closeInsightsButton) {
        closeInsightsButton.addEventListener('click', closeInsightsModal);
    }

    if (apiManagementLink) {
        apiManagementLink.addEventListener('click', (e) => {
            e.preventDefault();
            openApiKeysModal();
        });
    }
    if (closeApiKeysModalButton) {
        closeApiKeysModalButton.addEventListener('click', closeApiKeysModal);
    }
    if (saveApiKeysModalButton) {
        saveApiKeysModalButton.addEventListener('click', saveApiKeys);
    }

    if (saveAiConfigButton) {
        saveAiConfigButton.addEventListener('click', saveAiConfig);
    }
    
    transactionDateInput.valueAsDate = new Date();

    document.getElementById('configure-budget-button').addEventListener('click', () => openBudgetModal());
    closeBudgetModalButton.addEventListener('click', closeBudgetModal);
    cancelBudgetButton.addEventListener('click', closeBudgetModal);
    budgetAmountInput.addEventListener('input', () => formatCurrencyInput(budgetAmountInput));

    budgetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = budgetIdInput.value;
        const categoryId = budgetCategorySelect.value;
        const amount = parseFloat(budgetAmountInput.value.replace(/\./g, '').replace(',', '.'));
        
        if (!categoryId || isNaN(amount) || amount <= 0) {
            showToast("Por favor, selecione uma categoria e insira um valor válido.", "error");
            return;
        }

        if (!id) {
            const isAlreadyBudgeted = budgets.some(b => b.categoryId === categoryId && b.month === getCurrentMonthYYYYMM());
            if (isAlreadyBudgeted) {
                showToast("Já existe um orçamento para esta categoria neste mês.", "error");
                return;
            }
        }

        if (id) {
            const index = budgets.findIndex(b => b.id === id);
            if (index !== -1) {
                budgets[index].amount = amount;
            }
        } else {
            const newBudget = {
                id: generateUUID(),
                categoryId: categoryId,
                amount: amount,
                month: getCurrentMonthYYYYMM()
            };
            budgets.push(newBudget);
        }
        await saveBudgets();
        showToast('Orçamento salvo com sucesso!');
        closeBudgetModal();
    });

    budgetListContainer.addEventListener('click', (e) => {
        if (e.target.closest('.edit-budget-button')) {
            const id = e.target.closest('.edit-budget-button').dataset.id;
            const budgetToEdit = budgets.find(b => b.id === id);
            if (budgetToEdit) {
                openBudgetModal(budgetToEdit);
            }
        }
        if (e.target.closest('.delete-budget-button')) {
            const id = e.target.closest('.delete-budget-button').dataset.id;
            showConfirmationModal('Excluir Orçamento', 'Tem certeza que deseja excluir este orçamento?', async () => {
                budgets = budgets.filter(b => b.id !== id);
                await saveBudgets();
                showToast('Orçamento excluído.', 'info');
            });
        }
    });

    function renderExpenseChart() {
        const ctx = document.getElementById('expense-chart').getContext('2d');
        
        const expensesByCategory = transactions
            .filter(t => t.type === 'expense' && t.date.startsWith(getCurrentMonthYYYYMM()) && (t.status === 'Pago' || t.status === 'Recebido'))
            .reduce((acc, t) => {
                const category = categories.find(c => c.id === t.categoryId);
                const categoryName = category ? category.name : 'Sem Categoria';
                const categoryColor = category ? category.color : '#808080';
                                        
                if (!acc[categoryName]) {
                    acc[categoryName] = { total: 0, color: categoryColor };
                }
                acc[categoryName].total += parseFloat(t.amount);
                return acc;
            }, {});

        const labels = Object.keys(expensesByCategory);
        const data = labels.map(label => expensesByCategory[label].total);
        const backgroundColors = labels.map(label => expensesByCategory[label].color);

        if (expenseChartInstance) {
            expenseChartInstance.destroy();
        }
        
        if (labels.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = '16px "Inter", sans-serif';
            ctx.fillStyle = '#6B7280';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Sem dados de despesa para exibir neste mês.', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        expenseChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Despesas por Categoria',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += formatCurrency(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
});
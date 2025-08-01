// Importa os módulos necessários do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// Configurações da IA (ATUALIZADO)
let aiConfig = {
    aiPersona: "", 
    aiPersonality: ""
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

// NOVO: Variável para controlar o mês atual exibido
let currentMonth = new Date(); // Inicializa com o mês atual

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
function getCurrentMonthYYYYMM(date = new Date()) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
}

// Helper para formatar o mês para exibição (ex: "Julho de 2025")
function formatMonthDisplay(date) {
    const options = { month: 'long', year: 'numeric' };
    return date.toLocaleDateString('pt-BR', options);
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
    const bodyEl = document.querySelector('body');

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
    const fabButton = document.getElementById('fab-add-transaction');


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

    // --- Funções Expostas para a IA (Function Calling) ---

    // Adiciona uma transação a partir de um comando da IA.
    window.addTransactionFromAI = async (args) => {
        console.log("IA solicitou adicionar transação com args:", args);
        const { description, amount, categoryName, type, status, date } = args;

        // 1. Encontrar a categoria pelo nome
        const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase() && c.type === type);

        if (!category) {
            return `Erro: A categoria "${categoryName}" do tipo "${type}" não foi encontrada. Por favor, peça ao usuário para verificar o nome ou criar a categoria.`;
        }

        // 2. Criar o objeto da transação
        const newTransaction = {
            id: generateUUID(),
            description: description || 'Transação adicionada pela IA',
            amount: parseFloat(amount),
            date: date || new Date().toISOString().split('T')[0], // Usa hoje se não for fornecido
            type: category.type,
            categoryId: category.id,
            status: status || (type === 'income' ? 'Recebido' : 'Pago') // Status padrão
        };

        // 3. Salvar a transação
        await saveTransaction(newTransaction);
        showToast("Transação adicionada pela IA com sucesso!", "success");
        return `Sucesso: A transação "${description}" de ${formatCurrency(amount)} foi adicionada com sucesso.`;
    };

    // Apaga uma transação a partir de um comando da IA.
    window.deleteTransactionFromAI = async (args) => {
        console.log("IA solicitou apagar transação com args:", args);
        const { description, amount } = args;

        // 1. Encontrar a transação. Prioriza transações mais recentes.
        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const foundTransactions = sortedTransactions.filter(t => 
            t.description.toLowerCase().includes(description.toLowerCase()) && 
            parseFloat(t.amount) === parseFloat(amount)
        );

        if (foundTransactions.length === 0) {
            return `Erro: Não encontrei nenhuma transação com a descrição "${description}" e valor ${formatCurrency(amount)}. Verifique os detalhes.`;
        }
        
        if (foundTransactions.length > 1) {
             return `Erro: Encontrei múltiplas transações com essa descrição e valor. Para evitar erros, por favor, seja mais específico. Você pode me dizer a data da transação que quer apagar?`;
        }
        
        const transactionToDelete = foundTransactions[0];
        
        // 2. Reverter o valor se for uma transação de caixinha
        if (transactionToDelete.type === 'caixinha' && transactionToDelete.caixinhaId) {
            const caixinha = categories.find(c => c.id === transactionToDelete.caixinhaId);
            if (caixinha) {
                if (transactionToDelete.transactionType === 'deposit') {
                    caixinha.savedAmount -= parseFloat(transactionToDelete.amount);
                } else if (transactionToDelete.transactionType === 'withdraw') {
                    caixinha.savedAmount += parseFloat(transactionToDelete.amount);
                }
                await saveCategories(); // Salva o estado atualizado das caixinhas
            }
        }
        
        // 3. Deletar a transação
        await deleteTransactionFromFirestore(transactionToDelete.id);
        showToast("Transação apagada pela IA com sucesso!", "success");
        return `Sucesso: A transação "${transactionToDelete.description}" de ${formatCurrency(amount)} foi apagada.`;
    };

    // Edita uma transação existente a partir de um comando da IA.
    window.editTransactionFromAI = async (args) => {
        console.log("IA solicitou editar transação com args:", args);
        const { originalDescription, originalAmount, newDescription, newAmount, newCategoryName, newDate, newStatus } = args;
    
        // 1. Encontrar a transação original
        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const foundTransactions = sortedTransactions.filter(t =>
            t.description.toLowerCase().includes(originalDescription.toLowerCase()) &&
            parseFloat(t.amount) === parseFloat(originalAmount)
        );
    
        if (foundTransactions.length === 0) {
            return `Erro: Não encontrei nenhuma transação com a descrição "${originalDescription}" e valor ${formatCurrency(originalAmount)}. Verifique os detalhes.`;
        }
    
        if (foundTransactions.length > 1) {
            return `Erro: Encontrei múltiplas transações com essa descrição e valor. Para evitar erros, por favor, seja mais específico, como a data da transação.`;
        }
    
        const transactionToEdit = { ...foundTransactions[0] }; // Cria uma cópia para editar
        let finalMessage = "Sucesso: A transação foi editada. ";
    
        // 2. Lida com as atualizações
        if (newDescription) {
            transactionToEdit.description = newDescription;
            finalMessage += `Descrição atualizada para "${newDescription}". `;
        }
    
        // Validação da nova categoria, se fornecida
        if (newCategoryName) {
            const newCategory = categories.find(c => c.name.toLowerCase() === newCategoryName.toLowerCase() && c.type === transactionToEdit.type);
            if (!newCategory) {
                return `Erro: A categoria "${newCategoryName}" não foi encontrada para o tipo da transação. Peça ao usuário para verificar o nome ou cadastrar a categoria.`;
            }
            transactionToEdit.categoryId = newCategory.id;
            finalMessage += `Categoria atualizada para "${newCategory.name}". `;
        }
    
        if (newDate) {
            transactionToEdit.date = newDate;
            finalMessage += `Data atualizada para ${newDate}. `;
        }
    
        if (newStatus) {
            transactionToEdit.status = newStatus;
            finalMessage += `Status atualizado para "${newStatus}". `;
        }
    
        // A lógica de atualização de valor é mais complexa, especialmente para caixinhas
        if (newAmount) {
            const oldAmountValue = parseFloat(transactionToEdit.amount);
            const newAmountValue = parseFloat(newAmount);
            const difference = newAmountValue - oldAmountValue;
    
            // Se for uma transação de caixinha, ajusta o saldo da caixinha
            if (transactionToEdit.type === 'caixinha' && transactionToEdit.caixinhaId) {
                const caixinha = categories.find(c => c.id === transactionToEdit.caixinhaId);
                if (caixinha) {
                    if (transactionToEdit.transactionType === 'deposit') {
                        caixinha.savedAmount += difference;
                    } else if (transactionToEdit.transactionType === 'withdraw') {
                        caixinha.savedAmount -= difference;
                    }
                    await saveCategories(); // Salva o saldo atualizado da caixinha
                }
            }
            transactionToEdit.amount = newAmountValue;
            finalMessage += `Valor atualizado para ${formatCurrency(newAmountValue)}.`;
        }
    
        // 3. Salva a transação atualizada
        await saveTransaction(transactionToEdit); // A função saveTransaction pode ser usada para atualizar também
        showToast("Transação editada pela IA com sucesso!", "success");
        return finalMessage;
    };
    
    // Procura transações a partir de um comando da IA.
    window.findTransactionsFromAI = async (args) => {
        console.log("IA solicitou procurar transações com args:", args);
        const { date, categoryName, description } = args;
    
        let results = [...transactions];
    
        if (date) {
            results = results.filter(t => t.date === date);
        }
    
        if (categoryName) {
            const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
            if (category) {
                results = results.filter(t => t.categoryId === category.id);
            } else {
                return `Erro: A categoria "${categoryName}" não foi encontrada.`;
            }
        }
    
        if (description) {
            results = results.filter(t => t.description.toLowerCase().includes(description.toLowerCase()));
        }
    
        if (results.length === 0) {
            return "Nenhuma transação encontrada com os critérios fornecidos.";
        }
    
        // Formata o resultado para ser lido pela IA
        const formattedResults = results.map(t => {
            const category = categories.find(c => c.id === t.categoryId);
            const catName = category ? category.name : "Desconhecida";
            return `- Data: ${t.date}, Descrição: ${t.description}, Valor: ${formatCurrency(t.amount)}, Categoria: ${catName}, Status: ${t.status}`;
        }).join('\n');
    
        return `Sucesso: Encontrei as seguintes transações:\n${formattedResults}`;
    };


    // --- Funções de Persistência (Firebase Firestore) ---
    
    // Função para obter referência a uma coleção (para múltiplos documentos, ex: transações)
    const getUserCollectionRef = (collectionName) => {
        if (!userId) {
            console.error("userId não está definido. Não é possível criar referência de coleção.");
            return null;
        }
        // O caminho completo garante que os dados de cada usuário fiquem isolados e seguros.
        return collection(db, `artifacts/${appId}/users/${userId}/${collectionName}`);
    };

    // Função para obter referência a um documento específico (para dados salvos como um único doc)
    const getUserDocumentRef = (collectionName, docName) => {
        if (!userId) {
            console.error("userId não está definido. Não é possível criar referência de documento.");
            return null;
        }
        // O caminho completo garante que os dados de cada usuário fiquem isolados e seguros.
        return doc(db, `artifacts/${appId}/users/${userId}/${collectionName}/${docName}`);
    };


    // Elementos do Chat
    const chatMessagesDiv = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('chat-send-button'); 
    const chatLoadingIndicator = document.getElementById('chat-loading-indicator');
    const refreshChatDataButton = document.getElementById('refresh-chat-data-button');
    const clearChatButton = document.getElementById('clear-chat-button');
    const activeApiKeyIndicator = document.getElementById('active-api-key-indicator');
    const chatBackButton = document.getElementById('chat-back-button'); // NOVO: Botão Voltar

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
    const transactionModal = document.getElementById('transaction-modal');
    const closeTransactionModalButton = document.getElementById('close-transaction-modal');
    const transactionForm = document.getElementById('transaction-form');
    const transactionIdInput = document.getElementById('transaction-id');
    const transactionDescriptionInput = document.getElementById('transaction-description');
    const transactionAmountInput = document.getElementById('transaction-amount');
    const transactionDateInput = document.getElementById('transaction-date');
    const suggestCategoryButton = document.getElementById('suggest-category-button');
    const addCategoryQuickButton = document.getElementById('add-category-quick-button'); // NOVO BOTÃO
    // Os radios de transaction-type agora são ocultos e controlados pelos botões da Etapa 1
    const transactionTypeRadios = document.querySelectorAll('input[name="transaction-type"]'); 
    const transactionCategorySelect = document.getElementById('transaction-category');
    // ATUALIZADO: Removido o select, agora é um div para botões de rádio
    const transactionStatusOptionsContainer = document.getElementById('transaction-status-options'); 
    const step2Title = document.getElementById('step-2-title'); // Título da Etapa 2
    const noTransactionsMessage = document.getElementById('no-transactions-message');
    const transactionsListContainer = document.getElementById('transactions-list-container');
    // NOVO: Campo de número de parcelas
    const transactionInstallmentsInput = document.getElementById('transaction-installments');
    const installmentsField = document.getElementById('installments-field');
    // NOVO: Elementos de Navegação por Mês
    const prevMonthButton = document.getElementById('prev-month-button');
    const nextMonthButton = document.getElementById('next-month-button');
    const currentMonthDisplay = document.getElementById('current-month-display');
    // NOVO: Elementos de Filtro de Transações
    const filterTypeSelect = document.getElementById('filter-type');
    const filterCategorySelect = document.getElementById('filter-category');
    const filterStatusSelect = document.getElementById('filter-status');
    const resetFiltersButton = document.getElementById('reset-filters-button');



    // ATUALIZADO: Variáveis de controle para o fluxo multi-etapas do modal de transação
    let currentStep = 1;
    const totalSteps = 3; // Reduzido de 4 para 3
    const transactionSteps = [
        document.getElementById('transaction-step-1'),
        document.getElementById('transaction-step-2'),
        document.getElementById('transaction-step-3')
    ];


    // Elementos do Dashboard (agora com os resumos principais)
    const dashboardCurrentBalance = document.getElementById('dashboard-current-balance');
    const dashboardPaidExpenses = document.getElementById('dashboard-paid-expenses');
    const dashboardPendingExpenses = document.getElementById('dashboard-pending-expenses');
    const dashboardTotalCaixinhasSaved = document.getElementById('dashboard-total-caixinhas-saved');

    // Elementos da Seção de Transações (Resumo) - IDs não mais usados, pois foram movidos
    // const transactionsCurrentBalance = document.getElementById('transactions-current-balance');
    // ...etc

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

    // Elementos da Configuração de IA (ATUALIZADOS)
    const aiPersonaInput = document.getElementById('ai-persona');
    const aiPersonalityInput = document.getElementById('ai-personality');
    const saveAiConfigButton = document.getElementById('save-ai-config-button');
    const aiConfigStatusMessage = document.getElementById('ai-config-status-message');


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
    
    // NOVO: Elementos do Modal de Otimização de Categorias
    const optimizeCategoriesButton = document.getElementById('optimize-categories-button');
    const categoryOptimizationModal = document.getElementById('category-optimization-modal');
    const closeCategoryOptimizationModalButton = document.getElementById('close-category-optimization-modal');
    const closeCategoryOptimizationButton = document.getElementById('close-category-optimization-button');
    const categoryOptimizationContent = document.getElementById('category-optimization-content');
    const categoryOptimizationLoadingIndicator = document.getElementById('category-optimization-loading-indicator');
    const categoryOptimizationSuggestions = document.getElementById('category-optimization-suggestions');


    // Carrega todos os dados do Firestore
    async function loadAllDataFromFirestore() {
        if (!isAuthReady || !userId) {
            console.warn("Autenticação não pronta ou userId ausente para carregar dados do Firestore. Abortando load.");
            return;
        }
        console.log("loadAllDataFromFirestore called. userId:", userId, "isAuthReady:", isAuthReady);

        // Listener para AI Config - Usa getUserDocumentRef
        onSnapshot(getUserDocumentRef('settings', 'aiConfig'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                aiConfig.aiPersona = data.aiPersona || "Você é um educador financeiro especialista...";
                aiConfig.aiPersonality = data.aiPersonality || "";
            } else {
                 aiConfig.aiPersona = "Você é um educador financeiro especialista...";
                 aiConfig.aiPersonality = "";
            }
            // Popula os campos da UI com os valores carregados ou padrão
            aiPersonaInput.value = aiConfig.aiPersona;
            aiPersonalityInput.value = aiConfig.aiPersonality;
            
            if (!docSnap.exists()) {
                console.log("AI Config não encontrada, salvando padrão.");
                saveAiConfig(); // Salva a configuração padrão se não existir
            }
        }, (error) => {
            console.error("Erro ao carregar AI Config do Firestore:", error);
        });

        // Listener para Categorias (que agora incluem Caixinhas) - Usa getUserDocumentRef
        onSnapshot(getUserDocumentRef('categories', 'userCategories'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().items) {
                categories = docSnap.data().items;
                console.log("Categorias e Caixinhas carregadas do Firestore.");
                renderCategories(categorySearchInput.value);
                updateDashboardAndTransactionSummaries(); // Atualiza os resumos após carregar categorias
                renderExpenseChart(); // Adicionar chamada para o gráfico
                populateFilterCategories(); // ATUALIZADO: Popula o filtro de categorias
            } else { // Se não existir ou estiver vazio, inicializa como array vazio
                categories = [];
                console.log("Categorias e Caixinhas não encontradas ou vazias, inicializando como array vazio.");
                saveCategories(); // Salva para criar o documento vazio se não existir
                renderCategories(categorySearchInput.value);
                updateDashboardAndTransactionSummaries();
                renderExpenseChart(); // Adicionar chamada para o gráfico
                populateFilterCategories(); // ATUALIZADO: Popula o filtro de categorias
            }
        }, (error) => {
            console.error("Erro ao carregar Categorias do Firestore:", error);
        });

        // Listener para Orçamentos - Usa getUserDocumentRef
        onSnapshot(getUserDocumentRef('budgets', 'userBudgets'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().items) {
                budgets = docSnap.data().items;
                console.log("Orçamentos carregados do Firestore.");
                renderBudgets();
            } else { // Se não existir ou estiver vazio, inicializa como array vazio
                budgets = [];
                console.log("Orçamentos não encontrados ou vazios, inicializando como array vazio.");
                saveBudgets(); // Salva para criar o documento vazio se não existir
                renderBudgets();
            }
        }, (error) => {
            console.error("Erro ao carregar Orçamentos do Firestore:", error);
        });

        // Listener para Chaves de API Gemini (ARRAY) - NOVO
        onSnapshot(getUserDocumentRef('settings', 'geminiApiKeys'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().keys && Array.isArray(docSnap.data().keys)) {
                geminiApiKeys = docSnap.data().keys;
                // Popula os campos do modal com as chaves salvas
                modalApiKeyInputs.forEach((input, index) => {
                    input.value = geminiApiKeys[index] || '';
                });
                updateApiModalStatus("Chaves de API carregadas.", "info");
                isGeminiApiReady = geminiApiKeys.some(key => key.trim() !== ''); // Pronto se houver qualquer chave
                console.log("Chaves de API Gemini carregadas do Firestore.");
            } else {
                geminiApiKeys = [];
                modalApiKeyInputs.forEach(input => input.value = ''); // Limpa os campos
                updateApiModalStatus("Nenhuma chave de API salva ainda. Por favor, insira e salve.", "info");
                isGeminiApiReady = false;
                console.log("Chaves de API Gemini não encontradas no Firestore.");
            }
            updateChatUIState();
        }, (error) => {
            console.error("Erro ao carregar Chaves de API Gemini do Firestore:", error);
            geminiApiKeys = [];
            updateApiModalStatus(`Erro ao carregar chaves de API: ${error.message}`, "error");
            isGeminiApiReady = false;
            updateChatUIState();
        });

        // Listener para Transações - Usa getUserCollectionRef
        const transactionsColRef = getUserCollectionRef('transactions');
        if (transactionsColRef) { // Verifica se a referência foi criada com sucesso
            onSnapshot(query(transactionsColRef, orderBy('date', 'desc')), (querySnapshot) => {
                transactions = [];
                querySnapshot.forEach((doc) => {
                    transactions.push({ id: doc.id, ...doc.data() });
                });
                console.log("Transações carregadas do Firestore.");
                renderTransactions(); // Renderiza transações para o currentMonth
                updateDashboardAndTransactionSummaries(); // Atualiza os resumos para o currentMonth
                renderExpenseChart(); // Adicionar chamada para o gráfico
            }, (error) => {
                console.error("Erro ao carregar Transações do Firestore:", error);
            });
        }
    }

    // Função para exibir o status de salvamento (NOVO)
    function showAiConfigSaveStatus() {
        aiConfigStatusMessage.classList.remove('hidden');
        setTimeout(() => {
            aiConfigStatusMessage.classList.add('hidden');
        }, 2000); // A mensagem desaparece após 2 segundos
    }

    // Salva a configuração da IA no Firestore (ATUALIZADO)
    async function saveAiConfig() {
        if (!isAuthReady || !userId) {
            console.warn("Autenticação não pronta ou userId ausente.");
            return;
        }
        try {
            const aiConfigRef = getUserDocumentRef('settings', 'aiConfig');
            const dataToSave = {
                aiPersona: aiPersonaInput.value,
                aiPersonality: aiPersonalityInput.value
            };
            if (aiConfigRef) {
                await setDoc(aiConfigRef, dataToSave, { merge: true }); // Usar merge para não sobrescrever
                showToast("Configurações da IA salvas com sucesso!", "success");
                console.log("Configurações da IA salvas.");
            }
        } catch (error) {
            console.error("Erro ao salvar AI Config:", error);
            showToast(`Erro ao salvar configurações da IA: ${error.message}`, "error");
        }
    }

    // Salva categorias no Firestore (como um único documento com array)
    // Agora lida com categorias normais e caixinhas
    async function saveCategories() {
        if (!isAuthReady || !userId) { 
            console.warn("saveCategories: Autenticação não pronta ou userId ausente. Tentando salvar localmente por agora.");
            showToast('Erro: Autenticação não pronta para salvar no banco.', 'error');
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

    // Salva uma transação individual ou um grupo de transações no Firestore (adicione ou atualize)
    async function saveTransaction(transactionData, installments = 1) {
        if (!isAuthReady || !userId) { console.warn("Autenticação não pronta ou userId ausente."); return; }
        
        try {
            const transactionsColRef = getUserCollectionRef('transactions');
            if (!transactionsColRef) return;

            const batch = writeBatch(db); // Usar batch para operações atômicas

            if (installments > 1 && !transactionData.recurrenceId) {
                // Se for uma nova transação parcelada, gera um recurrenceId para o grupo
                const recurrenceId = generateUUID();
                for (let i = 0; i < installments; i++) {
                    const newTransaction = { ...transactionData };
                    newTransaction.id = generateUUID(); // Novo ID para cada parcela
                    newTransaction.recurrenceId = recurrenceId;
                    newTransaction.installmentNumber = i + 1; // Parcela 1, 2, 3...
                    newTransaction.totalInstallments = installments; // Total de parcelas
                    
                    // Ajusta a data para os meses futuros
                    const originalDate = new Date(transactionData.date + 'T12:00:00');
                    const futureDate = new Date(originalDate.getFullYear(), originalDate.getMonth() + i, originalDate.getDate());
                    newTransaction.date = futureDate.toISOString().split('T')[0];

                    // Ajusta a descrição para indicar a parcela
                    newTransaction.description = `${transactionData.description} (Parc. ${i + 1}/${installments})`;

                    batch.set(doc(transactionsColRef, newTransaction.id), newTransaction);
                }
            } else {
                // Se for uma transação única ou edição de uma parcela existente
                if (transactionData.id) {
                    batch.set(doc(transactionsColRef, transactionData.id), transactionData, { merge: true });
                } else {
                    batch.set(doc(transactionsColRef, generateUUID()), transactionData);
                }
            }
            await batch.commit();
            console.log("Transação(ões) salva(s) com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar Transação(ões):", error);
            showToast(`Erro ao salvar transação: ${error.message}`, 'error');
        }
    }

    // Deleta uma transação individual ou um grupo de transações recorrentes do Firestore
    async function deleteTransactionFromFirestore(id, recurrenceId = null) {
        if (!isAuthReady || !userId) { console.warn("Autenticação não pronta ou userId ausente."); return; }
        try {
            const batch = writeBatch(db);
            const transactionsColRef = getUserCollectionRef('transactions');
            if (!transactionsColRef) return;

            if (recurrenceId) {
                // Deleta todas as transações com o mesmo recurrenceId
                const q = query(transactionsColRef, where("recurrenceId", "==", recurrenceId));
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach((docSnap) => {
                    batch.delete(doc(transactionsColRef, docSnap.id));
                });
                console.log(`Deletando todas as transações com recurrenceId: ${recurrenceId}`);
            } else {
                // Deleta apenas a transação individual
                console.log(`Deletando transação individual: ${id}`);
                batch.delete(doc(transactionsColRef, id));
            }
            await batch.commit();
            showToast("Transação(ões) deletada(s) com sucesso.", "success");
        } catch (error) {
            console.error("Erro ao deletar Transação(ões):", error);
            showToast(`Erro ao deletar transação: ${error.message}`, 'error');
        }
    }

    // Salva orçamentos no Firestore (como um único documento com array)
    async function saveBudgets() {
        if (!isAuthReady || !userId) { console.warn("Autenticação não pronta ou userId ausente."); return; }
        try {
            const userBudgetsRef = getUserDocumentRef('budgets', 'userBudgets');
            if (userBudgetsRef) {
                await setDoc(userBudgetsRef, { items: budgets || [] });
                showToast("Orçamento salvo com sucesso!", "success");
            }
        } catch (error) {
            console.error("Erro ao salvar Orçamentos:", error);
            showToast(`Erro ao salvar orçamento: ${error.message}`, 'error');
        }
    }

    // Salva as chaves da API Gemini no Firestore (ARRAY) - ATUALIZADO
    async function saveApiKeys() {
        if (!isAuthReady || !userId) { 
            updateApiModalStatus("Erro: Autenticação não pronta para salvar as chaves de API.", "error");
            return; 
        }
        const keysToSave = modalApiKeyInputs.map(input => input.value.trim());
        
        // Validação simples: pelo menos uma chave deve ser preenchida
        if (keysToSave.every(key => key === '')) {
            updateApiModalStatus("Por favor, insira pelo menos uma chave de API válida.", "error");
            return;
        }

        try {
            const apiKeyRef = getUserDocumentRef('settings', 'geminiApiKeys');
            if (apiKeyRef) {
                await setDoc(apiKeyRef, { keys: keysToSave });
                geminiApiKeys = keysToSave; // Atualiza o array local
                updateApiModalStatus("Chaves de API salvas com sucesso!", "success");
                isGeminiApiReady = geminiApiKeys.some(key => key.trim() !== '');
                updateChatUIState();
                console.log("Chaves de API Gemini salvas no Firestore.");
            }
        } catch (error) {
            console.error("Erro ao salvar Chaves de API Gemini no Firestore:", error);
            updateApiModalStatus(`Erro ao salvar chaves de API: ${error.message}`, "error");
        }
    }
    // --- FIM das Funções de Persistência (Firebase Firestore) ---

    await initializeFirebase();
    
    // A função loadApiKey agora é disparada pelo onSnapshot dentro de loadAllDataFromFirestore
    // e não precisa mais ser chamada explicitamente aqui ou em openApiKeysModal.
    // A UI de chat será atualizada pelo onSnapshot da chave de API.

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

        // Atualizar o estado ativo dos links de navegação
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageId && (link.classList.contains('nav-link') || link.classList.contains('mobile-nav-item'))) {
                link.classList.add('active');
            }
        });

        // Controla a visibilidade do botão flutuante
        if (pageId === 'dashboard' || pageId === 'transactions') {
            fabButton.classList.remove('hidden');
        } else {
            fabButton.classList.add('hidden');
        }


        // Ações específicas ao carregar cada página
        if (pageId === 'chat') {
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
            bodyEl.classList.add('chat-active');
        } else {
            bodyEl.classList.remove('chat-active');
        }
        
        if (pageId === 'categories-management') {
            renderCategories();
        } else if (pageId === 'transactions') {
            // Ao entrar na página de transações, garante que o mês atual seja exibido
            currentMonth = new Date(); // Reseta para o mês atual
            updateMonthDisplay();
            renderTransactions();
            updateDashboardAndTransactionSummaries();
        } 
        else if (pageId === 'dashboard') {
            updateDashboardAndTransactionSummaries();
            renderExpenseChart(); // Garante que o gráfico é renderizado ao voltar para o dashboard
        } else if (pageId === 'budget-management') {
            renderBudgets();
        } else if (pageId === 'ai-config') {
            // Os valores já são populados pelo onSnapshot
            aiPersonaInput.value = aiConfig.aiPersona;
            aiPersonalityInput.value = aiConfig.aiPersonality;
        }
    }

    // Função para atualizar os cards de resumo no Dashboard
    function updateDashboardAndTransactionSummaries() {
        let totalGlobalIncome = 0;
        let totalGlobalPaidExpenses = 0;
        let totalPendingExpenses = 0;
        const today = new Date();
        const currentMonthYYYYMM = getCurrentMonthYYYYMM(today);

        // Calcula o Saldo Atual Global e Despesas Pagas Globais
        transactions.forEach(t => {
            const isConfirmed = t.status === 'Recebido' || t.status === 'Pago' || t.status === 'Confirmado';
            if (isConfirmed) {
                if (t.type === 'income') {
                    totalGlobalIncome += parseFloat(t.amount);
                } else if (t.type === 'expense') {
                    totalGlobalPaidExpenses += parseFloat(t.amount);
                } else if (t.type === 'caixinha') {
                    if (t.transactionType === 'deposit') {
                        // Depósitos em caixinha são considerados uma "despesa" para o saldo disponível
                        totalGlobalPaidExpenses += parseFloat(t.amount);
                    } else if (t.transactionType === 'withdraw') {
                        // Resgates de caixinha são considerados uma "receita" para o saldo disponível
                        totalGlobalIncome += parseFloat(t.amount);
                    }
                }
            }
        });

        // Calcula Despesas Pendentes (vencidas ou que vencem no mês atual)
        transactions.forEach(t => {
            if (t.type === 'expense' && t.status === 'Pendente') {
                const transactionDate = new Date(t.date + 'T12:00:00');
                // Inclui se a transação for de um mês anterior ou do mês atual e ainda não passou
                if (transactionDate <= today || getCurrentMonthYYYYMM(transactionDate) === currentMonthYYYYMM) {
                    totalPendingExpenses += parseFloat(t.amount);
                }
            }
        });

        const cumulativeBalance = totalGlobalIncome - totalGlobalPaidExpenses;
        dashboardCurrentBalance.textContent = formatCurrency(cumulativeBalance);
        dashboardPaidExpenses.textContent = formatCurrency(totalGlobalPaidExpenses);
        dashboardPendingExpenses.textContent = formatCurrency(totalPendingExpenses);

        // Calcula o Total Guardado em Caixinhas (cumulativo)
        let totalCaixinhasSaved = categories
            .filter(cat => cat.type === 'caixinha')
            .reduce((sum, caixinha) => sum + parseFloat(caixinha.savedAmount || 0), 0);
        dashboardTotalCaixinhasSaved.textContent = formatCurrency(totalCaixinhasSaved);
    }


    // --- Funções de Gerenciamento de Categorias ---

    /**
     * Retorna a próxima cor disponível para uma categoria com base no seu tipo e prioridade.
     * A função tenta encontrar uma cor que ainda não esteja em uso por outras categorias
     * do mesmo tipo/prioridade. Se todas as cores da paleta estiverem em uso, ela cicla.
     * @param {string} type - O tipo da categoria ('income', 'expense', 'caixinha').
     * @param {string} [priority] - A prioridade da categoria ('essential', 'non-essential'), aplicável apenas a 'expense'.
     * @returns {string} A cor hexadecimal selecionada.
     */
    function getNextAvailableColor(type, priority = null) {
        let palette;
        if (type === 'income') {
            palette = INCOME_COLORS;
        } else if (type === 'expense') {
            palette = (priority === 'essential') ? ESSENTIAL_COLORS : NON_ESSENTIAL_COLORS;
        } else if (type === 'caixinha') {
            palette = CAIXINHA_COLORS;
        } else {
            return '#9E9E9E'; // Cor padrão de fallback
        }

        // Filtra as categorias existentes para encontrar as do mesmo tipo/prioridade
        const relevantCategories = categories.filter(cat => {
            if (cat.type !== type) return false;
            if (type === 'expense' && cat.priority !== priority) return false;
            return true;
        });

        const usedColors = new Set(relevantCategories.map(cat => cat.color));

        // Tenta encontrar uma cor não utilizada
        for (const color of palette) {
            if (!usedColors.has(color)) {
                return color;
            }
        }

        // Se todas foram usadas, reutiliza de forma cíclica
        return palette[relevantCategories.length % palette.length];
    }

    // Função para renderizar as categorias (e caixinhas) na lista
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
            categoryItem.className = 'bg-white p-4 rounded-lg shadow-sm flex items-start justify-between';
            
            let typeDisplay = '';
            let priorityDisplay = '';
            let detailsHtml = '';

            if (category.type === 'income') {
                typeDisplay = 'Receita';
                detailsHtml = `<p class="text-sm text-gray-500">${typeDisplay}</p>`;
            } else if (category.type === 'expense') {
                typeDisplay = 'Despesa';
                priorityDisplay = category.priority ? (category.priority === 'essential' ? 'Essencial' : 'Não Essencial') : '';
                detailsHtml = `<p class="text-sm text-gray-500">${typeDisplay} &bull; ${priorityDisplay}</p>`;
            } else if (category.type === 'caixinha') {
                typeDisplay = 'Caixinha';
                const saved = parseFloat(category.savedAmount || 0);
                const target = parseFloat(category.targetAmount || 0);
                const progress = (target > 0) ? (saved / target) * 100 : 0;
                const progressBarColor = progress >= 100 ? 'bg-green-500' : (progress > 50 ? 'bg-blue-500' : 'bg-yellow-500');

                detailsHtml = `
                    <p class="text-sm text-gray-500">${typeDisplay}</p>
                    <p class="text-sm text-gray-600 mt-1">
                        <span class="font-medium">${formatCurrency(saved)}</span> de ${formatCurrency(target)}
                    </p>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                        <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${Math.min(100, progress)}%"></div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1 text-right">${progress.toFixed(0)}% Concluído</p>
                `;
            }

            categoryItem.innerHTML = `
                <div class="flex items-start flex-grow">
                    <div class="w-4 h-4 rounded-full mr-4 mt-1" style="background-color: ${category.color};"></div>
                    <div class="flex-grow">
                        <p class="font-semibold text-lg text-gray-800">${category.name}</p>
                        ${detailsHtml}
                    </div>
                </div>
                <div class="relative">
                    <button class="action-menu-button p-2 rounded-full hover:bg-gray-100" data-id="${category.id}">
                        <i class="fa-solid fa-ellipsis-vertical text-gray-500"></i>
                    </button>
                    <div class="action-menu-dropdown hidden">
                        <a href="#" class="edit-category-button" data-id="${category.id}">Editar</a>
                        <a href="#" class="delete-category-button" data-id="${category.id}">Apagar</a>
                    </div>
                </div>
            `;
            categoryListContainer.appendChild(categoryItem);
        });
    }

    // Abre o modal de categoria (agora também para caixinhas)
    function openCategoryModal(category = null) {
        categoryModal.classList.add('active');
        categoryForm.reset(); // Limpa o formulário
        categoryTargetAmountInput.value = ''; // Limpa o campo de valor alvo

        if (category) {
            categoryModalTitle.textContent = 'Editar Categoria';
            categoryIdInput.value = category.id;
            categoryNameInput.value = category.name;
            document.querySelector(`input[name="category-type"][value="${category.type}"]`).checked = true;
            
            // Controla a visibilidade do campo de prioridade
            if (category.type === 'expense') {
                priorityField.style.display = 'block';
                document.querySelector(`input[name="category-priority"][value="${category.priority || 'essential'}"]`).checked = true;
            } else {
                priorityField.style.display = 'none';
            }

            // Controla a visibilidade e preenche o campo de valor alvo para caixinhas
            if (category.type === 'caixinha') {
                targetAmountField.style.display = 'block';
                categoryTargetAmountInput.value = (parseFloat(category.targetAmount || 0) * 100).toFixed(0);
                formatCurrencyInput(categoryTargetAmountInput); // Formata o valor
            } else {
                targetAmountField.style.display = 'none';
            }

        } else { // Adicionar nova categoria/caixinha
            categoryModalTitle.textContent = 'Adicionar Nova Categoria ou Caixinha';
            categoryIdInput.value = '';
            categoryNameInput.value = '';
            document.querySelector('input[name="category-type"][value="expense"]').checked = true; // Padrão para Despesa
            priorityField.style.display = 'block'; // Visível por padrão para despesa
            document.querySelector(`input[name="category-priority"][value="essential"]`).checked = true;
            targetAmountField.style.display = 'none'; // Escondido por padrão
        }
    }

    // Fecha o modal de categoria
    function closeCategoryModal() {
        categoryModal.classList.remove('active');
        categoryForm.reset();
    }

    // Lida com o envio do formulário de categoria
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
            // Se estiver editando uma caixinha existente, mantém o savedAmount
            if (id) {
                const existingCategory = categories.find(cat => cat.id === id);
                savedAmount = existingCategory ? existingCategory.savedAmount : 0;
            } else {
                // Se for uma nova caixinha, o valor guardado começa em 0
                savedAmount = 0;
            }
        }

        if (id) { // Editando uma categoria existente
            const index = categories.findIndex(cat => cat.id === id);
            if (index !== -1) {
                const originalCategory = categories[index];
                const mudouTipo = originalCategory.type !== type;
                const mudouPrioridade = originalCategory.priority !== priority;
                                        
                // Mantém a cor se o tipo/prioridade não mudar
                let newColor = originalCategory.color; 
                                        
                // Recalcula a cor apenas se o tipo ou prioridade mudou
                if (mudouTipo || mudouPrioridade) {
                    newColor = getNextAvailableColor(type, priority);
                }
                categories[index] = { 
                    ...originalCategory, 
                    name, 
                    type, 
                    priority, 
                    color: newColor,
                    targetAmount: targetAmount, // Atualiza targetAmount
                    savedAmount: savedAmount // Atualiza savedAmount
                };
            }
        } else { // Criando uma nova categoria
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
        showToast('Categoria salva com sucesso!', 'success');
        
        // Se o modal de transação estiver aberto, atualiza a lista de categorias lá
        if(transactionModal.classList.contains('active')) {
            const selectedType = document.querySelector('input[name="transaction-type"]:checked').value;
            // Encontra o ID da categoria que acabou de ser criada/editada
            const lastSavedCategory = categories.find(c => c.name === name && c.type === type);
            populateTransactionCategories(selectedType);
            // Seleciona a categoria recém-criada
            if(lastSavedCategory) {
                 transactionCategorySelect.value = lastSavedCategory.id;
            }
        }
        closeCategoryModal(); // Fecha o modal após salvar
    });

    // Lida com cliques nos botões de editar/excluir categorias (delegação de eventos)
    categoryListContainer.addEventListener('click', (e) => {
        const target = e.target;
        // Lógica para o menu de 3 pontos
        const menuButton = target.closest('.action-menu-button');
        if (menuButton) {
            e.stopPropagation(); 
            const dropdown = menuButton.nextElementSibling;
            document.querySelectorAll('.action-menu-dropdown').forEach(openDropdown => {
                if (openDropdown !== dropdown) {
                    openDropdown.classList.add('hidden');
                }
            });
            dropdown.classList.toggle('hidden');
            return;
        }

        const editButton = target.closest('.edit-category-button');
        if (editButton) {
            const id = editButton.dataset.id;
            const categoryToEdit = categories.find(cat => cat.id === id);
            if (categoryToEdit) {
                openCategoryModal(categoryToEdit);
            }
        } 
        
        const deleteButton = target.closest('.delete-category-button');
        if (deleteButton) {
            const id = deleteButton.dataset.id;
            const categoryToDelete = categories.find(cat => cat.id === id);

            showConfirmationModal(
                "Confirmar Exclusão",
                `Tem certeza que deseja excluir a categoria "${categoryToDelete.name}"? Todas as transações associadas a ela ficarão sem categoria.`,
                async () => {
                    categories = categories.filter(cat => cat.id !== id);
                    const transactionsToUpdate = transactions.filter(t => t.categoryId === id);
                    for (const t of transactionsToUpdate) {
                        t.categoryId = 'unknown'; // Define como categoria desconhecida
                        t.transactionType = null; // Limpa o tipo de transação se for caixinha
                        t.caixinhaId = null; // Limpa o ID da caixinha
                        await saveTransaction(t);
                    }
                    await saveCategories();
                    showToast("Categoria deletada.", "info");
                    updateDashboardAndTransactionSummaries();
                }
            );
        }
    });

    // Lógica para mostrar/esconder o campo de prioridade e valor alvo
    categoryTypeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            const selectedType = event.target.value;
            // Mostra/esconde campo de prioridade
            priorityField.style.display = (selectedType === 'expense') ? 'block' : 'none';
            // Mostra/esconde campo de valor alvo
            targetAmountField.style.display = (selectedType === 'caixinha') ? 'block' : 'none';
            // Limpa o valor do campo alvo se não for caixinha
            if (selectedType !== 'caixinha') {
                categoryTargetAmountInput.value = '';
            }
        });
    });

    // Listener para formatar o input de valor alvo da categoria/caixinha
    categoryTargetAmountInput.addEventListener('input', () => {
        formatCurrencyInput(categoryTargetAmountInput);
    });


    // --- Funções de Gerenciamento de Transações ---

    // Função para popular o dropdown de categorias (e caixinhas) no modal de transações
    function populateTransactionCategories(selectedTransactionType = null) {
        const previouslySelected = transactionCategorySelect.value; // Salva a categoria selecionada
        transactionCategorySelect.innerHTML = '<option value="">Selecione uma Categoria</option>';

        let filteredCategories = [];
        // A lógica aqui precisa ser mais inteligente para o novo fluxo:
        // Se for 'income' ou 'expense', filtra por essas categorias.
        // Se for 'deposit' ou 'withdraw', filtra por categorias do tipo 'caixinha'.
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
            transactionCategorySelect.innerHTML += '<option value="" disabled>Nenhuma categoria disponível para este tipo</option>';
        }

        // Tenta restaurar a seleção anterior se ela ainda for válida na nova lista
        if (Array.from(transactionCategorySelect.options).some(opt => opt.value === previouslySelected)) {
            transactionCategorySelect.value = previouslySelected;
        }
    }


    // Renderiza as transações
    function renderTransactions() {
        transactionsListContainer.innerHTML = `
            <div class="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        `; 

        const currentMonthYYYYMM = getCurrentMonthYYYYMM(currentMonth);

        // APLICA FILTROS (NOVO)
        const typeFilter = filterTypeSelect.value;
        const categoryFilter = filterCategorySelect.value;
        const statusFilter = filterStatusSelect.value;

        const filteredTransactions = transactions.filter(t => {
            const transactionMonth = t.date.substring(0, 7);
            if (transactionMonth !== currentMonthYYYYMM) return false;
            
            if (typeFilter !== 'all' && t.type !== typeFilter) return false;
            if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
            if (statusFilter !== 'all' && t.status !== statusFilter) return false;
            
            return true;
        });

        if (filteredTransactions.length === 0) {
            transactionsListContainer.innerHTML += '<p class="text-center text-gray-500 py-4" id="no-transactions-message">Nenhuma transação encontrada para os filtros selecionados.</p>';
            return;
        }

        const groupedTransactions = filteredTransactions.reduce((acc, transaction) => {
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

            groupedTransactions[date].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA.getTime() === dateB.getTime()) {
                    return a.description.localeCompare(b.description);
                }
                return dateB - dateA;
            }).forEach(transaction => {
                let categoryName = 'Categoria Desconhecida';
                let bulletColor = '#9E9E9E';
                let amountColorClass = '';
                let amountPrefix = '';
                let transactionTypeDisplay = '';

                const category = categories.find(cat => cat.id === transaction.categoryId);
                if (category) {
                    categoryName = category.name;
                    bulletColor = category.color;
                } else {
                    categoryName = 'Categoria Desconhecida';
                    bulletColor = '#9E9E9E';
                }

                if (transaction.type === 'income') {
                    amountColorClass = 'text-[var(--color-green-positive)]';
                    amountPrefix = '+';
                    transactionTypeDisplay = categoryName;
                } else if (transaction.type === 'expense') {
                    amountColorClass = 'text-[var(--color-red-negative)]';
                    amountPrefix = '-';
                    transactionTypeDisplay = categoryName;
                } else if (transaction.type === 'caixinha') {
                    if (transaction.transactionType === 'deposit') {
                        amountColorClass = 'text-blue-600'; // Cor azul para depósito
                        amountPrefix = '→'; // Seta para indicar movimento
                        transactionTypeDisplay = `Depósito em: ${categoryName}`;
                    } else if (transaction.transactionType === 'withdraw') {
                        amountColorClass = 'text-indigo-600'; // Cor índigo para resgate
                        amountPrefix = '←'; // Seta para indicar movimento
                        transactionTypeDisplay = `Resgate de: ${categoryName}`;
                    }
                }
                
                const isPaidOrReceived = (transaction.status === 'Pago' || transaction.status === 'Recebido' || transaction.status === 'Confirmado');
                const bulletClass = isPaidOrReceived ? 'transaction-bullet paid' : 'transaction-bullet';
                const bulletStyle = isPaidOrReceived ? `background-color: ${bulletColor};` : `border: 3px solid ${bulletColor};`;
                
                const statusIndicatorText = transaction.status === 'Pendente' ? 'Pendente' : 
                                            (transaction.type === 'income' && transaction.status === 'Recebido' ? 'Recebido' : 
                                            (transaction.type === 'expense' && transaction.status === 'Pago' ? 'Pago' : 
                                            (transaction.type === 'caixinha' && transaction.status === 'Confirmado' ? 'Confirmado' : '')));
                const statusIndicatorHtml = statusIndicatorText ? `<p class="text-xs text-gray-500">${statusIndicatorText}</p>` : '';

                const installmentInfo = transaction.installmentNumber && transaction.totalInstallments ? 
                                        `<span class="text-xs text-gray-500 ml-2">(Parc. ${transaction.installmentNumber}/${transaction.totalInstallments})</span>` : '';

                const transactionItem = document.createElement('div');
                transactionItem.className = `bg-white p-4 rounded-lg shadow-sm flex justify-between items-center relative pl-8`; 
                transactionItem.innerHTML = `
                    <div class="${bulletClass}" style="${bulletStyle}"></div>
                    <div class="flex-grow min-w-0">
                        <p class="font-medium truncate text-gray-800">${transactionTypeDisplay} ${installmentInfo}</p>
                        ${statusIndicatorHtml}
                        <p class="text-sm text-gray-500 truncate">${transaction.description}</p>
                    </div>
                    <div class="flex items-center space-x-2 ml-4">
                        <p class="font-bold text-lg ${amountColorClass}">${amountPrefix} ${formatCurrency(transaction.amount)}</p>
                        <div class="relative">
                            <button class="action-menu-button p-2 rounded-full hover:bg-gray-100" data-id="${transaction.id}">
                                <i class="fa-solid fa-ellipsis-vertical text-gray-500"></i>
                            </button>
                            <div class="action-menu-dropdown hidden">
                                <a href="#" class="edit-transaction-button" data-id="${transaction.id}">Editar</a>
                                <a href="#" class="delete-transaction-button" data-id="${transaction.id}">Apagar</a>
                                ${transaction.recurrenceId ? `<a href="#" class="delete-recurrence-button" data-recurrence-id="${transaction.recurrenceId}">Apagar Recorrência</a>` : ''}
                            </div>
                        </div>
                    </div>
                `;
                transactionsForDateDiv.appendChild(transactionItem);
            });
            transactionsListContainer.appendChild(dateGroupDiv);
        });
        
    }

    // Função para atualizar as opções de status com botões de rádio
    function updateTransactionStatusOptions(transactionType) {
        const statusContainer = document.getElementById('transaction-status-options');
        statusContainer.innerHTML = '';
        let options = [];
        if (transactionType === 'income') {
            options = [{ value: 'Recebido', label: 'Recebido' }, { value: 'Pendente', label: 'Pendente' }];
        } else if (transactionType === 'expense') {
            options = [{ value: 'Pago', label: 'Pago' }, { value: 'Pendente', label: 'Pendente' }];
        } else { // caixinha (deposit/withdraw)
            options = [{ value: 'Confirmado', label: 'Confirmado' }]; // Simplificado para caixinhas
        }

        options.forEach((opt, index) => {
            const wrapper = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'transaction-status-radio'; // Novo nome para evitar conflito com o select removido
            input.id = `status-${opt.value}`;
            input.value = opt.value;
            input.className = 'hidden peer';
            if (index === 0) input.checked = true; // Marca a primeira opção como padrão

            const label = document.createElement('label');
            label.htmlFor = `status-${opt.value}`;
            label.textContent = opt.label;
            label.className = 'px-4 py-2 border rounded-lg cursor-pointer transition peer-checked:bg-[var(--color-blue-primary)] peer-checked:text-white peer-checked:border-[var(--color-blue-primary)]';
            
            wrapper.appendChild(input);
            wrapper.appendChild(label);
            statusContainer.appendChild(wrapper);
        });
    }

    // Função para controlar a visibilidade das etapas do modal de transação
    function goToStep(stepNumber, preserveState = false) {
        if (stepNumber < 1 || stepNumber > totalSteps) {
            console.error("Tentativa de ir para uma etapa inválida:", stepNumber);
            return;
        }

        let savedCategory = '';
        if (preserveState) {
            savedCategory = transactionCategorySelect.value;
        }

        currentStep = stepNumber;
        transactionSteps.forEach((step, index) => {
            if (index + 1 === currentStep) {
                step.classList.remove('hidden');
            } else {
                step.classList.add('hidden');
            }
        });

        // Ações específicas para cada etapa ao navegar
        if (currentStep === 2) {
            const selectedType = document.querySelector('input[name="transaction-type"]:checked').value;
            populateTransactionCategories(selectedType);
            if (preserveState && savedCategory) {
                 transactionCategorySelect.value = savedCategory;
            }

            // Mostra ou esconde o botão de sugestão de IA
            if (selectedType === 'deposit' || selectedType === 'withdraw') {
                suggestCategoryButton.style.display = 'none';
            } else {
                suggestCategoryButton.style.display = 'inline-flex';
            }

            transactionAmountInput.focus();
        } else if (currentStep === 3) {
            // Lógica combinada da antiga etapa 3 e 4
            const selectedType = document.querySelector('input[name="transaction-type"]:checked').value;
            updateTransactionStatusOptions(selectedType); // Move a chamada para cá
            if (transactionIdInput.value) {
                const transactionToEdit = transactions.find(t => t.id === transactionIdInput.value);
                if (transactionToEdit) {
                    const statusRadio = document.querySelector(`input[name="transaction-status-radio"][value="${transactionToEdit.status}"]`);
                    if (statusRadio) statusRadio.checked = true;
                }
            }
            
            if (selectedType === 'expense' || selectedType === 'income') {
                installmentsField.style.display = 'block';
            } else {
                installmentsField.style.display = 'none';
                transactionInstallmentsInput.value = 1;
            }

            if (transactionIdInput.value) {
                const transactionToEdit = transactions.find(t => t.id === transactionIdInput.value);
                 if (transactionToEdit && transactionToEdit.totalInstallments) {
                    transactionInstallmentsInput.value = transactionToEdit.totalInstallments;
                    transactionInstallmentsInput.disabled = true;
                } else {
                    transactionInstallmentsInput.value = 1;
                    transactionInstallmentsInput.disabled = false;
                }
            } else {
                transactionInstallmentsInput.value = 1;
                transactionInstallmentsInput.disabled = false;
            }
            transactionDateInput.focus();
        }
    }


    // Abre o modal de transação (agora apenas reseta e vai para a primeira etapa)
    function openTransactionModal(transaction = null) {
        transactionModal.classList.add('active');
        transactionForm.reset();
        transactionDateInput.valueAsDate = new Date(); // Define data padrão
        
        if (transaction) {
            transactionIdInput.value = transaction.id;
            transactionAmountInput.value = (parseFloat(transaction.amount) * 100).toFixed(0);
            formatCurrencyInput(transactionAmountInput);
            transactionDescriptionInput.value = transaction.description;
            transactionDateInput.value = transaction.date;

            // Marca o tipo de transação correto para edição
            let typeToSelect = transaction.type;
            if (transaction.type === 'caixinha') {
                typeToSelect = transaction.transactionType; // 'deposit' ou 'withdraw'
            }
            const typeButton = document.querySelector(`.step-1-type-button[data-type="${typeToSelect}"]`);
            if (typeButton) {
                document.querySelectorAll('.step-1-type-button').forEach(btn => btn.classList.remove('selected'));
                typeButton.classList.add('selected');
                document.querySelector(`input[name="transaction-type"][value="${typeToSelect}"]`).checked = true;
            }
            
            populateTransactionCategories(typeToSelect);
            transactionCategorySelect.value = transaction.categoryId;
            goToStep(2, true); // Pula para a etapa 2, preservando o estado
        } else {
            transactionIdInput.value = ''; // Garante que o ID da transação seja limpo para novas transações
            goToStep(1);
            // Remove a classe 'selected' de todos os botões de tipo ao abrir o modal
            document.querySelectorAll('.step-1-type-button').forEach(button => {
                button.classList.remove('selected');
            });
        }
    }

    // Fecha o modal de transação
    function closeTransactionModal() {
        transactionModal.classList.remove('active');
        transactionForm.reset();
        currentStep = 1; // Reseta para a primeira etapa ao fechar
    }

    // Lida com o envio do formulário de transação
    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // O tipo agora vem do radio button oculto
        const typeSelectedInStep1 = document.querySelector('input[name="transaction-type"]:checked').value;
        
        const id = transactionIdInput.value;
        const description = transactionDescriptionInput.value.trim();
        
        const amountFormatted = transactionAmountInput.value.replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(amountFormatted);

        const date = transactionDateInput.value;
        // ATUALIZADO: Obtém o valor do rádio selecionado
        const status = document.querySelector('input[name="transaction-status-radio"]:checked').value; 
        const categoryId = transactionCategorySelect.value;
        const installments = parseInt(transactionInstallmentsInput.value, 10) || 1; // Novo campo de parcelas

        let transactionTypeForCaixinha = null; // 'deposit' or 'withdraw'
        let transactionCategoryType = null; // 'income', 'expense', or 'caixinha'

        // Validação básica (descrição agora é opcional)
        if (isNaN(amount) || !date || !status || !categoryId) {
            showConfirmationModal("Erro de Validação", "Por favor, preencha todos os campos da transação corretamente (valor, data, status, categoria).", () => {});
            return;
        }
        if (installments < 1) {
            showConfirmationModal("Erro de Validação", "O número de parcelas deve ser no mínimo 1.", () => {});
            return;
        }

        // Determina o tipo de transação real ('income', 'expense', 'caixinha')
        // e o tipo de movimento da caixinha ('deposit', 'withdraw')
        const selectedCategory = categories.find(cat => cat.id === categoryId);

        if (!selectedCategory) {
            console.error("Categoria selecionada não encontrada.");
            return;
        }

        transactionCategoryType = selectedCategory.type;

        if (selectedCategory.type === 'caixinha') {
            // Se a categoria é uma caixinha, o 'type' da transação será 'caixinha'
            // e 'transactionTypeForCaixinha' será 'deposit' ou 'withdraw'
            if (typeSelectedInStep1 === 'deposit') {
                transactionTypeForCaixinha = 'deposit';
                selectedCategory.savedAmount = (selectedCategory.savedAmount || 0) + amount;
            } else if (typeSelectedInStep1 === 'withdraw') {
                transactionTypeForCaixinha = 'withdraw';
                if ((selectedCategory.savedAmount || 0) < amount) {
                    showConfirmationModal(
                        "Erro de Resgate",
                        "O valor que você está tentando resgatar é maior do que o valor guardado nesta caixinha. Por favor, ajuste o valor.",
                        () => {} // Não faz nada ao confirmar, apenas fecha o modal
                    );
                    return; // Impede o salvamento da transação
                }
                selectedCategory.savedAmount -= amount;
            }
            await saveCategories(); // Salva o estado atualizado das categorias (que inclui a caixinha)
        }

        // Criar ou atualizar a transação
        const newTransaction = { 
            id: id || generateUUID(), 
            description, 
            amount, 
            date, 
            type: transactionCategoryType, // Usa o tipo real da categoria
            categoryId, 
            status 
        };

        // Adiciona campos específicos para transações de caixinha se aplicável
        if (transactionCategoryType === 'caixinha') {
            newTransaction.transactionType = transactionTypeForCaixinha;
            newTransaction.caixinhaId = selectedCategory.id; // O ID da caixinha é o ID da categoria
        }

        // Salva a transação, passando o número de parcelas
        await saveTransaction(newTransaction, installments);
        showToast("Transação salva com sucesso!", "success");
        closeTransactionModal();
    });

    // Lida com cliques nos botões de editar/excluir transações (delegação de eventos)
    transactionsListContainer.addEventListener('click', (e) => {
        const target = e.target;
    
        // Lógica para o menu de 3 pontos
        const menuButton = target.closest('.action-menu-button');
        if (menuButton) {
            e.stopPropagation();
            const dropdown = menuButton.nextElementSibling;
            // Fecha outros menus abertos
            document.querySelectorAll('.action-menu-dropdown').forEach(openDropdown => {
                if (openDropdown !== dropdown) {
                    openDropdown.classList.add('hidden');
                }
            });
            dropdown.classList.toggle('hidden');
            return;
        }
    
        // Lógica para o botão de editar
        const editButton = target.closest('.edit-transaction-button');
        if (editButton) {
            const id = editButton.dataset.id;
            const transactionToEdit = transactions.find(t => t.id === id);
            if (transactionToEdit) {
                openTransactionModal(transactionToEdit);
            }
            return; // Encerra a execução para evitar outros gatilhos
        }
    
        // Lógica para o botão de apagar
        const deleteButton = target.closest('.delete-transaction-button');
        if (deleteButton) {
            const id = deleteButton.dataset.id;
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
                }
            );
            return;
        }
    
        // Lógica para o botão de apagar recorrência
        const deleteRecurrenceButton = target.closest('.delete-recurrence-button');
        if (deleteRecurrenceButton) {
            const recurrenceId = deleteRecurrenceButton.dataset.recurrenceId;
            showConfirmationModal(
                "Confirmar Exclusão de Parcelas",
                "Tem certeza que deseja excluir TODAS as parcelas desta recorrência? Esta ação não pode ser desfeita.",
                async () => {
                    const transactionsInRecurrence = transactions.filter(t => t.recurrenceId === recurrenceId);
                    for (const t of transactionsInRecurrence) {
                        if (t.type === 'caixinha' && t.caixinhaId) {
                            const caixinha = categories.find(c => c.id === t.caixinhaId);
                            if (caixinha) {
                                if (t.transactionType === 'deposit') {
                                    caixinha.savedAmount -= parseFloat(t.amount);
                                } else if (t.transactionType === 'withdraw') {
                                    caixinha.savedAmount += parseFloat(t.amount);
                                }
                            }
                        }
                    }
                    await saveCategories();
                    await deleteTransactionFromFirestore(null, recurrenceId);
                }
            );
            return;
        }
    });


    // Listener para formatar o input de valor da transação
    transactionAmountInput.addEventListener('input', () => {
        formatCurrencyInput(transactionAmountInput);
    });

    // --- Funções de Navegação por Mês ---
    function updateMonthDisplay() {
        currentMonthDisplay.textContent = formatMonthDisplay(currentMonth);
    }

    prevMonthButton.addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        updateMonthDisplay();
        renderTransactions();
        updateDashboardAndTransactionSummaries();
        renderExpenseChart(); // Atualiza o gráfico
        renderBudgets(); // Atualiza os orçamentos
    });

    nextMonthButton.addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        updateMonthDisplay();
        renderTransactions();
        updateDashboardAndTransactionSummaries();
        renderExpenseChart(); // Atualiza o gráfico
        renderBudgets(); // Atualiza os orçamentos
    });


    // --- Funções de Gerenciamento de Orçamento ---
    function openBudgetModal(budget = null) {
        budgetForm.reset();
        budgetCategorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
            
        // Popula o select com apenas as categorias de despesa
        const expenseCategories = categories.filter(c => c.type === 'expense');
        expenseCategories.forEach(cat => {
            // Impede que categorias já orçadas neste mês apareçam para novos orçamentos
            const isAlreadyBudgeted = budgets.some(b => b.categoryId === cat.id && b.month === getCurrentMonthYYYYMM(currentMonth)); // Usa currentMonth
            if (!budget && isAlreadyBudgeted) return; // Se não estiver editando e já houver orçamento, pula
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            budgetCategorySelect.appendChild(option);
        });

        if (budget) {
            budgetModalTitle.textContent = 'Editar Orçamento';
            budgetIdInput.value = budget.id;
            budgetCategorySelect.value = budget.categoryId;
            budgetCategorySelect.disabled = true; // Não permite mudar a categoria na edição
            budgetAmountInput.value = (parseFloat(budget.amount) * 100).toFixed(0); // Coloca em centavos para formatCurrencyInput
            formatCurrencyInput(budgetAmountInput); // Formata o valor
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
        const currentMonthYYYYMM = getCurrentMonthYYYYMM(currentMonth); // Usa currentMonth
        const currentMonthBudgets = budgets.filter(b => b.month === currentMonthYYYYMM);
        if (currentMonthBudgets.length === 0) {
            budgetListContainer.innerHTML = '<p class="text-center text-gray-500 py-4 col-span-full">Nenhum orçamento configurado para este mês.</p>';
            return;
        }
        noBudgetsMessage.classList.add('hidden'); // Esconde a mensagem se houver orçamentos

        currentMonthBudgets.forEach(budget => {
            const category = categories.find(c => c.id === budget.categoryId);
            if (!category) return; // Pula se a categoria foi deletada
            
            // Calcula o gasto real para essa categoria no mês corrente
            const totalSpent = transactions.filter(t => 
                    t.categoryId === budget.categoryId && 
                    t.type === 'expense' && // Apenas despesas
                    t.date.startsWith(currentMonthYYYYMM) && // Filtra pelo mês atual
                    (t.status === 'Pago' || t.status === 'Recebido' || t.status === 'Confirmado') // Apenas transações pagas/recebidas
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

    // --- Funções de Chat e IA ---

    /**
     * Tenta executar uma chamada à API Gemini usando uma chave específica.
     * Se a chave falhar com um erro de cota, tenta a próxima chave na lista.
     * @param {object} payload - O corpo da requisição para a API Gemini.
     * @param {number} attemptIndex - O índice da chave a ser tentada.
     * @returns {Promise<object>} - O resultado da API em caso de sucesso.
     * @throws {Error} - Se todas as chaves falharem.
     */
    async function tryNextApiKey(payload, attemptIndex) {
        const validKeys = geminiApiKeys.filter(key => key && key.trim() !== '');
        if (attemptIndex >= validKeys.length) {
            throw new Error("Todas as chaves de API falharam ou estão sem cota.");
        }

        const apiKey = validKeys[attemptIndex];
        const model = payload.generationConfig && payload.generationConfig.response_mime_type === "application/json" ? "gemini-1.5-flash-latest" : "gemini-1.5-flash-latest";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        console.log(`Tentando API com a chave ${attemptIndex + 1} e modelo ${model}...`);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // Se a resposta não for OK, trata como erro e tenta a próxima chave
                const errorResult = await response.json();
                const errorMessage = errorResult.error ? errorResult.error.message : response.statusText;
                console.error(`Erro da API com a chave ${attemptIndex + 1}:`, errorMessage);

                if (response.status === 429 || (errorMessage && errorMessage.includes("resource has been exhausted"))) {
                    console.warn(`Chave ${attemptIndex + 1} atingiu o limite de cota. Tentando a próxima.`);
                    return tryNextApiKey(payload, attemptIndex + 1);
                }
                // Outros erros
                throw new Error(`Erro da API: ${errorMessage}`);
            }

            const result = await response.json();
            
            // Se a chave funcionou, atualiza o índice global e o indicador visual
            currentGeminiApiKeyIndex = geminiApiKeys.indexOf(apiKey);
            updateActiveApiKeyIndicator();
            return result; // Retorna o resultado bem-sucedido

        } catch (error) {
            console.error(`Erro de rede ou desconhecido com a chave ${attemptIndex + 1}:`, error);
            // Em caso de erro de rede, também tenta a próxima chave
            return tryNextApiKey(payload, attemptIndex + 1);
        }
    }
    
    // Função para atualizar o indicador visual da chave de API ativa
    function updateActiveApiKeyIndicator() {
        const validKeys = geminiApiKeys.filter(key => key && key.trim() !== '');
        if (validKeys.length > 0) {
            activeApiKeyIndicator.textContent = `Chave ${currentGeminiApiKeyIndex + 1}/${validKeys.length}`;
            activeApiKeyIndicator.classList.remove('hidden');
        } else {
            activeApiKeyIndicator.classList.add('hidden');
        }
    }

    function appendMessage(sender, text, type = 'text') {
        const messageDiv = document.createElement('div');
        const bubbleDiv = document.createElement('div');

        if (sender === 'user') {
            messageDiv.className = 'flex justify-end';
            bubbleDiv.className = 'bg-[var(--color-blue-primary)] text-white p-3 rounded-xl rounded-br-none max-w-xs md:max-w-md shadow-sm';
        } else { // sender === 'ai' or 'model'
            messageDiv.className = 'flex justify-start';
            bubbleDiv.className = 'bg-gray-100 text-gray-800 p-3 rounded-xl rounded-bl-none max-w-xs md:max-w-md shadow-sm';
            if (type === 'error') {
                bubbleDiv.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-400');
            }
        }

        // Usamos innerHTML para renderizar tags HTML básicas que o modelo de IA pode gerar
        bubbleDiv.innerHTML = text; 
        messageDiv.appendChild(bubbleDiv);
        chatMessagesDiv.appendChild(messageDiv);

        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }

    // Função para obter dados financeiros formatados para a IA
    function getFinancialDataForAI() {
        let dataString = "";
    
        // 1. Resumo Geral
        dataString += "<strong>Resumo Financeiro Geral:</strong><br>";
        dataString += `- Saldo Disponível (Receitas - Despesas Pagas): ${dashboardCurrentBalance.textContent}<br>`;
        dataString += `- Total Guardado em Caixinhas (não incluso no saldo): ${dashboardTotalCaixinhasSaved.textContent}<br>`;
        dataString += `- Total de Despesas Pendentes (Vencidas + Mês Atual): ${dashboardPendingExpenses.textContent}<br>`;
    
        // 2. Pontos de Atenção (Problemas a serem resolvidos)
        const categoryIds = new Set(categories.map(c => c.id));
        const uncategorizedTransactions = transactions.filter(t => !categoryIds.has(t.categoryId));
        
        const budgetedCategoryIds = new Set(budgets.map(b => b.categoryId));
        const expensesWithoutBudget = transactions.filter(t => t.type === 'expense' && !budgetedCategoryIds.has(t.categoryId));
        const totalSpentWithoutBudget = expensesWithoutBudget.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
        if (uncategorizedTransactions.length > 0 || totalSpentWithoutBudget > 0) {
            dataString += "<br><strong>Pontos de Atenção:</strong><br>";
            if (uncategorizedTransactions.length > 0) {
                dataString += `- Existem <strong>${uncategorizedTransactions.length} transações sem categoria definida</strong>. É importante categorizá-las para uma análise correta.<br>`;
            }
            if (totalSpentWithoutBudget > 0) {
                dataString += `- Você gastou <strong>${formatCurrency(totalSpentWithoutBudget)}</strong> em categorias que não possuem um orçamento definido.<br>`;
            }
        }
    
        // 3. Resumo Mensal Detalhado (últimos 3 meses)
        dataString += "<br><strong>Análise Mensal Detalhada:</strong><br>";
        const lastThreeMonths = new Set();
        const today = new Date();
        for (let i = 0; i < 3; i++) {
            lastThreeMonths.add(getCurrentMonthYYYYMM(new Date(today.getFullYear(), today.getMonth() - i, 1)));
        }
    
        lastThreeMonths.forEach(monthYYYYMM => {
            const monthTransactions = transactions.filter(t => t.date.startsWith(monthYYYYMM));
            if (monthTransactions.length === 0) return;
    
            const monthDate = new Date(monthYYYYMM + '-02T00:00:00');
            const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            
            let monthIncome = 0;
            let monthExpenses = 0;
            
            monthTransactions.forEach(t => {
                if(t.status === 'Pago' || t.status === 'Recebido' || t.status === 'Confirmado'){
                    if(t.type === 'income') monthIncome += parseFloat(t.amount);
                    if(t.type === 'expense') monthExpenses += parseFloat(t.amount);
                }
            });
    
            dataString += `<br><strong>${monthName}:</strong><br>`;
            dataString += `- Receitas: ${formatCurrency(monthIncome)}<br>`;
            dataString += `- Despesas: ${formatCurrency(monthExpenses)}<br>`;
            dataString += `- Saldo do Mês: ${formatCurrency(monthIncome - monthExpenses)}<br>`;
        });
    
        dataString += "<br>--- Fim dos Dados Financeiros ---<br>";
        return dataString;
    }

    async function sendChatMessage(userMessage) {
        if (isSendingMessage) {
            return;
        }

        if (userMessage.trim() === "") return;

        const validKeys = geminiApiKeys.filter((key) => key && key.trim() !== "");
        if (!isGeminiApiReady || validKeys.length === 0) {
            appendMessage(
                "ai",
                'O assistente de IA não está configurado. Por favor, insira pelo menos uma chave de API válida em "Mais Opções".',
                "error"
            );
            return;
        }

        isSendingMessage = true;
        appendMessage("user", userMessage);
        chatInput.value = "";
        chatLoadingIndicator.classList.remove("hidden");

        const persona = aiConfig.aiPersona || "";
        const personality = aiConfig.aiPersonality || "";

        const baseSystemInstruction = `Você é um assistente financeiro com inteligência contextual, integrado a um aplicativo de finanças pessoais. Sua principal função é analisar dados financeiros do usuário, identificar padrões, propor melhorias e orientar com base em metas e sustentabilidade financeira. Agora você pode ADICIONAR, APAGAR, EDITAR e ENCONTRAR transações.

<strong>Ferramentas Disponíveis:</strong>
1.  <strong>addTransactionFromAI</strong>
    *   Use para adicionar uma nova receita ou despesa.
    *   <strong>Lógica Obrigatória:</strong> Antes de chamar, verifique se a categoria mencionada existe na lista de "Categorias e Caixinhas Cadastradas". Se a categoria **NÃO** existir, você **DEVE** perguntar ao usuário em qual categoria existente ele gostaria de registrar. Não invente categorias.
    *   Parâmetros: "description", "amount", "categoryName", "type" ('income' ou 'expense'), "date" (opcional), "status" (opcional).

2.  <strong>deleteTransactionFromAI</strong>
    *   Use para apagar uma transação existente.
    *   <strong>Lógica Obrigatória:</strong> Para evitar erros, sempre peça a descrição e o valor exato da transação a ser apagada. Se a ferramenta retornar um erro de ambiguidade (múltiplas transações encontradas), informe ao usuário e peça mais detalhes, como a data.
    *   Parâmetros: "description", "amount".

3.  <strong>editTransactionFromAI</strong>
    *   Use para modificar uma transação existente.
    *   <strong>Lógica Obrigatória:</strong> Primeiro, identifique a transação a ser editada pedindo a descrição e o valor original ao usuário. Depois, pergunte quais campos devem ser alterados (novo valor, nova descrição, etc.) e chame a ferramenta com os parâmetros originais e os novos.
    *   Parâmetros: "originalDescription", "originalAmount", e pelo menos um dos novos campos "newDescription", "newAmount", "newCategoryName", "newDate", "newStatus".

4.  <strong>findTransactionsFromAI</strong>
    *   Use para buscar e listar transações quando o usuário perguntar algo como "quais foram meus gastos de hoje?" ou "liste minhas despesas com transporte".
    *   <strong>Lógica Obrigatória:</strong> Use os parâmetros para filtrar a busca. Se o usuário não for específico, use o bom senso (ex: "hoje" significa a data atual). Retorne os resultados para o usuário.
    *   Parâmetros: "date" (formato AAAA-MM-DD), "categoryName", "description".

<strong>Instruções de Comportamento:</strong>
*   <strong>Persona e Personalidade:</strong> Siga estritamente o papel e o tom definidos abaixo.
    *   <strong>Personagem:</strong> ${persona}
    *   <strong>Personalidade:</strong> ${personality}
*   <strong>Foco e Concisão:</strong> Seja direto, objetivo e claro. Responda APENAS ao que foi perguntado.
*   <strong>Sem Repetição:</strong> NÃO repita os "Pontos de Atenção" (transações sem categoria, gastos sem orçamento) em todas as respostas. Mencione-os apenas se for diretamente relevante para a pergunta do usuário ou se ele pedir um conselho geral.
*   <strong>Criação de Categorias:</strong> Você NUNCA deve criar uma categoria diretamente. Se o usuário pedir para criar uma, você deve guiá-lo a fazer isso manualmente no app, explicando as regras:
    *   Pergunte o nome da categoria.
    *   Pergunte o tipo: Receita, Despesa ou Caixinha.
    *   Se for 'Despesa', pergunte se é 'Essencial' ou 'Não Essencial'.
    *   Se for 'Caixinha', lembre o usuário que ele precisará definir um valor alvo.
    *   Finalize dizendo: "Ok, para criar, vá em Mais Opções > Categorias e Caixinhas e adicione uma nova com essas informações."
*   <strong>Análise de Dados:</strong> Você sempre tem acesso a um retrato atualizado das finanças do usuário. Use essas informações para gerar respostas contextualizadas e precisas. NUNCA invente valores.
*   <strong>Formatação:</strong> Use apenas HTML básico (<strong>, <br>, <ul>, <li>) para formatar. Nunca use Markdown (*, #, _).

---

<strong>Glossário do app (obrigatório conhecer):</strong>
- <strong>Caixinha:</strong> Meta de poupança onde o usuário guarda ou resgata dinheiro. O valor guardado não faz parte do saldo disponível.
- <strong>Orçamento:</strong> Limite de gastos por categoria em um mês.

<strong>Estilo de resposta:</strong>
- <strong>Com iniciativa:</strong> Após respostas como “ok”, continue com algo útil e relevante.
- <strong>Se faltarem dados:</strong> Avise o usuário e oriente a registrar as informações necessárias de forma educada.`;


        let currentFinancialData = "";
        const refreshKeywords = ["atualizar dados", "recarregar dados", "consultar dados", "verificar finanças", "novos dados", "dados atuais", "meus dados", "favor, atualize meus dados financeiros"]; 

        const needsRefresh = refreshKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

        if (!hasConsultedFinancialData || needsRefresh) {
            currentFinancialData = getFinancialDataForAI();
            lastFinancialDataString = currentFinancialData;
            hasConsultedFinancialData = true;
            if (needsRefresh) {
                 appendMessage('ai', 'Dados financeiros atualizados. Como posso te ajudar?', 'info');
            } else {
                 appendMessage('ai', 'Analisando seus dados financeiros para a nossa conversa. Um momento...', 'info');
            }
        }

        const contentsPayload = [...chatHistory];
        const userPromptWithData = `DATA_FINANCEIRA_DO_USUARIO_PARA_ANALISE:\n${currentFinancialData}\n\nMENSAGEM_DO_USUARIO:\n${userMessage}`;
        contentsPayload.push({ role: "user", parts: [{ text: userPromptWithData }] });

        const tools = [{
            "functionDeclarations": [
                {
                    "name": "addTransactionFromAI",
                    "description": "Adiciona uma nova transação de receita ou despesa.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "description": { "type": "STRING", "description": "A descrição da transação. Ex: 'Almoço'." },
                            "amount": { "type": "NUMBER", "description": "O valor da transação. Ex: 50.25." },
                            "categoryName": { "type": "STRING", "description": "O nome exato da categoria existente." },
                            "type": { "type": "STRING", "enum": ["income", "expense"], "description": "O tipo da transação." },
                            "date": { "type": "STRING", "description": "A data (AAAA-MM-DD). Padrão: hoje." },
                            "status": { "type": "STRING", "enum": ["Pago", "Pendente", "Recebido"], "description": "O status. Padrão: 'Pago' ou 'Recebido'." }
                        },
                        "required": ["description", "amount", "categoryName", "type"]
                    }
                },
                {
                    "name": "deleteTransactionFromAI",
                    "description": "Apaga uma transação existente.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "description": { "type": "STRING", "description": "A descrição da transação a ser apagada." },
                            "amount": { "type": "NUMBER", "description": "O valor exato da transação a ser apagada." }
                        },
                        "required": ["description", "amount"]
                    }
                },
                {
                    "name": "editTransactionFromAI",
                    "description": "Edita uma transação existente.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "originalDescription": { "type": "STRING", "description": "A descrição original da transação a ser editada." },
                            "originalAmount": { "type": "NUMBER", "description": "O valor original da transação a ser editada." },
                            "newDescription": { "type": "STRING", "description": "A nova descrição para a transação." },
                            "newAmount": { "type": "NUMBER", "description": "O novo valor para a transação." },
                            "newCategoryName": { "type": "STRING", "description": "O novo nome de categoria para a transação." },
                            "newDate": { "type": "STRING", "description": "A nova data (AAAA-MM-DD) para a transação." },
                            "newStatus": { "type": "STRING", "enum": ["Pago", "Pendente", "Recebido"], "description": "O novo status para a transação." }
                        },
                        "required": ["originalDescription", "originalAmount"]
                    }
                },
                {
                    "name": "findTransactionsFromAI",
                    "description": "Encontra e lista transações com base em filtros.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "date": { "type": "STRING", "description": "A data para filtrar (AAAA-MM-DD)." },
                            "categoryName": { "type": "STRING", "description": "O nome da categoria para filtrar." },
                            "description": { "type": "STRING", "description": "Um termo na descrição para filtrar." }
                        },
                        "required": []
                    }
                }
            ]
        }];
    
        const availableFunctions = { 
            addTransactionFromAI,
            deleteTransactionFromAI,
            editTransactionFromAI,
            findTransactionsFromAI
        };
        
        const payload = {
            systemInstruction: { role: "system", parts: [{ text: baseSystemInstruction }] },
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
            ],
            tools: tools,
            tool_config: { "function_calling_config": { "mode": "AUTO" } }
        };

        try {
            let result = await tryNextApiKey(payload, currentGeminiApiKeyIndex);
        
            while (result && result.candidates && result.candidates[0].content.parts[0].functionCall) {
                const candidate = result.candidates[0];
                const part = candidate.content.parts[0];
                const { name, args } = part.functionCall;
                const functionToCall = availableFunctions[name];
        
                if (functionToCall) {
                    const functionResult = await functionToCall(args);
        
                    // Adiciona o histórico da chamada da função e seu resultado
                    payload.contents.push(candidate.content);
                    payload.contents.push({
                        role: "tool",
                        parts: [{
                            functionResponse: { name, response: { content: functionResult } }
                        }]
                    });
        
                    // Adiciona ao histórico do chat local também
                    chatHistory.push(candidate.content);
                    chatHistory.push({
                        role: "tool",
                        parts: [{ functionResponse: { name, response: { content: functionResult } } }]
                    });
        
                    // Chama a API novamente com o resultado da função
                    result = await tryNextApiKey(payload, currentGeminiApiKeyIndex);
                } else {
                    // Se a função não for encontrada, quebra o loop
                    break;
                }
            }
        
            // Processa a resposta final de texto da IA
            if (result && result.candidates && result.candidates[0].content.parts[0].text) {
                const finalResponse = result.candidates[0].content.parts[0].text;
                appendMessage('ai', finalResponse);
                chatHistory.push({ role: "model", parts: [{ text: finalResponse }] });
            } else if (result.error) {
                throw new Error(result.error.message || 'Erro desconhecido da API Gemini.');
            } else if (!result.candidates || result.candidates.length === 0) {
                 throw new Error('Não foi possível obter uma resposta válida da IA.');
            }

        } catch (error) {
            console.error('Erro ao chamar a API Gemini:', error);
            appendMessage('ai', `Erro de comunicação com a IA. ${error.message}`, 'error');
        } finally {
            if (chatHistory.length > 20) {
                chatHistory = chatHistory.slice(chatHistory.length - 20);
            }
            chatLoadingIndicator.classList.add('hidden');
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
            isSendingMessage = false; 
            hasConsultedFinancialData = false;
        }
    }


    // --- Funções de Insights Financeiros ---
    async function openInsightsModal() {
        insightsModal.classList.add('active');
        insightsText.innerHTML = '';
        insightsLoadingIndicator.classList.remove('hidden');

        const validKeys = geminiApiKeys.filter(key => key && key.trim() !== '');
        if (!isGeminiApiReady || validKeys.length === 0) {
            insightsText.innerHTML = '<p class="text-red-500">O assistente de IA não está configurado. Por favor, insira sua chave da API Gemini nas "Mais Opções".</p>';
            insightsLoadingIndicator.classList.add('hidden');
            return;
        }

        // Obtém os dados financeiros atualizados para os insights
        const financialData = getFinancialDataForAI();

        const insightPrompt =
            `Analise os seguintes dados financeiros do usuário e forneça insights e recomendações úteis. ` +
            `Seja objetivo, encorajador e focado em ações práticas. ` +
            `Estruture a resposta com títulos em negrito usando <strong>, listas não ordenadas com <ul> e <li>, e quebras de linha com <br>. ` +
            `Mantenha o tone de um assistente financeiro útil. ` +
            `NUNCA use Markdown (*, **, _, #, etc.).` +
            `Aqui estão os dados: <br><br>${financialData}`;

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

        try {
            const result = await tryNextApiKey(payload, currentGeminiApiKeyIndex);

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0 && result.candidates[0].content.parts[0].text) {
                const aiResponseText = result.candidates[0].content.parts[0].text;
                insightsText.innerHTML = aiResponseText;
            } else if (result.error) {
                insightsText.innerHTML = `<p class="text-red-500">Erro da API: ${result.error.message || 'Erro desconhecido da API Gemini.'}</p>`;
                console.error('Erro da API Gemini para Insights:', result.error);
            } else {
                insightsText.innerHTML = '<p class="text-red-500">Não foi possível gerar insights financeiros neste momento.</p>';
            }
        } catch (error) {
            insightsText.innerHTML = `<p class="text-red-500">Erro ao comunicar com a IA para insights. ${error.message || 'Verifique sua conexão.'}</p>`;
            console.error('Erro ao chamar a API Gemini para Insights:', error);
        } finally {
            insightsLoadingIndicator.classList.add('hidden');
        }
    }


    function closeInsightsModal() {
        insightsModal.classList.remove('active');
    }
    
    // --- Funções do Modal de Otimização de Orçamento com IA (NOVA) ---
    async function openBudgetOptimizationModal() {
        budgetOptimizationModal.classList.add('active');
        budgetOptimizationText.innerHTML = '';
        budgetOptimizationLoadingIndicator.classList.remove('hidden');

        const validKeys = geminiApiKeys.filter(key => key && key.trim() !== '');
        if (!isGeminiApiReady || validKeys.length === 0) {
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
                    t.categoryId === budget.categoryId && t.type === 'expense' && (t.status === 'Pago' || t.status === 'Recebido' || t.status === 'Confirmado')
                ).reduce((sum, t) => sum + parseFloat(t.amount), 0);
                const remaining = budget.amount - actualSpent; // Use budget.amount
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

        try {
            const result = await tryNextApiKey(payload, currentGeminiApiKeyIndex);
            
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0 && result.candidates[0].content.parts[0].text) {
                const aiResponseText = result.candidates[0].content.parts[0].text;
                budgetOptimizationText.innerHTML = aiResponseText;
            } else if (result.error) {
                budgetOptimizationText.innerHTML = `<p class="text-red-500">Erro da API: ${result.error.message || 'Erro desconhecido da API Gemini.'}</p>`;
                console.error('Erro da API Gemini para Otimização de Orçamento:', result.error);
            } else {
                budgetOptimizationText.innerHTML = '<p class="text-red-500">Não foi possível gerar sugestões de otimização de orçamento neste momento.</p>';
            }
        } catch (error) {
            budgetOptimizationText.innerHTML = `<p class="text-red-500">Erro ao comunicar com a IA para otimização. ${error.message || 'Verifique sua conexão.'}</p>`;
            console.error('Erro ao chamar a API Gemini para Otimização de Orçamento:', error);
        } finally {
            budgetOptimizationLoadingIndicator.classList.add('hidden');
        }
    }

    function closeBudgetOptimizationModal() {
        budgetOptimizationModal.classList.remove('active');
    }

    // --- Funções do Modal de Chave de API ---
    function openApiKeysModal() {
        apiKeysModal.classList.add('active');
        // As chaves serão carregadas automaticamente pelo onSnapshot em loadAllDataFromFirestore
        // e os modalApiKeyInputs.value serão atualizados por ele.
    }

    function closeApiKeysModal() {
        apiKeysModal.classList.remove('active');
    }

    function updateApiModalStatus(message, type = 'info') {
        apiModalStatusMessageDiv.classList.remove('hidden', 'bg-blue-100', 'border-blue-500', 'text-blue-700', 'bg-green-100', 'border-green-500', 'text-green-700', 'bg-red-100', 'border-red-500', 'text-red-700');
        
        if (type === 'info') {
            apiModalStatusMessageDiv.classList.add('bg-blue-100', 'border-blue-500', 'text-blue-700');
        } else if (type === 'success') {
            apiModalStatusMessageDiv.classList.add('bg-green-100', 'border-green-500', 'text-green-700');
        } else if (type === 'error') {
            apiModalStatusMessageDiv.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
        }
        
        apiModalMessageText.textContent = message;
        apiModalStatusMessageDiv.classList.remove('hidden');

        setTimeout(() => {
            apiModalStatusMessageDiv.classList.add('hidden');
        }, 5000);
    }

    // --- Configuração e Inicialização do Firebase ---
    async function initializeFirebase() {
        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            console.log("Firebase Config usada:", firebaseConfig);
            console.log("Initial Auth Token:", initialAuthToken);

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    // Usuário está logado (seja por token, e-mail/senha, ou sessão anterior)
                    userId = user.uid;
                    isAuthReady = true;
                    loginScreen.classList.add('hidden');
                    appContent.classList.remove('hidden');
                    console.log("Usuário autenticado:", userId);
                    // Carrega os dados apenas depois que o usuário é confirmado
                    await loadAllDataFromFirestore();
                    showPage('dashboard');
                } else {
                    // Nenhum usuário logado
                    userId = null;
                    isAuthReady = false;
                    loginScreen.classList.remove('hidden');
                    appContent.classList.add('hidden');
                    console.log("Usuário não autenticado. Mostrando tela de login.");
                }
            });

            // Tenta logar com token apenas se ele existir E NÃO HOUVER um usuário corrente
            if (initialAuthToken && !auth.currentUser) {
                try {
                    await signInWithCustomToken(auth, initialAuthToken);
                    console.log("Autenticação com token inicial bem-sucedida.");
                } catch (error) {
                    console.error("Falha na autenticação com o token inicial.", error);
                    let errorMessage = `Erro de autenticação: ${error.message}.`;
                    if (error.code === 'auth/custom-token-mismatch' || error.code === 'auth/invalid-custom-token') {
                        errorMessage += " Verifique as configurações do Firebase ou gere um novo token.";
                    }
                    loginErrorMessage.textContent = errorMessage;
                    loginErrorMessage.classList.remove('hidden');
                }
            } else if (!auth.currentUser) {
                 // Não faz nada se não houver token e nenhum usuário. A tela de login será mostrada pelo onAuthStateChanged.
                console.log("Nenhum token inicial e nenhum usuário logado. Aguardando interação na tela de login.");
            }

        } catch (error) {
            console.error("Erro ao inicializar Firebase:", error);
            loginErrorMessage.textContent = `Erro crítico ao iniciar a aplicação: ${error.message}`;
            loginErrorMessage.classList.remove('hidden');
        }
    }

    // Event listener para o formulário de login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            try {
                await signInWithEmailAndPassword(auth, email, password);
                loginErrorMessage.classList.add('hidden'); // Limpa a mensagem de erro se o login for bem-sucedido
            } catch (error) {
                let message = 'Erro ao fazer login. Verifique o seu e-mail e palavra-passe.';
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    message = 'E-mail ou palavra-passe inválidos.';
                } else if (error.code === 'auth/invalid-email') {
                    message = 'Formato de e-mail inválido.';
                } else if (error.code === 'auth/operation-not-allowed') {
                    message = 'A operação de login por e-mail/palavra-passe não está ativada no seu projeto Firebase.';
                }
                loginErrorMessage.textContent = message;
                loginErrorMessage.classList.remove('hidden');
                console.error("Erro de login:", error.message, error.code);
            }
        });
    }

    // Event listener para o botão de logout (desktop)
    if (logoutButtonDesktop) {
        logoutButtonDesktop.addEventListener('click', async () => {
            try {
                await signOut(auth);
                console.log("Utilizador desconectado com sucesso.");
                // UI will be handled by onAuthStateChanged listener
            } catch (error) {
                console.error("Erro ao desconectar:", error.message);
            }
        });
    }

    // Event listener para o botão de logout (mobile)
    if (logoutButtonMobile) {
        logoutButtonMobile.addEventListener('click', async () => {
            try {
                await signOut(auth);
                console.log("Utilizador desconectado com sucesso.");
                // UI will be handled by onAuthStateChanged listener
            } catch (error) {
                console.error("Erro ao desconectar:", error.message);
            }
        });
    }


    // Carregar a página inicial (dashboard) ao carregar (inicialmente oculto até logar)
    // showPage('dashboard'); // Esta chamada será feita dentro do onAuthStateChanged

    // Atualizar o estado do chat ao carregar a página
    updateChatUIState();
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); 
            const pageId = e.currentTarget.dataset.page;
            showPage(pageId);
        });
    });

    // Event listeners para o chat
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
    // Event listener para o novo botão de atualizar dados do chat
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
            chatHistory = []; // Limpa o histórico da sessão
            hasConsultedFinancialData = false; // Permite que a próxima mensagem recarregue os dados
            appendMessage('ai', 'Chat limpo. Como posso te ajudar a começar de novo?', 'info');
        });
    }

    // NOVO: Event listener para o botão de voltar do chat
    if (chatBackButton) {
        chatBackButton.addEventListener('click', () => {
            showPage('dashboard'); // Volta para a Visão Geral
        });
    }


    // Event listener para o novo botão de Gerar Insights Financeiros
    const generateInsightsButton = document.getElementById('generate-insights-button');
    if (generateInsightsButton) {
        generateInsightsButton.addEventListener('click', openInsightsModal);
    }

    // Event listener para o novo botão de Otimizar Orçamento
    if (optimizeBudgetButton) {
        optimizeBudgetButton.addEventListener('click', openBudgetOptimizationModal);
    }

    // Event listeners do Modal de Otimização de Orçamento
    if (closeBudgetOptimizationModalButton) {
        closeBudgetOptimizationModalButton.addEventListener('click', closeBudgetOptimizationModal);
    }
    if (closeBudgetOptimizationButton) {
        closeBudgetOptimizationButton.addEventListener('click', closeBudgetOptimizationButton);
    }


    // Função para atualizar o estado da UI do chat (habilitado/desabilitado)
    function updateChatUIState() {
        const hasValidKey = geminiApiKeys.some(key => key.trim() !== '');
        if (hasValidKey) {
            isGeminiApiReady = true;
            chatInput.disabled = false;
            sendButton.disabled = false;
            refreshChatDataButton.disabled = false;
            chatInput.placeholder = "Digite a sua mensagem...";
            // Verifica se a mensagem de "insira a sua chave" ainda está presente e a remove
            const initialAiMessage = chatMessagesDiv.querySelector('.flex.justify-start .bg-gray-100');
            if (initialAiMessage && initialAiMessage.textContent.includes('Por favor, insira sua chave')) {
                chatMessagesDiv.innerHTML = ''; // Limpa a div de mensagens
                appendMessage('ai', 'Assistente de IA pronto! Como posso ajudar?', 'info');
            }
            updateActiveApiKeyIndicator(); // Mostra o indicador
        } else {
            isGeminiApiReady = false;
            chatInput.disabled = true;
            sendButton.disabled = true;
            refreshChatDataButton.disabled = true;
            chatInput.placeholder = "Assistente não configurado...";
            activeApiKeyIndicator.classList.add('hidden'); // Esconde o indicador
        }
    }


    // Event listeners do Modal de Categoria
    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', () => openCategoryModal());
    }
    if (closeCategoryModalButton) {
        closeCategoryModalButton.addEventListener('click', closeCategoryModal);
    }
    if (cancelCategoryButton) {
        cancelCategoryButton.addEventListener('click', closeCategoryModal);
    }

    // Event listeners do Modal de Transação e FAB
    if (fabButton) {
        fabButton.addEventListener('click', () => openTransactionModal());
    }
    if (closeTransactionModalButton) {
        closeTransactionModalButton.addEventListener('click', closeTransactionModal);
    }
    // Listener para os botões da Etapa 1
    document.querySelectorAll('.step-1-type-button').forEach(button => {
        button.addEventListener('click', () => {
            // Remove a classe 'selected' de todos os botões e adiciona ao clicado
            document.querySelectorAll('.step-1-type-button').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');

            const type = button.dataset.type;
            // Marca o radio oculto correspondente
            document.querySelector(`input[name="transaction-type"][value="${type}"]`).checked = true;
                    
            // Atualiza o título e as categorias da Etapa 2
            const titleMap = {
                income: 'Nova Receita',
                expense: 'Nova Despesa',
                deposit: 'Guardar Dinheiro',
                withdraw: 'Resgatar Dinheiro'
            };
            step2Title.textContent = titleMap[type];
            populateTransactionCategories(type); // Função que já deve existir no seu código
                    
            goToStep(2);
        });
    });
    // Listeners para os botões "Continuar"
    document.querySelectorAll('.step-next-button').forEach(button => {
        button.addEventListener('click', () => {
            goToStep(currentStep + 1, true); // Preserve state when moving forward
        });
    });
    // Listeners para os botões "Voltar"
    document.querySelectorAll('.step-back-button').forEach(button => {
        button.addEventListener('click', () => {
            goToStep(currentStep - 1, true); // Preserve state when moving back
        });
    });
    // Listener para o botão de cancelar da Etapa 1
    document.getElementById('cancel-transaction-button-step1').addEventListener('click', closeTransactionModal);


    // Event listeners do Modal de Insights
    if (closeInsightsModalButton) {
        closeInsightsModalButton.addEventListener('click', closeInsightsModal);
    }
    if (closeInsightsButton) {
        closeInsightsButton.addEventListener('click', closeInsightsModal);
    }

    // Event listeners do Modal de Chave de API
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

    // Event listeners para o novo modal de orçamento
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
            showConfirmationModal("Erro de Validação", "Por favor, selecione uma categoria e insira um valor válido.", () => {});
            return;
        }

        // Verifica se já existe um orçamento para a categoria no mês atual, se não for edição
        if (!id) {
            const isAlreadyBudgeted = budgets.some(b => b.categoryId === categoryId && b.month === getCurrentMonthYYYYMM(currentMonth)); // Usa currentMonth
            if (isAlreadyBudgeted) {
                showConfirmationModal("Orçamento Existente", "Já existe um orçamento para esta categoria neste mês. Por favor, edite o orçamento existente ou selecione outra categoria.", () => {});
                return;
            }
        }

        if (id) { // Editando
            const index = budgets.findIndex(b => b.id === id);
            if (index !== -1) {
                budgets[index].amount = amount;
            }
        } else { // Criando
            const newBudget = {
                id: generateUUID(),
                categoryId: categoryId,
                amount: amount,
                month: getCurrentMonthYYYYMM(currentMonth) // Usa currentMonth
            };
            budgets.push(newBudget);
        }
        await saveBudgets(); // Função que salva o array 'budgets' no Firestore
        closeBudgetModal();
    });

    // Adicione delegação de eventos para os botões de editar/excluir orçamentos
    budgetListContainer.addEventListener('click', (e) => {
        const editButton = e.target.closest('.edit-budget-button');
        if (editButton) {
            const id = editButton.dataset.id;
            const budgetToEdit = budgets.find(b => b.id === id);
            if (budgetToEdit) {
                openBudgetModal(budgetToEdit);
            }
        }
        const deleteButton = e.target.closest('.delete-budget-button');
        if (deleteButton) {
            const id = deleteButton.dataset.id;
            showConfirmationModal('Excluir Orçamento', 'Tem certeza que deseja excluir este orçamento?', async () => {
                budgets = budgets.filter(b => b.id !== id);
                await saveBudgets();
            });
        }
    });

    // --- Funções e Listeners de Filtros (NOVO) ---
    function populateFilterCategories() {
        filterCategorySelect.innerHTML = '<option value="all">Todas as Categorias</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            filterCategorySelect.appendChild(option);
        });
    }
    
    filterTypeSelect.addEventListener('change', renderTransactions);
    filterCategorySelect.addEventListener('change', renderTransactions);
    filterStatusSelect.addEventListener('change', renderTransactions);
    resetFiltersButton.addEventListener('click', () => {
        filterTypeSelect.value = 'all';
        filterCategorySelect.value = 'all';
        filterStatusSelect.value = 'all';
        renderTransactions();
    });

    // Fecha dropdowns de ação ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-menu-button')) {
            document.querySelectorAll('.action-menu-dropdown').forEach(dropdown => {
                dropdown.classList.add('hidden');
            });
        }
    });


    // Função para renderizar o gráfico de despesas
    function renderExpenseChart() {
        const ctx = document.getElementById('expense-chart').getContext('2d');
        
        // Agrupa despesas do mês atual por categoria
        const expensesByCategory = transactions
            .filter(t => t.type === 'expense' && t.date.startsWith(getCurrentMonthYYYYMM(currentMonth)) && (t.status === 'Pago' || t.status === 'Recebido' || t.status === 'Confirmado')) // Filtra pelo currentMonth
            .reduce((acc, t) => {
                const category = categories.find(c => c.id === t.categoryId);
                const categoryName = category ? category.name : 'Sem Categoria';
                const categoryColor = category ? category.color : '#808080'; // Cor padrão para "Sem Categoria"
                                        
                if (!acc[categoryName]) {
                    acc[categoryName] = { total: 0, color: categoryColor };
                }
                acc[categoryName].total += parseFloat(t.amount);
                return acc;
            }, {});

        const labels = Object.keys(expensesByCategory);
        const data = labels.map(label => expensesByCategory[label].total);
        const backgroundColors = labels.map(label => expensesByCategory[label].color);

        // Destrói a instância anterior do gráfico se ela existir
        if (expenseChartInstance) {
            expenseChartInstance.destroy();
        }
        
        if (labels.length === 0) {
            // Mostra uma mensagem se não houver dados
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Limpa o canvas
            ctx.font = '16px "Inter", sans-serif';
            ctx.fillStyle = '#6B7280'; // Cor do texto cinza
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

    // --- Funções de Notificação (Toast) ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return; // Se o container não existe, não faz nada
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: 'fa-solid fa-circle-check',
            error: 'fa-solid fa-circle-xmark',
            info: 'fa-solid fa-circle-info'
        };

        toast.innerHTML = `
            <i class="${icons[type]}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);

        // Trigger the animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Remove the toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            // Remove the element from DOM after the fade out animation
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, 3000);
    }

    // --- NOVO: Função de Sugestão de Categoria com IA ---
    async function suggestCategoryFromAI() {
        const description = transactionDescriptionInput.value.trim();
        const button = suggestCategoryButton;

        if (!description) {
            showToast("Por favor, digite uma descrição para a IA sugerir uma categoria.", "info");
            return;
        }

        const validKeys = geminiApiKeys.filter((key) => key && key.trim() !== "");
        if (!isGeminiApiReady || validKeys.length === 0) {
            showToast("O assistente de IA não está configurado. Verifique suas chaves de API.", "error");
            return;
        }

        button.disabled = true;
        button.innerHTML = '<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>';

        const transactionType = document.querySelector('input[name="transaction-type"]:checked').value;
        
        // Passa as categorias existentes com seus tipos e prioridades
        const existingCategories = categories
            .filter(c => c.type === transactionType)
            .map(c => ({ name: c.name, priority: c.priority }));

        const prompt = `
            Você é um assistente financeiro especialista em categorização.
            Analise a descrição da transação: "${description}".
            As categorias de ${transactionType === 'income' ? 'receita' : 'despesa'} existentes são: ${JSON.stringify(existingCategories)}.
            
            Sua tarefa é retornar um objeto JSON com a seguinte estrutura:
            {
              "suggestedCategoryName": "nome da categoria",
              "isNew": boolean,
              "type": "${transactionType}",
              "priority": "essential" ou "non-essential" (apenas se for uma nova despesa)
            }

            REGRAS CRÍTICAS:
            1. FAÇA UMA ANÁLISE SEMÂNTICA PROFUNDA. Compare o significado da descrição com o das categorias existentes.
            2. ANÁLISE DE PRIORIDADE: Analise a descrição por palavras como "essencial", "necessário", "básico" vs. "não essencial", "supérfluo", "lazer", "desejo".
            3. Se a descrição se encaixa LOGICAMENTE em uma categoria existente E a prioridade (se inferida ou explícita na descrição) NÃO CONFLITA com a prioridade da categoria existente, PREFIRA USAR a categoria existente. Defina "isNew" como false.
            4. Se a descrição tem o mesmo tema de uma categoria existente (ex: "Mercado"), mas a prioridade inferida da descrição (ex: "não essencial" para "salgadinhos") é DIFERENTE da prioridade da categoria existente (ex: "Mercado Essencial" que é "essential"), você DEVE sugerir uma NOVA categoria com um nome que reflita essa diferença (ex: "Mercado (Lazer)"). Defina "isNew" como true.
            5. Só sugira uma nova categoria (isNew: true) se a descrição for CLARAMENTE distinta de TODAS as categorias existentes OU se houver o conflito de prioridade descrito na regra 4.
            6. Se for uma nova despesa, determine se é "essential" (moradia, alimentação básica, saúde, transporte essencial) ou "non-essential" (lazer, hobbies, compras não essenciais, etc.).
            7. Responda APENAS com o objeto JSON. Não inclua \`\`\`json ou qualquer outro texto.
        `;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                response_mime_type: "application/json",
            },
        };

        try {
            const result = await tryNextApiKey(payload, currentGeminiApiKeyIndex);
            
            if (!result.candidates || !result.candidates[0].content.parts[0].text) {
                throw new Error("Resposta da IA inválida.");
            }
            
            const suggestion = JSON.parse(result.candidates[0].content.parts[0].text);
            
            if (suggestion.isNew) {
                showConfirmationModal(
                    "Nova Categoria Sugerida",
                    `A IA sugere a nova categoria "${suggestion.suggestedCategoryName}". Deseja criá-la como uma ${suggestion.type === 'income' ? 'receita' : 'despesa ' + (suggestion.priority || '')}?`,
                    async () => {
                        const newCategory = {
                            id: generateUUID(),
                            name: suggestion.suggestedCategoryName,
                            type: suggestion.type,
                            priority: suggestion.priority || null,
                            color: getNextAvailableColor(suggestion.type, suggestion.priority)
                        };
                        categories.push(newCategory);
                        await saveCategories();
                        showToast(`Categoria "${newCategory.name}" criada com sucesso!`, "success");
                        
                        populateTransactionCategories(newCategory.type);
                        transactionCategorySelect.value = newCategory.id;
                    }
                );
            } else {
                const existingCategory = categories.find(c => c.name.toLowerCase() === suggestion.suggestedCategoryName.toLowerCase() && c.type === suggestion.type);
                if (existingCategory) {
                    showToast(`Categoria sugerida: ${existingCategory.name}`, "success");
                    transactionCategorySelect.value = existingCategory.id;
                } else {
                    showToast(`A categoria sugerida "${suggestion.suggestedCategoryName}" não foi encontrada.`, "error");
                }
            }

        } catch (error) {
            console.error("Erro ao sugerir categoria:", error);
            showToast("Não foi possível sugerir uma categoria.", "error");
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
        }
    }
    
    suggestCategoryButton.addEventListener('click', suggestCategoryFromAI);

    // Listener para o novo botão de adicionar categoria rápido
    addCategoryQuickButton.addEventListener('click', () => {
        // Abre o modal de categoria, mas não passa nenhum objeto, então ele abre em modo de adição
        openCategoryModal();
        // Pré-seleciona o tipo de categoria com base no tipo de transação que o usuário está criando
        const selectedTransactionType = document.querySelector('input[name="transaction-type"]:checked').value;
        let categoryTypeToSelect = selectedTransactionType;
        if (selectedTransactionType === 'deposit' || selectedTransactionType === 'withdraw') {
            categoryTypeToSelect = 'caixinha';
        }
        const categoryRadio = document.querySelector(`input[name="category-type"][value="${categoryTypeToSelect}"]`);
        if (categoryRadio) {
            categoryRadio.checked = true;
            // Dispara o evento 'change' para garantir que a UI do modal de categoria se atualize
            categoryRadio.dispatchEvent(new Event('change'));
        }
    });
    
    // --- Funções de Otimização de Categoria com IA ---
    function closeCategoryOptimizationModal() {
        categoryOptimizationModal.classList.remove('active');
    }

    async function openCategoryOptimizationModal() {
        categoryOptimizationModal.classList.add('active');
        categoryOptimizationSuggestions.innerHTML = '';
        categoryOptimizationLoadingIndicator.classList.remove('hidden');

        const validKeys = geminiApiKeys.filter((key) => key && key.trim() !== "");
        if (!isGeminiApiReady || validKeys.length === 0) {
            categoryOptimizationSuggestions.innerHTML = '<p class="text-red-500">O assistente de IA não está configurado.</p>';
            categoryOptimizationLoadingIndicator.classList.add('hidden');
            return;
        }

        const categoryAndTransactionData = categories.map(cat => {
            const associatedTransactions = transactions
                .filter(t => t.categoryId === cat.id)
                .map(t => t.description)
                .slice(0, 5); // Limita a 5 descrições por performance
            return {
                id: cat.id,
                name: cat.name,
                type: cat.type,
                transactionCount: associatedTransactions.length,
                sampleDescriptions: associatedTransactions
            };
        });

        const prompt = `
            Você é um organizador financeiro especialista. Analise a lista de categorias e transações de um usuário.
            Seu objetivo é sugerir melhorias para manter as categorias organizadas e claras.
            Responda com um array de objetos JSON, onde cada objeto é uma sugestão.
            
            As sugestões podem ser dos seguintes tipos: 'merge', 'rename', 'delete'.

            Estrutura da resposta:
            [
              {
                "type": "merge",
                "from": ["Nome Categoria A", "Nome Categoria B"],
                "to": "Nome Sugerido para a Nova Categoria",
                "reason": "Justificativa curta para a sugestão."
              },
              {
                "type": "rename",
                "from": "Nome Categoria Antiga",
                "to": "Novo Nome Sugerido",
                "reason": "Justificativa curta para a sugestão."
              },
              {
                "type": "delete",
                "from": "Nome Categoria",
                "reason": "Justificativa curta (ex: Sem uso e sem transações)."
              }
            ]

            REGRAS:
            1.  Mescle categorias que são muito similares (ex: "Táxi" e "Uber").
            2.  Renomeie categorias com nomes pouco claros ou com abreviações (ex: "Transp." para "Transporte").
            3.  Sugira apagar apenas categorias sem transações associadas.
            4.  Se não houver sugestões, retorne um array vazio [].
            5.  Foque em sugestões de alto impacto. Não sugira muitas mudanças de uma vez. Limite-se a um máximo de 5 sugestões.
            6.  Responda APENAS com o array JSON. Não inclua \`\`\`json ou qualquer outro texto.

            DADOS DO USUÁRIO:
            ${JSON.stringify(categoryAndTransactionData, null, 2)}
        `;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                response_mime_type: "application/json",
            },
        };

        try {
            const result = await tryNextApiKey(payload, currentGeminiApiKeyIndex);
            if (!result.candidates || !result.candidates[0].content.parts[0].text) {
                throw new Error("Resposta da IA inválida ao otimizar categorias.");
            }
            const suggestions = JSON.parse(result.candidates[0].content.parts[0].text);
            renderCategoryOptimizationSuggestions(suggestions);
        } catch (error) {
            console.error("Erro ao otimizar categorias:", error);
            categoryOptimizationSuggestions.innerHTML = `<p class="text-red-500">Erro ao obter sugestões da IA. Tente novamente.</p>`;
        } finally {
            categoryOptimizationLoadingIndicator.classList.add('hidden');
        }
    }
    
    function renderCategoryOptimizationSuggestions(suggestions) {
        categoryOptimizationSuggestions.innerHTML = '';
        if (suggestions.length === 0) {
            categoryOptimizationSuggestions.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma sugestão de otimização encontrada. Suas categorias estão bem organizadas!</p>';
            return;
        }

        suggestions.forEach((suggestion, index) => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            let description = '';

            switch(suggestion.type) {
                case 'merge':
                    description = `Sugerimos mesclar as categorias <strong>${suggestion.from.join(', ')}</strong> na nova categoria <strong>"${suggestion.to}"</strong>.`;
                    break;
                case 'rename':
                    description = `Sugerimos renomear a categoria <strong>"${suggestion.from}"</strong> para <strong>"${suggestion.to}"</strong>.`;
                    break;
                case 'delete':
                     description = `Sugerimos apagar a categoria <strong>"${suggestion.from}"</strong>.`;
                    break;
            }

            card.innerHTML = `
                <p class="font-semibold text-gray-800">${suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)}</p>
                <p class="text-sm text-gray-600 mt-1">${description}</p>
                <p class="text-xs text-gray-500 mt-1"><em>Motivo: ${suggestion.reason}</em></p>
                <div class="suggestion-actions">
                    <button class="action-confirm" data-index="${index}" data-action="confirm">Confirmar</button>
                    <button class="action-ignore" data-index="${index}" data-action="ignore">Ignorar</button>
                </div>
            `;
            categoryOptimizationSuggestions.appendChild(card);
        });
    }


    optimizeCategoriesButton.addEventListener('click', openCategoryOptimizationModal);
    closeCategoryOptimizationModalButton.addEventListener('click', closeCategoryOptimizationModal);
    closeCategoryOptimizationButton.addEventListener('click', closeCategoryOptimizationModal);

});

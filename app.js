// Importa os módulos necessários do Firebase
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Variáveis globais do ambiente Canvas (preenchidas em tempo de execução)
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        // ATENÇÃO: Firebase Config hardcodada para depuração.
        // Substitua com seus valores reais do Firebase Console se precisar mudar de projeto.
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
        let goals = []; 
        let budgets = []; 

        // Configurações da IA
        let aiConfig = {
            // Definição de Persona (valores padrão, serão carregados do Firestore)
            persona: "Você é meu assistente financeiro pessoal, especializado em organização de gastos, planejamento financeiro e educação financeira. Acompanho seus dados em tempo real e uso regras como a 50-30-20 para te ajudar a tomar decisões mais inteligentes com o seu dinheiro. Meu papel é analisar suas entradas e saídas, identificar padrões, te avisar quando você sair do ideal e propor ajustes práticos. Se tiver dinheiro sobrando, mostro como usar com inteligência. Se faltar, te mostro onde cortar. Se você não tiver registrado seus gastos do dia ou não tiver dados o suficiente, vou te lembrar de atualizar. Sem informação, não consigo te orientar. Meu objetivo é ser o cérebro da sua vida financeira — mas preciso que você alimente ele.",
            // Personalidade da IA (valores padrão, serão carregados do Firestore)
            personality: "Direto e firme. Quando tiver que dar uma notícia ruim ou um feedback direto, não floreie, vá direto ao ponto. Após entregar a realidade, seja construtivo e ofereça sugestões claras para melhorar. Se o usuário não tiver dados suficientes para uma análise aprofundada, informe de forma clara que mais dados são necessários. Sua função é educar e otimizar, não suavizar a realidade financeira. Use emojis com moderação e apenas para dar um leve toque de leveza após uma informação séria ou para realçar um ponto positivo/ação recomendada."
        };

        let geminiApiKey = ''; 
        let chatHistory = []; 
        let isSendingMessage = false;
        let isGeminiApiReady = false; 

        // Flag e armazenamento para dados financeiros para a IA
        let hasConsultedFinancialData = false;
        let lastFinancialDataString = ''; 

        // Cores para o seletor de categorias - EXPANDIDAS E SIMILARES À IMAGEM DO USUÁRIO
        const categoryColors = [
            // Linha 1 da imagem (Vermelhos/Rosas/Laranjas)
            '#E91E63', '#F06292', '#F48FB1', '#F8B1A0', '#EF5350', '#E53935', '#D32F2F', '#C62828',
            // Linha 2 da imagem (Marrons/Vermelhos Escuros/Laranjas)
            '#795548', '#8D6E63', '#A1887F', '#BCAAA4', '#FF8A65', '#FF7043', '#FF5722', '#F4511E',
            // Linha 3 da imagem (Laranjas/Amarelos)
            '#FFCC80', '#FFB74D', '#FFA726', '#FB8C00', '#FFEA00', '#FFD600', '#FFC107', '#FFAB00',
            // Linha 4 da imagem (Verdes/Azuis Esverdeados)
            '#4CAF50', '#66BB6A', '#8BC34A', '#CDDC39', '#009688', '#26A69A', '#4DB6AC', '#80CBC4',
            // Linha 5 da imagem (Azuis/Cianos)
            '#00BCD4', '#26C6DA', '#4DD0E1', '#80DEEA', '#2196F3', '#42A5F5', '#64B5F6', '#90CAF9',
            // Linha 6 da imagem (Azuis Escuros/Roxos)
            '#1A237E', '#283593', '#303F9F', '#3F51B5', '#673AB7', '#7E57C2', '#9575CD', '#B39DDB',
            // Linha 7 da imagem (Roxos/Cinzas/Pretos)
            '#BA68C8', '#CE93D8', '#E1BEE7', '#F3E5F5', '#9E9E9E', '#BDBDBD', '#E0E0E0', '#424242' // Adicionando alguns cinzas para mais variedade
        ];


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

            // Função para obter referência a um documento específico (para dados armazenados como um único doc, ex: categorias, metas, orçamentos, aiConfig)
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
            const colorPalette = document.getElementById('color-palette');
            const selectedColorInput = document.getElementById('selected-color');
            const categorySearchInput = document.getElementById('category-search-input');
            const categorySaveStatusMessage = document.getElementById('category-save-status-message');

            // Elementos das Transações
            const addNewTransactionButton = document.getElementById('add-new-transaction-button');
            const transactionsListContainer = document.getElementById('transactions-list-container');
            const transactionModal = document.getElementById('transaction-modal');
            const closeTransactionModalButton = document.getElementById('close-transaction-modal');
            const cancelTransactionButton = document.getElementById('cancel-transaction-button');
            const transactionForm = document.getElementById('transaction-form');
            const transactionIdInput = document.getElementById('transaction-id');
            const transactionDescriptionInput = document.getElementById('transaction-description');
            const transactionAmountInput = document.getElementById('transaction-amount');
            const transactionDateInput = document.getElementById('transaction-date');
            const transactionTypeRadios = document.querySelectorAll('input[name="transaction-type"]');
            const transactionCategoryContainer = document.getElementById('transaction-category-container'); 
            const transactionCategorySelect = document.getElementById('transaction-category');
            const transactionStatusSelect = document.getElementById('transaction-status');
            const transactionModalTitle = document.getElementById('transaction-modal-title');
            const noTransactionsMessage = document.getElementById('no-transactions-message');

            // Elementos das Metas
            const addNewGoalButton = document.getElementById('add-new-goal-button');
            const goalListContainer = document.getElementById('goal-list-container');
            const goalModal = document.getElementById('goal-modal');
            const closeGoalModalButton = document.getElementById('close-goal-modal');
            const cancelGoalButton = document.getElementById('cancel-goal-button');
            const goalForm = document.getElementById('goal-form');
            const goalIdInput = document.getElementById('goal-id');
            const goalNameInput = document.getElementById('goal-name');
            const goalTargetAmountInput = document.getElementById('goal-target-amount');
            const goalCurrentAmountInput = document.getElementById('goal-current-amount');
            const goalModalTitle = document.getElementById('goal-modal-title');
            const noGoalsMessage = document.getElementById('no-goals-message');

            // Elementos do Dashboard
            const dashboardCurrentBalance = document.getElementById('dashboard-current-balance');
            const dashboardMonthlyIncome = document.getElementById('dashboard-monthly-income');
            const dashboardMonthlyExpenses = document.getElementById('dashboard-monthly-expenses');

            // Elementos da Seção de Transações (Resumo)
            const transactionsCurrentBalance = document.getElementById('transactions-current-balance');
            const transactionsTotalExpenses = document.getElementById('transactions-total-expenses');
            const transactionsTotalGoalsSaved = document.getElementById('transactions-total-goals-saved');

            // Elementos do Orçamento
            const configureBudgetButton = document.getElementById('configure-budget-button'); // Botão existente
            const optimizeBudgetButton = document.getElementById('optimize-budget-button'); // NOVO: Botão de Otimização de Orçamento
            const budgetListContainer = document.getElementById('budget-list-container');
            const noBudgetsMessage = document.getElementById('no-budgets-message');

            // Elementos do Insights Modal
            const insightsModal = document.getElementById('insights-modal');
            const closeInsightsModalButton = document.getElementById('close-insights-modal'); 
            const closeInsightsButton = document.getElementById('close-insights-button');
            const insightsContent = document.getElementById('insights-content');
            const insightsLoadingIndicator = document.getElementById('insights-loading-indicator');
            const insightsText = document.getElementById('insights-text');

            // Elementos do Modal de Otimização de Orçamento (NOVO)
            const budgetOptimizationModal = document.getElementById('budget-optimization-modal');
            const closeBudgetOptimizationModalButton = document.getElementById('close-budget-optimization-modal');
            const closeBudgetOptimizationButton = document.getElementById('close-budget-optimization-button');
            const budgetOptimizationContent = document.getElementById('budget-optimization-content');
            const budgetOptimizationLoadingIndicator = document.getElementById('budget-optimization-loading-indicator');
            const budgetOptimizationText = document.getElementById('budget-optimization-text');


            // Elementos do Modal de Chave de API
            const apiManagementLink = document.querySelector('[data-page="api-management"]');
            const apiKeysModal = document.getElementById('api-keys-modal');
            const closeApiKeysModalButton = document.getElementById('close-api-keys-modal');
            const modalApiKeyInput = document.getElementById('modal-api-key');
            const saveApiKeysModalButton = document.getElementById('save-api-keys-modal-button');
            const apiModalStatusMessageDiv = document.getElementById('api-modal-status-message');
            const apiModalMessageText = document.getElementById('api-modal-message-text');

            // Elementos da Configuração de IA
            const aiPersonaInput = document.getElementById('ai-persona');
            const aiPersonalityInput = document.getElementById('ai-personality');
            const saveAiConfigButton = document.getElementById('save-ai-config-button');
            const aiConfigStatusMessage = document.getElementById('ai-config-status-message');

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

                // Listener para AI Config - Usa getUserDocumentRef
                onSnapshot(getUserDocumentRef('settings', 'aiConfig'), (docSnap) => {
                    if (docSnap.exists()) {
                        aiConfig = { ...aiConfig, ...docSnap.data() }; // Mescla com os defaults
                        aiPersonaInput.value = aiConfig.persona;
                        aiPersonalityInput.value = aiConfig.personality;
                        console.log("AI Config carregada do Firestore.");
                    } else {
                        console.log("AI Config não encontrada, salvando padrão.");
                        setDoc(getUserDocumentRef('settings', 'aiConfig'), aiConfig); // Usa getUserDocumentRef para salvar
                    }
                }, (error) => {
                    console.error("Erro ao carregar AI Config do Firestore:", error);
                });

                // Listener para Categorias - Usa getUserDocumentRef
                onSnapshot(getUserDocumentRef('categories', 'userCategories'), (docSnap) => {
                    if (docSnap.exists() && docSnap.data().items) {
                        categories = docSnap.data().items;
                        console.log("Categorias carregadas do Firestore.");
                        renderCategories(categorySearchInput.value);
                        if (transactionModal.classList.contains('active')) {
                            populateTransactionCategories(document.querySelector('input[name="transaction-type"]:checked').value);
                        }
                    } else { // Se não existir ou estiver vazio, inicializa como array vazio
                        categories = [];
                        console.log("Categorias não encontradas ou vazias, inicializando como array vazio.");
                        saveCategories(); // Salva para criar o documento vazio se não existir
                        renderCategories(categorySearchInput.value);
                    }
                }, (error) => {
                    console.error("Erro ao carregar Categorias do Firestore:", error);
                });

                // Listener para Metas - Usa getUserDocumentRef
                onSnapshot(getUserDocumentRef('goals', 'userGoals'), (docSnap) => {
                    if (docSnap.exists() && docSnap.data().items) {
                        goals = docSnap.data().items;
                        console.log("Metas carregadas do Firestore.");
                        renderGoals();
                        updateDashboardAndTransactionSummaries();
                        if (transactionModal.classList.contains('active')) {
                            populateTransactionCategories(document.querySelector('input[name="transaction-type"]:checked').value);
                        }
                    } else { // Se não existir ou estiver vazio, inicializa como array vazio
                        goals = [];
                        console.log("Metas não encontradas ou vazias, inicializando como array vazio.");
                        saveGoals(); // Salva para criar o documento vazio se não existir
                        renderGoals();
                        updateDashboardAndTransactionSummaries();
                    }
                }, (error) => {
                    console.error("Erro ao carregar Metas do Firestore:", error);
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

                // Listener para Transações - Usa getUserCollectionRef
                const transactionsColRef = getUserCollectionRef('transactions');
                if (transactionsColRef) { // Verifica se a referência foi criada com sucesso
                    onSnapshot(query(transactionsColRef, orderBy('date', 'desc')), (querySnapshot) => {
                        transactions = [];
                        querySnapshot.forEach((doc) => {
                            transactions.push({ id: doc.id, ...doc.data() });
                        });
                        console.log("Transações carregadas do Firestore.");
                        renderTransactions();
                        updateDashboardAndTransactionSummaries();
                    }, (error) => {
                        console.error("Erro ao carregar Transações do Firestore:", error);
                    });
                }


                loadApiKey();
            }

            // Salva a configuração da IA no Firestore
            async function saveAiConfig() {
                if (!isAuthReady || !userId) { console.warn("Autenticação não pronta ou userId ausente."); return; }
                try {
                    const aiConfigRef = getUserDocumentRef('settings', 'aiConfig');
                    if (aiConfigRef) { // Verifica se a referência foi criada com sucesso
                        await setDoc(aiConfigRef, aiConfig); 
                        aiConfigStatusMessage.textContent = 'Configurações da IA salvas no Firebase!';
                        aiConfigStatusMessage.className = 'mt-4 text-sm font-medium text-green-700 block';
                        setTimeout(() => { aiConfigStatusMessage.classList.add('hidden'); }, 3000);
                    }
                } catch (error) {
                    console.error("Erro ao salvar AI Config:", error);
                    aiConfigStatusMessage.textContent = `Erro ao salvar: ${error.message}`;
                    aiConfigStatusMessage.className = 'mt-4 text-sm font-medium text-red-700 block';
                }
            }

            // Salva categorias no Firestore (como um único documento com array)
            async function saveCategories() {
                if (!isAuthReady || !userId) { 
                    console.warn("saveCategories: Autenticação não pronta ou userId ausente. Tentando salvar localmente por agora.");
                    displayCategorySaveStatus('Erro: Autenticação não pronta para salvar no banco.', 'error');
                    return; 
                }
                try {
                    const userCategoriesRef = getUserDocumentRef('categories', 'userCategories');
                    if (userCategoriesRef) {
                        await setDoc(userCategoriesRef, { items: categories || [] }); 
                        console.log("saveCategories: Categorias salvas com sucesso no Firestore!");
                        displayCategorySaveStatus('Categoria salva com sucesso! &#x1F389;', 'success');
                    }
                } catch (error) {
                    console.error("saveCategories: Erro ao salvar Categorias no Firestore:", error);
                    displayCategorySaveStatus(`Erro ao salvar: ${error.message}`, 'error');
                }
            }

            // Salva uma transação individual no Firestore (adicione ou atualize)
            async function saveTransaction(transactionData) {
                if (!isAuthReady || !userId) { console.warn("Autenticação não pronta ou userId ausente."); return; }
                try {
                    const transactionsColRef = getUserCollectionRef('transactions');
                    if (transactionsColRef) {
                        if (transactionData.id) {
                            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/transactions`, transactionData.id), transactionData);
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

            // Salva metas no Firestore (como um único documento com array)
            async function saveGoals() {
                if (!isAuthReady || !userId) { console.warn("Autenticação não pronta ou userId ausente."); return; }
                try {
                    const userGoalsRef = getUserDocumentRef('goals', 'userGoals');
                    if (userGoalsRef) {
                        await setDoc(userGoalsRef, { items: goals || [] }); 
                    }
                } catch (error) {
                    console.error("Erro ao salvar Metas:", error);
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
            // --- FIM das Funções de Persistência (Firebase Firestore) ---

            await initializeFirebase();
            
            
            function loadApiKey() {
                const storedKey = localStorage.getItem('geminiApiKey');
                if (storedKey) {
                    geminiApiKey = storedKey;
                    modalApiKeyInput.value = geminiApiKey;
                    updateApiModalStatus(`Chave de API carregada: ${geminiApiKey.substring(0, 10)}...`, 'info');
                    isGeminiApiReady = true;
                } else {
                    geminiApiKey = '';
                    updateApiModalStatus("Nenhuma chave de API salva ainda. Por favor, insira e salve.", "info");
                    isGeminiApiReady = false;
                }
                updateChatUIState();
            }

            function saveApiKey() {
                const keyToSave = modalApiKeyInput.value.trim();
                localStorage.setItem('geminiApiKey', keyToSave);
                geminiApiKey = keyToSave;
                updateApiModalStatus("Chave de API salva com sucesso! &#x1F389;", "success");
                isGeminiApiReady = true;
                updateChatUIState();
            }

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

                // Ações específicas ao carregar cada página
                if (pageId === 'chat') {
                    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
                } else if (pageId === 'categories-management') {
                    renderCategories();
                } else if (pageId === 'transactions') {
                    renderTransactions();
                    updateDashboardAndTransactionSummaries();
                } else if (pageId === 'goals-management') {
                    renderGoals();
                    updateDashboardAndTransactionSummaries();
                } else if (pageId === 'dashboard') {
                    updateDashboardAndTransactionSummaries();
                } else if (pageId === 'budget-management') {
                    renderBudgets();
                } else if (pageId === 'ai-config') {
                    aiPersonaInput.value = aiConfig.persona;
                    aiPersonalityInput.value = aiConfig.personality;
                }
            }

            // Função para atualizar os cards de resumo no Dashboard e Transações
            function updateDashboardAndTransactionSummaries() {
                let totalIncome = 0;
                let totalExpenses = 0;
                let currentBalance = 0;

                transactions.forEach(t => {
                    // Transações de receita que NÃO SÃO depósito de meta contribuem para a receita geral
                    if (t.type === 'Receita' && (t.status === 'Recebido' || t.status === 'Pago') && !t.isGoalDeposit) { 
                        totalIncome += parseFloat(t.amount);
                    } else if (t.type === 'Despesa' && (t.status === 'Pago' || t.status === 'Recebido')) {
                        totalExpenses += parseFloat(t.amount);
                    }
                });
                currentBalance = totalIncome - totalExpenses;

                // Atualiza Dashboard
                dashboardCurrentBalance.textContent = formatCurrency(currentBalance);
                dashboardMonthlyIncome.textContent = formatCurrency(totalIncome);
                dashboardMonthlyExpenses.textContent = formatCurrency(totalExpenses);

                // Atualiza Resumo em Transações
                transactionsCurrentBalance.textContent = formatCurrency(currentBalance);
                transactionsTotalExpenses.textContent = formatCurrency(totalExpenses);

                // Atualiza Total Guardado (Metas)
                let totalGoalsSaved = goals.reduce((sum, goal) => sum + parseFloat(goal.currentSavedAmount), 0);
                transactionsTotalGoalsSaved.textContent = formatCurrency(totalGoalsSaved);
            }


            // --- Funções de Gerenciamento de Categorias ---

            // Função para renderizar as categorias na lista
            function renderCategories(filter = '') {
                categoryListContainer.innerHTML = '';

                const filteredCategories = categories.filter(cat => 
                    cat.name.toLowerCase().includes(filter.toLowerCase())
                );

                if (filteredCategories.length === 0 && filter === '') {
                    categoryListContainer.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma categoria cadastrada. Adicione uma nova!</p>';
                } else if (filteredCategories.length === 0 && filter !== '') {
                    categoryListContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Nenhuma categoria encontrada para "${filter}".</p>`;
                }

                filteredCategories.forEach(category => {
                    const categoryItem = document.createElement('div');
                    categoryItem.className = 'bg-white p-4 rounded-lg shadow-sm flex items-center justify-between';
                    categoryItem.innerHTML = `
                        <div class="flex items-center">
                            <div class="w-6 h-6 rounded-full mr-3" style="background-color: ${category.color};"></div>
                            <div>
                                <p class="font-medium text-lg">${category.name}</p>
                                <p class="text-sm text-gray-500">${category.type}</p>
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

            // Abre o modal de categoria
            function openCategoryModal(category = null) {
                categoryModal.classList.add('active');
                categorySaveStatusMessage.classList.add('hidden');

                if (category) {
                    categoryModalTitle.textContent = 'Editar Categoria';
                    categoryIdInput.value = category.id;
                    categoryNameInput.value = category.name;
                    document.querySelector(`input[name="category-type"][value="${category.type}"]`).checked = true;
                    selectedColorInput.value = category.color;
                } else {
                    categoryModalTitle.textContent = 'Adicionar Nova Categoria';
                    categoryIdInput.value = '';
                    categoryNameInput.value = '';
                    selectedColorInput.value = '#F8B1A0';
                    document.querySelector(`input[name="category-type"][value="Despesa"]`).checked = true;
                }
                updateColorPaletteSelection(selectedColorInput.value);
            }

            // Fecha o modal de categoria
            function closeCategoryModal() {
                categoryModal.classList.remove('active');
                categoryForm.reset();
                categorySaveStatusMessage.classList.add('hidden');
            }

            // Exibe mensagem de status para salvar categoria
            function displayCategorySaveStatus(message, type = 'info') {
                categorySaveStatusMessage.textContent = message;
                categorySaveStatusMessage.classList.remove('hidden', 'text-green-700', 'text-red-700', 'text-blue-700');
                if (type === 'success') {
                    categorySaveStatusMessage.classList.add('text-green-700');
                } else if (type === 'error') {
                    categorySaveStatusMessage.classList.add('text-red-700');
                } else {
                    categorySaveStatusMessage.classList.add('text-blue-700');
                }
                setTimeout(() => {
                    categorySaveStatusMessage.classList.add('hidden');
                }, 3000);
            }

            // Lida com o envio do formulário de categoria
            categoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = categoryIdInput.value;
                const name = categoryNameInput.value.trim();
                const type = document.querySelector('input[name="category-type"]:checked').value;
                const color = selectedColorInput.value;

                if (!name) {
                    console.warn("Nome da categoria é obrigatório.");
                    displayCategorySaveStatus('Nome da categoria é obrigatório!', 'error');
                    return;
                }

                if (id) {
                    const index = categories.findIndex(cat => cat.id === id);
                    if (index !== -1) {
                        categories[index] = { id, name, type, color };
                    }
                } else {
                    categories.push({ id: generateUUID(), name, type, color });
                }
                await saveCategories();
                if(transactionModal.classList.contains('active')) {
                    populateTransactionCategories(document.querySelector('input[name="transaction-type"]:checked').value);
                }
            });

            // Lida com cliques nos botões de editar/excluir categorias (delegação de eventos)
            categoryListContainer.addEventListener('click', (e) => {
                if (e.target.closest('.edit-category-button')) {
                    const id = e.target.closest('.edit-category-button').dataset.id;
                    const categoryToEdit = categories.find(cat => cat.id === id);
                    if (categoryToEdit) {
                        openCategoryModal(categoryToEdit);
                    }
                } else if (e.target.closest('.delete-category-button')) {
                    const id = e.target.closest('.delete-category-button').dataset.id;
                    showConfirmationModal(
                        "Confirmar Exclusão",
                        "Tem certeza que deseja excluir esta categoria? Todas as transações associadas a ela ficarão sem categoria.",
                        async () => {
                            categories = categories.filter(cat => cat.id !== id);
                            const transactionsToUpdate = transactions.filter(t => t.categoryId === id);
                            for (const t of transactionsToUpdate) {
                                t.categoryId = 'unknown';
                                await saveTransaction(t);
                            }
                            await saveCategories();
                            if(transactionModal.classList.contains('active')) {
                                populateTransactionCategories(document.querySelector('input[name="transaction-type"]:checked').value);
                            }
                        }
                    );
                }
            });

            // Popula o seletor de cores e adiciona listeners
            function populateColorPalette() {
                colorPalette.innerHTML = '';
                categoryColors.forEach(color => {
                    const colorCircle = document.createElement('div');
                    colorCircle.className = 'color-circle';
                    colorCircle.style.backgroundColor = color;
                    colorCircle.dataset.color = color;
                    if (color === selectedColorInput.value) {
                        colorCircle.classList.add('selected');
                    }
                    colorCircle.addEventListener('click', () => {
                        selectedColorInput.value = color;
                        updateColorPaletteSelection(color);
                    });
                    colorPalette.appendChild(colorCircle);
                });
            }

            // Atualiza a seleção visual na paleta de cores
            function updateColorPaletteSelection(selectedColor) {
                document.querySelectorAll('.color-circle').forEach(circle => {
                    circle.classList.remove('selected');
                    if (circle.dataset.color === selectedColor) {
                        circle.classList.add('selected');
                    }
                });
            }


            // --- Funções de Gerenciamento de Transações ---

            // Função para popular o dropdown de categorias (e metas para receita) no modal de transações
            function populateTransactionCategories(transactionType = null) {
                transactionCategorySelect.innerHTML = '<option value="">Selecione uma Categoria</option>';

                if (transactionType === 'Despesa') {
                    const expenseCategories = categories.filter(cat => cat.type === 'Despesa');
                    expenseCategories.forEach(cat => {
                        const option = document.createElement('option');
                        option.value = cat.id;
                        option.textContent = cat.name; 
                        transactionCategorySelect.appendChild(option);
                    });
                } else if (transactionType === 'Receita') {
                    // Grupo para categorias de receita normais
                    const optgroupCategories = document.createElement('optgroup');
                    optgroupCategories.label = 'Categorias de Receita';
                    const incomeCategories = categories.filter(cat => cat.type === 'Receita');
                    if (incomeCategories.length > 0) {
                        incomeCategories.forEach(cat => {
                            const option = document.createElement('option');
                            option.value = cat.id;
                            option.textContent = cat.name;
                            optgroupCategories.appendChild(option);
                        });
                        transactionCategorySelect.appendChild(optgroupCategories);
                    }

                    // Grupo para metas financeiras
                    const optgroupGoals = document.createElement('optgroup');
                    optgroupGoals.label = 'Metas Financeiras';
                    if (goals.length > 0) {
                        goals.forEach(goal => {
                            const option = document.createElement('option');
                            option.value = `goal-${goal.id}`;
                            option.textContent = `Meta: ${goal.name} (Alvo: ${formatCurrency(goal.targetAmount)})`;
                            optgroupGoals.appendChild(option);
                        });
                        transactionCategorySelect.appendChild(optgroupGoals);
                    }
                    
                    if (incomeCategories.length === 0 && goals.length === 0) {
                        transactionCategorySelect.innerHTML += '<option value="" disabled>Nenhuma categoria ou meta disponível</option>';
                    }
                }
            }


            // Renderiza as transações
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

                    groupedTransactions[date].sort((a, b) => {
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        if (dateA.getTime() === dateB.getTime()) {
                            return a.description.localeCompare(b.description);
                        }
                        return dateB - dateA;
                        // Correção para ordenar também por hora se disponível, ou descrição
                    }).forEach(transaction => {
                        let categoryName = 'Categoria Desconhecida';
                        let bulletColor = '#9E9E9E';
                        
                        // Se for um depósito para meta
                        if (transaction.isGoalDeposit && transaction.goalId) {
                            const goal = goals.find(g => g.id === transaction.goalId);
                            categoryName = `Depósito para Meta: ${goal ? goal.name : 'Desconhecida'}`;
                            bulletColor = '#42A5F5';
                        } else { // Categoria normal
                            const category = categories.find(cat => cat.id === transaction.categoryId);
                            if (category) {
                                categoryName = category.name;
                                bulletColor = category.color;
                            }
                        }

                        const amountColorClass = transaction.type === 'Receita' ? 'text-[var(--color-green-positive)]' : 'text-[var(--color-red-negative)]';
                        const amountPrefix = transaction.type === 'Receita' ? '+' : '-';
                        
                        let bulletStyle = `background-color: transparent; border: 3px solid ${bulletColor};`;
                        if (transaction.status === 'Pago' || transaction.status === 'Recebido') {
                            bulletStyle = `background-color: ${bulletColor}; border: none;`;
                        }
                        
                        const statusIndicatorText = transaction.status === 'Pendente' ? '(Pendente)' : 
                                                    (transaction.type === 'Receita' && transaction.status === 'Recebido' ? '(Recebido)' : 
                                                    (transaction.type === 'Despesa' && transaction.status === 'Pago' ? '(Pago)' : ''));
                        const statusIndicatorClass = transaction.status === 'Pendente' ? 'text-orange-500' : '';
                        const statusIndicator = statusIndicatorText ? `<span class="${statusIndicatorClass} text-xs ml-2">${statusIndicatorText}</span>` : '';

                        const transactionItem = document.createElement('div');
                        transactionItem.className = `bg-white p-4 rounded-lg shadow-sm flex justify-between items-center relative pl-12`;
                        transactionItem.innerHTML = `
                            <div class="transaction-bullet" style="${bulletStyle}"></div>
                            <div>
                                <p class="font-medium">${transaction.description} ${statusIndicator}</p>
                                <p class="text-sm text-gray-500">${categoryName}</p>
                            </div>
                            <div class="text-right flex items-center space-x-2">
                                <p class="font-semibold ${amountColorClass}">${amountPrefix} ${formatCurrency(transaction.amount)}</p>
                                <button class="text-gray-400 hover:text-blue-500 p-1 rounded-full edit-transaction-button" data-id="${transaction.id}">
                                    <i class="fa-solid fa-pen-to-square text-base"></i>
                                </button>
                                <button class="text-gray-400 hover:text-red-500 p-1 rounded-full delete-transaction-button" data-id="${transaction.id}">
                                    <i class="fa-solid fa-trash-can text-base"></i>
                                </button>
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

            // Função para atualizar as opções do dropdown de status com base no tipo de transação
            function updateTransactionStatusOptions(selectedType = null) {
                let currentType = selectedType;
                if (!currentType) {
                    currentType = document.querySelector('input[name="transaction-type"]:checked').value;
                }

                transactionStatusSelect.innerHTML = ''; 

                if (currentType === 'Despesa') {
                    const optionPaid = document.createElement('option');
                    optionPaid.value = 'Pago';
                    optionPaid.textContent = 'Pago';
                    transactionStatusSelect.appendChild(optionPaid);

                    const optionPending = document.createElement('option');
                    optionPending.value = 'Pendente';
                    optionPending.textContent = 'Pendente';
                    transactionStatusSelect.appendChild(optionPending);
                } else if (currentType === 'Receita') {
                    const optionReceived = document.createElement('option');
                    optionReceived.value = 'Recebido';
                    optionReceived.textContent = 'Recebido';
                    transactionStatusSelect.appendChild(optionReceived);

                    const optionPending = document.createElement('option');
                    optionPending.value = 'Pendente';
                    optionPending.textContent = 'Pendente';
                    transactionStatusSelect.appendChild(optionPending);
                }
                transactionStatusSelect.value = transactionStatusSelect.options[0] ? transactionStatusSelect.options[0].value : '';
            }

            // Abre o modal de transação
            function openTransactionModal(transaction = null) {
                transactionModal.classList.add('active');

                if (transaction) {
                    transactionModalTitle.textContent = 'Editar Transação';
                    transactionIdInput.value = transaction.id;
                    transactionDescriptionInput.value = transaction.description;
                    transactionAmountInput.value = (parseFloat(transaction.amount) * 100).toFixed(0); 
                    formatCurrencyInput(transactionAmountInput);
                    
                    transactionDateInput.value = transaction.date;
                    document.querySelector(`input[name="transaction-type"][value="${transaction.type}"]`).checked = true;
                    
                    updateTransactionStatusOptions(transaction.type); 
                    populateTransactionCategories(transaction.type);

                    if (transaction.isGoalDeposit) {
                        transactionCategorySelect.value = `goal-${transaction.goalId}`;
                    } else {
                        transactionCategorySelect.value = transaction.categoryId;
                    }
                    transactionStatusSelect.value = transaction.status;

                } else { // Adicionar nova transação
                    transactionModalTitle.textContent = 'Adicionar Nova Transação';
                    transactionIdInput.value = '';
                    transactionForm.reset();
                    transactionDateInput.valueAsDate = new Date();
                    transactionAmountInput.value = '';
                    
                    document.querySelector('input[name="transaction-type"][value="Despesa"]').checked = true;
                    populateTransactionCategories('Despesa');
                    updateTransactionStatusOptions('Despesa');
                }
            }

            // Fecha o modal de transação
            function closeTransactionModal() {
                transactionModal.classList.remove('active');
                transactionForm.reset();
            }

            // Lida com o envio do formulário de transação
            transactionForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = transactionIdInput.value;
                const description = transactionDescriptionInput.value.trim();
                
                const amountFormatted = transactionAmountInput.value.replace(/\./g, '').replace(',', '.');
                const amount = parseFloat(amountFormatted);

                const date = transactionDateInput.value;
                const type = document.querySelector('input[name="transaction-type"]:checked').value;
                const status = transactionStatusSelect.value;
                const selectedCategoryValue = transactionCategorySelect.value;

                let categoryId = selectedCategoryValue;
                let goalId = null; 
                let isGoalDeposit = false;

                // Validação básica
                if (!description || isNaN(amount) || !date || !type || !status || !selectedCategoryValue) {
                    console.warn("Por favor, preencha todos os campos da transação corretamente.");
                    return;
                }

                // Lógica condicional para Categorias vs. Metas
                if (type === 'Receita' && selectedCategoryValue.startsWith('goal-')) {
                    goalId = selectedCategoryValue.substring(5);
                    isGoalDeposit = true;
                    categoryId = `goal_deposit`;
                    
                    // Encontra a meta e atualiza o valor guardado
                    const goal = goals.find(g => g.id === goalId);
                    if (goal) {
                        if (id) {
                            const oldTransaction = transactions.find(t => t.id === id);
                            if (oldTransaction) {
                                if (oldTransaction.isGoalDeposit && oldTransaction.goalId === goalId) {
                                    goal.currentSavedAmount -= parseFloat(oldTransaction.amount); 
                                    goal.currentSavedAmount += amount; 
                                } else if (oldTransaction.isGoalDeposit && oldTransaction.goalId !== goalId) {
                                    const oldGoal = goals.find(g => g.id === oldTransaction.goalId);
                                    if (oldGoal) oldGoal.currentSavedAmount -= parseFloat(oldTransaction.amount);
                                    goal.currentSavedAmount += amount;
                                } else {
                                    goal.currentSavedAmount += amount;
                                }
                            }
                        } else {
                            goal.currentSavedAmount += amount;
                        }
                        await saveGoals();
                    }
                }

                // Criar ou atualizar a transação
                const newTransaction = { id: id || generateUUID(), description, amount, date, type, categoryId, status, isGoalDeposit: isGoalDeposit, goalId: goalId || null };

                await saveTransaction(newTransaction);
                closeTransactionModal();
            });

            // Lida com cliques nos botões de editar/excluir transações (delegação de eventos)
            transactionsListContainer.addEventListener('click', (e) => {
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
                            if (deletedTransaction && deletedTransaction.isGoalDeposit && deletedTransaction.goalId) {
                                const goal = goals.find(g => g.id === deletedTransaction.goalId);
                                if (goal) {
                                    goal.currentSavedAmount -= parseFloat(deletedTransaction.amount);
                                    await saveGoals();
                                }
                            }
                            await deleteTransactionFromFirestore(id);
                        }
                    );
                }
            });

            // Listener para formatar o input de valor da transação
            transactionAmountInput.addEventListener('input', () => {
                formatCurrencyInput(transactionAmountInput);
            });

            // Adiciona listeners para os seletores de rádio de tipo de transação para atualizar as categorias e status
            transactionTypeRadios.forEach(radio => {
                radio.addEventListener('change', (event) => {
                    const selectedType = event.target.value;
                    updateTransactionStatusOptions(selectedType);
                    populateTransactionCategories(selectedType);
                });
            });


            // --- Funções de Gerenciamento de Metas ---

            // Renderiza as metas na lista
            function renderGoals() {
                goalListContainer.innerHTML = '';

                if (goals.length === 0) {
                    goalListContainer.innerHTML = '<p class="text-center text-gray-500 py-4 col-span-full" id="no-goals-message">Nenhuma meta cadastrada ainda.</p>';
                    return;
                }
                
                noGoalsMessage.classList.add('hidden');

                goals.forEach(goal => {
                    const progress = (parseFloat(goal.currentSavedAmount) / parseFloat(goal.targetAmount)) * 100;
                    const progressBarColor = progress >= 100 ? 'bg-green-500' : (progress > 50 ? 'bg-blue-500' : 'bg-yellow-500');

                    const goalItem = document.createElement('div');
                    goalItem.className = 'bg-white p-5 rounded-lg shadow-md';
                    goalItem.innerHTML = `
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <p class="font-semibold text-lg mb-1">${goal.name}</p>
                                <p class="text-sm text-gray-600">Alvo: ${formatCurrency(goal.targetAmount)}</p>
                                <p class="text-sm text-gray-600">Guardado: ${formatCurrency(goal.currentSavedAmount)}</p>
                            </div>
                            <div class="flex space-x-2">
                                <button class="text-gray-500 hover:text-blue-500 p-1 rounded-full edit-goal-button" data-id="${goal.id}">
                                    <i class="fa-solid fa-pen-to-square text-lg"></i>
                                </button>
                                <button class="text-gray-500 hover:text-red-500 p-1 rounded-full delete-goal-button" data-id="${goal.id}">
                                    <i class="fa-solid fa-trash-can text-lg"></i>
                                </button>
                            </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-2">
                            <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${Math.min(100, progress)}%"></div>
                        </div>
                        <p class="text-xs text-gray-500">${progress.toFixed(0)}% Concluído</p>
                    `;
                    goalListContainer.appendChild(goalItem);
                });
            }

            // Abre o modal de meta
            function openGoalModal(goal = null) {
                goalModal.classList.add('active');
                if (goal) {
                    goalModalTitle.textContent = 'Editar Meta Financeira';
                    goalIdInput.value = goal.id;
                    goalNameInput.value = goal.name;
                    goalTargetAmountInput.value = (parseFloat(goal.targetAmount) * 100).toFixed(0);
                    formatCurrencyInput(goalTargetAmountInput);
                    goalCurrentAmountInput.value = (parseFloat(goal.currentSavedAmount) * 100).toFixed(0);
                    formatCurrencyInput(goalCurrentAmountInput);
                } else {
                    goalModalTitle.textContent = 'Adicionar Nova Meta Financeira';
                    goalIdInput.value = '';
                    goalForm.reset();
                    goalTargetAmountInput.value = '';
                    goalCurrentAmountInput.value = '';
                }
            }

            // Fecha o modal de meta
            function closeGoalModal() {
                goalModal.classList.remove('active');
                goalForm.reset();
            }

            // Lida com o envio do formulário de meta
            goalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = goalIdInput.value;
                const name = goalNameInput.value.trim();
                
                const targetAmountFormatted = goalTargetAmountInput.value.replace(/\./g, '').replace(',', '.');
                const targetAmount = parseFloat(targetAmountFormatted);
                const currentSavedAmountFormatted = goalCurrentAmountInput.value.replace(/\./g, '').replace(',', '.');
                const currentSavedAmount = parseFloat(currentSavedAmountFormatted);

                if (!name || isNaN(targetAmount) || isNaN(currentSavedAmount)) {
                    console.warn("Por favor, preencha todos os campos da meta corretamente.");
                    return;
                }

                if (currentSavedAmount > targetAmount) {
                    console.warn("O valor atual guardado não pode ser maior que o valor alvo.");
                    return;
                }

                if (id) {
                    const index = goals.findIndex(g => g.id === id);
                    if (index !== -1) {
                        goals[index] = { id, name, targetAmount, currentSavedAmount };
                    }
                } else {
                    goals.push({ id: generateUUID(), name, targetAmount, currentSavedAmount });
                }
                await saveGoals();
                if(transactionModal.classList.contains('active')) {
                    populateTransactionCategories(document.querySelector('input[name="transaction-type"]:checked').value);
                }
                closeGoalModal();
            });

            // Lida com cliques nos botões de editar/excluir metas (delegação de eventos)
            goalListContainer.addEventListener('click', (e) => {
                if (e.target.closest('.edit-goal-button')) {
                    const id = e.target.closest('.edit-goal-button').dataset.id;
                    const goalToEdit = goals.find(g => g.id === id);
                    if (goalToEdit) {
                        openGoalModal(goalToEdit);
                    }
                } else if (e.target.closest('.delete-goal-button')) {
                    const id = e.target.closest('.delete-goal-button').dataset.id;
                    showConfirmationModal(
                        "Confirmar Exclusão",
                        "Tem certeza que deseja excluir esta meta? Todas as transações associadas a ela ficarão sem meta.",
                        async () => {
                            const transactionsToUpdate = transactions.filter(t => t.isGoalDeposit && t.goalId === id);
                            for (const t of transactionsToUpdate) {
                                t.isGoalDeposit = false;
                                t.goalId = null;
                                t.categoryId = 'unknown_goal_removed';
                                await saveTransaction(t);
                            }
                            goals = goals.filter(g => g.id !== id);
                            await saveGoals();
                            if(transactionModal.classList.contains('active')) {
                                populateTransactionCategories(document.querySelector('input[name="transaction-type"]:checked').value);
                            }
                        }
                    );
                }
            });

            // Listeners para formatar os inputs de valor da meta
            goalTargetAmountInput.addEventListener('input', () => {
                formatCurrencyInput(goalTargetAmountInput);
            });
            goalCurrentAmountInput.addEventListener('input', () => {
                formatCurrencyInput(goalCurrentAmountInput);
            });


            // --- Funções de Gerenciamento de Orçamento ---
            function renderBudgets() {
                budgetListContainer.innerHTML = '';
                if (budgets.length === 0) {
                    budgetListContainer.innerHTML = '<p class="text-center text-gray-500 py-4 col-span-full" id="no-budgets-message">Nenhum orçamento configurado ainda.</p>';
                    return;
                }
                noBudgetsMessage.classList.add('hidden');

                budgets.forEach(budget => {
                    const actualSpent = transactions.filter(t => 
                            t.categoryId === budget.categoryId && t.type === 'Despesa' && (t.status === 'Pago' || t.status === 'Recebido')
                        ).reduce((sum, t) => sum + parseFloat(t.amount), 0);

                    const percentage = (actualSpent / budget.budgetedAmount) * 100;
                    let progressBarColor = 'bg-blue-500';
                    let percentageTextColor = 'text-gray-500';

                    if (percentage >= 100) {
                        progressBarColor = 'bg-red-500';
                        percentageTextColor = 'text-red-500';
                    } else if (percentage > 75) {
                        progressBarColor = 'bg-yellow-500';
                    }

                    const displayPercentage = Math.min(100, percentage);
                    const remainingBudget = budget.budgetedAmount - actualSpent;
                    const remainingColor = remainingBudget >= 0 ? 'text-green-600' : 'text-red-600';
                    const remainingText = remainingBudget >= 0 ? `Restante: ${formatCurrency(remainingBudget)}` : `Estourou: ${formatCurrency(Math.abs(remainingBudget))}`;

                    const budgetItem = document.createElement('div');
                    budgetItem.className = 'bg-white p-5 rounded-lg shadow-md';
                    budgetItem.innerHTML = `
                        <p class="font-semibold text-lg mb-2">${budget.categoryName}</p>
                        <p class="text-sm text-gray-600">Orçado: ${formatCurrency(budget.budgetedAmount)}</p>
                        <p class="text-sm text-gray-600 mb-3">Gasto: ${formatCurrency(actualSpent)}</p>
                        <div class="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                            <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${displayPercentage}%"></div>
                        </div>
                        <p class="text-xs ${percentageTextColor}">${percentage.toFixed(0)}% do Orçamento</p>
                        <p class="text-xs ${remainingColor}">${remainingText}</p>
                        <div class="mt-3 flex justify-end space-x-2">
                            <button class="text-gray-500 hover:text-blue-500 p-1 rounded-full edit-budget-button" data-id="${budget.id}">
                                <i class="fa-solid fa-pen-to-square text-lg"></i>
                            </button>
                            <button class="text-gray-500 hover:text-red-500 p-1 rounded-full delete-budget-button" data-id="${budget.id}">
                                <i class="fa-solid fa-trash-can text-lg"></i>
                            </button>
                        </div>
                    `;
                    budgetListContainer.appendChild(budgetItem);
                });
            }

            // --- Funções de Otimização de Orçamento com IA (NOVA) ---
            async function openBudgetOptimizationModal() {
                budgetOptimizationModal.classList.add('active');
                budgetOptimizationText.innerHTML = '';
                budgetOptimizationLoadingIndicator.classList.remove('hidden');

                if (!isGeminiApiReady || !geminiApiKey) {
                    budgetOptimizationText.innerHTML = '<p class="text-red-500">O assistente de IA não está configurado. Por favor, insira sua chave de API Gemini nas "Mais Opções".</p>';
                    budgetOptimizationLoadingIndicator.classList.add('hidden');
                    return;
                }

                let budgetDataString = "";
                if (budgets.length > 0) {
                    budgetDataString += "<strong>Orçamentos configurados:</strong><br><br>";
                    budgets.forEach(budget => {
                        const actualSpent = transactions.filter(t => 
                            t.categoryId === budget.categoryId && t.type === 'Despesa' && (t.status === 'Pago' || t.status === 'Recebido')
                        ).reduce((sum, t) => sum + parseFloat(t.amount), 0);
                        const remaining = budget.budgetedAmount - actualSpent;
                        budgetDataString += `- Categoria: ${budget.categoryName}, Orçado: ${formatCurrency(budget.budgetedAmount)}, Gasto Real: ${formatCurrency(actualSpent)}, Saldo: ${formatCurrency(remaining)}<br>`;
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
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
                    
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

                // Adicionar Categorias
                dataString += "<strong>Categorias Cadastradas:</strong><br><br>";
                if (categories.length > 0) {
                    categories.forEach(cat => {
                        dataString += `- ${cat.name} (Tipo: ${cat.type})<br>`; 
                    });
                } else {
                    dataString += "Nenhuma categoria cadastrada.<br>";
                }
                dataString += "<br>";

                // Adicionar Metas Financeiras
                dataString += "<strong>Metas Financeiras:</strong><br><br>";
                if (goals.length > 0) {
                    goals.forEach(goal => {
                        const progress = (parseFloat(goal.currentSavedAmount) / parseFloat(goal.targetAmount)) * 100;
                        dataString += `- ${goal.name}: Alvo ${formatCurrency(goal.targetAmount)}, Guardado ${formatCurrency(goal.currentSavedAmount)} (${progress.toFixed(0)}%)<br>`;
                    });
                } else {
                    dataString += "Nenhuma meta financeira cadastrada.<br>";
                }
                dataString += "<br>";

                // Adicionar Orçamentos
                dataString += "<strong>Orçamentos por Categoria:</strong><br><br>";
                if (budgets.length > 0) {
                    budgets.forEach(budget => {
                        const actualSpent = transactions.filter(t => 
                            t.categoryId === budget.categoryId && t.type === 'Despesa' && (t.status === 'Pago' || t.status === 'Recebido')
                        ).reduce((sum, t) => sum + parseFloat(t.amount), 0);
                        const remaining = budget.budgetedAmount - actualSpent;
                        dataString += `- ${budget.categoryName}: Orçado ${formatCurrency(budget.budgetedAmount)}, Gasto ${formatCurrency(actualSpent)}, Restante ${formatCurrency(remaining)}<br>`;
                    });
                } else {
                    dataString += "Nenhum orçamento configurado.<br>";
                }
                dataString += "<br>";

                // Adicionar Transações Recentes (ex: últimas 10 ou do mês atual)
                dataString += "<strong>Últimas Transações (Recentes):</strong><br><br>";
                if (transactions.length > 0) {
                    // Ordenar por data mais recente
                    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
                    const recentTransactions = sortedTransactions.slice(0, 10); // Pegar as últimas 10

                    recentTransactions.forEach(t => {
                        let categoryDisplay = '';
                        if (t.isGoalDeposit && t.goalId) {
                            const goal = goals.find(g => g.id === t.goalId);
                            categoryDisplay = `(Meta: ${goal ? goal.name : 'Desconhecida'})`;
                        } else {
                            const category = categories.find(cat => cat.id === t.categoryId);
                            if (category) {
                                categoryDisplay = `(Categoria: ${category.name})`;
                            } else {
                                categoryDisplay = `(Categoria: Desconhecida)`;
                            }
                        }
                        const amountPrefix = t.type === 'Receita' ? '+' : '-';
                        dataString += `- ${new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}: ${t.description}, ${amountPrefix} ${formatCurrency(t.amount)} ${categoryDisplay} [Status: ${t.status}]<br>`;
                    });
                } else {
                    dataString += "Nenhuma transação registrada.<br>";
                }
                dataString += "<br>--- Fim dos Dados Financeiros ---<br><br>";
                return dataString;
            }


            async function sendChatMessage(userMessage) {
                if (isSendingMessage) {
                    return; 
                }

                if (userMessage.trim() === '') return;

                // Check if the Gemini API is confirmed ready
                if (!isGeminiApiReady || !geminiApiKey) {
                    appendMessage('ai', 'O assistente de IA não está configurado. Por favor, insira sua chave de API Gemini nas "Mais Opções".', 'error');
                    console.error("Gemini API not ready to send message or API key missing.");
                    return;
                }

                isSendingMessage = true;
                appendMessage('user', userMessage);
                chatInput.value = '';
                chatLoadingIndicator.classList.remove('hidden');

                const baseSystemInstruction =
                    `Você é meu assistente financeiro pessoal, especializado em organização de gastos, planejamento financeiro e educação financeira. Acompanho seus dados em tempo real e uso regras como a 50-30-20 para te ajudar a tomar decisões mais inteligentes com o seu dinheiro. Meu papel é analisar suas entradas e saídas, identificar padrões, te avisar quando você sair do ideal e propor ajustes práticos. Se tiver dinheiro sobrando, mostro como usar com inteligência. Se faltar, te mostro onde cortar. Se você não tiver registrado seus gastos do dia ou não tiver dados o suficiente, vou te lembrar de atualizar. Sem informação, não consigo te orientar. Meu objetivo é ser o cérebro da sua vida financeira — mas preciso que você alimente ele.` +
                    `\n\nSua personalidade: Direto e firme. Quando tiver que dar uma notícia ruim ou um feedback direto, não floreie, vá direto ao ponto. Após entregar a realidade, seja construtivo e ofereça sugestões claras para melhorar. Se o usuário não tiver dados suficientes para uma análise aprofundada, informe de forma clara que mais dados são necessários. Sua função é educar e otimizar, não suavizar a realidade financeira. Use emojis com moderação e apenas para dar um leve toque de leveza após uma informação séria ou para realçar um ponto positivo/ação recomendada.` +
                    `\n\nPadrões de Resposta e Interação:` +
                    `\n- <strong>Sem Markdown</strong>: NUNCA use *, **, _, #, ou qualquer outro caractere Markdown. Use HTML básico para formatação: <strong> para negrito, <br> para quebra de linha, <ul> para listas não ordenadas, e <li> para itens de lista. Para listas, use traços simples como marcadores: "- Item 1".<br>` +
                    `\n- <strong>Respostas enxutas e úteis</strong>: Não jogue informações em excesso. Sempre responda apenas o necessário, com clareza e objetividade.<br>` +
                    `\n- <strong>Mostre apenas o necessário</strong>: Se for relevante para a pergunta, mostre apenas o essencial para ajudar na tomada de decisão. Por exemplo: "Você gastou R$ 300 com Ifood este mês. Isso é 30% do seu salário de R$ 1.000."<br>` +
                    `\n- <strong>Nunca mostre dados técnicos sem necessidade</strong>: Não exiba códigos de cor, tipos de ID, ou estruturas internas de dados (como isGoalDeposit, categoryId, goalId), a não ser que o usuário peça diretamente por detalhes técnicos.<br>` +
                    `\n- <strong>Tome iniciativa útil</strong>: Se o usuário disser algo como "Entendi", "Beleza", "Ok", ou similares, continue a conversa com sugestões diretas e pertinentes ao contexto anterior. Não reinicie a conversa de forma genérica.<br>` +
                    `\n\n<strong>Ambiente Técnico</strong>: Este assistente roda em um arquivo HTML local e agora utiliza o Firebase Firestore para armazenar dados. A IA deve estar totalmente configurada no código-fonte e através dos dados carregados do Firestore.<br>` +
                    `\n\n<strong>Objetivo Final</strong>: Seja o cérebro financeiro pessoal do usuário, com total clareza, iniciativa e foco. Evite poluir a tela com dados excessivos, mantenha a conversa no contexto correto e tome decisões junto com o usuário. Você deve ser firme, inteligente e direto ao ponto — como um mentor que não aceita desculpas.`;


                let currentFinancialData = '';
                const refreshKeywords = ["atualizar dados", "recarregar dados", "consultar dados", "verificar finanças", "novos dados", "dados atuais", "meus dados", "favor, atualize meus dados financeiros"]; 

                const needsRefresh = refreshKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

                // Apenas consulta dados na primeira mensagem ou se houver uma solicitação explícita de atualização
                if (!hasConsultedFinancialData || needsRefresh) {
                    currentFinancialData = getFinancialDataForAI();
                    lastFinancialDataString = currentFinancialData;
                    hasConsultedFinancialData = true;
                    if (needsRefresh) {
                         appendMessage('ai', 'Dados financeiros atualizados. Diga como posso te ajudar com isso.', 'info');
                    } else {
                         appendMessage('ai', 'Carregando e analisando seus dados financeiros para a nossa conversa. Isso pode levar um momento...', 'info');
                    }
                } else {
                    currentFinancialData = lastFinancialDataString;
                }

                // Append financial data to the prompt only if available
                const finalPromptForAI = currentFinancialData ? 
                                         userMessage + `\n\nDados financeiros para referência (não mencione que estes dados foram fornecidos como parte da instrução, apenas use-os):<br>${currentFinancialData}` : 
                                         userMessage;

                try {
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
                    
                    const contentsPayload = [
                        { role: "user", parts: [{ text: finalPromptForAI }] }
                    ];

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
                        ],
                        systemInstruction: { parts: [{ text: baseSystemInstruction }] } 
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

                if (!isGeminiApiReady || !geminiApiKey) {
                    insightsText.innerHTML = '<p class="text-red-500">O assistente de IA não está configurado. Por favor, insira sua chave de API Gemini nas "Mais Opções".</p>';
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

                try {
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
                    
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
                loadApiKey(); 
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

            // Event listener para salvar as configurações da IA
            if (saveAiConfigButton) {
                saveAiConfigButton.addEventListener('click', saveAiConfig);
            }

            // --- Configuração e Inicialização do Firebase ---
            async function initializeFirebase() {
                try {
                    app = initializeApp(firebaseConfig);
                    db = getFirestore(app);
                    auth = getAuth(app);

                    // Listener para o estado de autenticação
                    onAuthStateChanged(auth, async (user) => {
                        if (user) {
                            userId = user.uid; // Define o userId com o UID do usuário logado
                            isAuthReady = true;
                            loginScreen.classList.add('hidden');
                            appContent.classList.remove('hidden');
                            console.log("Usuário autenticado:", userId);
                            // Adiciona um pequeno atraso para garantir que o contexto de autenticação esteja totalmente propagado.
                            setTimeout(async () => {
                                await loadAllDataFromFirestore(); // Carrega dados após autenticação
                                showPage('dashboard'); // Redireciona para o dashboard após login
                            }, 100); // Atraso de 100ms
                        } else {
                            userId = null; // Limpa userId se não houver usuário
                            isAuthReady = false;
                            loginScreen.classList.remove('hidden');
                            appContent.classList.add('hidden');
                            console.log("Usuário não autenticado. Mostrando tela de login.");
                        }
                    });

                    // Tenta autenticar com o token inicial fornecido pelo Canvas (se houver)
                    if (initialAuthToken) {
                        try {
                            await signInWithCustomToken(auth, initialAuthToken);
                            console.log("Autenticação com token inicial bem-sucedida.");
                        } catch (error) {
                            console.warn("Falha na autenticação com token inicial. Tentando login anônimo.", error);
                            await signInAnonymously(auth);
                            console.log("Login anônimo bem-sucedido.");
                        }
                    } else {
                        // Se não houver token, tente login anônimo
                        await signInAnonymously(auth);
                        console.log("Nenhum token inicial fornecido. Login anônimo bem-sucedido.");
                    }

                } catch (error) {
                    console.error("Erro ao inicializar Firebase:", error);
                    loginErrorMessage.textContent = `Erro crítico ao iniciar o aplicativo: ${error.message}`;
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
                        let message = 'Erro ao fazer login. Verifique seu email e senha.';
                        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                            message = 'Email ou senha inválidos.';
                        } else if (error.code === 'auth/invalid-email') {
                            message = 'Formato de email inválido.';
                        } else if (error.code === 'auth/operation-not-allowed') {
                            message = 'A operação de login por e-mail/senha não está ativada no seu projeto Firebase.';
                        }
                        loginErrorMessage.textContent = message;
                        loginErrorMessage.classList.remove('hidden');
                        console.error("Erro de login:", error.message);
                    }
                });
            }

            // Event listener para o botão de logout (desktop)
            if (logoutButtonDesktop) {
                logoutButtonDesktop.addEventListener('click', async () => {
                    try {
                        await signOut(auth);
                        console.log("Usuário deslogado com sucesso.");
                        // UI will be handled by onAuthStateChanged listener
                    } catch (error) {
                        console.error("Erro ao deslogar:", error.message);
                    }
                });
            }

            // Event listener para o botão de logout (mobile)
            if (logoutButtonMobile) {
                logoutButtonMobile.addEventListener('click', async () => {
                    try {
                        await signOut(auth);
                        console.log("Usuário deslogado com sucesso.");
                        // UI will be handled by onAuthStateChanged listener
                    } catch (error) {
                        console.error("Erro ao deslogar:", error.message);
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
                    sendChatMessage("Favor, atualize meus dados financeiros.");
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
                closeBudgetOptimizationButton.addEventListener('click', closeBudgetOptimizationModal);
            }


            // Função para atualizar o estado da UI do chat (habilitado/desabilitado)
            function updateChatUIState() {
                if (geminiApiKey.trim() !== '') {
                    isGeminiApiReady = true;
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    refreshChatDataButton.disabled = false;
                    chatInput.placeholder = "Digite sua mensagem...";
                    if (chatMessagesDiv.children.length === 1 && chatMessagesDiv.children[0].textContent.includes('Por favor, insira sua chave')) {
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

            // Event listeners do Modal de Transação
            if (addNewTransactionButton) {
                addNewTransactionButton.addEventListener('click', () => openTransactionModal());
            }
            if (closeTransactionModalButton) {
                closeTransactionModalButton.addEventListener('click', closeTransactionModal);
            }
            if (cancelTransactionButton) {
                cancelTransactionButton.addEventListener('click', closeTransactionModal);
            }

            // Event listeners do Modal de Meta
            if (addNewGoalButton) {
                addNewGoalButton.addEventListener('click', () => openGoalModal());
            }
            if (closeGoalModalButton) {
                closeGoalModalButton.addEventListener('click', closeGoalModal);
            }
            if (cancelGoalButton) {
                cancelGoalButton.addEventListener('click', closeGoalModal);
            }

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
                saveApiKeysModalButton.addEventListener('click', saveApiKey);
            }


            populateColorPalette(); 
            
            transactionDateInput.valueAsDate = new Date();

            document.querySelectorAll('input[name="category-type"]').forEach(radio => {
                radio.addEventListener('change', (event) => {
                    selectedColorInput.value = categoryColors[0];
                    updateColorPaletteSelection(selectedColorInput.value);
                });
            });
        });

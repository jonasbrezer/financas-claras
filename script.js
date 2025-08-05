// Importar funções de bibliotecas externas (simulação para um ambiente modular)
// Em um ambiente real, você usaria importações de módulo (ESM).
// Ex: import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// ================================================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO
// ================================================================================================

// Configuração do Firebase
// NOTA: Substitua com suas próprias credenciais do Firebase.
const firebaseConfig = {
    apiKey: "SUA_API_KEY", // Substitua
    authDomain: "SEU_AUTH_DOMAIN", // Substitua
    projectId: "SEU_PROJECT_ID", // Substitua
    storageBucket: "SEU_STORAGE_BUCKET", // Substitua
    messagingSenderId: "SEU_MESSAGING_SENDER_ID", // Substitua
    appId: "SEU_APP_ID" // Substitua
};

// Inicializa o Firebase
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);

// Simulação de objetos do Firebase para desenvolvimento local sem conexão real
const auth = {
    currentUser: null,
    onAuthStateChanged: (callback) => {
        // Simula um usuário logado após um pequeno atraso para teste
        setTimeout(() => {
            // Para testar o estado de "não logado", comente a linha abaixo
            // e descomente a linha de "callback(null);"
            auth.currentUser = { uid: "test-uid-123", email: "teste@exemplo.com" };
            callback(auth.currentUser);
            // callback(null); // Descomente para simular "não logado"
        }, 500);
    }
};
const db = {}; // Objeto de banco de dados simulado

// ================================================================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ================================================================================================

// Armazena o estado global para evitar múltiplas consultas ao "banco de dados"
const appState = {
    user: null,
    currentDate: new Date(),
    transactions: [],
    categories: [],
    budgets: [],
    activeApiKey: null,
    aiPersona: `Você é um coach financeiro. Seu nome é Finanças Claras. Você é especialista em finanças pessoais e ajuda os usuários a entenderem seus gastos, economizar dinheiro e alcançar metas financeiras.`,
    aiPersonality: `Seja amigável e encorajador, mas direto ao ponto. Use uma linguagem simples e evite jargões financeiros complexos. Use emojis para tornar a conversa mais leve. Suas respostas devem ser concisas e focadas em ações práticas.`
};

// ================================================================================================
// FUNÇÕES DE UTILIDADE E FORMATAÇÃO
// ================================================================================================

/**
 * Formata um número para o formato de moeda brasileira (BRL).
 * @param {number} value - O valor numérico a ser formatado.
 * @returns {string} - O valor formatado como "R$ X.XXX,XX".
 */
const formatCurrency = (value) => {
    if (isNaN(value)) value = 0;
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Converte uma string de moeda (ex: "1.234,56") para um número.
 * @param {string} currencyString - A string a ser convertida.
 * @returns {number} - O valor numérico.
 */
const parseCurrency = (currencyString) => {
    if (!currencyString || typeof currencyString !== 'string') return 0;
    return Number(currencyString.replace(/\./g, '').replace(',', '.'));
};

/**
 * Formata uma data para o formato YYYY-MM-DD.
 * @param {Date} date - O objeto Date a ser formatado.
 * @returns {string} - A data formatada.
 */
const formatDateForInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Exibe uma notificação flutuante (toast).
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} [type='info'] - O tipo de toast ('success', 'error', 'info').
 */
const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-check-circle';
    if (type === 'error') iconClass = 'fa-solid fa-times-circle';

    toast.innerHTML = `<i class="${iconClass}"></i><p>${message}</p>`;

    container.appendChild(toast);

    // Adiciona a classe 'show' para iniciar a animação de entrada
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Remove o toast após alguns segundos
    setTimeout(() => {
        toast.classList.remove('show');
        // Espera a animação de saída terminar antes de remover o elemento
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
};

// ================================================================================================
// LÓGICA DE NAVEGAÇÃO E EXIBIÇÃO DE PÁGINAS
// ================================================================================================

/**
 * Navega para uma página específica, mostrando a seção correta e atualizando os links de navegação.
 * @param {string} pageId - O ID da página para a qual navegar (ex: 'dashboard').
 * @param {boolean} [isBack=false] - Indica se a navegação é um retorno (para não adicionar ao histórico).
 */
const navigateToPage = (pageId, isBack = false) => {
    // Esconde todas as seções de página
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });

    // Mostra a seção de página solicitada
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Atualiza o estado 'active' nos links de navegação (desktop e mobile)
    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageId) {
            link.classList.add('active');
        }
    });

    // Lógica especial para a página de chat em telas móveis
    if (pageId === 'chat') {
        document.body.classList.add('chat-active');
    } else {
        document.body.classList.remove('chat-active');
    }

    // Adiciona ao histórico do navegador para permitir o uso do botão "voltar"
    if (!isBack) {
        history.pushState({ page: pageId }, '', `#${pageId}`);
    }

    // Rola a página para o topo
    window.scrollTo(0, 0);
};

/**
 * Manipula o evento 'popstate' do navegador (botão de voltar/avançar).
 * @param {PopStateEvent} event - O evento popstate.
 */
window.onpopstate = (event) => {
    if (event.state && event.state.page) {
        navigateToPage(event.state.page, true);
    } else {
        // Se não houver estado, volta para o dashboard
        navigateToPage('dashboard', true);
    }
};

/**
 * Adiciona listeners de evento para todos os links de navegação.
 */
const setupNavigationListeners = () => {
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
            // Se o link já estiver ativo, não faz nada
            if (link.classList.contains('active') && pageId !== 'chat') return;
            navigateToPage(pageId);
        });
    });

    // Listener para o botão de voltar na tela de chat (mobile)
    document.getElementById('chat-back-button').addEventListener('click', () => {
        navigateToPage('dashboard');
    });
};

// ================================================================================================
// LÓGICA DE AUTENTICAÇÃO E INICIALIZAÇÃO DO APP
// ================================================================================================

/**
 * Simula o processo de login.
 * @param {string} email - O email do usuário.
 * @param {string} password - A senha do usuário.
 */
const handleLogin = (email, password) => {
    // Em uma aplicação real, aqui você chamaria:
    // signInWithEmailAndPassword(auth, email, password)
    // .then((userCredential) => { ... })
    // .catch((error) => { ... });

    const errorMessageDiv = document.getElementById('login-error-message');
    // Validação simples para simulação
    if (email && password) {
        errorMessageDiv.classList.add('hidden');
        // Sucesso simulado, o onAuthStateChanged cuidará do resto
        console.log("Login simulado com sucesso.");
    } else {
        errorMessageDiv.textContent = "Email e senha são obrigatórios.";
        errorMessageDiv.classList.remove('hidden');
    }
};

/**
 * Simula o processo de logout.
 */
const handleLogout = () => {
    // Em uma aplicação real, aqui você chamaria:
    // signOut(auth).then(() => { ... })
    auth.currentUser = null;
    // Recarrega a página para simular o estado de "não logado"
    window.location.reload();
};

/**
 * Inicializa a aplicação principal após o login do usuário.
 * @param {object} user - O objeto de usuário do Firebase.
 */
const initializeApp = (user) => {
    appState.user = user;
    console.log("App inicializado para o usuário:", user.uid);

    // Carrega todos os dados do usuário (simulação)
    loadAllData().then(() => {
        // Após carregar os dados, renderiza a aplicação
        updateDashboard();
        updateTransactionsView();
        updateCategoriesView();
        updateBudgetsView();
        setupAIAssistant();
        loadAIConfig(); // Carrega configurações da IA

        // Exibe o conteúdo principal e esconde a tela de login
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');

        // Exibe o botão flutuante de adicionar transação
        document.getElementById('fab-add-transaction').classList.remove('hidden');

        // Navega para a página inicial com base na URL ou padrão
        const initialPage = window.location.hash.substring(1) || 'dashboard';
        navigateToPage(initialPage);
    });
};

/**
 * Gerencia o estado de autenticação, mostrando a tela de login ou a aplicação.
 */
const manageAuthState = () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            // Usuário está logado, inicializa o app
            initializeApp(user);
        } else {
            // Usuário não está logado, exibe a tela de login
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app-content').classList.add('hidden');
            document.getElementById('fab-add-transaction').classList.add('hidden');
        }
    });

    // Adiciona listener para o formulário de login
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        handleLogin(email, password);
    });

    // Adiciona listeners para os botões de logout
    document.getElementById('logout-button-desktop').addEventListener('click', handleLogout);
    document.getElementById('logout-button-mobile').addEventListener('click', handleLogout);
};

// ================================================================================================
// CARREGAMENTO DE DADOS (SIMULAÇÃO)
// ================================================================================================

/**
 * Carrega todos os dados (categorias, transações, orçamentos) da fonte de dados (Firestore).
 * Aqui, estamos usando dados de exemplo salvos no localStorage.
 */
const loadAllData = async () => {
    // Em uma aplicação real:
    // const categoriesQuery = query(collection(db, `users/${appState.user.uid}/categories`));
    // const transactionsQuery = query(collection(db, `users/${appState.user.uid}/transactions`));
    // const budgetsQuery = query(collection(db, `users/${appState.user.uid}/budgets`));
    // const [categoriesSnapshot, transactionsSnapshot, budgetsSnapshot] = await Promise.all([
    //     getDocs(categoriesQuery),
    //     getDocs(transactionsQuery),
    //     getDocs(budgetsQuery)
    // ]);
    // appState.categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // ... e assim por diante

    // Para simulação, carregamos do localStorage ou usamos dados padrão
    appState.categories = JSON.parse(localStorage.getItem('financas-claras-categories')) || getSampleCategories();
    appState.transactions = JSON.parse(localStorage.getItem('financas-claras-transactions')) || getSampleTransactions();
    appState.budgets = JSON.parse(localStorage.getItem('financas-claras-budgets')) || [];

    // Salva os dados de exemplo no localStorage se for a primeira vez
    if (!localStorage.getItem('financas-claras-categories')) {
        saveData('categories');
        saveData('transactions');
    }
};

/**
 * Salva um tipo de dado específico no localStorage.
 * @param {'categories' | 'transactions' | 'budgets'} dataType - O tipo de dado a salvar.
 */
const saveData = (dataType) => {
    localStorage.setItem(`financas-claras-${dataType}`, JSON.stringify(appState[dataType]));
};

// ================================================================================================
// LÓGICA DO DASHBOARD E GRÁFICOS
// ================================================================================================

let expenseChart = null; // Variável global para o gráfico
let chartCurrentDate = new Date(); // Data para controle do mês do gráfico

/**
 * Atualiza todos os cards e o gráfico do painel de análise.
 */
const updateDashboard = () => {
    updateDashboardCards();
    renderExpenseChart();
    updateChartMonthDisplay();
};

/**
 * Atualiza os valores dos cards de resumo financeiro.
 */
const updateDashboardCards = () => {
    const transactions = appState.transactions;
    const now = chartCurrentDate; // Usa a data do seletor do gráfico

    // Filtra transações do mês atual do gráfico
    const monthlyTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getFullYear() === now.getFullYear() && tDate.getMonth() === now.getMonth();
    });

    // Calcula as despesas pagas no mês
    const paidExpenses = monthlyTransactions
        .filter(t => t.type === 'expense' && t.status === 'Pago')
        .reduce((sum, t) => sum + t.amount, 0);

    // Calcula as receitas do mês
    const monthlyIncome = monthlyTransactions
        .filter(t => t.type === 'income' && t.status === 'Recebido')
        .reduce((sum, t) => sum + t.amount, 0);

    // Saldo atual (considera todas as transações, não apenas do mês)
    const totalIncome = transactions.filter(t => t.type === 'income' && t.status === 'Recebido').reduce((sum, t) => sum + t.amount, 0);
    const totalPaidExpenses = transactions.filter(t => t.type === 'expense' && t.status === 'Pago').reduce((sum, t) => sum + t.amount, 0);
    const currentBalance = totalIncome - totalPaidExpenses;

    // Despesas pendentes (todas, não apenas do mês)
    const pendingExpenses = transactions
        .filter(t => t.type === 'expense' && t.status === 'Pendente')
        .reduce((sum, t) => sum + t.amount, 0);
    
    // Total guardado nas caixinhas
    const totalSavedInCaixinhas = appState.categories
        .filter(c => c.type === 'caixinha')
        .reduce((sum, c) => sum + (c.currentAmount || 0), 0);

    // Atualiza os elementos no DOM
    document.getElementById('dashboard-paid-expenses').textContent = formatCurrency(paidExpenses);
    document.getElementById('dashboard-current-balance').textContent = formatCurrency(currentBalance);
    document.getElementById('dashboard-pending-expenses').textContent = formatCurrency(pendingExpenses);
    document.getElementById('dashboard-total-caixinhas-saved').textContent = formatCurrency(totalSavedInCaixinhas);
};

/**
 * Renderiza ou atualiza o gráfico de despesas com base no tipo selecionado.
 * @param {string} [type='pie'] - O tipo de gráfico ('pie', 'bar', 'line').
 */
const renderExpenseChart = (type = 'pie') => {
    const ctx = document.getElementById('expense-chart').getContext('2d');
    const now = chartCurrentDate;

    // Destroi o gráfico anterior, se existir
    if (expenseChart) {
        expenseChart.destroy();
    }

    // Prepara os dados do gráfico
    const monthlyTransactions = appState.transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getFullYear() === now.getFullYear() && tDate.getMonth() === now.getMonth();
    });

    let chartData = {};
    let chartOptions = {};

    if (type === 'pie') {
        // Gráfico de Pizza: Despesas por Categoria
        const expensesByCategory = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
                const category = appState.categories.find(c => c.id === t.categoryId)?.name || 'Sem Categoria';
                acc[category] = (acc[category] || 0) + t.amount;
                return acc;
            }, {});

        chartData = {
            labels: Object.keys(expensesByCategory),
            datasets: [{
                label: 'Despesas por Categoria',
                data: Object.values(expensesByCategory),
                backgroundColor: [
                    '#EF4444', '#3B82F6', '#22C55E', '#F97316',
                    '#8B5CF6', '#F59E0B', '#10B981', '#6366F1'
                ],
                hoverOffset: 4
            }]
        };
        chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Distribuição de Despesas' }
            }
        };
    } else if (type === 'bar') {
        // Gráfico de Barras: Receita vs. Despesa
        const totalIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

        chartData = {
            labels: ['Movimentações do Mês'],
            datasets: [
                {
                    label: 'Receitas',
                    data: [totalIncome],
                    backgroundColor: '#22C55E',
                },
                {
                    label: 'Despesas',
                    data: [totalExpense],
                    backgroundColor: '#EF4444',
                }
            ]
        };
        chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: {
                title: { display: true, text: 'Receita vs. Despesa' }
            }
        };
    } else if (type === 'line') {
        // Gráfico de Linha: Evolução do Saldo
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dailyBalances = Array(daysInMonth).fill(0);
        
        monthlyTransactions.forEach(t => {
            const day = new Date(t.date).getDate() - 1;
            if (t.type === 'income') dailyBalances[day] += t.amount;
            if (t.type === 'expense') dailyBalances[day] -= t.amount;
        });

        // Acumula os saldos
        for (let i = 1; i < dailyBalances.length; i++) {
            dailyBalances[i] += dailyBalances[i - 1];
        }

        chartData = {
            labels: Array.from({ length: daysInMonth }, (_, i) => i + 1),
            datasets: [{
                label: 'Evolução do Saldo no Mês',
                data: dailyBalances,
                fill: false,
                borderColor: '#3B82F6',
                tension: 0.1
            }]
        };
        chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: {
                title: { display: true, text: 'Evolução do Saldo' }
            }
        };
    }

    // Cria a nova instância do gráfico
    expenseChart = new Chart(ctx, {
        type: type,
        data: chartData,
        options: chartOptions
    });
};

/**
 * Atualiza o texto que exibe o mês e ano corrente no seletor de mês do gráfico.
 */
const updateChartMonthDisplay = () => {
    const display = document.getElementById('current-month-chart-display');
    display.textContent = chartCurrentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

/**
 * Adiciona listeners para os controles do gráfico (mês anterior/próximo e tipo de gráfico).
 */
const setupChartControls = () => {
    document.getElementById('prev-month-chart-button').addEventListener('click', () => {
        chartCurrentDate.setMonth(chartCurrentDate.getMonth() - 1);
        const currentType = document.querySelector('.chart-type-button.active').dataset.chartType;
        renderExpenseChart(currentType);
        updateChartMonthDisplay();
    });

    document.getElementById('next-month-chart-button').addEventListener('click', () => {
        chartCurrentDate.setMonth(chartCurrentDate.getMonth() + 1);
        const currentType = document.querySelector('.chart-type-button.active').dataset.chartType;
        renderExpenseChart(currentType);
        updateChartMonthDisplay();
    });

    document.querySelectorAll('.chart-type-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.chart-type-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            renderExpenseChart(button.dataset.chartType);
        });
    });
};

// ================================================================================================
// LÓGICA DA PÁGINA DE TRANSAÇÕES
// ================================================================================================

let transactionCurrentDate = new Date(); // Data para controle do mês da lista de transações

/**
 * Atualiza a exibição da lista de transações e os controles associados.
 */
const updateTransactionsView = () => {
    renderTransactionsList();
    updateTransactionsMonthDisplay();
    populateCategoryFilter();
};

/**
 * Renderiza a lista de transações, agrupando-as por data.
 */
const renderTransactionsList = () => {
    const container = document.getElementById('transactions-list-container');
    container.innerHTML = '<div class="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>'; // Recria a linha do tempo

    const filters = getTransactionFilters();
    
    // Filtra transações pelo mês e ano selecionados
    const monthlyTransactions = appState.transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getFullYear() === transactionCurrentDate.getFullYear() &&
               tDate.getMonth() === transactionCurrentDate.getMonth();
    });

    // Aplica os filtros de tipo, categoria e status
    const filteredTransactions = monthlyTransactions.filter(t => {
        const typeMatch = filters.type === 'all' || t.type === filters.type;
        const categoryMatch = filters.category === 'all' || t.categoryId === filters.category;
        const statusMatch = filters.status === 'all' || t.status === filters.status;
        return typeMatch && categoryMatch && statusMatch;
    });

    if (filteredTransactions.length === 0) {
        container.innerHTML += '<p class="text-center text-gray-500 py-4" id="no-transactions-message">Nenhuma transação encontrada para este mês ou filtro.</p>';
        return;
    }

    // Agrupa as transações por data
    const groupedByDate = filteredTransactions.reduce((acc, t) => {
        const date = new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'long' });
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(t);
        return acc;
    }, {});
    
    // Ordena as datas em ordem decrescente
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
        const dateA = new Date(appState.transactions.find(t => new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'long' }) === a).date);
        const dateB = new Date(appState.transactions.find(t => new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'long' }) === b).date);
        return dateB - dateA;
    });

    // Renderiza cada grupo de data
    for (const date of sortedDates) {
        const dateGroupContainer = document.createElement('div');
        dateGroupContainer.className = 'mb-6';
        
        const dateHeader = `
            <div class="flex items-center mb-2 relative pl-12">
                <div class="timeline-bullet-date">
                    <i class="fa-solid fa-calendar-day text-white text-sm"></i>
                </div>
                <h3 class="font-semibold text-gray-800">${date}</h3>
            </div>`;
        
        const transactionsHtml = groupedByDate[date].map(t => createTransactionCard(t)).join('');

        dateGroupContainer.innerHTML = dateHeader + transactionsHtml;
        container.appendChild(dateGroupContainer);
    }
};

/**
 * Cria o HTML para um único card de transação.
 * @param {object} transaction - O objeto da transação.
 * @returns {string} - O HTML do card.
 */
const createTransactionCard = (transaction) => {
    const category = appState.categories.find(c => c.id === transaction.categoryId);
    const isIncome = transaction.type === 'income';
    const isExpense = transaction.type === 'expense';
    const isCaixinha = transaction.type === 'deposit' || transaction.type === 'withdraw';

    let icon, color, amountSign;
    if (isIncome) {
        icon = 'fa-arrow-up';
        color = 'text-green-500';
        amountSign = '+';
    } else if (isExpense) {
        icon = 'fa-arrow-down';
        color = 'text-red-500';
        amountSign = '-';
    } else { // Caixinha
        icon = transaction.type === 'deposit' ? 'fa-piggy-bank' : 'fa-wallet';
        color = 'text-blue-500';
        amountSign = transaction.type === 'deposit' ? '-' : '+';
    }

    const statusBadge = `
        <span class="text-xs font-medium px-2 py-1 rounded-full ${
            transaction.status === 'Pago' || transaction.status === 'Recebido' ? 'bg-green-100 text-green-800' :
            transaction.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' :
            'bg-blue-100 text-blue-800'
        }">${transaction.status}</span>
    `;

    return `
        <div class="ml-12 mb-2 bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 ${color}">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div>
                        <p class="font-semibold text-gray-800">${transaction.description}</p>
                        <p class="text-sm text-gray-500">${category?.name || 'Sem categoria'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-lg ${color}">${amountSign} ${formatCurrency(transaction.amount)}</p>
                    ${statusBadge}
                </div>
            </div>
        </div>
    `;
};


/**
 * Retorna os valores atuais dos filtros de transação.
 * @returns {object} - Um objeto com os valores dos filtros.
 */
const getTransactionFilters = () => {
    const type = document.getElementById('filter-type').value;
    const category = document.getElementById('filter-category').value;
    const status = document.getElementById('filter-status').value;
    return { type, category, status };
};

/**
 * Atualiza o texto que exibe o mês e ano corrente na lista de transações.
 */
const updateTransactionsMonthDisplay = () => {
    const display = document.getElementById('current-month-display');
    display.textContent = transactionCurrentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

/**
 * Popula o seletor de filtro de categorias com as categorias do usuário.
 */
const populateCategoryFilter = () => {
    const select = document.getElementById('filter-category');
    select.innerHTML = '<option value="all">Todas as Categorias</option>';
    appState.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
    });
};

/**
 * Adiciona listeners para os controles da página de transações.
 */
const setupTransactionControls = () => {
    // Botões de navegação de mês
    document.getElementById('prev-month-button').addEventListener('click', () => {
        transactionCurrentDate.setMonth(transactionCurrentDate.getMonth() - 1);
        updateTransactionsView();
    });

    document.getElementById('next-month-button').addEventListener('click', () => {
        transactionCurrentDate.setMonth(transactionCurrentDate.getMonth() + 1);
        updateTransactionsView();
    });

    // Filtros
    document.getElementById('filter-type').addEventListener('change', renderTransactionsList);
    document.getElementById('filter-category').addEventListener('change', renderTransactionsList);
    document.getElementById('filter-status').addEventListener('change', renderTransactionsList);

    // Botão de limpar filtros
    document.getElementById('reset-filters-button').addEventListener('click', () => {
        document.getElementById('filter-type').value = 'all';
        document.getElementById('filter-category').value = 'all';
        document.getElementById('filter-status').value = 'all';
        renderTransactionsList();
    });
};

// ================================================================================================
// MODAL DE TRANSAÇÃO (LÓGICA MULTI-ETAPAS)
// ================================================================================================

const transactionModal = {
    element: document.getElementById('transaction-modal'),
    form: document.getElementById('transaction-form'),
    steps: {
        1: document.getElementById('transaction-step-1'),
        2: document.getElementById('transaction-step-2'),
        3: document.getElementById('transaction-step-3'),
    },
    currentStep: 1,
    isEditing: false,
    editingId: null,

    open: (transactionId = null) => {
        transactionModal.isEditing = !!transactionId;
        transactionModal.editingId = transactionId;
        transactionModal.form.reset();
        
        if (transactionModal.isEditing) {
            // Lógica para preencher o formulário no modo de edição (simplificado)
            const transaction = appState.transactions.find(t => t.id === transactionId);
            // ... preencher campos
            // Como o fluxo é multi-etapas, a edição direta é complexa.
            // Por simplicidade, a edição não será implementada neste exemplo.
            showToast("A edição de transações ainda não foi implementada.", "info");
            return;
        }

        transactionModal.goToStep(1);
        transactionModal.element.classList.add('active');
    },

    close: () => {
        transactionModal.element.classList.remove('active');
    },

    goToStep: (stepNumber) => {
        transactionModal.currentStep = stepNumber;
        Object.values(transactionModal.steps).forEach(step => step.classList.add('hidden'));
        transactionModal.steps[stepNumber].classList.remove('hidden');
        
        if (stepNumber === 2) {
            const type = transactionModal.form['transaction-type'].value;
            document.getElementById('step-2-title').textContent = {
                'income': 'Nova Receita',
                'expense': 'Nova Despesa',
                'deposit': 'Guardar Dinheiro',
                'withdraw': 'Resgatar Dinheiro'
            }[type];
            transactionModal.populateCategoriesForStep2(type);
        } else if (stepNumber === 3) {
            const type = transactionModal.form['transaction-type'].value;
            transactionModal.setupStep3(type);
        }
    },
    
    populateCategoriesForStep2: (type) => {
        const select = document.getElementById('transaction-category');
        select.innerHTML = ''; // Limpa opções anteriores
        
        let relevantCategories = [];
        if (type === 'income' || type === 'expense') {
            relevantCategories = appState.categories.filter(c => c.type === type);
        } else { // deposit ou withdraw
            relevantCategories = appState.categories.filter(c => c.type === 'caixinha');
        }

        relevantCategories.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.name;
            select.appendChild(option);
        });
    },
    
    setupStep3: (type) => {
        const statusContainer = document.getElementById('transaction-status-options');
        statusContainer.innerHTML = ''; // Limpa opções
        const installmentsField = document.getElementById('installments-field');
        
        let statuses = [];
        if (type === 'income') {
            statuses = ['Recebido', 'Pendente'];
            installmentsField.classList.remove('hidden');
        } else if (type === 'expense') {
            statuses = ['Pago', 'Pendente'];
            installmentsField.classList.remove('hidden');
        } else { // deposit ou withdraw
            statuses = ['Confirmado'];
            installmentsField.classList.add('hidden'); // Esconde parcelas para caixinhas
        }
        
        statuses.forEach((status, index) => {
            const radioId = `status-${status.toLowerCase()}`;
            const label = document.createElement('label');
            label.className = 'inline-flex items-center';
            label.innerHTML = `
                <input type="radio" name="transaction-status" value="${status}" id="${radioId}" class="form-radio" ${index === 0 ? 'checked' : ''}>
                <span class="ml-2">${status}</span>
            `;
            statusContainer.appendChild(label);
        });

        // Preenche a data com o dia de hoje por padrão
        document.getElementById('transaction-date').value = formatDateForInput(new Date());
    },

    handleSubmit: (e) => {
        e.preventDefault();
        const formData = new FormData(transactionModal.form);
        const type = transactionModal.form['transaction-type'].value;

        const newTransaction = {
            id: `trans_${new Date().getTime()}`,
            userId: appState.user.uid,
            type: type,
            description: document.getElementById('transaction-description').value || 'Nova transação',
            amount: parseCurrency(document.getElementById('transaction-amount').value),
            categoryId: document.getElementById('transaction-category').value,
            date: document.getElementById('transaction-date').value,
            status: transactionModal.form['transaction-status'].value,
            installments: parseInt(document.getElementById('transaction-installments').value) || 1
        };

        // Lógica para caixinhas
        if (type === 'deposit' || type === 'withdraw') {
            const caixinha = appState.categories.find(c => c.id === newTransaction.categoryId);
            if (caixinha) {
                caixinha.currentAmount = caixinha.currentAmount || 0;
                if (type === 'deposit') {
                    caixinha.currentAmount += newTransaction.amount;
                } else { // withdraw
                    // Garante que não se pode resgatar mais do que o disponível
                    if (newTransaction.amount > caixinha.currentAmount) {
                        showToast("Valor de resgate maior que o saldo da caixinha.", "error");
                        return;
                    }
                    caixinha.currentAmount -= newTransaction.amount;
                }
            }
        }
        
        // Adiciona a transação (ou transações, se houver parcelas)
        if (newTransaction.installments > 1 && (type === 'expense' || type === 'income')) {
            for (let i = 0; i < newTransaction.installments; i++) {
                const installmentTransaction = { ...newTransaction };
                const transactionDate = new Date(installmentTransaction.date);
                transactionDate.setMonth(transactionDate.getMonth() + i);
                
                installmentTransaction.id = `trans_${new Date().getTime()}_${i}`;
                installmentTransaction.date = formatDateForInput(transactionDate);
                installmentTransaction.description = `${newTransaction.description} (${i + 1}/${newTransaction.installments})`;
                installmentTransaction.installments = 1; // Cada parcela é uma transação única
                
                appState.transactions.push(installmentTransaction);
            }
        } else {
            newTransaction.installments = 1;
            appState.transactions.push(newTransaction);
        }

        saveData('transactions');
        if (type === 'deposit' || type === 'withdraw') {
            saveData('categories'); // Salva o estado atualizado das caixinhas
        }
        
        updateDashboard();
        updateTransactionsView();
        
        showToast("Transação adicionada com sucesso!", "success");
        transactionModal.close();
    },

    setupListeners: () => {
        document.getElementById('fab-add-transaction').addEventListener('click', () => transactionModal.open());
        document.getElementById('close-transaction-modal').addEventListener('click', transactionModal.close);
        
        // Etapa 1: Seleção de tipo
        document.querySelectorAll('.step-1-type-button').forEach(button => {
            button.addEventListener('click', () => {
                transactionModal.form['transaction-type'].value = button.dataset.type;
                transactionModal.goToStep(2);
            });
        });

        // Botões de navegação do modal
        document.querySelectorAll('.step-back-button').forEach(button => {
            button.addEventListener('click', () => {
                transactionModal.goToStep(transactionModal.currentStep - 1);
            });
        });
        document.querySelectorAll('.step-next-button').forEach(button => {
            button.addEventListener('click', () => {
                transactionModal.goToStep(transactionModal.currentStep + 1);
            });
        });

        // Botão de cancelar na etapa 1
        document.getElementById('cancel-transaction-button-step1').addEventListener('click', transactionModal.close);

        // Submit do formulário
        transactionModal.form.addEventListener('submit', transactionModal.handleSubmit);
    }
};


// ================================================================================================
// LÓGICA DE CATEGORIAS E CAIXINHAS
// ================================================================================================

/**
 * Atualiza a visualização da lista de categorias e caixinhas.
 */
const updateCategoriesView = () => {
    const container = document.getElementById('category-list-container');
    container.innerHTML = '';

    const categories = appState.categories.filter(c => c.type === 'income' || c.type === 'expense');
    const caixinhas = appState.categories.filter(c => c.type === 'caixinha');

    if (categories.length > 0) {
        container.innerHTML += createCategorySection('Categorias de Transação', categories);
    }
    if (caixinhas.length > 0) {
        container.innerHTML += createCategorySection('Caixinhas (Metas)', caixinhas, true);
    }

    if (container.innerHTML === '') {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma categoria ou caixinha criada.</p>';
    }
};

/**
 * Cria o HTML para uma seção de categorias (Transação ou Caixinha).
 * @param {string} title - O título da seção.
 * @param {Array<object>} items - A lista de itens (categorias ou caixinhas).
 * @param {boolean} [isCaixinha=false] - Indica se os itens são caixinhas.
 * @returns {string} - O HTML da seção.
 */
const createCategorySection = (title, items, isCaixinha = false) => {
    const itemsHtml = items.map(item => {
        const badgeColor = item.type === 'income' ? 'bg-green-100 text-green-800' : 
                         item.type === 'expense' ? 'bg-red-100 text-red-800' : 
                         'bg-blue-100 text-blue-800';
        
        let progressHtml = '';
        if (isCaixinha) {
            const percentage = item.targetAmount > 0 ? ((item.currentAmount || 0) / item.targetAmount) * 100 : 0;
            progressHtml = `
                <div class="mt-2">
                    <div class="flex justify-between text-sm font-medium text-gray-600">
                        <span>${formatCurrency(item.currentAmount || 0)}</span>
                        <span>${formatCurrency(item.targetAmount)}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                        <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="bg-white p-4 rounded-lg shadow-sm border">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-semibold text-lg">${item.name}</p>
                        <span class="text-xs font-medium px-2 py-1 rounded-full ${badgeColor}">${item.type}</span>
                    </div>
                    <!-- Botão de editar/excluir (a ser implementado) -->
                </div>
                ${progressHtml}
            </div>
        `;
    }).join('');

    return `
        <div class="mb-8">
            <h3 class="text-xl font-bold mb-4">${title}</h3>
            <div class="space-y-4">${itemsHtml}</div>
        </div>
    `;
};

// ================================================================================================
// LÓGICA DO MODAL DE CATEGORIAS
// ================================================================================================

const categoryModal = {
    element: document.getElementById('category-modal'),
    form: document.getElementById('category-form'),
    title: document.getElementById('category-modal-title'),
    isEditing: false,
    editingId: null,

    open: (categoryId = null) => {
        categoryModal.isEditing = !!categoryId;
        categoryModal.editingId = categoryId;
        categoryModal.form.reset();
        
        categoryModal.title.textContent = categoryModal.isEditing ? 'Editar Categoria' : 'Adicionar Nova Categoria';
        
        if (categoryModal.isEditing) {
            const category = appState.categories.find(c => c.id === categoryId);
            // Preencher campos para edição (a ser implementado)
        }

        // Mostra/esconde o campo de valor alvo para caixinhas
        const typeRadios = categoryModal.form.elements['category-type'];
        const targetAmountField = document.getElementById('target-amount-field');
        
        const updateVisibility = () => {
            targetAmountField.classList.toggle('hidden', typeRadios.value !== 'caixinha');
        };
        
        Array.from(typeRadios).forEach(radio => {
            radio.addEventListener('change', updateVisibility);
        });
        updateVisibility(); // Executa na abertura

        categoryModal.element.classList.add('active');
    },
    
    close: () => {
        categoryModal.element.classList.remove('active');
    },

    handleSubmit: (e) => {
        e.preventDefault();
        const name = document.getElementById('category-name').value;
        const type = categoryModal.form['category-type'].value;
        const targetAmount = parseCurrency(document.getElementById('category-target-amount').value);

        if (categoryModal.isEditing) {
            // Lógica de edição
        } else {
            const newCategory = {
                id: `cat_${new Date().getTime()}`,
                userId: appState.user.uid,
                name,
                type,
                priority: type === 'caixinha' ? null : categoryModal.form['category-priority'].value,
                targetAmount: type === 'caixinha' ? targetAmount : null,
                currentAmount: type === 'caixinha' ? 0 : null
            };
            appState.categories.push(newCategory);
        }

        saveData('categories');
        updateCategoriesView();
        populateCategoryFilter(); // Atualiza os filtros de transação
        
        showToast(`Categoria "${name}" salva com sucesso!`, "success");
        categoryModal.close();
    },

    setupListeners: () => {
        document.getElementById('add-new-category-button').addEventListener('click', () => categoryModal.open());
        document.getElementById('add-category-quick-button').addEventListener('click', () => {
             // Fecha o modal de transação antes de abrir o de categoria
            transactionModal.close();
            categoryModal.open();
        });
        document.getElementById('close-category-modal').addEventListener('click', categoryModal.close);
        document.getElementById('cancel-category-button').addEventListener('click', categoryModal.close);
        categoryModal.form.addEventListener('submit', categoryModal.handleSubmit);
    }
};

// ================================================================================================
// LÓGICA DE ORÇAMENTOS (BUDGET)
// ================================================================================================

/**
 * Atualiza a visualização da lista de orçamentos.
 */
const updateBudgetsView = () => {
    const container = document.getElementById('budget-list-container');
    const noBudgetsMessage = document.getElementById('no-budgets-message');
    container.innerHTML = ''; // Limpa antes de renderizar

    const budgets = appState.budgets;

    if (budgets.length === 0) {
        container.appendChild(noBudgetsMessage);
        noBudgetsMessage.classList.remove('hidden');
        return;
    }

    noBudgetsMessage.classList.add('hidden');
    
    budgets.forEach(budget => {
        const category = appState.categories.find(c => c.id === budget.categoryId);
        if (!category) return; // Se a categoria foi excluída, não mostra o orçamento

        const spent = appState.transactions
            .filter(t => t.categoryId === budget.categoryId && new Date(t.date).getMonth() === new Date().getMonth())
            .reduce((sum, t) => sum + t.amount, 0);

        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
        const progressBarColor = percentage > 100 ? 'bg-red-500' : 'bg-blue-600';

        const budgetCard = document.createElement('div');
        budgetCard.className = 'bg-white p-6 rounded-lg shadow-md';
        budgetCard.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <p class="font-semibold text-lg">${category.name}</p>
                <p class="text-sm text-gray-500">${formatCurrency(budget.amount)}</p>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-4">
                <div class="${progressBarColor} h-4 rounded-full" style="width: ${Math.min(percentage, 100)}%;"></div>
            </div>
            <div class="flex justify-between text-sm mt-2">
                <span class="text-gray-600">Gasto: ${formatCurrency(spent)}</span>
                <span class="font-medium ${percentage > 100 ? 'text-red-500' : 'text-gray-600'}">
                    ${percentage.toFixed(0)}%
                </span>
            </div>
        `;
        container.appendChild(budgetCard);
    });
};

// ================================================================================================
// LÓGICA DO MODAL DE ORÇAMENTO
// ================================================================================================
const budgetModal = {
    element: document.getElementById('budget-modal'),
    form: document.getElementById('budget-form'),
    
    open: () => {
        budgetModal.form.reset();
        const categorySelect = document.getElementById('budget-category');
        categorySelect.innerHTML = '';
        
        // Popula apenas com categorias de despesa que ainda não têm orçamento
        const categoriesWithBudget = appState.budgets.map(b => b.categoryId);
        const availableCategories = appState.categories.filter(c => c.type === 'expense' && !categoriesWithBudget.includes(c.id));
        
        availableCategories.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.name;
            categorySelect.appendChild(option);
        });

        if (availableCategories.length === 0) {
            showToast("Todas as categorias de despesa já têm um orçamento.", "info");
            return;
        }
        
        budgetModal.element.classList.add('active');
    },

    close: () => {
        budgetModal.element.classList.remove('active');
    },

    handleSubmit: (e) => {
        e.preventDefault();
        const categoryId = document.getElementById('budget-category').value;
        const amount = parseCurrency(document.getElementById('budget-amount').value);

        const newBudget = {
            id: `budget_${new Date().getTime()}`,
            userId: appState.user.uid,
            categoryId,
            amount,
            month: new Date().getMonth(), // Orçamento para o mês atual
            year: new Date().getFullYear()
        };

        appState.budgets.push(newBudget);
        saveData('budgets');
        updateBudgetsView();
        
        showToast("Orçamento salvo com sucesso!", "success");
        budgetModal.close();
    },

    setupListeners: () => {
        document.getElementById('configure-budget-button').addEventListener('click', budgetModal.open);
        document.getElementById('close-budget-modal').addEventListener('click', budgetModal.close);
        document.getElementById('cancel-budget-button').addEventListener('click', budgetModal.close);
        budgetModal.form.addEventListener('submit', budgetModal.handleSubmit);
    }
};

// ================================================================================================
// LÓGICA DO ASSISTENTE DE IA (GEMINI)
// ================================================================================================

/**
 * Configura os listeners e a lógica inicial para o assistente de IA.
 */
const setupAIAssistant = () => {
    const apiKey = JSON.parse(localStorage.getItem('financas-claras-api-keys'))?.[0];
    appState.activeApiKey = apiKey;
    
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('chat-send-button');
    const apiKeyIndicator = document.getElementById('active-api-key-indicator');

    if (apiKey) {
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.placeholder = 'Pergunte sobre suas finanças...';
        apiKeyIndicator.textContent = `API: ...${apiKey.slice(-4)}`;
        apiKeyIndicator.classList.remove('hidden');
    } else {
        chatInput.disabled = true;
        sendButton.disabled = true;
        chatInput.placeholder = 'Adicione uma chave de API para começar...';
        apiKeyIndicator.classList.add('hidden');
    }

    sendButton.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    document.getElementById('clear-chat-button').addEventListener('click', clearChat);
    document.getElementById('refresh-chat-data-button').addEventListener('click', refreshChatContext);
};

/**
 * Envia uma mensagem do usuário para a IA.
 */
const sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message || !appState.activeApiKey) return;

    appendMessage(message, 'user');
    input.value = '';

    const loadingIndicator = document.getElementById('chat-loading-indicator');
    loadingIndicator.classList.remove('hidden');

    try {
        const aiResponse = await callGeminiAPI(message);
        appendMessage(aiResponse, 'ai');
    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        appendMessage("Desculpe, não consegui processar sua solicitação. Verifique sua chave de API e a conexão.", 'ai', true);
    } finally {
        loadingIndicator.classList.add('hidden');
    }
};

/**
 * Adiciona uma mensagem à interface do chat.
 * @param {string} text - O texto da mensagem.
 * @param {'user' | 'ai'} sender - Quem enviou a mensagem.
 * @param {boolean} [isError=false] - Indica se a mensagem é um erro.
 */
const appendMessage = (text, sender, isError = false) => {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    const bubbleDiv = document.createElement('div');
    
    messageDiv.className = sender === 'user' ? 'flex justify-end' : 'flex justify-start';
    
    bubbleDiv.className = sender === 'user' ? 
        'bg-blue-500 text-white p-3 rounded-xl rounded-br-none max-w-xs md:max-w-md shadow-sm' : 
        isError ? 
        'bg-red-100 text-red-800 p-3 rounded-xl rounded-bl-none max-w-xs md:max-w-md shadow-sm' :
        'bg-gray-100 text-gray-800 p-3 rounded-xl rounded-bl-none max-w-xs md:max-w-md shadow-sm';
    
    // Converte markdown simples (como listas) em HTML
    // NOTA: Esta é uma conversão muito básica. Uma biblioteca como 'marked' seria melhor.
    text = text.replace(/\n/g, '<br>');
    text = text.replace(/\* (.*?)(<br>|$)/g, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    
    bubbleDiv.innerHTML = text;
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

/**
 * Limpa o histórico do chat.
 */
const clearChat = () => {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = `
        <div class="flex justify-start">
            <div class="bg-gray-100 text-gray-800 p-3 rounded-xl rounded-bl-none max-w-xs md:max-w-md shadow-sm">
                Olá! Sou seu assistente financeiro. Como posso ajudar?
            </div>
        </div>`;
    showToast("Chat limpo.", "info");
};

/**
 * Atualiza o contexto da IA com os dados mais recentes.
 */
const refreshChatContext = () => {
    // A lógica de construção do contexto já pega os dados mais recentes de appState,
    // então apenas notificamos o usuário.
    showToast("Contexto da IA atualizado com seus dados mais recentes.", "success");
};


/**
 * Constrói o prompt para a API Gemini, incluindo o contexto financeiro.
 * @param {string} userMessage - A mensagem do usuário.
 * @returns {string} - O prompt completo a ser enviado.
 */
const buildPrompt = (userMessage) => {
    const financialContext = `
        **Dados Financeiros do Usuário (Mês Atual):**
        - **Receitas:** ${formatCurrency(appState.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}
        - **Despesas:** ${formatCurrency(appState.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}
        - **Orçamentos:** ${appState.budgets.map(b => {
            const category = appState.categories.find(c => c.id === b.categoryId);
            return `${category?.name}: ${formatCurrency(b.amount)}`;
        }).join(', ') || 'Nenhum'}
        - **Caixinhas (Metas):** ${appState.categories.filter(c => c.type === 'caixinha').map(c => `${c.name} (Meta: ${formatCurrency(c.targetAmount)}, Guardado: ${formatCurrency(c.currentAmount || 0)})`).join(', ') || 'Nenhuma'}
        - **Últimas Transações:**
        ${appState.transactions.slice(-5).map(t => `  * ${t.description}: ${formatCurrency(t.amount)} (${t.status})`).join('\n')}
    `;

    return `
        **Contexto do Sistema:**
        ${appState.aiPersona}
        ${appState.aiPersonality}

        **Contexto Financeiro Atual:**
        ${financialContext}

        ---

        **Pergunta do Usuário:**
        "${userMessage}"
    `;
};


/**
 * Chama a API do Google Gemini.
 * @param {string} userMessage - A mensagem do usuário.
 * @returns {Promise<string>} - A resposta da IA.
 */
const callGeminiAPI = async (userMessage) => {
    const prompt = buildPrompt(userMessage);
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${appState.activeApiKey}`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Erro na API');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
};

// ================================================================================================
// LÓGICA DE CONFIGURAÇÕES (API, PERSONA IA)
// ================================================================================================

const apiKeysModal = {
    element: document.getElementById('api-keys-modal'),
    
    open: () => {
        const savedKeys = JSON.parse(localStorage.getItem('financas-claras-api-keys')) || [];
        for (let i = 1; i <= 5; i++) {
            document.getElementById(`modal-api-key-${i}`).value = savedKeys[i - 1] || '';
        }
        apiKeysModal.element.classList.add('active');
    },

    close: () => {
        apiKeysModal.element.classList.remove('active');
    },

    save: () => {
        const keys = [];
        for (let i = 1; i <= 5; i++) {
            const key = document.getElementById(`modal-api-key-${i}`).value.trim();
            if (key) {
                keys.push(key);
            }
        }
        localStorage.setItem('financas-claras-api-keys', JSON.stringify(keys));
        showToast("Chaves de API salvas com sucesso!", "success");
        apiKeysModal.close();
        // Re-configura o assistente com a nova chave
        setupAIAssistant();
    },

    setupListeners: () => {
        // O link para abrir o modal está em 'more-options', que já tem um listener de navegação.
        // A lógica de abertura está na função navigateToPage.
        // Precisamos adicionar listeners para os botões do modal.
        document.querySelector('[data-page="api-management"]').addEventListener('click', (e) => {
            e.preventDefault();
            apiKeysModal.open();
        });
        document.getElementById('close-api-keys-modal').addEventListener('click', apiKeysModal.close);
        document.getElementById('save-api-keys-modal-button').addEventListener('click', apiKeysModal.save);
    }
};

/**
 * Carrega a configuração da IA (persona/personalidade) do localStorage para a UI.
 */
const loadAIConfig = () => {
    const persona = localStorage.getItem('financas-claras-ai-persona');
    const personality = localStorage.getItem('financas-claras-ai-personality');

    if (persona) {
        document.getElementById('ai-persona').value = persona;
        appState.aiPersona = persona;
    }
    if (personality) {
        document.getElementById('ai-personality').value = personality;
        appState.aiPersonality = personality;
    }
};

/**
 * Salva a configuração da IA da UI para o localStorage.
 */
const saveAIConfig = () => {
    const persona = document.getElementById('ai-persona').value;
    const personality = document.getElementById('ai-personality').value;

    localStorage.setItem('financas-claras-ai-persona', persona);
    localStorage.setItem('financas-claras-ai-personality', personality);
    
    appState.aiPersona = persona;
    appState.aiPersonality = personality;

    const statusMessage = document.getElementById('ai-config-status-message');
    statusMessage.classList.remove('hidden');
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 3000);
    showToast("Configurações da IA salvas!", "success");
};

// ================================================================================================
// DADOS DE AMOSTRA E INICIALIZAÇÃO GERAL
// ================================================================================================

/**
 * Retorna uma lista de categorias de exemplo.
 * @returns {Array<object>}
 */
function getSampleCategories() {
    return [
      { id: 'cat_1', name: 'Salário', type: 'income', priority: null },
      { id: 'cat_2', name: 'Aluguel', type: 'expense', priority: 'essential' },
      { id: 'cat_3', name: 'Supermercado', type: 'expense', priority: 'essential' },
      { id: 'cat_4', name: 'Transporte', type: 'expense', priority: 'essential' },
      { id: 'cat_5', name: 'Lazer', type: 'expense', priority: 'non-essential' },
      { id: 'cat_6', name: 'Saúde', type: 'expense', priority: 'essential' },
      { id: 'cat_7', name: 'Viagem dos Sonhos', type: 'caixinha', currentAmount: 1500, targetAmount: 10000 },
      { id: 'cat_8', name: 'Freelancer', type: 'income', priority: null },
      { id: 'cat_9', name: 'Educação', type: 'expense', priority: 'non-essential'},
      { id: 'cat_10', name: 'Reserva de Emergência', type: 'caixinha', currentAmount: 5000, targetAmount: 15000 },
    ];
}

/**
 * Retorna uma lista de transações de exemplo para o mês atual e anterior.
 * @returns {Array<object>}
 */
function getSampleTransactions() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const transactions = [
      // Mês Atual
      { id: 'trans_1', description: 'Salário Mensal', type: 'income', categoryId: 'cat_1', amount: 5000, date: new Date(currentYear, currentMonth, 5).toISOString(), status: 'Recebido', installments: 1 },
      { id: 'trans_2', description: 'Pagamento Aluguel', type: 'expense', categoryId: 'cat_2', amount: 1500, date: new Date(currentYear, currentMonth, 10).toISOString(), status: 'Pago', installments: 1 },
      { id: 'trans_3', description: 'Compras da Semana', type: 'expense', categoryId: 'cat_3', amount: 350, date: new Date(currentYear, currentMonth, 12).toISOString(), status: 'Pago', installments: 1 },
      { id: 'trans_4', description: 'Crédito App Transporte', type: 'expense', categoryId: 'cat_4', amount: 100, date: new Date(currentYear, currentMonth, 15).toISOString(), status: 'Pendente', installments: 1 },
      { id: 'trans_5', description: 'Cinema', type: 'expense', categoryId: 'cat_5', amount: 80, date: new Date(currentYear, currentMonth, 18).toISOString(), status: 'Pago', installments: 1 },
      { id: 'trans_6', description: 'Depósito Viagem', type: 'deposit', categoryId: 'cat_7', amount: 500, date: new Date(currentYear, currentMonth, 6).toISOString(), status: 'Confirmado', installments: 1 },
      { id: 'trans_7', description: 'Projeto Freelancer X', type: 'income', categoryId: 'cat_8', amount: 750, date: new Date(currentYear, currentMonth, 20).toISOString(), status: 'Recebido', installments: 1 },
      // Mês Anterior
      { id: 'trans_8', description: 'Salário Mensal', type: 'income', categoryId: 'cat_1', amount: 5000, date: new Date(currentYear, currentMonth - 1, 5).toISOString(), status: 'Recebido', installments: 1 },
      { id: 'trans_9', description: 'Pagamento Aluguel', type: 'expense', categoryId: 'cat_2', amount: 1500, date: new Date(currentYear, currentMonth - 1, 10).toISOString(), status: 'Pago', installments: 1 },
    ];
    return transactions;
}

/**
 * Função principal que é executada quando o DOM está totalmente carregado.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Configura listeners de navegação
    setupNavigationListeners();
    // Gerencia o estado de autenticação (decide se mostra login ou o app)
    manageAuthState();
    // Configura os listeners dos modais
    transactionModal.setupListeners();
    categoryModal.setupListeners();
    budgetModal.setupListeners();
    apiKeysModal.setupListeners();
    // Configura listeners dos controles do gráfico
    setupChartControls();
    // Configura listeners dos controles de transações
    setupTransactionControls();
    // Configura listener do botão de salvar config da IA
    document.getElementById('save-ai-config-button').addEventListener('click', saveAIConfig);
});

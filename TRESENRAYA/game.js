// --- Configuración de Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyDjSsmrOT7huC-HBZIiM3FkrjBBkw-TVGQ",
    authDomain: "proyecto-3-en-raya.firebaseapp.com",
    projectId: "proyecto-3-en-raya",
    storageBucket: "proyecto-3-en-raya.appspot.com",
    messagingSenderId: "252069733137",
    appId: "1:252069733137:web:b8b96d435700e1c49962b0"
};
// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();
window.firebase = firebase;
window.currentUser = null;

// Clase principal del juego
class GameManager {
    constructor() {
        this.initialized = false;
        this.eventListeners = new Map();
        this.currentRoomId = null;
        this.isHost = false;
        this.playerRole = null;
        this.roomRef = null;
        this.playerJoinedNotified = false;
        this.chatRef = null;
        this.movesRef = null;
        this.gameHistoryRef = null;
        this.currentGameHistoryId = null;
        // Variables del juego (ahora dentro de la clase)
        this.gameBoard = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.gameActive = true;
        this.gameMode = 'cpu';
        this.difficulty = 'medium';
        this.playerSymbol = 'X';
        this.cpuSymbol = 'O';
        this.init();
    }

    init() {
        if (this.initialized) return;
        console.log('🎮 Inicializando GameManager...');
        window.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log("✅ Usuario autenticado:", user.uid);
                window.currentUser = user;
                this.loadPlayerData(user, true);
                this.subscribeToPlayerData(user);
            } else {
                console.log("❌ Ningún usuario autenticado");
                window.currentUser = null;
                this.showScreen('registration-screen');
            }
        });
        this.setupEventListeners();
        this.checkForRoomParameter();
        this.initialized = true;
        console.log('✅ GameManager inicializado correctamente');
    }

    // --- Métodos de Eventos y UI ---
    addEventListener(element, event, handler, key) {
        if (!element) return;
        this.removeEventListener(element, event, key);
        element.addEventListener(event, handler);
        this.eventListeners.set(key, { element, event, handler });
    }

    removeEventListener(element, event, key) {
        if (this.eventListeners.has(key)) {
            const { element: oldElement, event: oldEvent, handler: oldHandler } = this.eventListeners.get(key);
            oldElement.removeEventListener(oldEvent, oldHandler);
        }
    }

    setupEventListeners() {
        // Navegación entre pantallas
        const showLoginBtn = document.getElementById('show-login');
        if (showLoginBtn) {
            this.addEventListener(
                showLoginBtn,
                'click',
                (e) => {
                    e.preventDefault();
                    this.showScreen('login-screen');
                },
                'show-login'
            );
        }
        const showRegBtn = document.getElementById('show-registration');
        if (showRegBtn) {
            this.addEventListener(
                showRegBtn,
                'click',
                (e) => {
                    e.preventDefault();
                    this.showScreen('registration-screen');
                },
                'show-registration'
            );
        }
        // Botones "Volver al Panel"
        ['go-to-panel', 'go-to-panel-login', 'go-to-panel-catalog', 'back-to-panel', 'close-leaderboard'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                this.addEventListener(
                    el,
                    'click',
                    () => {
                        if (window.currentUser) {
                            this.showScreen('catalog');
                        } else {
                            this.showScreen('registration-screen');
                        }
                    },
                    id
                );
            }
        });
        // Configuración del juego
        const setupForm = document.getElementById('setup-form');
        if (setupForm) {
            this.addEventListener(
                setupForm,
                'submit',
                (e) => {
                    e.preventDefault();
                    this.startGame(e);
                },
                'setup-form'
            );
        }
        // Modo de juego
        document.querySelectorAll('input[name="mode"]').forEach((radio, index) => {
            this.addEventListener(
                radio,
                'change',
                (e) => {
                    const difficultyGroup = document.getElementById('difficulty-group');
                    const onlineGroup = document.getElementById('online-group');
                    if (e.target.value === 'cpu') {
                        if (difficultyGroup) difficultyGroup.style.display = 'block';
                        if (onlineGroup) onlineGroup.style.display = 'none';
                    } else if (e.target.value === 'online') {
                        if (difficultyGroup) difficultyGroup.style.display = 'none';
                        if (onlineGroup) onlineGroup.style.display = 'block';
                    } else {
                        if (difficultyGroup) difficultyGroup.style.display = 'none';
                        if (onlineGroup) onlineGroup.style.display = 'none';
                    }
                },
                `mode-radio-${index}`
            );
        });
        // Acciones en línea
        document.querySelectorAll('input[name="online-action"]').forEach((radio, index) => {
            this.addEventListener(
                radio,
                'change',
                (e) => {
                    const roomIdGroup = document.getElementById('room-id-group');
                    const roomInfoGroup = document.getElementById('room-info-group');
                    if (e.target.value === 'create') {
                        if (roomIdGroup) roomIdGroup.style.display = 'none';
                        if (roomInfoGroup) roomInfoGroup.style.display = 'block';
                        this.generateRoomId();
                    } else {
                        if (roomIdGroup) roomIdGroup.style.display = 'block';
                        if (roomInfoGroup) roomInfoGroup.style.display = 'none';
                    }
                },
                `online-action-${index}`
            );
        });
        // Copiar enlace de la sala
        const copyBtn = document.getElementById('copy-room-link');
        if (copyBtn) {
            this.addEventListener(
                copyBtn,
                'click',
                () => {
                    const roomLink = document.getElementById('room-link');
                    if (roomLink) this.copyToClipboard(roomLink.value);
                },
                'copy-room-link'
            );
        }
        // Tabla de líderes
        const leaderboardBtn = document.getElementById('leaderboard-btn');
        if (leaderboardBtn) {
            this.addEventListener(
                leaderboardBtn,
                'click',
                () => {
                    this.showScreen('leaderboard-screen');
                    this.loadLeaderboard();
                },
                'leaderboard-btn'
            );
        }
        // Cerrar sesión
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            this.addEventListener(
                logoutBtn,
                'click',
                async () => {
                    try {
                        await window.auth.signOut();
                        alert("Sesión cerrada.");
                        this.showScreen('registration-screen');
                    } catch (error) {
                        console.error("Error al cerrar sesión:", error);
                        alert("Error al cerrar sesión.");
                    }
                },
                'logout-btn'
            );
        }
        // Registro y login
        const regForm = document.getElementById('player-registration-form');
        if (regForm) {
            this.addEventListener(
                regForm,
                'submit',
                async (e) => {
                    e.preventDefault();
                    await this.handleRegistration(e);
                },
                'registration-form'
            );
        }
        const loginForm = document.getElementById('player-login-form');
        if (loginForm) {
            this.addEventListener(
                loginForm,
                'submit',
                async (e) => {
                    e.preventDefault();
                    await this.handleLogin(e);
                },
                'login-form'
            );
        }
        // Controles del juego
        const resetBtn = document.getElementById('reset');
        if (resetBtn) {
            this.addEventListener(
                resetBtn,
                'click',
                () => this.resetGame(),
                'reset'
            );
        }
        const backBtn = document.getElementById('back');
        if (backBtn) {
            this.addEventListener(
                backBtn,
                'click',
                () => {
                    this.cleanupOnlineGame();
                    if (window.currentUser) {
                        this.loadPlayerData(window.currentUser, false);
                    }
                    this.showScreen('catalog');
                },
                'back'
            );
        }
        // Chat
        this.setupChatListeners();
    }

    showScreen(screenId) {
        console.log(`📺 Mostrando pantalla: ${screenId}`);
        const screens = ['registration-screen', 'login-screen', 'catalog', 'game-area', 'leaderboard-screen'];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        const targetEl = document.getElementById(screenId);
        if (targetEl) {
            targetEl.hidden = false;
        } else {
            console.error(`❌ Pantalla no encontrada: ${screenId}`);
        }
    }

    // --- Métodos de Autenticación y Datos ---
    async loadPlayerData(user, shouldSwitchScreen = false) {
        try {
            const doc = await window.db.collection("players").doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                const welcomeEl = document.getElementById('welcome-player');
                const gamesPlayedEl = document.getElementById('games-played');
                const gamesWonEl = document.getElementById('games-won');
                const winPercentageEl = document.getElementById('win-percentage');
                if (welcomeEl) welcomeEl.textContent = data.name || "Jugador";
                if (gamesPlayedEl) gamesPlayedEl.textContent = data.gamesPlayed || 0;
                if (gamesWonEl) gamesWonEl.textContent = data.gamesWon || 0;
                const winPercentage = data.gamesPlayed > 0 ? Math.round((data.gamesWon / data.gamesPlayed) * 100) : 0;
                if (winPercentageEl) winPercentageEl.textContent = winPercentage + '%';
                if (shouldSwitchScreen) {
                    this.showScreen('catalog');
                }
            } else {
                console.log("Documento del jugador no encontrado");
                if (shouldSwitchScreen) this.showScreen('registration-screen');
            }
        } catch (error) {
            console.error("Error al cargar datos:", error);
            this.showScreen('registration-screen');
        }
    }

    subscribeToPlayerData(user) {
        window.db.collection("players").doc(user.uid).onSnapshot((doc) => {
            if (doc.exists) {
                this.loadPlayerData(user, false);
            }
        });
    }

    // --- Métodos de Juego ---
    startGame(e) {
        console.log('🎮 Iniciando juego...');
        const formData = new FormData(e.target);
        this.playerSymbol = formData.get('symbol') || 'X';
        this.cpuSymbol = this.playerSymbol === 'X' ? 'O' : 'X';
        this.gameMode = formData.get('mode') || 'cpu';
        const difficultySelect = document.getElementById('difficulty');
        this.difficulty = difficultySelect ? difficultySelect.value : 'medium';
        console.log(`Modo: ${this.gameMode}, Símbolo: ${this.playerSymbol}, Dificultad: ${this.difficulty}`);
        if (this.gameMode === 'online') {
            const onlineAction = formData.get('online-action');
            if (onlineAction === 'create') {
                this.createOnlineRoom();
            } else if (onlineAction === 'join') {
                const roomIdInput = document.getElementById('room-id');
                const roomId = roomIdInput ? roomIdInput.value.trim() : '';
                if (roomId.length === 6) {
                    this.joinOnlineRoom(roomId);
                } else {
                    alert('Por favor ingresa un ID de sala válido de 6 caracteres.');
                    return;
                }
            }
        } else {
            this.startLocalGame();
        }
    }

    startLocalGame() {
        console.log('🎮 Iniciando juego local...');
        // Resetear estado del juego
        if (this.gameMode === '2p') {
            this.currentPlayer = 'X';
        } else {
            this.currentPlayer = this.playerSymbol;
        }
        this.gameBoard = ['', '', '', '', '', '', '', '', ''];
        this.gameActive = true;
        // Cambiar a pantalla de juego
        this.showScreen('game-area');
        // Ocultar chat en juegos locales
        this.hideChat();
        // Inicializar tablero
        this.initializeGameBoard();
        this.updateBoard();
        this.updateStatus();
        this.showGameStartMessage();
        console.log('✅ Juego local iniciado correctamente');
    }

    showGameStartMessage() {
        let message = '';
        if (this.gameMode === 'cpu') {
            const playerNameInput = document.getElementById('player-name-reg');
            const playerName = playerNameInput ? playerNameInput.value : 'Jugador';
            message = `¡${playerName} empieza primero con ${this.playerSymbol}!`;
        } else if (this.gameMode === '2p') {
            message = `¡Jugador 1 empieza primero con X! El segundo jugador será O.`;
        } else if (this.gameMode === 'online') {
            message = `¡El juego ha comenzado! ${this.isHost ? 'Eres el anfitrión (X)' : 'Eres el invitado (O)'}.`;
        }
        if (message) {
            console.log(message);
        }
    }

    // --- Métodos de Juego en Línea ---
    createOnlineRoom() {
        const roomId = this.generateRoomId();
        if (!roomId) {
            alert('Error: No se pudo generar el ID de la sala.');
            return;
        }
        console.log(`🚪 Creando sala: ${roomId}`);

        const roomData = {
            board: ['', '', '', '', '', '', '', '', ''],
            turn: 'X',
            player1: window.currentUser.uid,
            player2: null,
            player1Symbol: 'X',
            player2Symbol: 'O',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'waiting'
        };

        const roomRef = window.db.collection("rooms").doc(roomId);

        // 1. Crear la sala
        roomRef.set(roomData)
            .then(() => {
                console.log(`✅ Sala creada: ${roomId}`);
                this.currentRoomId = roomId;
                this.isHost = true;
                this.playerRole = 'host';
                this.roomRef = roomRef;

                const shareLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
                const roomLinkInput = document.getElementById('room-link');
                if (roomLinkInput) roomLinkInput.value = shareLink;

                // 2. Escuchar la sala hasta que esté disponible en Firestore
                const unsubscribe = roomRef.onSnapshot((doc) => {
                    if (doc.exists) {
                        console.log("✅ Sala confirmada en Firestore");
                        // Ya podemos iniciar el juego
                        this.showScreen('game-area');
                        this.listenToRoom();
                        this.startOnlineGame(roomId, 'host');

                        // Desuscribirse después de la primera lectura exitosa
                        unsubscribe();
                    } else {
                        console.warn("⚠️ Sala aún no disponible, esperando...");
                    }
                }, (error) => {
                    console.error("❌ Error al escuchar sala recién creada:", error);
                    alert("Error al crear la sala. Por favor, intenta nuevamente.");
                    unsubscribe();
                });
            })
            .catch(error => {
                console.error("❌ Error al crear sala:", error);
                alert("Error al crear la sala. Por favor, intenta nuevamente.");
            });
    }

    joinOnlineRoom(roomId) {
        console.log(`🚪 Intentando unirse a sala: ${roomId}`);
        window.db.collection("rooms").doc(roomId).get()
            .then(doc => {
                if (!doc.exists) {
                    alert('La sala no existe.');
                    return;
                }
                const data = doc.data();
                if (data.status !== 'waiting') {
                    alert('La sala ya está en juego.');
                    return;
                }
                if (data.player2) {
                    alert('La sala ya tiene 2 jugadores.');
                    return;
                }
                window.db.collection("rooms").doc(roomId).update({
                    player2: window.currentUser.uid,
                    status: 'playing'
                })
                .then(() => {
                    console.log(`✅ Unido a sala: ${roomId}`);
                    this.currentRoomId = roomId;
                    this.isHost = false;
                    this.playerRole = 'guest';
                    this.roomRef = window.db.collection("rooms").doc(roomId);
                    // Mostrar pantalla de juego
                    this.showScreen('game-area');
                    this.listenToRoom();
                    this.loadRoomState(data);
                    this.startOnlineGame(roomId, 'guest');
                })
                .catch(error => {
                    console.error("❌ Error al unirse a sala:", error);
                    alert("Error al unirse a la sala. Por favor, intenta nuevamente.");
                });
            })
            .catch(error => {
                console.error("❌ Error al obtener sala:", error);
                alert("Error al obtener la sala. Por favor, verifica el ID e intenta nuevamente.");
            });
    }

    listenToRoom() {
        if (!this.roomRef) return;
        this.roomRef.onSnapshot((doc) => {
            if (!doc.exists) {
                console.log("❌ La sala ya no existe");
                alert("La sala ha sido cerrada");
                this.showScreen('catalog');
                return;
            }
            const data = doc.data();
            this.loadRoomState(data);
            // Notificar cuando el segundo jugador se una
            if (data.player2 && !this.playerJoinedNotified) {
                console.log('✅ Segundo jugador conectado');
                this.playerJoinedNotified = true;
                if (this.isHost && this.currentGameHistoryId) {
                    this.gameHistoryRef.doc(this.currentGameHistoryId).update({
                        player2: data.player2
                    });
                }
            }
        }, (error) => {
            console.error("❌ Error al escuchar sala:", error);
        });
    }

    loadRoomState(data) {
        if (!data) return;
        console.log('🔄 Cargando estado de la sala:', data.status);
        // Actualizar el estado visual
        const roomStatusEl = document.getElementById('room-status');
        if (roomStatusEl) {
            if (!data.player2) {
                roomStatusEl.textContent = this.isHost ? "Esperando al jugador invitado..." : "Esperando al anfitrión...";
            } else if (data.status === 'playing') {
                roomStatusEl.textContent = `Turno de ${data.turn}`;
            } else if (data.status === 'finished') {
                roomStatusEl.textContent = "La partida ha terminado.";
            }
        }
        // Cargar el tablero y el turno
        this.gameBoard = data.board || ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = data.turn || 'X';
        this.gameActive = data.status === 'playing';
        // Actualizar UI
        this.updateBoard();
        this.updateStatus();
        // Si el juego está en progreso y ambos jugadores están conectados
        if (data.status === 'playing' && data.player1 && data.player2) {
            this.showChat();
            this.initializeChat();
            this.initializeOnlineChat(this.currentRoomId);
            this.initializeGameHistory(this.currentRoomId);
        }
    }

    startOnlineGame(roomId, role) {
        console.log(`🎮 Iniciando juego online: ${role}`);
        this.gameBoard = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.gameActive = true;
        this.initializeGameBoard();
        this.updateBoard();
        this.updateStatus();
        this.showChat();
        this.initializeChat();
        this.initializeOnlineChat(roomId);
        this.initializeGameHistory(roomId);
        this.showRoomInfo(roomId, role);
        this.showGameStartMessage();
        console.log('✅ Juego online iniciado');
    }

    showRoomInfo(roomId, role) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            if (role === 'host') {
                statusEl.textContent = `Sala ${roomId} - Esperando jugador... (Eres X)`;
            } else {
                statusEl.textContent = `Sala ${roomId} - Conectado (Eres O)`;
            }
        }
    }

    // --- Métodos de Chat ---
    setupChatListeners() {
        const sendBtn = document.getElementById('send-message');
        if (sendBtn) {
            this.addEventListener(
                sendBtn,
                'click',
                () => this.sendMessage(),
                'send-message'
            );
        }
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            this.addEventListener(
                chatInput,
                'keypress',
                (e) => {
                    if (e.key === 'Enter') {
                        this.sendMessage();
                    }
                },
                'chat-input-enter'
            );
        }
    }

    showChat() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) chatContainer.style.display = 'block';
    }

    hideChat() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) chatContainer.style.display = 'none';
    }

    initializeChat() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="chat-message system"><span class="message-time">00:00</span><span class="message-text">¡Bienvenido al chat! Puedes comunicarte con tu oponente aquí.</span></div>';
        }
    }

    initializeOnlineChat(roomId) {
        if (!roomId) return;
        this.chatRef = window.db.collection('rooms').doc(roomId).collection('messages');
        this.chatRef.orderBy('timestamp', 'asc').onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const isOwnMessage = data.senderId === window.currentUser.uid;
                    if (!isOwnMessage) {
                        this.addChatMessage('other', data.message, data.sender);
                    }
                }
            });
        }, (error) => {
            console.error('Error al escuchar mensajes:', error);
        });
    }

    addChatMessage(type, text, sender = null) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const senderText = sender ? `<span class="message-sender">${sender}:</span>` : '';
        messageDiv.innerHTML = `
            <span class="message-time">${time}</span>
            ${senderText}
            <span class="message-text">${text}</span>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendMessage() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;
        const message = chatInput.value.trim();
        if (!message) return;
        chatInput.value = '';
        if (this.gameMode === 'online' && this.chatRef) {
            const playerName = window.currentUser?.displayName || 'Jugador';
            const messageData = {
                message: message,
                sender: playerName,
                senderId: window.currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                roomId: this.currentRoomId
            };
            this.chatRef.add(messageData).then(() => {
                console.log('✅ Mensaje enviado');
                this.addChatMessage('own', message);
            }).catch(error => {
                console.error('Error al enviar mensaje:', error);
            });
        }
    }

    // --- Métodos de Juego ---
    initializeGameBoard() {
        console.log('🎲 Inicializando tablero de juego...');
        const gameBoardEl = document.getElementById('game-tres-en-raya');
        if (!gameBoardEl) {
            console.error('❌ Elemento game-tres-en-raya no encontrado');
            return;
        }
        gameBoardEl.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            gameBoardEl.appendChild(cell);
            this.addEventListener(
                cell,
                'click',
                () => this.handleCellClick(i),
                `cell-${i}`
            );
        }
        console.log('✅ Tablero inicializado');
    }

    handleCellClick(index) {
        console.log(`🖱️ Click en celda ${index}`);
        if (this.gameBoard[index] !== '' || !this.gameActive) {
            console.log('⚠️ Movimiento inválido');
            return;
        }
        if (this.gameMode === 'online') {
            const isMyTurn = (this.playerRole === 'host' && this.currentPlayer === 'X') ||
                             (this.playerRole === 'guest' && this.currentPlayer === 'O');
            if (!isMyTurn) {
                console.log('⚠️ No es tu turno');
                return;
            }
        } else if (this.gameMode === 'cpu') {
            if (this.currentPlayer !== this.playerSymbol) {
                console.log('⚠️ No es tu turno');
                return;
            }
        }
        // Guardar movimiento en Firestore (solo en línea)
        if (this.gameMode === 'online') {
            this.saveMove(index, this.currentPlayer);
        }
        // Actualizar tablero local
        this.gameBoard[index] = this.currentPlayer;
        this.updateBoard();
        // Verificar ganador o empate
        if (this.checkWinner()) {
            const winner = this.currentPlayer;
            const statusEl = document.getElementById('status');
            if (statusEl) statusEl.textContent = `¡${winner} gana!`;
            this.gameActive = false;
            // Actualizar estadísticas solo para el ganador
            if (this.gameMode === 'cpu') {
                this.updateStats(winner === this.playerSymbol ? 'win' : 'lose');
            } else if (this.gameMode === '2p') {
                this.updateStats('win'); // En 2 jugadores, ambos juegan en el mismo dispositivo
            } else if (this.gameMode === 'online') {
                this.saveGameResult(winner, 'win');
                if (this.roomRef) {
                    this.roomRef.update({
                        board: this.gameBoard,
                        turn: this.currentPlayer,
                        status: 'finished'
                    });
                }
            }
            return;
        }
        if (this.gameBoard.every(cell => cell !== '')) {
            const statusEl = document.getElementById('status');
            if (statusEl) statusEl.textContent = '¡Empate!';
            this.gameActive = false;
            this.updateStats('draw');
            if (this.gameMode === 'online') {
                this.saveGameResult('tie', 'draw');
                if (this.roomRef) {
                    this.roomRef.update({
                        board: this.gameBoard,
                        turn: this.currentPlayer,
                        status: 'finished'
                    });
                }
            }
            return;
        }
        // Cambiar turno
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        this.updateStatus();
        // Actualizar turno en Firestore (solo en línea)
        if (this.gameMode === 'online' && this.roomRef) {
            this.roomRef.update({
                board: this.gameBoard,
                turn: this.currentPlayer
            });
        }
        // Movimiento de la CPU (si aplica)
        if (this.gameMode === 'cpu' && this.currentPlayer === this.cpuSymbol && this.gameActive) {
            setTimeout(() => {
                this.cpuMove();
            }, 500);
        }
    }

    saveMove(cellIndex, player) {
        if (!this.movesRef || !this.currentGameHistoryId) {
            console.log('⚠️ Movimiento no guardado: historial no inicializado');
            if (!this.isHost) {
                this.findExistingGameHistory(this.currentRoomId);
            }
            return;
        }
        const moveData = {
            cellIndex: cellIndex,
            player: player,
            playerId: window.currentUser.uid,
            playerName: window.currentUser.displayName || 'Jugador',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            moveNumber: this.gameBoard.filter(cell => cell !== '').length + 1,
            gameHistoryId: this.currentGameHistoryId
        };
        this.movesRef.add(moveData).then(() => {
            console.log(`✅ Movimiento guardado: ${player} en celda ${cellIndex}`);
        }).catch(error => {
            console.error('❌ Error al guardar movimiento:', error);
        });
    }

    cpuMove() {
        if (!this.gameActive) return;
        console.log(`🤖 CPU jugando (dificultad: ${this.difficulty})...`);
        let move;
        switch (this.difficulty) {
            case 'easy':
                move = this.getRandomMove();
                break;
            case 'medium':
                move = Math.random() < 0.7 ? this.getBestMove() : this.getRandomMove();
                break;
            case 'hard':
                move = this.getBestMove();
                break;
            default:
                move = this.getRandomMove();
        }
        if (move !== -1) {
            console.log(`🤖 CPU elige celda ${move}`);
            this.handleCellClick(move);
        }
    }

    getRandomMove() {
        const availableMoves = this.gameBoard.map((cell, index) => cell === '' ? index : null).filter(val => val !== null);
        return availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : -1;
    }

    getBestMove() {
        let bestScore = -Infinity;
        let bestMove = -1;
        for (let i = 0; i < 9; i++) {
            if (this.gameBoard[i] === '') {
                this.gameBoard[i] = this.cpuSymbol;
                let score = this.minimax(this.gameBoard, 0, false);
                this.gameBoard[i] = '';
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = i;
                }
            }
        }
        return bestMove;
    }

    minimax(board, depth, isMaximizing) {
        const result = this.checkWinnerForMinimax();
        if (result !== null) {
            return result === this.cpuSymbol ? 1 : result === this.playerSymbol ? -1 : 0;
        }
        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = this.cpuSymbol;
                    let score = this.minimax(board, depth + 1, false);
                    board[i] = '';
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = this.playerSymbol;
                    let score = this.minimax(board, depth + 1, true);
                    board[i] = '';
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    }

    checkWinner() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        return winPatterns.some(pattern => {
            const [a, b, c] = pattern;
            return this.gameBoard[a] && this.gameBoard[a] === this.gameBoard[b] && this.gameBoard[a] === this.gameBoard[c];
        });
    }

    checkWinnerForMinimax() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (let pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (this.gameBoard[a] && this.gameBoard[a] === this.gameBoard[b] && this.gameBoard[a] === this.gameBoard[c]) {
                return this.gameBoard[a];
            }
        }
        return this.gameBoard.every(cell => cell !== '') ? 'tie' : null;
    }

    updateBoard() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            cell.textContent = this.gameBoard[index];
            cell.style.color = this.gameBoard[index] === 'X' ? '#e74c3c' : '#3498db';
        });
    }

    updateStatus() {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            if (this.gameMode === 'online') {
                const mySymbol = this.playerRole === 'host' ? 'X' : 'O';
                const isMyTurn = this.currentPlayer === mySymbol;
                statusEl.textContent = isMyTurn ? `Tu turno (${mySymbol})` : `Turno del oponente (${this.currentPlayer})`;
            } else {
                statusEl.textContent = `Turno de ${this.currentPlayer}`;
            }
        }
    }

    resetGame() {
        console.log('🔄 Reiniciando juego...');
        if (this.gameMode === 'online' && this.currentRoomId && this.roomRef) {
            const resetData = {
                board: ['', '', '', '', '', '', '', '', ''],
                turn: 'X',
                status: 'playing'
            };
            this.roomRef.update(resetData)
                .then(() => {
                    console.log('✅ Juego reiniciado en línea');
                })
                .catch(error => {
                    console.error('❌ Error al reiniciar juego en línea:', error);
                    alert('Error al reiniciar el juego. Intenta nuevamente.');
                });
        } else {
            this.gameBoard = ['', '', '', '', '', '', '', '', ''];
            this.currentPlayer = this.gameMode === '2p' ? 'X' : this.playerSymbol;
            this.gameActive = true;
            this.updateBoard();
            this.updateStatus();
            console.log('✅ Juego reiniciado localmente');
        }
    }

    // --- Métodos de Estadísticas ---
    async updateStats(result) {
        if (!window.currentUser) return;
        try {
            const playerRef = window.db.collection("players").doc(window.currentUser.uid);
            const doc = await playerRef.get();
            if (doc.exists) {
                const data = doc.data();
                const newGamesPlayed = (data.gamesPlayed || 0) + 1;
                const newGamesWon = result === 'win' ? (data.gamesWon || 0) + 1 : (data.gamesWon || 0);
                const newWinPercentage = Math.round((newGamesWon / newGamesPlayed) * 100);
                await playerRef.update({
                    gamesPlayed: newGamesPlayed,
                    gamesWon: newGamesWon,
                    winPercentage: newWinPercentage
                });
                this.updateStatsUI(newGamesPlayed, newGamesWon, newWinPercentage);
                console.log(`📊 Estadísticas actualizadas: ${newGamesPlayed} partidas, ${newGamesWon} victorias`);
            }
        } catch (error) {
            console.error("Error al actualizar estadísticas:", error);
        }
    }

    updateStatsUI(gamesPlayed, gamesWon, winPercentage) {
        const gamesPlayedEl = document.getElementById('games-played');
        const gamesWonEl = document.getElementById('games-won');
        const winPercentageEl = document.getElementById('win-percentage');
        if (gamesPlayedEl) gamesPlayedEl.textContent = gamesPlayed;
        if (gamesWonEl) gamesWonEl.textContent = gamesWon;
        if (winPercentageEl) winPercentageEl.textContent = winPercentage + '%';
    }

    // --- Métodos de Autenticación ---
    async handleRegistration(e) {
        const nameInput = document.getElementById('player-name-reg');
        const emailInput = document.getElementById('player-email');
        const passwordInput = document.getElementById('player-password');
        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        if (!name || !email || !password) {
            alert("Por favor completa todos los campos.");
            return;
        }
        try {
            const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await user.updateProfile({
                displayName: name
            });
            await window.db.collection("players").doc(user.uid).set({
                name: name,
                email: email,
                gamesPlayed: 0,
                gamesWon: 0,
                winPercentage: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Usuario registrado exitosamente');
            alert("✅ Registro exitoso. ¡Bienvenido!");
        } catch (error) {
            console.error("Error en registro:", error);
            let msg = "Error: ";
            if (error.code === 'auth/email-already-in-use') {
                msg += "El correo ya está registrado.";
            } else if (error.code === 'auth/invalid-email') {
                msg += "Correo inválido.";
            } else if (error.code === 'auth/weak-password') {
                msg += "La contraseña debe tener al menos 6 caracteres.";
            } else {
                msg += error.message;
            }
            alert(msg);
        }
    }

    async handleLogin(e) {
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        if (!email || !password) {
            alert("Por favor completa todos los campos.");
            return;
        }
        try {
            await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            await window.auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Login exitoso');
        } catch (error) {
            console.error("Error en login:", error);
            let msg = "Error: ";
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                msg += "Correo o contraseña incorrectos.";
            } else if (error.code === 'auth/invalid-email') {
                msg += "Correo inválido.";
            } else {
                msg += error.message;
            }
            alert(msg);
        }
    }

    // --- Tabla de Líderes ---
    async loadLeaderboard() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;
        list.innerHTML = '<p>Cargando...</p>';
        try {
            const snapshot = await window.db.collection("players")
                .orderBy("gamesWon", "desc")
                .limit(10)
                .get();
            list.innerHTML = '';
            let rank = 1;
            snapshot.forEach(doc => {
                const data = doc.data();
                const item = document.createElement('div');
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;">
                        <span><strong>${rank}.</strong> ${data.name}</span>
                        <span>${data.gamesWon} victorias</span>
                    </div>
                `;
                list.appendChild(item);
                rank++;
            });
            if (rank === 1) {
                list.innerHTML = '<p>No hay jugadores registrados aún.</p>';
            }
        } catch (error) {
            console.error("Error al cargar leaderboard:", error);
            list.innerHTML = '<p>Error al cargar la tabla de líderes.</p>';
        }
    }

    // --- Utilidades ---
    generateRoomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let roomId = '';
        for (let i = 0; i < 6; i++) {
            roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const displayElement = document.getElementById('display-room-id');
        const linkElement = document.getElementById('room-link');
        if (displayElement) {
            displayElement.textContent = roomId;
        }
        if (linkElement) {
            const currentUrl = `${window.location.origin}${window.location.pathname}`;
            linkElement.value = `${currentUrl}?room=${roomId}`;
        }
        console.log(`🔑 ID de sala generado: ${roomId}`);
        return roomId;
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            alert('¡Copiado al portapapeles!');
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('¡Copiado al portapapeles!');
        }
    }

    checkForRoomParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        if (roomId) {
            console.log(`🔗 Detectado parámetro de sala: ${roomId}`);
            const joinRadio = document.querySelector('input[name="online-action"][value="join"]');
            const createRadio = document.querySelector('input[name="online-action"][value="create"]');
            const onlineMode = document.querySelector('input[name="mode"][value="online"]');
            if (joinRadio && createRadio && onlineMode) {
                onlineMode.checked = true;
                joinRadio.checked = true;
                createRadio.checked = false;
                const difficultyGroup = document.getElementById('difficulty-group');
                const onlineGroup = document.getElementById('online-group');
                const roomIdGroup = document.getElementById('room-id-group');
                const roomInfoGroup = document.getElementById('room-info-group');
                if (difficultyGroup) difficultyGroup.style.display = 'none';
                if (onlineGroup) onlineGroup.style.display = 'block';
                if (roomIdGroup) roomIdGroup.style.display = 'block';
                if (roomInfoGroup) roomInfoGroup.style.display = 'none';
                const roomIdInput = document.getElementById('room-id');
                if (roomIdInput) {
                    roomIdInput.value = roomId;
                }
            }
        }
    }

    initializeGameHistory(roomId) {
        if (!roomId) return;
        this.movesRef = window.db.collection('rooms').doc(roomId).collection('moves');
        this.gameHistoryRef = window.db.collection('rooms').doc(roomId).collection('gameHistory');
        if (this.isHost) {
            this.gameHistoryRef.add({
                gameId: roomId,
                startTime: firebase.firestore.FieldValue.serverTimestamp(),
                player1: window.currentUser.uid,
                player2: null,
                status: 'playing',
                moves: []
            }).then(docRef => {
                this.currentGameHistoryId = docRef.id;
                console.log('✅ Historial de juego inicializado:', docRef.id);
            }).catch(error => {
                console.error('❌ Error al inicializar historial:', error);
            });
        } else {
            this.findExistingGameHistory(roomId);
        }
    }

    findExistingGameHistory(roomId) {
        if (!this.gameHistoryRef) return;
        this.gameHistoryRef.where('gameId', '==', roomId)
            .where('status', '==', 'playing')
            .limit(1)
            .get()
            .then(snapshot => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    this.currentGameHistoryId = doc.id;
                    this.gameHistoryRef.doc(doc.id).update({
                        player2: window.currentUser.uid
                    });
                    console.log('✅ Historial de juego encontrado:', doc.id);
                } else {
                    console.log('⚠️ No se encontró historial existente');
                }
            })
            .catch(error => {
                console.error('❌ Error al buscar historial:', error);
            });
    }

    saveGameResult(winner, result) {
        if (!this.gameHistoryRef || !this.currentGameHistoryId) return;
        const gameResult = {
            winner: winner,
            result: result,
            endTime: firebase.firestore.FieldValue.serverTimestamp(),
            finalBoard: [...this.gameBoard],
            totalMoves: this.gameBoard.filter(cell => cell !== '').length,
            status: 'finished'
        };
        this.gameHistoryRef.doc(this.currentGameHistoryId).update(gameResult).then(() => {
            console.log('✅ Resultado del juego guardado:', result);
        }).catch(error => {
            console.error('❌ Error al guardar resultado:', error);
        });
    }

    cleanupOnlineGame() {
        console.log('🧹 Limpiando juego en línea...');
        if (this.roomRef && this.isHost && this.gameActive) {
            this.roomRef.delete().catch(error => {
                console.error('Error al eliminar sala:', error);
            });
        }
        this.roomRef = null;
        this.chatRef = null;
        this.movesRef = null;
        this.gameHistoryRef = null;
        this.currentRoomId = null;
        this.isHost = false;
        this.playerRole = null;
        this.playerJoinedNotified = false;
        this.currentGameHistoryId = null;
        console.log('✅ Limpieza completada');
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicación Tres en Raya...');
    try {
        window.gameManager = new GameManager();
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
        alert('Error al iniciar la aplicación. Revisa la consola para más detalles.');
    }
});
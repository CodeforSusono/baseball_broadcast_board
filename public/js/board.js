const board = Vue.createApp({
  data: () => ({
    boardData: {
      game_title: "",
      team_top: "",
      team_bottom: "",
      game_inning: 0,
      last_inning: 5,
      top: true,
      first_base: false,
      second_base: false,
      third_base: false,
      ball_cnt: 0,
      strike_cnt: 0,
      out_cnt: 0,
      score_top: 0,
      score_bottom: 0,
    },
    socket: null,
    // WebSocket reconnection
    connectionStatus: 'connecting',
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    reconnectDelay: 1000,
    reconnectTimer: null,
  }),
  created() {
    // Initialize WebSocket connection
    this.connectWebSocket();

    // Load configuration from init_data.json
    fetch("/init_data.json")
      .then((response) => response.json())
      .then((data) => {
        this.boardData.game_title = data.game_title;
        this.boardData.team_top = data.team_top;
        this.boardData.team_bottom = data.team_bottom;
      });
  },
  beforeUnmount() {
    // Clean up WebSocket and timers
    this.cancelReconnect();
    if (this.socket) {
      this.socket.close();
    }
  },
  methods: {
    // WebSocket connection management
    connectWebSocket() {
      // Dynamically generate WebSocket URL based on current page location
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;

      try {
        this.socket = new WebSocket(`${wsProtocol}//${wsHost}`);

        this.socket.onopen = () => this.handleWebSocketOpen();
        this.socket.onmessage = (event) => this.handleWebSocketMessage(event);
        this.socket.onerror = (error) => this.handleWebSocketError(error);
        this.socket.onclose = () => this.handleWebSocketClose();
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        this.scheduleReconnect();
      }
    },

    handleWebSocketOpen() {
      console.log('WebSocket connection established for display board.');
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
    },

    handleWebSocketMessage(event) {
      try {
        this.boardData = JSON.parse(event.data);
      } catch (error) {
        console.error('Error parsing board data:', error);
      }
    },

    handleWebSocketError(error) {
      console.error('WebSocket error:', error);
    },

    handleWebSocketClose() {
      console.log('WebSocket connection closed');

      if (this.connectionStatus !== 'disconnected') {
        this.connectionStatus = 'reconnecting';
        this.scheduleReconnect();
      }
    },

    scheduleReconnect() {
      // Clear any existing reconnect timer
      this.cancelReconnect();

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.connectionStatus = 'disconnected';
        return;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
        30000 // Max 30 seconds
      );

      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connectWebSocket();
      }, delay);
    },

    cancelReconnect() {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    },
  },
});
board.component('scoreboard', scoreboardComponent);
board.mount('#board');

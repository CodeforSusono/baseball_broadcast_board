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
  }),
  created() {
    // Dynamically generate WebSocket URL based on current page location
    // This allows access from different PCs (localhost, LAN IP, domain name)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host; // includes hostname and port
    this.socket = new WebSocket(`${wsProtocol}//${wsHost}`);

    this.socket.onopen = () => {
      console.log('WebSocket connection established for display board.');
    };

    this.socket.onmessage = (event) => {
      this.boardData = JSON.parse(event.data);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    fetch("/init_data.json")
      .then((response) => response.json())
      .then((data) => {
        this.boardData.game_title = data.game_title;
        this.boardData.team_top = data.team_top;
        this.boardData.team_bottom = data.team_bottom;
      });
  },
});
board.component('scoreboard', scoreboardComponent);
board.mount('#board');

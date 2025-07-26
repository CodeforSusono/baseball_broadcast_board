const board = Vue.createApp({
  data: () => ({
    boardData: {
      game_title: "試合情報",
      team_top: "Team A",
      team_bottom: "Team B",
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
    this.socket = new WebSocket('ws://localhost:8080');

    this.socket.onopen = () => {
      console.log('WebSocket connection established for display board.');
    };

    this.socket.onmessage = (event) => {
      this.boardData = JSON.parse(event.data);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  },
});
board.component('scoreboard', scoreboardComponent);
board.mount('#board');

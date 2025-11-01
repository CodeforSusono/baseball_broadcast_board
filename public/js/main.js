const app = Vue.createApp({
  data: () => ({
    message: "Hello Score Board !",
    game_title: "",
    team_top: "",
    team_bottom: "",
    game_inning: 0,
    last_inning: 9,
    top: false,
    first_base: false,
    second_base: false,
    third_base: false,
    ball_cnt: 0,
    strike_cnt: 0,
    out_cnt: 0,
    score_top: 0,
    score_bottom: 0,
    game_start: false,
    game_array: [],
    team_items: [],
    socket: null,
    restoredFromServer: false,
  }),
  created() {
    // Dynamically generate WebSocket URL based on current page location
    // This allows access from different PCs (localhost, LAN IP, domain name)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host; // includes hostname and port
    this.socket = new WebSocket(`${wsProtocol}//${wsHost}`);

    this.socket.onopen = () => {
      console.log("WebSocket connection established for control panel.");
      // Wait for server to send saved state before sending current state
    };

    // Receive saved game state from server
    this.socket.onmessage = (event) => {
      try {
        const savedState = JSON.parse(event.data);
        console.log("Received saved game state from server");

        // Restore game state (but not UI configuration like game_array and team_items)
        this.game_title = savedState.game_title || this.game_title;
        this.team_top = savedState.team_top || this.team_top;
        this.team_bottom = savedState.team_bottom || this.team_bottom;
        this.game_inning = savedState.game_inning || 0;
        this.last_inning = savedState.last_inning || 9;
        this.top = savedState.top || false;
        this.first_base = savedState.first_base || false;
        this.second_base = savedState.second_base || false;
        this.third_base = savedState.third_base || false;
        this.ball_cnt = savedState.ball_cnt || 0;
        this.strike_cnt = savedState.strike_cnt || 0;
        this.out_cnt = savedState.out_cnt || 0;
        this.score_top = savedState.score_top || 0;
        this.score_bottom = savedState.score_bottom || 0;

        this.restoredFromServer = true;
      } catch (error) {
        console.error("Error parsing saved game state:", error);
      }
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Load configuration from init_data.json
    fetch("/init_data.json")
      .then((response) => response.json())
      .then((data) => {
        // Always load UI configuration (dropdown options)
        this.game_array = data.game_array;
        this.team_items = data.team_items;

        // Load initial values only if not restored from server
        if (!this.restoredFromServer) {
          this.game_title = data.game_title;
          this.team_top = data.team_top;
          this.team_bottom = data.team_bottom;
          if (data.last_inning !== undefined) {
            this.last_inning = data.last_inning;
          }
        }
      });
  },
  watch: {
    // 監視するデータをまとめて指定
    boardData: {
      handler() {
        this.updateBoard();
      },
      deep: true, // ネストされたオブジェクトも監視
    },
  },
  computed: {
    // watchで監視するための、ボードに関連するデータをまとめた算出プロパティ
    boardData() {
      return {
        game_title: this.game_title,
        team_top: this.team_top,
        team_bottom: this.team_bottom,
        game_inning: this.game_inning,
        top: this.top,
        first_base: this.first_base,
        second_base: this.second_base,
        third_base: this.third_base,
        ball_cnt: this.ball_cnt,
        strike_cnt: this.strike_cnt,
        out_cnt: this.out_cnt,
        score_top: this.score_top,
        score_bottom: this.score_bottom,
        last_inning: this.last_inning,
      };
    },
  },
  methods: {
    updateBoard() {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(this.boardData));
      }
    },
    initParams: function () {
      this.first_base = false;
      this.second_base = false;
      this.third_base = false;
      this.ball_cnt = 0;
      this.strike_cnt = 0;
      this.out_cnt = 0;
    },
    resetBSO: function () {
      this.ball_cnt = 0;
      this.strike_cnt = 0;
      this.out_cnt = 0;
    },
    resetBS: function () {
      this.ball_cnt = 0;
      this.strike_cnt = 0;
    },
    inningMsg: function () {
      if (this.game_inning < 1) {
        return "試合前";
      } else if (this.game_inning > this.last_inning) {
        return "試合終了";
      } else {
        return this.game_inning + "回" + (this.top ? "オモテ" : "ウラ");
      }
    },
    changeOffense: function () {
      if (this.top) {
        this.top = false;
      } else {
        this.top = true;
      }
      this.initParams();
    },
    isPlaying: function () {
      if (this.game_inning >= 1 && this.game_inning <= this.last_inning) {
        return true;
      } else {
        return false;
      }
    },
    ballCountUp: function () {
      if (this.ball_cnt < 3) {
        this.ball_cnt++;
      }
    },
    ballCountDown: function () {
      if (this.ball_cnt >= 1) {
        this.ball_cnt--;
      }
    },
    strikeCountUp: function () {
      if (this.strike_cnt < 2) {
        this.strike_cnt++;
      }
    },
    strikeCountDown: function () {
      if (this.strike_cnt >= 1) {
        this.strike_cnt--;
      }
    },
    outCountUp: function () {
      if (this.out_cnt < 2) {
        this.out_cnt++;
      }
    },
    outCountDown: function () {
      if (this.out_cnt >= 1) {
        this.out_cnt--;
      }
    },
    gameStatusUp: function () {
      if (this.game_inning < this.last_inning + 1) {
        this.game_inning++;
        this.initParams();
      }
    },
    gameStatusDown: function () {
      if (this.game_inning > 0) {
        this.game_inning--;
        this.initParams();
      }
    },
    gameForward: function () {
      if (this.game_inning <= this.last_inning) {
        if (this.top) {
          this.top = false;
        } else {
          this.game_inning++;
          this.top = true;
        }
        this.initParams();
      }
    },
    gameBackward: function () {
      if (this.game_inning >= 1) {
        if (this.top) {
          this.game_inning--;
          this.top = false;
        } else {
          this.top = true;
        }
        this.initParams();
        if (this.game_inning === 0) {
          this.score_top = 0;
          this.score_bottom = 0;
        }
      }
    },
    incrementScoreTop: function () {
      this.score_top++;
    },
    decrementScoreTop: function () {
      if (this.score_top > 0) {
        this.score_top--;
      }
    },
    incrementScoreBottom: function () {
      this.score_bottom++;
    },
    decrementScoreBottom: function () {
      if (this.score_bottom > 0) {
        this.score_bottom--;
      }
    },
  },
});
app.component("scoreboard", scoreboardComponent);
app.mount("#app");

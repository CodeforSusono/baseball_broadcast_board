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
    game_array: ["試合前", 1, 2, 3, 4, 5, 6, 7, 8, 9, "試合終了"],
    team_items: ["　", "東京B", "横浜", "東京G", "龍野"],
    socket: null,
  }),
  created() {
    this.socket = new WebSocket("ws://localhost:8080");

    this.socket.onopen = () => {
      console.log("WebSocket connection established for control panel.");
      // 接続時に現在のデータを送信
      this.updateBoard();
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    fetch("/init_data.json")
      .then((response) => response.json())
      .then((data) => {
        this.game_title = data.game_title;
        this.team_top = data.team_top;
        this.team_bottom = data.team_bottom;
      });

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
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

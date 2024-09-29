const app = Vue.createApp({
  data: () => ({
    message: 'Hello Score Board !',
    game_title: "第21回 DREAM-CUP 第1試合",
    team_top: "Team A",
    team_bottom: "Team B",
    game_inning: 0,
    last_inning: 5,
    top: false,
    first_base: false,
    second_base: false,
    third_base: false,
    ball_cnt: 0,
    strike_cnt: 0.,
    out_cnt: 0,
    score_top: 0,
    score_bottom: 0,
    game_start: false,
    game_array: ["試合前",1,2,3,4,5,"試合終了"]
  }),
  methods: {
    initParams: function() {
      this.first_base = false
      this.second_base = false
      this.third_base = false
      this.ball_cnt = 0
      this.strike_cnt = 0
      this.out_cnt = 0
    },
    inningMsg: function() {
      if (this.game_inning<1) {
        return '試合前'
      } else if (this.game_inning>this.last_inning) {
        return '試合終了'
      } else {
        return this.game_inning+'回'+(this.top ? 'オモテ':'ウラ')
      }
    },
    changeOffense: function() {
      if (this.top) {
        this.top = false
      } else {
        this.top = true
      }
      this.initParams()
    },
    isPlaying: function() {
      if (this.game_inning>=1 && this.game_inning<=this.last_inning) {
        return true
      } else {
        return false
      }
    },
    ballCountUp: function() {
      if (this.ball_cnt < 3) {
        this.ball_cnt++
      }
    },
    ballCountDown: function() {
      if (this.ball_cnt >= 1) {
        this.ball_cnt--
      }
    },
    strikeCountUp: function() {
      if (this.strike_cnt < 2) {
        this.strike_cnt++
      }
    },
    strikeCountDown: function() {
      if (this.strike_cnt >= 1) {
        this.strike_cnt--
      }
    },
    outCountUp: function() {
      if (this.out_cnt < 2) {
        this.out_cnt++
      }
    },
    outCountDown: function() {
      if (this.out_cnt >= 1) {
        this.out_cnt--
      }
    },
    gameStatusUp: function() {
      if (this.game_inning < this.last_inning+1) {
        this.game_inning++
        this.initParams()
      }
    },
    gameStatusDown: function() {
      if (this.game_inning > 0) {
        this.game_inning--
        this.initParams()
      } 
    },
    gameForward: function() {
      if (this.game_inning <= this.last_inning) {
        if (this.top) {
          this.top = false
        } else {
          this.game_inning++
          this.top = true
        }
        this.initParams()
      }
    },
    gameBackward: function() {
      if (this.game_inning >= 1) {
        if (this.top) {
          this.game_inning--
          this.top = false
        } else {
          this.top = true
        }
        this.initParams()
        if (this.game_inning === 0) {
          this.score_top = 0
          this.score_bottom = 0
        }
      }
    },
    incrementScoreTop: function() {
      this.score_top++
      console.log(this.score_top)
    },
    decrementScoreTop: function() {
      if (this.score_top>0) {
        this.score_top--
      }
    },
    incrementScoreBottom: function() {
      this.score_bottom++
      console.log(this.score_bottom)
    },
    decrementScoreBottom: function() {
      if (this.score_bottom>0) {
        this.score_bottom--
      }
    },
  }
})
app.mount('#app')

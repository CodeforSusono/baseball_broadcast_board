const scoreboardComponent = {
  props: ["boardData", "poweredByClass"],
  template: `
  <div class="col-sm">
    <svg
      width="50mm"
      height="30.000002mm"
      viewBox="0 0 50 30.000002"
      version="1.1"
      id="svg1"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:svg="http://www.w3.org/2000/svg">
      <defs
        id="defs1">
        <linearGradient
          id="linearGradient3">
          <stop
            style="stop-color:#a8a8a8;stop-opacity:1;"
            offset="0"
            id="stop3" />
          <stop
            style="stop-color:#ebebeb;stop-opacity:1;"
            offset="0.82028985"
            id="stop4" />
        </linearGradient>
        <linearGradient
          xlink:href="#linearGradient3"
          id="linearGradient4"
          x1="35.611572"
          y1="79.637955"
          x2="35.732254"
          y2="84.760162"
          gradientUnits="userSpaceOnUse"
          spreadMethod="reflect"
          gradientTransform="matrix(0.89999999,0,0,0.8,0.65857019,-33.074855)" />
      </defs>
      <g
        id="layer1"
        transform="translate(-20.244935,-28.781959)">
        <rect
          style="fill:#35328A;fill-opacity:1;stroke-width:0.264583"
          id="rect2"
          width="50"
          height="30"
          x="20.244934"
          y="28.781958" />
        <rect
          style="fill:url(#linearGradient4);stroke-width:0.224506"
          id="rect3"
          width="22.5"
          height="8"
          x="21.952339"
          y="30.733273" />
        <text
          xml:space="preserve"
          style="font-size:4.23333px;fill:#333333;fill-opacity:1;stroke-width:0.264583"
          x="25.367146"
          y="36.099411"
          id="text4"><tspan
            id="tspan4"
            style="font-style:italic;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:4.23333px;font-family:'Meiryo UI';-inkscape-font-specification:'Meiryo UI Bold Italic';fill:#333333;stroke-width:0.264583"
            x="25.367146"
            y="36.099411">{{ inningMsg }}</tspan></text>
        <text
          xml:space="preserve"
          style="font-style:italic;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:4.58611px;font-family:'Meiryo UI';-inkscape-font-specification:'Meiryo UI Bold Italic';fill:#333333;fill-opacity:1;stroke-width:0.264583"
          x="22.440168"
          y="46.34383"
          id="text8"><tspan
            id="tspan8"
            style="font-size:4.58611px;fill:#e3e3e3;fill-opacity:1;stroke-width:0.264583"
            x="22.440168"
            y="46.34383">{{ boardData.team_top }}</tspan></text>
        <text
          xml:space="preserve"
          style="font-style:italic;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:4.58611px;font-family:'Meiryo UI';-inkscape-font-specification:'Meiryo UI Bold Italic';fill:#333333;fill-opacity:1;stroke-width:0.264583"
          x="22.124441"
          y="53.872559"
          id="text7-5"><tspan
            id="tspan7-2"
            style="font-size:4.58611px;fill:#e3e3e3;fill-opacity:1;stroke-width:0.264583"
            x="22.124441"
            y="53.872559">{{ boardData.team_bottom }}</tspan></text>
        <text
          xml:space="preserve"
          style="font-style:normal;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:4.5861px;font-family:'Meiryo UI';-inkscape-font-specification:'Meiryo UI Bold Italic';fill:#c8c8c8;fill-opacity:1;stroke-width:0.264583"
          x="40.922894"
          y="46.587742"
          id="text9"><tspan
            id="tspan9"
            style="stroke-width:0.264583"
            x="40.922894"
            y="46.587742">: {{ boardData.score_top < 10 ? ' ' + boardData.score_top : boardData.score_top }}</tspan></text>
        <text
          xml:space="preserve"
          style="font-style:normal;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:4.5861px;font-family:'Meiryo UI';-inkscape-font-specification:'Meiryo UI Bold Italic';fill:#c8c8c8;fill-opacity:1;stroke-width:0.264583"
          x="40.922894"
          y="53.910057"
          id="text9-5"><tspan
            id="tspan9-5"
            style="stroke-width:0.264583"
            x="40.922894"
            y="53.910057">: {{ boardData.score_bottom < 10 ? ' ' + boardData.score_bottom : boardData.score_bottom }}</tspan></text>
        <path v-if="boardData.first_base"
          style="fill:#cdcd00;fill-opacity:1;stroke-width:0.264583"
          d="m 52.791246,77.482778 c 0.0058,-0.665178 8.824026,-9.330703 9.489205,-9.324894 0.665179,0.0058 9.330704,8.824026 9.324895,9.489205 -0.0058,0.665179 -8.824027,9.330704 -9.489206,9.324895 -0.665179,-0.0058 -9.330704,-8.824027 -9.324894,-9.489206 z"
          transform="matrix(0.42521287,0,0,0.15945483,37.195423,23.713337)" />
        <path v-else
          style="fill:none;fill-opacity:1;stroke:#cdcd00;stroke-width:0.960103;stroke-dasharray:none;stroke-opacity:1"
          d="m 52.791246,77.482778 c 0.0058,-0.665178 8.824026,-9.330703 9.489205,-9.324894 0.665179,0.0058 9.330704,8.824026 9.324895,9.489205 -0.0058,0.665179 -8.824027,9.330704 -9.489206,9.324895 -0.665179,-0.0058 -9.330704,-8.824027 -9.324894,-9.489206 z"
          transform="matrix(0.42521287,0,0,0.15945483,37.195423,23.713337)" />
        <path v-if="boardData.second_base"
          style="fill:#cdcd00;fill-opacity:1;stroke-width:0.264583"
          d="m 52.791246,77.482778 c 0.0058,-0.665178 8.824026,-9.330703 9.489205,-9.324894 0.665179,0.0058 9.330704,8.824026 9.324895,9.489205 -0.0058,0.665179 -8.824027,9.330704 -9.489206,9.324895 -0.665179,-0.0058 -9.330704,-8.824027 -9.324894,-9.489206 z"
          transform="matrix(0.42521287,0,0,0.15945483,31.304235,21.013711)" />
        <path v-else
          style="fill:none;fill-opacity:1;stroke:#cdcd00;stroke-width:0.960103;stroke-dasharray:none;stroke-opacity:1"
          d="m 52.791246,77.482778 c 0.0058,-0.665178 8.824026,-9.330703 9.489205,-9.324894 0.665179,0.0058 9.330704,8.824026 9.324895,9.489205 -0.0058,0.665179 -8.824027,9.330704 -9.489206,9.324895 -0.665179,-0.0058 -9.330704,-8.824027 -9.324894,-9.489206 z"
          transform="matrix(0.42521287,0,0,0.15945483,31.304235,21.013711)" />
        <path v-if="boardData.third_base"
          style="fill:#cdcd00;fill-opacity:1;stroke-width:0.264583"
          d="m 52.791246,77.482778 c 0.0058,-0.665178 8.824026,-9.330703 9.489205,-9.324894 0.665179,0.0058 9.330704,8.824026 9.324895,9.489205 -0.0058,0.665179 -8.824027,9.330704 -9.489206,9.324895 -0.665179,-0.0058 -9.330704,-8.824027 -9.324894,-9.489206 z"
          transform="matrix(0.42521287,0,0,0.15945483,25.041017,23.713336)" />
        <path v-else
          style="fill:none;fill-opacity:1;stroke:#cdcd00;stroke-width:0.960103;stroke-dasharray:none;stroke-opacity:1"
          d="m 52.791246,77.482778 c 0.0058,-0.665178 8.824026,-9.330703 9.489205,-9.324894 0.665179,0.0058 9.330704,8.824026 9.324895,9.489205 -0.0058,0.665179 -8.824027,9.330704 -9.489206,9.324895 -0.665179,-0.0058 -9.330704,-8.824027 -9.324894,-9.489206 z"
          transform="matrix(0.42521287,0,0,0.15945483,25.041017,23.713336)" />
        <text
          xml:space="preserve"
          style="font-style:italic;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:3.88056px;font-family:'Meiryo UI';-inkscape-font-specification:'Meiryo UI Bold Italic';fill:#e5e5e8;fill-opacity:1;stroke-width:0.264583"
          x="51.422126"
          y="44.880337"><tspan
            style="font-style:normal;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:3.88056px;font-family:'Meiryo UI';-inkscape-font-specification:'Meiryo UI Bold';fill:#e5e5e8;fill-opacity:1;stroke-width:0.264583"
            x="51.422126"
            y="44.880337">B</tspan><tspan
            style="font-style:normal;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:3.88056px;font-family:'Meiryo UI';-inkscape-font-specification:'Meiryo UI Bold';fill:#e5e5e8;fill-opacity:1;stroke-width:0.264583"
            x="51.422126"
            y="49.731037">S</tspan><tspan
            style="font-style:normal;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:3.88056px;font-family:'Meiryo UI';-inkscape-font-specification:'Meiryo UI Bold';fill:#e5e5e8;fill-opacity:1;stroke-width:0.264583"
            x="51.422126"
            y="54.581738">O</tspan></text>
        <circle v-show="boardData.strike_cnt >= 1" style="fill:#cdcd00;fill-opacity:1;stroke-width:0.198438" cx="57.413261" cy="48.554428" r="1.5" />
        <circle v-show="boardData.strike_cnt === 2" style="fill:#cdcd00;fill-opacity:1;stroke-width:0.198438" cx="61.810734" cy="48.554428" r="1.5" />
        <circle v-show="boardData.ball_cnt >= 1" style="fill:#01aa01;fill-opacity:1;stroke-width:0.198438" cx="57.413261" cy="43.30896" r="1.5" />
        <circle v-show="boardData.ball_cnt >= 2" style="fill:#01aa01;fill-opacity:1;stroke-width:0.198438" cx="61.810734" cy="43.30896" r="1.5" />
        <circle v-show="boardData.ball_cnt === 3" style="fill:#01aa01;fill-opacity:1;stroke-width:0.198438" cx="66.469948" cy="43.30896" r="1.5" />
        <circle v-show="boardData.out_cnt >= 1" style="fill:#9e0000;fill-opacity:1;stroke-width:0.198438" cx="57.413261" cy="53.494202" r="1.5" />
        <circle v-show="boardData.out_cnt === 2" style="fill:#9e0000;fill-opacity:1;stroke-width:0.198438" cx="61.810734" cy="53.494202" r="1.5" />
        <rect v-show="isPlaying"
          style="fill:#01aa01;fill-opacity:1;stroke-width:0.172333"
          width="1"
          height="7"
          x="21.041811"
          :y="boardData.top ? 40.990444 : 49.477066" />
      </g>
    </svg>
  </div>
  <div class="col-sm">
    <div
      class="align-top badge bg-warning text-dark text-wrap"
      style="width: 11.8rem"
    >
      {{ boardData.game_title }}
    </div>
    <div class="power" :class="poweredByClass">
      Powered by　<img
        src="img/c4s.png"
        alt="Code for SUSONO"
        width="100"
      />
    </div>
  </div>
  `,
  computed: {
    inningMsg() {
      if (!this.boardData || this.boardData.game_inning === undefined)
        return "";
      if (this.boardData.game_inning < 1) {
        return "試合前";
      } else if (this.boardData.game_inning > this.boardData.last_inning) {
        return "試合終了";
      } else {
        return (
          this.boardData.game_inning +
          "回" +
          (this.boardData.top ? "オモテ" : "ウラ")
        );
      }
    },
    isPlaying() {
      if (!this.boardData || this.boardData.game_inning === undefined)
        return false;
      return (
        this.boardData.game_inning >= 1 &&
        this.boardData.game_inning <= this.boardData.last_inning
      );
    },
  },
};

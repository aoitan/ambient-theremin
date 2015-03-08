// DOMContentLoaded is fired once the document has been loaded and parsed,
// but without waiting for other external resources to load (css/images/etc)
// That makes the app more responsive and perceived as faster.
// https://developer.mozilla.org/Web/Reference/Events/DOMContentLoaded
window.addEventListener('DOMContentLoaded', function() {

  // We'll ask the browser to use strict code to help us catch errors earlier.
  // https://developer.mozilla.org/Web/JavaScript/Reference/Functions_and_function_scope/Strict_mode
  'use strict';

  var translate = navigator.mozL10n.get;

  // We want to wait until the localisations library has loaded all the strings.
  // So we'll tell it to let us know once it's ready.
  navigator.mozL10n.once(start);

  // ---

  function start() {

    // We're using textContent because inserting content from external sources into your page using innerHTML can be dangerous.
    // https://developer.mozilla.org/Web/API/Element.innerHTML#Security_considerations

    canvasDraw(INITVOL, INITFREQ);

    var calibrated = calibration(10); // 10秒キャリブレーション(起動時キャリブレーション画面を作るまでの暫定)
    calibrated.then(() => {
      initAudio();
      window.addEventListener('devicelight', changeBrightness);
      window.addEventListener('userproximity', approximation);
      document.addEventListener('touchmove', touchMove);

      updateCanvas();
    });
  }

  var audio = {
    context: null,
    oscillator: null,
    gainNode: null
  }

  var INITFREQ = 3000;
  var INITVOL = 0.001;

  var MAXFREQ = 6000;
  var MAXVOL = 0.02;

  var WIDTH = window.innerWidth;
  var HEIGHT = window.innerHeight;

  var maxBright = null;

  // 音声の初期化
  function initAudio() {
    // Web Audio APIの状態管理オブジェクトを生成
    audio.context = new AudioContext();

    // オシレータとゲインを生成
    audio.oscillator = audio.context.createOscillator();
    audio.gainNode = audio.context.createGain();

    // オシレータとゲインをスピーカにつなぐ
    audio.oscillator.connect(audio.gainNode);
    audio.gainNode.connect(audio.context.destination);

    // オシレータオプションを設定する
    audio.oscillator.type = 'square'; // 矩形波
    audio.oscillator.frequency.value = INITFREQ; // 発振周波数(Hz単位)
    audio.oscillator.detune.value = 100; // デチューン設定(セント単位)
    audio.oscillator.start();

    audio.oscillator.onended = function() {
      console.log('再生停止');
    }

    // ゲインを設定する
    audio.gainNode.gain.value = INITVOL;
  }

  // マウス位置
  var curX;
  var curY;

  // タッチ位置が動いたらタッチ座標からゲインを設定する
  function touchMove(e) {
    curX = e.targetTouches.item(0).screenX;
    curY = e.targetTouches.item(0).screenY;

    audio.gainNode.gain.value = (curY/HEIGHT) * MAXVOL;
    //console.log('cur: ' + curY + ', h: ' + HEIGHT);
  }


  // 明るさが変化したら環境光センサの値からピッチを設定する
  var currentBrightness = -1;
  var smaBrightness = [];
  var NUM_SMASAMPLE = 10;

  function average(array) {
    var sum = 0;
    array.reduce((prev, cur, idx, arr) => {
      sum += cur;
    }, sum);
    return sum / array.length;
  }

  function push(array, val, limit) {
    array.push(val);
    if (array.length > limit) {
      array.shift();
    }
    return array;
  }

  function changeBrightness(e) {
    currentBrightness = e.value;
    if (!maxBright) maxBright = currentBrightness; // フェイルセーフ

    // 最大値は超えない
    if (currentBrightness > maxBright) currentBrightness = maxBright;

    // 直近n回の移動平均を取って周波数を作る
    var ave = average(push(smaBrightness, currentBrightness, NUM_SMASAMPLE));
    audio.oscillator.frequency.value = (ave / maxBright) * MAXFREQ;
    //console.log('light: ' + ave + ', maxBright: ' + maxBright);
  }


  // 近接センサが反応したらミュートする
  function approximation(e) {
    if (e.near) {
      // ミュート
      audio.gainNode.disconnect(audio.context.destination);
    } else {
      // ミュート解除
      audio.gainNode.connect(audio.context.destination);
    }
  }

  // 画面に視覚効果を付ける
  var canvas = document.querySelector('.canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  var canvasCtx = canvas.getContext('2d');

  var curcleSize = WIDTH / 8;

  function fillCircle(x, y, r, g, b) {
    var rC = WIDTH / 8;

    canvasCtx.beginPath();
    canvasCtx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    canvasCtx.arc(x, y, rC / 2, (Math.PI / 180) * 0, (Math.PI / 180) * 360, false);
    canvasCtx.fill();
    canvasCtx.closePath();
    //console.log('r: ' + r + ', g: ' + g + ', b: ' + b);
  }

  function canvasDraw(gain, frequency) {
    console.log('draw start gain: ' + gain + ' , freq: ' + frequency);
    var rC = WIDTH / 8;
    var xloop = 8;
    var yloop = 14;

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.globalAlpha = 0.5;

    for (var i = 1; i < xloop; ++i) {
      for (var j = 1; j < yloop; ++j) {
        var r = 60 + (j * 10);
        var g = Math.floor((frequency / MAXFREQ) * (i / xloop) * 255);
        var b = Math.floor((gain / MAXVOL) * (j / yloop) * 192);
        fillCircle(i * rC, j * rC, r, g, b);
      }
    }
    console.log('draw end');
  }

  function updateCanvas() {
    canvasDraw(audio.gainNode.gain.value, audio.oscillator.frequency.value);
    setTimeout(updateCanvas, 66);
  }


  // キャリブレーション
  function calibration(restSec) {
    function calibLightEvent(e) {
      if (maxBright < e.value) {
        maxBright = e.value;
      }
    }

    return new Promise((resolve) => {
      window.addEventListener('devicelight', calibLightEvent);

      setTimeout(() => { resolve(); }, restSec * 1000);
    }).then(() => {
      window.removeEventListener('devicelight', calibLightEvent);
    });
  }
});

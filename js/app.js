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

    var calibrated = calibration(10); // 10秒キャリブレーション(起動時キャリブレーション画面を作るまでの暫定)
    calibrated.then(() => {
      initAudio();
      window.addEventListener('devicelight', changeBrightness);
      window.addEventListener('userproximity', approximation);
      document.addEventListener('touchmove', touchMove);
    });
  }

  var audio = {
    context: null,
    oscillator: null,
    gain: null
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
    audio.gain = audio.context.createGain();

    // オシレータとゲインをスピーカにつなぐ
    audio.oscillator.connect(audio.gain);
    audio.gain.connect(audio.context.destination);

    // オシレータオプションを設定する
    audio.oscillator.type = 'square';
    audio.oscillator.frequency.value = INITFREQ; // value in hertz
    audio.oscillator.detune.value = 100; // value in cents
    audio.oscillator.start();

    audio.oscillator.onended = function() {
      console.log('Your tone has now stopped playing!');
    }

    // ゲインを設定する
    audio.gain.gain.value = INITVOL;
  }

  // マウス位置
  var CurX;
  var CurY;

  // タッチ位置が動いたらタッチ座標からゲインを設定する
  function touchMove(e) {
    CurX = e.targetTouches.item(0).screenX;
    CurY = e.targetTouches.item(0).screenY;

    audio.gain.gain.value = (CurY/HEIGHT) * MAXVOL;
    //console.log('cur: ' + CurY + ', h: ' + HEIGHT);

    //canvasDraw();
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

    // 直近10回の移動平均を取って周波数を作る
    var ave = average(push(smaBrightness, currentBrightness, NUM_SMASAMPLE));
    audio.oscillator.frequency.value = (ave / maxBright) * MAXFREQ;
    console.log('light: ' + ave + ', maxBright: ' + maxBright);
  }


  // 近接センサが反応したらミュートする
  function approximation(e) {
    if (e.near) {
      // ミュート
      audio.gain.disconnect(audio.context.destination);
    } else {
      // ミュート解除
      audio.gain.connect(audio.context.destination);
    }
  }

  // 画面に視覚効果を付ける
  function random(number1,number2) {
    var randomNo = number1 + (Math.floor(Math.random() * (number2 - number1)) + 1);
    return randomNo;
  }

  var canvas = document.querySelector('.canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT; 

  var canvasCtx = canvas.getContext('2d');

  function canvasDraw() {
    rC = Math.floor((audio.gain.gain.value/MAXVOL)*30);

    canvasCtx.globalAlpha = 0.2;

    for(i=1;i<=15;i=i+2) {
      canvasCtx.beginPath();
      canvasCtx.fillStyle = 'rgb(' + 100+(i*10) + ',' + Math.floor((audio.gain.gain.value/MAXVOL)*255) + ',' + Math.floor((audio.oscillator.frequency.value/MAXFREQ)*255) + ')';
      canvasCtx.arc(CurX+random(0,50),CurY+random(0,50),rC/2+i,(Math.PI/180)*0,(Math.PI/180)*360,false);
      canvasCtx.fill();
      canvasCtx.closePath();
    }
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

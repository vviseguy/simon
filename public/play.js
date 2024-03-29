// Event messages
const GameEndEvent = 'gameEnd';
const GameStartEvent = 'gameStart';

const btnDescriptions = [
    { file: 'sound1.mp3', hue: 120 },
    { file: 'sound2.mp3', hue: 0 },
    { file: 'sound3.mp3', hue: 60 },
    { file: 'sound4.mp3', hue: 240 },
  ];
  
  class Button {
    constructor(description, el) {
      this.el = el;
      this.hue = description.hue;
      this.sound = loadSound(description.file);
      this.paint(25);
    }
  
    paint(level) {
      const background = `hsl(${this.hue}, 100%, ${level}%)`;
      this.el.style.backgroundColor = background;
    }
  
    async press(volume) {
      this.paint(50);
      await this.play(volume);
      this.paint(25);
    }
  
    // Work around Safari's rule to only play sounds if given permission.
    async play(volume = 1.0) {
      this.sound.volume = volume;
      await new Promise((resolve) => {
        this.sound.onended = resolve;
        this.sound.play();
      });
    }
  }
  
  class Game {
    buttons;
    allowPlayer;
    sequence;
    playerPlaybackPos;
    mistakeSound;
    isGameActive;
  
    constructor() {
      this.buttons = new Map();
      this.allowPlayer = false;
      this.sequence = [];
      this.playerPlaybackPos = 0;
      this.mistakeSound = loadSound('error.mp3');
      this.isGameActive = false;
  
      document.querySelectorAll('.gametile').forEach((el, i) => {
        if (i < btnDescriptions.length) {
          this.buttons.set(el.id, new Button(btnDescriptions[i], el));
        }
      });
  
      const playerNameEl = document.querySelector('.player-name');
      playerNameEl.textContent = this.getPlayerName();

      this.configureWebSocket();
    }
  
    async pressButton(button) {
      if (!this.isGameActive) {
        await this.reset();
      }
      else if (this.allowPlayer) {
        await this.buttons.get(button.id).press(1.0);
        this.allowPlayer = false;
        if (this.sequence[this.playerPlaybackPos].el.id === button.id) {
          this.playerPlaybackPos++;
          if (this.playerPlaybackPos === this.sequence.length) {
            this.playerPlaybackPos = 0;
            this.addButton();
            this.updateScore();
            await this.playSequence();
          }
          this.allowPlayer = true;
        } else {
          this.saveScore();
          this.mistakeSound.play();
          await this.buttonDance(1);
          await delay(500);
          this.isGameActive = false;
        }
      }
    }
  
    async reset() {
      this.isGameActive = true;
      this.allowPlayer = false;
      this.playerPlaybackPos = 0;
      this.sequence = [];
      this.updateScore("--");
      await this.buttonDance(2);
      this.addButton();
      this.updateScore();
      await this.playSequence();
      this.allowPlayer = true;

      
      // Let other players know a new game has started
      this.broadcastEvent(this.getPlayerName(), GameStartEvent, {});
    }
  
    getPlayerName() {
      return localStorage.getItem('userName') ?? 'Guest';
    }
  
    async playSequence() {
      await delay(500);
      for (const btn of this.sequence) {
        await btn.press(1.0);
        await delay(100);
      }
    }
  
    addButton() {
      const btn = this.getRandomButton();
      this.sequence.push(btn);
    }
  
    updateScore(score = this.sequence.length - 1) {
      const scoreEl = document.querySelector('#score');
      scoreEl.textContent = (score < 10? "0":"")+score;
    }
  
    async buttonDance(laps = 2) {
      for (let step = 0; step < laps; step++) {
        for (const btn of this.buttons.values()) {
          await btn.press(0.0);
        }
      }
    }
  
    getRandomButton() {
      let buttons = Array.from(this.buttons.values());
      return buttons[Math.floor(Math.random() * this.buttons.size)];
    }
    async saveScore(score = this.sequence.length - 1) {
      if (score < 0 || !this.isGameActive) return;
      const userName = this.getPlayerName();
      const date = new Date().toLocaleDateString();
      const newScore = { name: userName, score: score, date: date };
  
      try {
        const response = await fetch('/api/score', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(newScore),
        });

        // Let other players know the game has concluded
        this.broadcastEvent(userName, GameEndEvent, newScore);
  
        // Store what the service gave us as the high scores
        const scores = await response.json();
        localStorage.setItem('highscores', JSON.stringify(scores));
      } catch {
        // If there was an error then just track scores locally
        this.updateScoresLocal(newScore);
      }
    }
    updateScoresLocal(newScore) {
      let scores = [];
      const scoresText = localStorage.getItem('highscores');
      if (scoresText) {
        scores = JSON.parse(scoresText);
      }
  
      let found = false;
      for (const [i, prevScore] of scores.entries()) {
        if (newScore > prevScore.score) {
          scores.splice(i, 0, newScore);
          found = true;
          break;
        }
      }
  
      if (!found) {
        scores.push(newScore);
      }
  
      if (scores.length > 10) {
        scores.length = 10;
      }
  
      localStorage.setItem('highscores', JSON.stringify(scores));
    }
    updateScores(userName, score, scores) {
      const date = new Date().valueOf();
      const newScore = { name: userName, score: score, date: date };
  
      let found = false;
      for (const [i, prevScore] of scores.entries()) {
        if (score > prevScore.score) {
          scores.splice(i, 0, newScore);
          found = true;
          break;
        }
      }
  
      if (!found) {
        scores.push(newScore);
      }
  
      if (scores.length > 10) {
        scores.length = 10;
      }
  
      return scores;
    }


    // Functionality for peer communication using WebSocket

    configureWebSocket() {
      const protocol = window.location.protocol === 'http:' ? 'ws' : 'wss';
      this.socket = new WebSocket(`${protocol}://${window.location.host}`);
      this.socket.onopen = (event) => {
        this.displayMsg('system', 'game', 'connected');
      };
      this.socket.onclose = (event) => {
        this.displayMsg('system', 'game', 'disconnected');
      };
      this.socket.onmessage = async (event) => {
        const msg = JSON.parse(await event.data.text());
        if (msg.type === GameEndEvent) {
          this.displayMsg('player', msg.from, `scored ${msg.value.score}`);
        } else if (msg.type === GameStartEvent) {
          this.displayMsg('player', msg.from, `started a new game`);
        }
      };
    }

    displayMsg(cls, from, msg) {
      const chatText = document.querySelector('#player-messages');
      chatText.innerHTML =
        `<div class="event"><span class="${cls}-event">${from}</span> ${msg}</div>` + chatText.innerHTML;
    }

    broadcastEvent(from, type, value) {
      const event = {
        from: from,
        type: type,
        value: value,
      };
      this.socket.send(JSON.stringify(event));
    }
  }
  
  const game = new Game();
  
  function delay(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, milliseconds);
    });
  }
  
  function loadSound(filename) {
    return new Audio('assets/' + filename);
  }
  
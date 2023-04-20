async function loadScores() {
  let scores = [];
  try {
    // Get the latest high scores from the service
    const response = await fetch('/api/scores');
    scores = await response.json();

    // Save the scores in case we go offline in the future
    localStorage.setItem('scores', JSON.stringify(scores));
  } catch {
    // If there was an error then just use the last saved scores
    const scoresText = localStorage.getItem('scores');
    if (scoresText) {
      scores = JSON.parse(scoresText);
    }
  }

  displayScores(scores);
}
function displayScores(scores) {
    const tableBodyEl = document.querySelector('#highscores');
  
    if (scores.length) {
      for (const [i, score] of scores.entries()) {
        const positionTdEl = document.createElement('td');
        const nameTdEl = document.createElement('td');
        const scoreTdEl = document.createElement('td');
        const dateTdEl = document.createElement('td');
  
        positionTdEl.textContent = i + 1;
        nameTdEl.textContent = score.name;
        scoreTdEl.textContent = score.score;
        dateTdEl.textContent = parseDate(score.date);
  
        const rowEl = document.createElement('tr');
        rowEl.appendChild(positionTdEl);
        rowEl.appendChild(nameTdEl);
        rowEl.appendChild(scoreTdEl);
        rowEl.appendChild(dateTdEl);
  
        tableBodyEl.appendChild(rowEl);
      }
    } else {
      tableBodyEl.innerHTML = '<tr><td></td><td>Be the first to score!</td><td></td><td></td></tr>';
    }
  }
  
  loadScores();

  function parseDate(date){
    const now = new Date().valueOf();
    const offset = now - date;
    const minutesAgo = Math.floor(offset/1000/60);
    function within(time){
      switch (time){
        case "minute":
          return minutesAgo < 1;
        case "hour":
          return minutesAgo < 60;
        case "day":
          return minutesAgo < 60*24;
        case "2 days":
          return minutesAgo < 24*2;
        default:
          return false;
      }
    }
    switch (true) {
      case within("minute"):
        return "Seconds ago...";
      case within("hour"):
        if (minutesAgo == 1) return "1 minnute ago";
        return minutesAgo +" minutes ago";
      case within("day"):
        return "Today";
      case within("2 days"):
        return "Yesterday";
      default:
        return new Date(date).toDateString();
    }
  }
  
(async () => {
  console.log("on load()");
  const userName = localStorage.getItem('userName');
  if (userName) {
    console.log(document.querySelector('#playerName'));
    document.querySelector('#playerName').textContent = userName;
    setDisplay('signinControls', 'none');
    setDisplay('playControls', 'flex');
  } else {
    setDisplay('signinControls', 'flex');
    setDisplay('playControls', 'none');
  }
})();

async function loginUser() {
  loginOrCreate(`/api/auth/login`);
}

async function createUser() {
  loginOrCreate(`/api/auth/create`);
}

async function loginOrCreate(endpoint) {
  const userName = document.querySelector('#username')?.value;
  const password = document.querySelector('#password')?.value;

  const response = await fetch(endpoint, {
    method: 'post',
    body: JSON.stringify({ email: userName, password: password }),
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  });

  if (response.ok) {
    localStorage.setItem('userName', userName);
    window.location.href = 'play.html';
  } else {
    const body = await response.json();
    alert(`⚠ Error: ${body.msg}`);
  }
}

function play() {
  console.log("play()");
  window.location.href = 'play.html';
}

function logout() {
  localStorage.removeItem('userName');
  fetch(`/api/auth/logout`, {
    method: 'delete',
  }).then(() => (window.location.href = '/'));
}

async function getUser(email) {
  let scores = [];
  // See if we have a user with the given email.
  const response = await fetch(`/api/user/${email}`);
  if (response.status === 200) {
    return response.json();
  }

  return null;
}

function setDisplay(controlId, display) {
  const playControlEl = document.querySelector(`#${controlId}`);
  if (playControlEl) {
    playControlEl.style.display = display;
  }
}

const usernameField = document.getElementById('usernameField');
const passwordField = document.getElementById('passwordField');

function login() {
    const username = usernameField.value;
    const password = passwordField.value;

    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'username': username,
            'password': password
        }),
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.successful) {
            alert('Login successful, token: ' + data.token);
        } else {
            alert(data.error);
        }
    });
}
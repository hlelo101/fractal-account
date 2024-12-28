const usernameField = document.getElementById('usernameField');
const passwordField = document.getElementById('passwordField');

function createAccount() {
    const username = usernameField.value;
    const password = passwordField.value;

    fetch('/register', {
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
            alert('Account created successfully, you will need to then login.');
            window.location.href = '/login';
        } else {
            alert(data.error);
        }
    });
}
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
            document.cookie = `token=${data.token}; path=/; Secure; SameSite=Strict`;
            alert('Login successful, token: ' + data.token + '\nThe token has been saved in the cookies.');
            window.location.href = '/accountsettings';
        } else {
            alert(data.error);
        }
    });
}
const tokenField = document.getElementById('tokenField');

async function checkToken() {
    const token = tokenField.value;

    const response = await (await fetch('/checktoken', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'token': token
        })
    })).json();

    if(response.successful) {
        alert((response.valid) ? 'Token is valid' : 'Token is invalid');
    } else {
        alert('Failed to check token');
    }
}
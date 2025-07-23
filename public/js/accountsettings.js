const profilePicture = document.getElementById('profilePicture');

function getCookie(cookieName) {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(cookieName + '=')) {
            return cookie.substring((cookieName + '=').length);
        }
    }
    
    return null;
}

async function updatePassword() {
    const oldPassword = document.getElementById('changePasswordOldPassword').value;
    const newPassword = document.getElementById('changePasswordNewPassword').value;

    const response = await (await fetch('/updatepassword', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            oldPassword: oldPassword,
            newPassword: newPassword,
            token: getCookie('token')
        })
    })).json();

    alert((!response.successful) ? ('An error occurred while updating the password: ' + response.error) : 'Password successfully updated');
}

async function setUsername() {
    const response = await (await fetch('/getusername', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            token: getCookie('token')
        })
    })).json();

    if(!response.successful) {
        alert('An error occurred while retrieving the username: ' + response.error);
        return;
    } else {
        document.getElementById('username').innerHTML = response.username;
    }
}

async function updateProfilePicture() {
    const response = await (await fetch('/getprofilepicturelink', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            token: getCookie('token')
        })
    })).json();

    if(!response.successful) {
        alert('An error occurred while retrieving the profile picture: ' + response.error);
        return;
    } else {
        profilePicture.src = response.link;
    }
}

document.getElementById('uploadProfilePictureButton').addEventListener('click', () => {
    const file = document.getElementById('profilePictureUpload').files[0];
    const formData = new FormData();
    formData.append('file', file);

    fetch('/uploadprofilepicture', {
        method: 'POST',
        body: formData,
    }).then(response => {
        if(response.status === 200) {
            alert('Profile picture successfully updated. You may need to refresh the page to see the changes.');
            setTimeout(updateProfilePicture, 3000);
        } else {
            alert('An error occurred while updating the profile picture');
        }
    });
});

document.getElementById('vIDNewColor').addEventListener('change', () => {
    const color = document.getElementById('vIDNewColor').value;
    console.log('New color: ', color);
    fetch('/updatevidcolor', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            token: getCookie('token'),
            'color': color
        })
    }).then(async response => {
        const json = await response.json();
        if(response.status !== 200) {
            alert(`An error occurred while updateing the vID color: ${json.error}`);
        }
    })
});

const vidContainer = document.getElementById('vidContainer');
document.getElementById('profilePicture').addEventListener('click', (e) => {
    e.stopPropagation();
    vidContainer.style.display = vidContainer.style.display === 'flex' ? 'none' : 'flex';
});
vidContainer.addEventListener('click', (e) => {
    e.stopPropagation();
});

document.addEventListener('click', () => {
    if(vidContainer.style.display === 'flex') {
        vidContainer.style.display = 'none';
    }
});

async function deleteAccount() {
    const response = await (await fetch('/deleteaccount', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            token: getCookie('token')
        })
    })).json();

    if(!response.successful) {
        alert('An error occurred while deleting the account: ' + response.error);
    } else {
        alert('Account successfully deleted');
        window.location.href = '/login';
    }
}

async function setvIDPath() {
    document.getElementById('vidContainer').style.display = 'none';

    const res = await (await fetch('/getaccountid', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            token: getCookie('token')  
        })
    })).json();
    if(!res.successful) {
        console.error('Could not get vID: ', res.error);
        document.getElementById('vID').innerHTML = '<p>Could not get vID.</p>'
        return;
    }
    document.getElementById('vID').src = `/vid/${res.accountID}`;
}

document.getElementById('profilePictureUpload').addEventListener('change', () => {
    const file = document.getElementById('profilePictureUpload').files[0];

    document.getElementById('profilePictureUploadStatus').innerHTML = file ? file.name + ' selected.' : 'No file selected';
});

setUsername();
updateProfilePicture();
setvIDPath();

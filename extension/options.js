document.addEventListener('DOMContentLoaded', () => {
    const backendUrlInput = document.getElementById('backendUrl');
    const saveButton = document.getElementById('save');
    const statusDiv = document.getElementById('status');
    const defaultBackendUrl = 'https://inigma.idone.su';

    // Load saved backend URL
    chrome.storage.local.get('backendUrl', (result) => {
        backendUrlInput.value = result.backendUrl || defaultBackendUrl;
    });

    // Save backend URL
    saveButton.addEventListener('click', () => {
        const urlToSave = backendUrlInput.value.trim();
        
        // Basic validation: check if it's not empty and looks like an HTTP/S URL
        if (urlToSave && (urlToSave.startsWith('http://') || urlToSave.startsWith('https://'))) {
            chrome.storage.local.set({ backendUrl: urlToSave }, () => {
                statusDiv.textContent = 'Settings saved!';
                statusDiv.style.color = 'green';
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 3000);
            });
        } else {
            statusDiv.textContent = 'Please enter a valid URL (e.g., https://example.com).';
            statusDiv.style.color = 'red';
            setTimeout(() => {
                statusDiv.textContent = '';
            }, 5000);
        }
    });
});

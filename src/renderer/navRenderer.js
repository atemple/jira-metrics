console.log('navRenderer.js loaded');  // Add this line for debugging

const { ipcRenderer } = require('electron');

// Make ipcRenderer available globally
window.ipcRenderer = ipcRenderer;

// Function to navigate to a different page
function navigateTo(page) {
    // Check if the config is complete before navigating
    ipcRenderer.invoke('check-config-complete').then((isConfigComplete) => {
        if (isConfigComplete) {
            console.log('Navigating to:', page);
            window.location.href = page;
        } else {
            console.log('Incomplete config. Redirecting to settings.');
            window.location.href = 'settings.html';
        }
    }).catch(err => {
        console.error('Error checking config status:', err);
        window.location.href = 'settings.html'; // Redirect to settings on error
    });
}

// Attach navigateTo to the window object
// window.navigateTo = navigateTo;

// Export the navigateTo function
module.exports = {
    navigateTo
};
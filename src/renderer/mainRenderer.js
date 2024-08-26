const { ipcRenderer } = require('electron');

// Selectors for navigation links
const linkProject = document.getElementById('link-project');
const linkQuality = document.getElementById('link-quality');

// Content frame
const contentFrame = document.getElementById('content-frame');

// Event listeners to change the src of the iframe based on the clicked link
linkProject.addEventListener('click', () => {
    contentFrame.src = '../views/project.html';  // Load project metrics by default
});

linkQuality.addEventListener('click', () => {
    contentFrame.src = '../views/quality.html';
});

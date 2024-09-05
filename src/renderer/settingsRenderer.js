// Receive and load the config data
window.ipcRenderer.on('load-config', (event, config) => {
    document.getElementById('jiraApiToken').value = config.jiraApiToken || '';
    document.getElementById('jiraEmail').value = config.jiraEmail || '';
    document.getElementById('jiraBaseDomain').value = config.jiraBaseDomain || '';
    document.getElementById('jiraProjectKeys').value = config.jiraProjectKeys || '';

});

// Listen for form submission
document.getElementById('settingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    
    // Get the config option values from the form
    const jiraApiToken = document.getElementById('jiraApiToken').value;
    const jiraEmail = document.getElementById('jiraEmail').value;
    const jiraBaseDomain = document.getElementById('jiraBaseDomain').value;
    const jiraProjectKeys = document.getElementById('jiraProjectKeys').value;

    // Send the config options to the main process to save
    window.ipcRenderer.send('save-config', { jiraApiToken, jiraEmail, jiraBaseDomain, jiraProjectKeys });
});

// Optionally, listen for a confirmation message after saving
window.ipcRenderer.on('config-saved', (event, config) => {
    console.log('Config saved successfully', config);
    // Optionally, update the form fields with the latest config
    document.getElementById('jiraApiToken').value = config.jiraApiToken || '';
    document.getElementById('jiraEmail').value = config.jiraEmail || ''; 
    document.getElementById('jiraBaseDomain').value = config.jiraBaseDomain || '';
    document.getElementById('jiraProjectKeys').value = config.jiraProjectKeys || '';

    ipcRenderer.send('relaunch-app');  // Send message to main process to relaunch
    // window.location.href = 'project.html';
});
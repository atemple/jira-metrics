// Receive and load the config data
window.ipcRenderer.on('load-config', (event, config) => {
    document.getElementById('jiraApiToken').value = config.jiraApiToken || '';
    document.getElementById('jiraEmail').value = config.jiraEmail || '';
    document.getElementById('jiraBaseDomain').value = config.jiraBaseDomain || '';
    document.getElementById('jiraProjectKeys').value = config.jiraProjectKeys || '';

});

// Listen for form submission
document.addEventListener('DOMContentLoaded', () => {
    const saveAndReloadButton = document.getElementById('saveAndReload');
    const saveAndNavigateButton = document.getElementById('saveOnly');

    // Function to get config values from the form
    const getConfigValues = () => {
        return {
            jiraApiToken: document.getElementById('jiraApiToken').value,
            jiraEmail: document.getElementById('jiraEmail').value,
            jiraBaseDomain: document.getElementById('jiraBaseDomain').value,
            jiraProjectKeys: document.getElementById('jiraProjectKeys').value
        };
    };
    
    // Function to handle save config
    const handleSaveConfig = (shouldReload) => {
        const config = getConfigValues();
        window.ipcRenderer.send('save-config', config, shouldReload);
    };

    // Save settings and reload the app
    saveAndReloadButton.addEventListener('click', () => handleSaveConfig(true));

    // Save settings and navigate to project page
    saveAndNavigateButton.addEventListener('click', () => handleSaveConfig(false));
});

// Optionally, listen for a confirmation message after saving
window.ipcRenderer.on('config-saved', (event, config, reload) => {
    console.log('Config saved successfully', config);
    // Optionally, update the form fields with the latest config
    document.getElementById('jiraApiToken').value = config.jiraApiToken || '';
    document.getElementById('jiraEmail').value = config.jiraEmail || ''; 
    document.getElementById('jiraBaseDomain').value = config.jiraBaseDomain || '';
    document.getElementById('jiraProjectKeys').value = config.jiraProjectKeys || '';

    if (reload) {
        ipcRenderer.send('relaunch-app');  // Send message to main process to relaunch the app
    } else {
        window.location.href = 'project.html';
    }    
});
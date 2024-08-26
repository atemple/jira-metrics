// const { contextBridge } = require('electron');

// const Utils = require('../common/utils');
// const { getJiraIssues, getJiraBugs } = require('../common/jiraData');
// const Chart = require('chart.js');

// // Expose the Utils object to the renderer process
// contextBridge.exposeInMainWorld('Utils', Utils);

// // Expose the Chart object to the renderer process
// contextBridge.exposeInMainWorld('Chart', Chart);

// // Expose selected utils functions to the renderer process
// contextBridge.exposeInMainWorld('jiraData', {
//     getJiraIssues: getJiraIssues,
//     getJiraBugs: getJiraBugs
// });
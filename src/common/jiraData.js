const { ipcRenderer } = require('electron');
const axios = require('axios');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./jiraData.db');

db.serialize(() => {
    // db.run(`DROP TABLE IF EXISTS jira_data`, (err) => {
    //     if (err) {
    //         console.error('Error dropping table:', err);
    //     } else {
    //         console.log('Table issues dropped successfully.');
    //     }
    // });
    db.run(`CREATE TABLE IF NOT EXISTS jira_data (
        id TEXT PRIMARY KEY,
        projectKey TEXT,
        dataType TEXT,   -- 'issues' or 'bugs'
        data TEXT,
        updatedAt INTEGER
    )`);
});

// Jira configs
let jiraApiToken;
let jiraEmail;
let jiraBaseDomain;
let jiraProjectKeys;

// Receive and load the config data
ipcRenderer.on('load-config', (event, config) => {
    jiraApiToken = config.jiraApiToken || '';
    jiraEmail = config.jiraEmail || '';
    jiraBaseDomain = config.jiraBaseDomain || '';
    jiraProjectKeys = config.jiraProjectKeys.split(',') || '';
});

// Create an HTTPS agent that allows self-signed certificates
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Fetch issues from Jira
async function fetchAllIssues(projectKey) {
    const maxResults = 100; // Maximum allowed by Jira API
    let startAt = 0;
    let total = 0;
    let allIssues = [];

    const jql = `project IN (${projectKey}) AND ((issuetype IN (Story, Improvement, "New Feature", Refactoring, "Technical Debt", "Technical Task", Bug) AND status CHANGED TO ("READY FOR UAT BUILD", "SIT DONE") during (startOfYear(), 1w) AND status NOT IN (Canceled, Cancelled)) OR (issuetype ="Sub-Bug" AND status CHANGED TO (Done) DURING (startOfYear(), 1w))) ORDER BY resolved ASC`;
    const fields = `issuetype,resolutiondate,created,resolved,priority,summary,status,reporter,customfield_13464,resolution,customfield_13393,customfield_13456,fixVersions,versions,project,customfield_10022,customfield_13230`;

    try {
        do {
            const url = `${jiraBaseDomain}/rest/api/2/search?maxResults=${maxResults}&startAt=${startAt}&expand=changelog&fields=${encodeURIComponent(fields)}&jql=${encodeURIComponent(jql)}`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')}`,
                    'Accept': 'application/json'
                },
                httpsAgent
            });

            const issues = response.data.issues;
            total = response.data.total; // Total number of issues in the result set

            allIssues = allIssues.concat(issues);
            startAt += maxResults; // Move the starting point for the next batch

        } while (startAt < total);

        return allIssues;
    } catch (error) {
        console.error('Error fetching issues:', error);
        return [];
    }
}

// Fetch issues from Jira
async function fetchAllBugs(projectKey) {
    const maxResults = 100; // Maximum allowed by Jira API
    let startAt = 0;
    let total = 0;
    let allIssues = [];

    const jql = `project in (${projectKey}) AND ((issuetype IN (Bug, Sub-Bug) AND status NOT IN (Canceled, Cancelled)) AND ((status NOT IN ("Done", "In Production") AND resolved IS EMPTY) OR created >= startOfYear())) ORDER BY created DESC`;
    const fields = `issuetype,resolutiondate,created,resolved,priority,summary,status,reporter,customfield_13464,resolution,customfield_13393,customfield_13456,fixVersions,versions,project,customfield_10022,customfield_13230`;

    try {
        do {
            const url = `${jiraBaseDomain}/rest/api/2/search?maxResults=${maxResults}&startAt=${startAt}&expand=changelog&fields=${encodeURIComponent(fields)}&jql=${encodeURIComponent(jql)}`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')}`,
                    'Accept': 'application/json'
                },
                httpsAgent
            });

            const issues = response.data.issues;
            total = response.data.total; // Total number of issues in the result set

            allIssues = allIssues.concat(issues);
            startAt += maxResults; // Move the starting point for the next batch

        } while (startAt < total);

        return allIssues;
    } catch (error) {
        console.error('Error fetching issues:', error);
        return [];
    }
}

// Show the loading spinner
function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

// Hide the loading spinner
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// Helper function to get the start of the current day
function getStartOfDayTimestamp() {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set time to midnight
    return now.getTime();
}

// Function to get Jira issues (using caching in the DB)
async function getJiraIssues(projectKey) {
    showLoading();
    const data = await getJiraData(projectKey, 'issues', fetchAllIssues);
    hideLoading();
    return data;
}

// Function to get Jira bugs (using caching in the DB)
async function getJiraBugs(projectKey) {
    showLoading();
    const data = await getJiraData(projectKey, 'bugs', fetchAllBugs);
    hideLoading();
    return data;
}

// Function to fetch Jira data and store it in the database if needed
async function getJiraData(projectKey, dataType, fetchFunction) {
    try {
        const data = new Promise((resolve, reject) => {
            const today = getStartOfDayTimestamp(); // Get timestamp for the start of the current day

            db.get(`SELECT data, updatedAt FROM jira_data WHERE projectKey = ? AND dataType = ?`, [projectKey, dataType], async (err, row) => {
                if (err) return reject(err);

                if (row && row.updatedAt >= today) {
                    // Data is from the current day, return it
                    console.log(`Data for project ${projectKey} (${dataType}) is up-to-date.`);
                    resolve(JSON.parse(row.data));
                } else {
                    // Data is outdated or doesn't exist, fetch fresh data
                    console.log(`Data for project ${projectKey} (${dataType}) is outdated. Fetching new data...`);
                    const data = await fetchFunction(projectKey);
                    const jsonData = JSON.stringify(data);

                    if (row) {
                        // Update existing row
                        db.run(`UPDATE jira_data SET data = ?, updatedAt = ? WHERE projectKey = ? AND dataType = ?`, [
                            jsonData,
                            Date.now(), // Current timestamp
                            projectKey,
                            dataType
                        ], (err) => {
                            if (err) return reject(err);
                            resolve(data);
                        });
                    } else {
                        // Insert new row
                        db.run(`INSERT INTO jira_data (id, projectKey, dataType, data, updatedAt) VALUES (?, ?, ?, ?, ?)`, [
                            `${projectKey}_${dataType}`, // Unique ID by combining projectKey and dataType
                            projectKey,
                            dataType,
                            jsonData,
                            Date.now(), // Current timestamp
                        ], (err) => {
                            if (err) return reject(err);
                            resolve(data);
                        });
                    }
                }
            });

        });

        return data;

    } catch (error) {
        console.error('Error fetching data from database:', error);
        return null;
    } 
}

// Export the cache and preload function
module.exports = {
    getJiraIssues,
    getJiraBugs
};
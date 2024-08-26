require('dotenv').config();
const axios = require('axios');
const https = require('https');

// Cache to store Jira API results by projectKey
const issuesCache = new Map();
const bugsCache = new Map();

// List of project keys to preload
const projectKeys = process.env.JIRA_PROJECT_KEYS.split(',');

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
            const url = `${process.env.JIRA_BASE_URL}/rest/api/2/search?maxResults=${maxResults}&startAt=${startAt}&expand=changelog&fields=${encodeURIComponent(fields)}&jql=${encodeURIComponent(jql)}`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64')}`,
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
            const url = `${process.env.JIRA_BASE_URL}/rest/api/2/search?maxResults=${maxResults}&startAt=${startAt}&expand=changelog&fields=${encodeURIComponent(fields)}&jql=${encodeURIComponent(jql)}`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64')}`,
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

// Function to preload Jira data for multiple projects
async function getJiraBugs(projectKey) {
    try {
        if (! bugsCache.has(projectKey)) {
             showLoading();
             for (const projectKey of projectKeys) {
                 const issues = await fetchAllBugs(projectKey);
                 bugsCache.set(projectKey, issues);
             }
             hideLoading();
         }
         return bugsCache.get(projectKey);
         console.log('Preloaded Jira data for all projects.');
     } catch (error) {
         console.error('Error preloading Jira data:', error);
     }
}

// Function to preload Jira data for multiple projects
async function getJiraIssues(projectKey) {
    try {
       if (! issuesCache.has(projectKey)) {
            showLoading();
            for (const projectKey of projectKeys) {
                const issues = await fetchAllIssues(projectKey);
                issuesCache.set(projectKey, issues);
            }
            hideLoading();
        }
        return issuesCache.get(projectKey);
        console.log('Preloaded Jira data for all projects.');
    } catch (error) {
        console.error('Error preloading Jira data:', error);
    }
}

// Export the cache and preload function
module.exports = {
    getJiraIssues,
    getJiraBugs
};
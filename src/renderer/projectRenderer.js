const Utils = require("../common/utils");
const { getJiraIssues } = require('../common/jiraData');

const chartColors = Utils.CHART_COLORS;
const transparentize = Utils.transparentize;

const year = new Date().getFullYear();
const twoDigitYear = year.toString().slice(-2);

// Get issues by quarter
async function getIssuesByQuarter(allIssues) {
    const quarters = [
        { quarter: 1, start: `${year}-01-01`, end: `${year}-03-31` },
        { quarter: 2, start: `${year}-04-01`, end: `${year}-06-30` },
        { quarter: 3, start: `${year}-07-01`, end: `${year}-09-30` },
        { quarter: 4, start: `${year}-10-01`, end: `${year}-12-31` }
    ];

    // Split the data into quarters
    const processedData = quarters.map(q => {
        const issues = allIssues.filter(issue => {
            const resolutionDate = new Date(issue.fields.resolutiondate);
            return resolutionDate >= new Date(q.start) && resolutionDate <= new Date(q.end);
        });

        const finishedIssues = issues.filter(issue => issue.fields.issuetype.name !== 'Bug').length;
        const resolvedBugs = issues.filter(issue => issue.fields.issuetype.name === 'Bug').length;
        const totalIssues = issues.length;

        const bugDensity = totalIssues > 0 ? ((resolvedBugs / totalIssues) * 100).toFixed(2) : 0;

        // Calculate velocity (sum of story points)
        const velocity = Math.round(issues.reduce((sum, issue) => {
            const storyPoints = issue.fields.customfield_10022;
            return sum + (storyPoints ? Number(storyPoints) : 0);
        }, 0) / 3);
        
        // Throughput is simply the total issues completed in the quarter
        const throughput = totalIssues;
 
        // Calculate cycle time for all issues
        const totalCycleTime = calculateCycleTimeForAllIssues(issues);
        const cycleTime = calculateAverageCycleTime(totalCycleTime);

        return {
            finishedIssues,
            resolvedBugs,
            bugDensity,
            totalIssues,
            velocity,
            throughput,
            cycleTime
        };
    });

    return { quarters, quarterlyData: processedData };
}

async function getIssuesByMonth(issues) {
    const monthsLabels = [
        'January', 'February', 'March',
        'April', 'May', 'June',
        'July', 'August', 'September',
        'October', 'November', 'December'
    ];
    const finishedIssuesMonthly = [];
    const resolvedBugsMonthly = [];
    const velocitiesMonthly = [];
    const throughputsMonthly = [];
    const cycleTimessMonthly = [];

    const monthlyIssues = {};
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const date = startDate;

    // Initialize the months object with each month in the quarter
    while (date <= endDate) {
        const monthKey = date.getMonth();
        if (!monthlyIssues[monthKey]) {
            monthlyIssues[monthKey] = {
                finishedIssues: 0,
                resolvedBugs: 0,
                velocity: 0,
                throughput: 0,
                cycleTime: 0
            };
        }
        date.setMonth(date.getMonth() + 1);
    }

    // Process each issue and categorize it by the resolution month
    issues.forEach(issue => {
        const resolutionDate = new Date(issue.fields.resolutiondate);
        const monthKey = resolutionDate.getMonth();
        const yearKey = resolutionDate.getFullYear();

        if (yearKey >= year && monthlyIssues[monthKey]) {
            if (issue.fields.issuetype.name !== 'Bug') {
                monthlyIssues[monthKey].finishedIssues += 1;
            } else {
                monthlyIssues[monthKey].resolvedBugs += 1;
            }
            monthlyIssues[monthKey].velocity += issue.fields.customfield_10022 || 0;
            monthlyIssues[monthKey].throughput += 1;

            const cycleTime = monthlyIssues[monthKey].cycleTime;
            const calculatedCycleTime = calculateCycleTime(issue);
            if (calculatedCycleTime) {
                monthlyIssues[monthKey].cycleTime = Math.ceil(cycleTime ? (cycleTime + calculatedCycleTime) / 2 : calculatedCycleTime);
            }
        }

    });

    Object.values(monthlyIssues).forEach(monthData => {
        finishedIssuesMonthly.push(monthData.finishedIssues);
        resolvedBugsMonthly.push(monthData.resolvedBugs);
        velocitiesMonthly.push(monthData.velocity);
        throughputsMonthly.push(monthData.throughput);
        cycleTimessMonthly.push(monthData.cycleTime);

    });

    return {
        labels: monthsLabels,
        finishedIssues: finishedIssuesMonthly,
        resolvedBugs: resolvedBugsMonthly,
        velocities: velocitiesMonthly,
        throughputs: throughputsMonthly,
        cycleTimes: cycleTimessMonthly
    };
}

// Function to calculate cycle time for all issues
function calculateCycleTimeForAllIssues(issues) {
    const cycleTimeMap = {};

    issues.forEach(issue => {
        cycleTimeMap[issue.key] = calculateCycleTime(issue);
    });

    return cycleTimeMap;
}

// Function to calculate cycle time for an issue
function calculateCycleTime(issue) {
    const changelog = issue.changelog;
    let inProgressTime = null;
    let doneTime = null;

    changelog.histories.forEach(history => {
        history.items.forEach(item => {
            if (item.field === 'status') {
                if (item.toString.toUpperCase() === 'IN DEVELOPMENT') {
                    inProgressTime = new Date(history.created);
                } else if ((item.toString.toUpperCase() === 'DONE' || item.toString.toUpperCase() === 'READY FOR PROD')) {
                    doneTime = new Date(history.created);
                }
            }
        });
    });

    if (inProgressTime && doneTime) {
        const timeDiff = Math.abs(doneTime.getTime() - inProgressTime.getTime());
        const cycleTime = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
        // const cycleTime = (doneTime.getTime() - inProgressTime.getTime()) / (1000 * 60 * 60 * 24); // Cycle time in days
        return cycleTime;
    } else {
        return null; // No valid cycle time found
    }
}

function calculateAverageCycleTime(cycleTimeMap) {
    const cycleTimes = Object.values(cycleTimeMap).filter(time => time !== null);
    const totalCycleTime = cycleTimes.reduce((total, time) => total + time, 0);
    const averageCycleTime = cycleTimes.length > 0 ? totalCycleTime / cycleTimes.length : 0;

    return Math.ceil(averageCycleTime);
}

function updateUI(quarters, quarterData, montlyData) {
    // Prepare labels and data for the table (quarterly)
    const quarterLabels = quarters.map(q => `Q${q.quarter}/${twoDigitYear}`);
    const finishedIssuesQuarterly = quarterData.map(data => data.finishedIssues);
    const resolvedBugsQuarterly = quarterData.map(data => data.resolvedBugs);
    const bugDensityQuarterly = quarterData.map(data => data.bugDensity);
    const velocitiesQuarterly = quarterData.map(data => data.velocity);
    const throughputsQuarterly = quarterData.map(data => data.throughput);
    const cycleTimeQuarterly = quarterData.map(data => data.cycleTime);


    // Update the table with quarterly data
    updateTable(quarterLabels, finishedIssuesQuarterly, resolvedBugsQuarterly, bugDensityQuarterly, velocitiesQuarterly, throughputsQuarterly, cycleTimeQuarterly);

    // Update the chart with monthly data
    updateChart(montlyData.labels, montlyData.finishedIssues, montlyData.resolvedBugs, montlyData.velocities, montlyData.throughputs, montlyData.cycleTimes);
}

function updateTable(labels, finishedIssues, resolvedBugs, bugDensities, velocities, throughputs, cycleTimes) {
    const tableBody = document.getElementById('issuesTableBody');
    tableBody.innerHTML = ''; // Clear the existing table content

    labels.forEach((label, index) => {
        const row = document.createElement('tr');

        const quarterCell = document.createElement('td');
        quarterCell.textContent = label;
        row.appendChild(quarterCell);

        const throughputCell = document.createElement('td');
        throughputCell.textContent = throughputs[index];
        row.appendChild(throughputCell);

        const velocityCell = document.createElement('td');
        velocityCell.textContent = velocities[index];
        row.appendChild(velocityCell);

        const cycleTimeCell = document.createElement('td');
        cycleTimeCell.textContent = cycleTimes[index];
        row.appendChild(cycleTimeCell);

        const bugDensitiesCell = document.createElement('td');
        bugDensitiesCell.textContent = bugDensities[index];
        row.appendChild(bugDensitiesCell);

        tableBody.appendChild(row);
    });
}

function updateChart(labels, finishedIssues, resolvedBugs, velocities, throughputs, cycleTimes) {
    const ctx = document.getElementById('issuesChart').getContext('2d');

    if (window.myChart) {
        window.myChart.destroy(); // Destroy the existing chart instance
    }

    window.myChart = new Chart(ctx, {
        type: 'bar', // Base type is bar for stacked bars
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Throughput',
                    data: throughputs,
                    type: 'line', // Specify line chart for throughput
                    borderColor: chartColors.blue,
                    backgroundColor: transparentize(chartColors.blue, 0.5),
                    borderWidth: 2,
                    fill: false,
                },
                {
                    label: 'Velocity',
                    data: velocities,
                    type: 'line', // Specify line chart for velocity
                    borderColor: chartColors.orange,
                    backgroundColor: transparentize(chartColors.orange, 0.5),
                    borderWidth: 2,
                    fill: false,
                },
                {
                    label: 'Cycle Time',
                    data: cycleTimes,
                    type: 'line', // Specify line chart for velocity
                    borderColor: chartColors.yellow,
                    backgroundColor: transparentize(chartColors.yellow, 0.5),
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'cycleTimeAxis'
                },
                {
                    label: 'Issues Done',
                    data: finishedIssues,
                    borderColor: chartColors.green,
                    backgroundColor: transparentize(chartColors.green, 0.5),
                    borderWidth: 2,
                    stack: 'combined'
                },
                {
                    label: 'Bugs Fixed',
                    data: resolvedBugs,
                    borderColor: chartColors.red,
                    backgroundColor: transparentize(chartColors.red, 0.5),
                    borderWidth: 2,
                    stack: 'combined'
                },
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: true // Enable stacking for the bar chart
                },
                cycleTimeAxis: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'days'
                    },
                }
            },
            responsive: true,
            plugins: {
                legend: {
                    display: true
                }
            }
        }
    });
}

// Handle project selection change
async function handleProjectChange() {
    const projectKey = document.getElementById('projectSelect').value;

    if (projectKey) {
        const allIssues = await getJiraIssues(projectKey);
        const { quarters, quarterlyData } = await getIssuesByQuarter(allIssues);
        const montlyData = await getIssuesByMonth(allIssues);

        updateUI(quarters, quarterlyData, montlyData);
    } else {
        console.error('Please select a project.');
    }
}

// Receive and load the config data
ipcRenderer.on('load-config', (event, config) => {
    const projectSelect = document.getElementById('projectSelect');
    const projectKeys = config.jiraProjectKeys.split(',') || '';

    // Dynamically populate the select element with options
    projectKeys.forEach((projectKey) => {
        const option = document.createElement('option');
        option.value = projectKey.trim(); // Set the value as projectKey
        option.text = projectKey.trim(); // Set the displayed text as projectKey
        projectSelect.appendChild(option); // Append the option to the select element
    });
});

// Add event listener for project selection change
document.getElementById('projectSelect').addEventListener('change', handleProjectChange);

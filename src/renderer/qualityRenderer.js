const Utils = require("../common/utils");
const { getJiraBugs } = require('../common/jiraData');

const chartColors = Utils.CHART_COLORS;
const transparentize = Utils.transparentize;

const year = new Date().getFullYear();
const twoDigitYear = year.toString().slice(-2);

// Function to calculate quality metrics
async function getBugsByQuarter(allIssues) {
    const quarters = [
        { quarter: 1, start: `${year}-01-01`, end: `${year}-03-31` },
        { quarter: 2, start: `${year}-04-01`, end: `${year}-06-30` },
        { quarter: 3, start: `${year}-07-01`, end: `${year}-09-30` },
        { quarter: 4, start: `${year}-10-01`, end: `${year}-12-31` }
    ];

    // Split the data into quarters
    const quarterlyData = quarters.map(q => {
        const solvedIssues = allIssues.filter(issue => {
            const resolutionDate = new Date(issue.fields.resolutiondate);
            return resolutionDate >= new Date(q.start) && resolutionDate <= new Date(q.end);
        });

        const bugsReported = allIssues.filter(issue => {
            const createdDate = new Date(issue.fields.created);
            return createdDate >= new Date(q.start) && createdDate <= new Date(q.end);
        }).length;
        const bugsFixed = solvedIssues.filter(issue => {
            return issue.fields.status.name === 'Done' || issue.fields.status.name === 'In Production';
        }).length;
        const bugsEscaped = solvedIssues.filter(issue => {
            const environment = issue.fields.customfield_13464;
            return (Array.isArray(environment)) && environment.some(field => (field.value === 'UAT' || field.value === 'PROD'));
        }).length;
        const bugsProd = solvedIssues.filter(issue => {
            const environment = issue.fields.customfield_13464;
            return (Array.isArray(environment)) && environment.some(field => field.value === 'PROD');
        }).length;

        return {
            bugsReported,
            bugsFixed,
            bugsEscaped,
            bugsProd
        };
    });

    return { quarters, quarterlyData };
}

async function getBugsByMonth(allIssues) {
    const monthsLabels = [
        'January', 'February', 'March',
        'April', 'May', 'June',
        'July', 'August', 'September',
        'October', 'November', 'December'
    ];
    const bugsReportedMonthly = [];
    const bugsFixedMonthly = [];
    const bugsEscapedMonthly = [];
    const bugsProdMonthly = [];

    const monthlyIssues = {};
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const date = startDate;

    // Initialize the months object with each month in the quarter
    while (date <= endDate) {
        const monthKey = date.getMonth();
        if (!monthlyIssues[monthKey]) {
            monthlyIssues[monthKey] = {
                bugsReported: 0,
                bugsFixed: 0,
                bugsEscaped: 0,
                bugsProd: 0
            };
        }
        date.setMonth(date.getMonth() + 1);
    }

    // Process each issue and categorize it by the resolution month
    allIssues.forEach(issue => {
        const createdDate = new Date(issue.fields.created);
        const createdMonthKey = createdDate.getMonth();
        const createdYearKey = createdDate.getFullYear();
    
        const resolutionDate = new Date(issue.fields.resolutiondate);
        const resolutionMonthKey = resolutionDate.getMonth();
        const resolutionYearKey = resolutionDate.getFullYear();

        if (createdYearKey >= year && monthlyIssues[createdMonthKey]) {
            monthlyIssues[createdMonthKey].bugsReported++;
        }

        if (resolutionYearKey >= year && monthlyIssues[resolutionMonthKey]) {
            if (issue.fields.resolution) monthlyIssues[resolutionMonthKey].bugsFixed++;

            const environment = issue.fields.customfield_13464;
            if (Array.isArray(environment) && environment.some(field => (field.value === 'UAT' || field.value === 'PROD'))) monthlyIssues[resolutionMonthKey].bugsEscaped++;
            if (Array.isArray(environment) && environment.some(field => field.value === 'PROD')) monthlyIssues[resolutionMonthKey].bugsProd++;
        }

    });

    Object.values(monthlyIssues).forEach(monthData => {
        bugsReportedMonthly.push(monthData.bugsReported);
        bugsFixedMonthly.push(monthData.bugsFixed);
        bugsEscapedMonthly.push(monthData.bugsEscaped);
        bugsProdMonthly.push(monthData.bugsProd);
    });

    return {
        labels: monthsLabels,
        bugsReported: bugsReportedMonthly,
        bugsFixed: bugsFixedMonthly,
        bugsEscaped: bugsEscapedMonthly,
        bugsProd: bugsProdMonthly
    };
}

function updateUI(quarters, quarterlyData, montlyData) {

    updateTable(quarters, quarterlyData);

    updateChart(montlyData);
}

// Function to update the quality metrics table
function updateTable(quarters, quarterlyData) {
    const quarterLabels = quarters.map(q => `Q${q.quarter}/${twoDigitYear}`);
    const bugsReportedQuarterly = quarterlyData.map(data => data.bugsReported);
    const bugsFixedQuarterly = quarterlyData.map(data => data.bugsFixed);
    const bugsEscapedQuarterly = quarterlyData.map(data => data.bugsEscaped);
    const bugsProdQuarterly = quarterlyData.map(data => data.bugsProd);

    const tableBody = document.getElementById('issuesTableBody');
    tableBody.innerHTML = ''; // Clear the existing table content
    
    quarterLabels.forEach((label, index) => {
        const row = document.createElement('tr');

        const quarterCell = document.createElement('td');
        quarterCell.textContent = label;
        row.appendChild(quarterCell);

        const bugsReportedCell = document.createElement('td');
        bugsReportedCell.textContent = bugsReportedQuarterly[index];
        row.appendChild(bugsReportedCell);

        const bugsFixedCell = document.createElement('td');
        bugsFixedCell.textContent = bugsFixedQuarterly[index];
        row.appendChild(bugsFixedCell);

        const bugsEscapedCell = document.createElement('td');
        bugsEscapedCell.textContent = bugsEscapedQuarterly[index];
        row.appendChild(bugsEscapedCell);

        const bugsProdCell = document.createElement('td');
        bugsProdCell.textContent = bugsProdQuarterly[index];
        row.appendChild(bugsProdCell);

        tableBody.appendChild(row);

    });

}

// Function to update the chart
function updateChart(bugMetrics) {
    const ctx = document.getElementById('bugChart').getContext('2d');
    
    const labels = bugMetrics.labels;
    const bugsReported = bugMetrics.bugsReported;
    const bugsFixed = bugMetrics.bugsFixed;
    const bugsEscaped = bugMetrics.bugsEscaped; // Default to 0 if undefined
    const bugsProd = bugMetrics.bugsProd; // Default to 0 if undefined

    if (window.myChart) {
        window.myChart.destroy(); // Destroy the existing chart instance
    }

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Bugs Reported',
                    data: bugsReported,
                    borderColor: chartColors.red,
                    backgroundColor: transparentize(chartColors.red, 0.5),
                    borderWidth: 2,
                },
                {
                    label: 'Bugs Fixed',
                    data: bugsFixed,
                    borderColor: chartColors.green,
                    backgroundColor: transparentize(chartColors.green, 0.5),                    
                    borderWidth: 2,
                },
                {
                    label: 'Bugs in Prod',
                    data: bugsProd,
                    borderColor: chartColors.purple,
                    backgroundColor: transparentize(chartColors.purple, 0.5),
                    borderWidth: 2,
                    stack: 'combined',
                },
                {
                    label: 'Bugs Escaped',
                    data: bugsEscaped,
                    borderColor: chartColors.orange,
                    backgroundColor: transparentize(chartColors.orange, 0.5),
                    borderWidth: 2,
                    stack: 'combined',
                }
            ],
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: false
                }
            }
        }
    });
}

// Handle project selection change
async function handleProjectChange() {
    const projectKey = document.getElementById('projectSelect').value;

    if (projectKey) {
        const allIssues = await getJiraBugs(projectKey);
        const { quarters, quarterlyData } = await getBugsByQuarter(allIssues);
        const montlyData = await getBugsByMonth(allIssues);

        updateUI(quarters, quarterlyData, montlyData);
    } else {
        console.error('Please select a project.');
    }
}

// Function to navigate to a different page
function navigateTo(page) {
    console.log('Navigating to:', page);
    window.location.href = page;
}

// Add event listener for project selection change
document.getElementById('projectSelect').addEventListener('change', handleProjectChange);

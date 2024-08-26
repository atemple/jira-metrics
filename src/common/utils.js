const Utils = {
    // Predefined color set similar to those commonly used in examples
    CHART_COLORS: {
        red: 'rgb(255, 99, 132)',
        orange: 'rgb(255, 159, 64)',
        yellow: 'rgb(255, 205, 86)',
        green: 'rgb(75, 192, 192)',
        blue: 'rgb(54, 162, 235)',
        purple: 'rgb(153, 102, 255)',
        grey: 'rgb(201, 203, 207)'
    },

    // Transparentize function for color manipulation
    transparentize: function(color, opacity) {
        const alpha = opacity === undefined ? 0.5 : 1 - opacity;
        return Chart.helpers.color(color).alpha(alpha).rgbString();
    }
};


// Export the cache and preload function
module.exports = Utils;

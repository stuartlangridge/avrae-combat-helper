var colors = require('mocha/lib/reporters/base').colors;
for (var k in colors) { if (colors[k] == 90) colors[k] = 94; }
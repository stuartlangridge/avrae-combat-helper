let {colors} = require('mocha/lib/reporters/base');
for (var k in colors) { if (colors[k] == 90) colors[k] = 94; }
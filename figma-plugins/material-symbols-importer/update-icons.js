// Refreshes icon-names.json from Google's canonical Material Symbols
// codepoints file, so the icon list stays current as Google adds icons.
// Run: node update-icons.js && node build.js
var fs = require('fs');
var https = require('https');
var path = require('path');

var URL = 'https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL,GRAD,opsz,wght%5D.codepoints';

https.get(URL, function (res) {
  if (res.statusCode !== 200) {
    console.error('Failed to fetch codepoints file: HTTP ' + res.statusCode);
    process.exit(1);
  }
  var body = '';
  res.on('data', function (chunk) { body += chunk; });
  res.on('end', function () {
    var names = Array.from(new Set(
      body.split('\n')
        .map(function (line) { return line.trim().split(/\s+/)[0]; })
        .filter(Boolean)
    )).sort();
    fs.writeFileSync(path.join(__dirname, 'icon-names.json'), JSON.stringify(names));
    console.log('Wrote icon-names.json with ' + names.length + ' icons. Run `node build.js` next.');
  });
}).on('error', function (err) {
  console.error(err);
  process.exit(1);
});

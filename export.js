var GourmettaParser = require("./dist").default;
const commandLineArgs = require('command-line-args')

const optionDefinitions = [
    { name: 'username', type: String },
    { name: 'password', type: String },
    { name: 'file', type: String, defaultValue: `gourmetta-export-${new Date().toLocaleDateString().replace(/\//g,'_')}.xlsx` },
]

const {username, password, file} = commandLineArgs(optionDefinitions)

if (!username || !password) {
    throw new Error('No credentials given')
}

const parser = new GourmettaParser({username, password});

parser.fetch().then((res) => {
    const xlsx = parser.generateExcel(res,file )
    console.log('Successfully saved',file);
})


/*
var fs = require('fs');
fs.readFile('./index.htm', 'utf8', function(err, data) {
    if (err) throw err;

    // console.log(parser.parseWeek(data));
    // console.log(parser.parseSelection(data));

});
*/





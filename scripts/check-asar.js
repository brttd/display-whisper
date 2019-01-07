const fs = require('fs')

if (!fs.existsSync('app/app.asar')) {
    require('child_process').exec(
        'npm run asar',
        {
            cwd: process.cwd()
        },
        (error, stdout, stderr) => {
            if (error) {
                throw error
            }
            if (stderr) {
                throw stderr
            }
        }
    )
}

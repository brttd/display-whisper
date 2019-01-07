const fs = require('fs')
const path = require('path')

const licenseChecker = require('license-checker')

const customPath = path.join(process.cwd(), 'scripts/licenses_custom.json')

const ignore = [
    'dw-color',
    'dw-database',
    'dw-editor',
    'dw-files',
    'dw-items',
    'dw-keyboard',
    'dw-layout',
    'dw-log',
    'dw-rich-text',
    'display-whisper'
]

function getLicenses(source, callback) {
    if (typeof callback !== 'function') {
        return false
    }

    licenseChecker.init(
        {
            start: source,
            customPath: customPath
        },
        (error, licenses) => {
            if (error) {
                return callback(error)
            }

            let modified = []

            for (let module in licenses) {
                if (
                    licenses.hasOwnProperty(module) &&
                    !ignore.includes(module)
                ) {
                    if (!ignore.includes(licenses[module].name)) {
                        modified.push({
                            name: licenses[module].name,
                            version: licenses[module].version,
                            publisher: licenses[module].publisher,
                            licenses: licenses[module].licenses,
                            repository: licenses[module].repository,
                            url: licenses[module].url,
                            licenseText: licenses[module].licenseText
                        })
                    }
                }
            }

            return callback(null, modified)
        }
    )
}

getLicenses(process.cwd(), (error, mainLicenses) => {
    if (error) {
        return console.error(error)
    }

    getLicenses(path.join(process.cwd(), 'app'), (error, appLicenses) => {
        if (error) {
            return console.error(error)
        }

        let all = mainLicenses.concat(appLicenses)

        fs.writeFile(
            path.join(process.cwd(), '/app/', 'licenses.json'),
            JSON.stringify(all),
            error => {
                if (error) {
                    return console.error(error)
                }

                console.log('Finished!')
            }
        )
    })
})

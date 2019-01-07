const fs = require('fs')
const path = require('path')
const child_process = require('child_process')
const rmdir = require('rimraf')
const ncp = require('ncp')
const packager = require('electron-packager')

const packageDir = 'package'
const outDir = 'build'

const packageCopyList = [
    'app.asar',
    'main.js',
    'package.json',
    'node_modules',
    'icons'
]

function execCommand(command, dir, callback = () => {}) {
    child_process.exec(
        command,
        {
            cwd: path.join(process.cwd(), dir)
        },
        error => {
            if (error) {
                return callback(error)
            }

            callback(null)
        }
    )
}

function clearDirs(dirList, callback = () => {}) {
    if (dirList.length === 0) {
        return callback(null)
    }

    let dir = dirList.pop()

    rmdir(dir, error => {
        if (error) {
            return callback(error)
        }

        fs.mkdir(dir, error => {
            if (error) {
                return callback(error)
            }

            clearDirs(dirList, callback)
        })
    })
}

function copyFrom(source, list, destination, callback = () => {}) {
    if (list.length === 0) {
        return callback(null)
    }

    let file = list.pop()

    fs.stat(path.join(source, file), (error, stats) => {
        if (error) {
            return callback(error)
        }

        if (stats.isDirectory()) {
            ncp(
                path.join(source, file),
                path.join(destination, file),
                {
                    dereference: true
                },
                error => {
                    if (error) {
                        return callback(error)
                    }

                    copyFrom(source, list, destination, callback)
                }
            )
        } else if (stats.isFile()) {
            fs.copyFile(
                path.join(source, file),
                path.join(destination, file),
                error => {
                    if (error) {
                        return callback(error)
                    }

                    copyFrom(source, list, destination, callback)
                }
            )
        } else {
            copyFrom(source, list, destination, callback)
        }
    })
}

function getJson(file, callback = () => {}) {
    fs.readFile(file, 'utf8', (error, data) => {
        if (error) {
            return callback(error)
        }

        try {
            data = JSON.parse(data)

            callback(null, data)
        } catch (error) {
            callback(error)
        }
    })
}

console.log('Running license script...')
execCommand('npm run update-licenses', '', error => {
    if (error) {
        return console.error(error)
    }

    console.log('Running asar script...')
    execCommand('npm run asar', '', error => {
        if (error) {
            return console.error(error)
        }

        console.log('Setting up packaging directories...')
        clearDirs([outDir, packageDir, 'app/node_modules'], error => {
            if (error) {
                return console.error(error)
            }

            console.log('Installing app node modules...')
            execCommand('npm install --production', 'app', error => {
                if (error) {
                    return console.error(error)
                }

                console.log('Creating packaging directory...')
                copyFrom('app', packageCopyList, packageDir, error => {
                    if (error) {
                        return console.error(error)
                    }

                    getJson('app/package.json', (error, app) => {
                        packager(
                            {
                                dir: packageDir,
                                icon: path.join(packageDir, app.icon),
                                out: outDir,
                                overwrite: true,
                                prune: false
                            },
                            error => {
                                if (error) {
                                    return console.error(error)
                                }

                                rmdir(packageDir, error => {
                                    if (error) {
                                        return console.error(error)
                                    }

                                    console.log('Finished')
                                })
                            }
                        )
                    })
                })
            })
        })
    })
})

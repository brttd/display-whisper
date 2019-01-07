const fs = require('fs')
const path = require('path')
const child_process = require('child_process')
const rmdir = require('rimraf')
const ncp = require('ncp')
const packager = require('electron-packager')
const archiver = require('archiver')

const packageDir = 'package'
const outDir = 'out'

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

function zipFolder(folder, destination, callback = () => {}) {
    let output = fs.createWriteStream(destination)

    let archive = archiver('zip', {
        zlib: { level: 9 }
    })

    output.on('close', () => {
        callback(null)
    })
    output.on('end', () => {})
    archive.on('warning', error => {
        console.warn(error)
    })
    archive.on('error', error => {
        callback(error)
    })

    archive.pipe(output)

    archive.directory(folder, false)

    archive.finalize()
}

function zipAll(folder, destination, callback = () => {}) {
    fs.readdir(folder, (error, list) => {
        if (error) {
            return callback(error)
        }

        let zipNext = () => {
            if (list.length === 0) {
                return callback(null)
            }

            let dir = list.pop()

            fs.stat(path.join(folder, dir), (error, stats) => {
                if (error) {
                    return callback(error)
                }

                if (stats.isDirectory()) {
                    zipFolder(
                        path.join(folder, dir),
                        path.join(destination, dir + '.zip'),
                        error => {
                            if (error) {
                                return callback(error)
                            }

                            zipNext()
                        }
                    )
                } else {
                    zipNext()
                }
            })
        }

        zipNext()
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

function moveToBuilds(source, version, callback = () => {}) {
    execCommand('git checkout builds', '', error => {
        if (error) {
            return callback(error)
        }

        clearDirs([version, 'latest'], error => {
            if (error) {
                return callback(error)
            }

            zipAll(source, version, error => {
                if (error) {
                    return callback(error)
                }

                ncp(version, 'latest', error => {
                    if (error) {
                        return callback(error)
                    }

                    fs.writeFile(
                        'latest/info.json',
                        JSON.stringify({ version: version }),
                        error => {
                            if (error) {
                                return callback(error)
                            }

                            callback(null)
                        }
                    )
                })
            })
        })
    })
}

console.log('Pulling...')
execCommand('git pull', '', error => {
    if (error) {
        return console.error(error)
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

                    copyFrom('app', packageCopyList, packageDir, error => {
                        if (error) {
                            return console.error(error)
                        }

                        getJson('app/package.json', (error, app) => {
                            packager(
                                {
                                    dir: packageDir,
                                    arch: 'x64',
                                    icon: path.join(packageDir, app.icon),
                                    out: outDir,
                                    overwrite: true,
                                    platform: 'win32,darwin',
                                    prune: false
                                },
                                error => {
                                    if (error) {
                                        return console.error(error)
                                    }

                                    console.log(
                                        'Zipping and moving to builds branch...'
                                    )
                                    moveToBuilds(outDir, app.version, error => {
                                        if (error) {
                                            return console.error(error)
                                        }

                                        console.log('finished')
                                    })
                                }
                            )
                        })
                    })
                })
            })
        })
    })
})

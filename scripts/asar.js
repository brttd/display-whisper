const fs = require('fs')
const path = require('path')
const child_process = require('child_process')
const asar = require('asar')
const rmdir = require('rimraf')
const ncp = require('ncp')

let unpack_glob =
    '*(README.m*|readme.m*|LICENSE|license|LICENSE.m*|CHANGELOG|changelog|CHANGELOG.md|.jshintrc*|.npm*|.travis.yml|.eslintrc|app.asar)'
let unpack_dirs = '{custom_modules,app.asar.unpacked}'

let baseDir = process.cwd()

function createNormalNodeModules(callback = () => {}) {
    rmdir(path.join(baseDir, 'app/node_modules'), error => {
        if (error) {
            return callback(error)
        }

        child_process.exec(
            'npm install',
            {
                cwd: path.join(baseDir, '/app')
            },
            error => {
                if (error) {
                    return callback(error)
                }
                callback(null)
            }
        )
    })
}

function replaceSymLinks(directory, callback = () => {}) {
    fs.readdir(path.join(baseDir, directory), (error, list) => {
        if (error) {
            return callback(error)
        }

        let checkNext = () => {
            if (list.length === 0) {
                return callback(null)
            }

            let file = list.pop()

            fs.lstat(path.join(baseDir, directory, file), (error, stats) => {
                if (error) {
                    return callback(error)
                }

                if (stats.isSymbolicLink()) {
                    fs.readlink(
                        path.join(baseDir, directory, file),
                        (error, link) => {
                            if (error) {
                                return callback(error)
                            }

                            if (!path.isAbsolute(link)) {
                                link = path.join(baseDir, directory, link)
                            }

                            fs.unlink(
                                path.join(baseDir, directory, file),
                                error => {
                                    if (error) {
                                        return callback(error)
                                    }

                                    ncp(
                                        link,
                                        path.join(baseDir, directory, file),
                                        error => {
                                            if (error) {
                                                return callback(error)
                                            }

                                            checkNext()
                                        }
                                    )
                                }
                            )
                        }
                    )
                } else {
                    checkNext()
                }
            })
        }

        checkNext()
    })
}

function createNodeModules(callback = () => {}) {
    rmdir(path.join(baseDir, 'app/node_modules'), error => {
        if (error) {
            return callback(error)
        }

        child_process.exec(
            'npm install',
            {
                cwd: path.join(baseDir, '/app')
            },
            error => {
                if (error) {
                    return callback(error)
                }
                rmdir(
                    path.join(baseDir, 'app/node_modules/font-list'),
                    error => {
                        if (error) {
                            return callback(error)
                        }

                        replaceSymLinks('app/node_modules', error => {
                            if (error) {
                                return callback(error)
                            }

                            callback(null)
                        })
                    }
                )
            }
        )
    })
}

function packageAsar(callback = () => {}) {
    asar.createPackageWithOptions(
        path.join(baseDir, 'app'),
        path.join(baseDir, 'app/app.asar'),
        {
            unpack: unpack_glob,
            unpackDir: unpack_dirs
        },
        error => {
            if (error) {
                return callback(error)
            }

            callback()
        }
    )
}

rmdir(path.join(baseDir, 'app/app.asar.unpacked'), error => {
    if (error) {
        console.error(error)
    }

    console.log('creating node_modules directory')
    createNodeModules(error => {
        if (error) {
            return console.error(error)
        }

        console.log('creating asar package')
        packageAsar(error => {
            if (error) {
                return console.error(error)
            }

            console.log('returning node_modules back to basic state')
            createNormalNodeModules(error => {
                if (error) {
                    return console.error(error)
                }

                console.log('finished')
            })
        })
    })
})

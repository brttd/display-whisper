const { ipcRenderer } = require('electron')

const fs = require('fs')
const pathJoin = require('path').join

const marked = require('marked')
const renderer = new marked.Renderer()

const appPath = pathJoin(__dirname, '..')

const sections = {}
let currentSection = ''

let contentLastHeader = null

const navigationElem = document.createElement('header')
const sectionLinksElem = document.createElement('div')
const quickJumpElem = document.createElement('div')
const contentElem = document.createElement('article')

navigationElem.appendChild(sectionLinksElem)
navigationElem.appendChild(quickJumpElem)

sectionLinksElem.id = 'help-sections'
quickJumpElem.id = 'help-quick-nav'

document.body.appendChild(navigationElem)
document.body.appendChild(contentElem)

//markdown rendering settings
{
    //Codespans are being used to display keyboard shortcuts
    renderer.codespan = function(setting) {
        let value = ipcRenderer.sendSync('get-setting-sync', setting)

        if (typeof value !== 'string') {
            return '<kbd>Not Set!</kbd>'
        } else {
            value = value.replace('Key', '')
            value = value.replace('Digit', '')

            return '<kbd>' + value + '</kbd>'
        }
    }

    //Images are being used to display UI icons
    renderer.image = function(href) {
        if (href[0] === '#') {
            let url = pathJoin(
                __dirname,
                '../icons/',
                href.split('-')[0].slice(1) + '.svg' + href
            )

            return (
                '<svg viewBox="0 0 100 100"><use xlink:href="' +
                url +
                '"></use></svg>'
            )
        } else {
            return ''
        }
    }

    marked.setOptions({
        renderer: renderer
    })
}

function nameToId(name) {
    return name.toLowerCase().replace(' ', '-')
}

function toggleQuickNavVisibility() {
    //the showContent function set contentLastHeader to be the last (if there's more than one) h1/h2 element in the section
    //If there is a last header, check if it's below the scroll height of the section div
    //If it is, that means you need to scroll to get to it, and so the "jump to" menu should be shown
    if (contentLastHeader) {
        if (
            contentLastHeader.offsetTop - contentElem.offsetTop >
            contentElem.offsetHeight
        ) {
            quickJumpElem.style.display = ''
            return
        }
    }

    quickJumpElem.style.display = 'none'
}

function showContent(data) {
    //Replace the content element with rendered html of the new section
    contentElem.innerHTML = marked(data)

    //The "jump to" menu needs to be updated with links to each header inside the section
    let headers = contentElem.querySelectorAll('h1, h2, h3')

    quickJumpElem.innerHTML = 'Jump to:'

    //for each header which has an id, create a link for that id
    for (let i = 0; i < headers.length; i++) {
        if (headers[i].id) {
            quickJumpElem.appendChild(document.createElement('a'))
            quickJumpElem.lastChild.textContent = headers[i].textContent
            quickJumpElem.lastChild.href = '#' + headers[i].id
        }
    }

    //contentLastHeader is used to check if the "jump to" menu should be shown
    if (headers.length > 1) {
        contentLastHeader = headers[headers.length - 1]
    } else {
        contentLastHeader = null
    }

    //Even when replacing the html of an element, the scroll position can be retained
    //When displaying a new section, it should be shown scrolled to the top
    contentElem.scrollTop = 0

    toggleQuickNavVisibility()
}

function displaySection(name) {
    if (!sections.hasOwnProperty(name) || currentSection === name) {
        return false
    }

    currentSection = name

    let selected = sectionLinksElem.querySelector('.selected')
    if (selected) {
        selected.classList.remove('selected')
    }

    selected = document.getElementById(name)

    selected.classList.add('selected')

    navigationElem.firstElementChild.scrollTo({
        left:
            selected.offsetLeft +
            selected.offsetWidth / 2 -
            navigationElem.firstElementChild.offsetWidth / 2,
        behavior: 'smooth'
    })

    showContent(sections[name])
}

function onSectionClick(event) {
    displaySection(nameToId(event.target.textContent))
}

fs.readFile(
    pathJoin(appPath, 'help.json'),
    { encoding: 'utf-8' },
    (error, data) => {
        if (error) {
            ipcRenderer.send('show-dialog', 'error', {
                content:
                    'Unable to load help file!\n' +
                    (error.message || error.toString())
            })

            logger.error('Unable to load help json file:', error)

            return false
        }

        try {
            data = JSON.parse(data)
        } catch (error) {
            ipcRenderer.send('show-dialog', 'error', {
                content:
                    'Unable to load help file!\n' + error.message ||
                    error.toString()
            })

            logger.error('Unable to pase json help file:', error)

            return false
        }

        if (!Array.isArray(data)) {
            ipcRenderer.send('show-dialog', 'error', {
                content: 'Unable to load help file!'
            })

            logger.error('help.json file was not array!')

            return false
        }

        for (let i = 0; i < data.length; i++) {
            if (typeof data[i].file === 'string') {
                try {
                    let sectionName = data[i].name || data[i].file.split('.')[0]

                    sections[nameToId(sectionName)] = content = fs.readFileSync(
                        pathJoin(appPath, data[i].file),
                        {
                            encoding: 'utf-8'
                        }
                    )

                    let title = document.createElement('h2')
                    title.textContent = sectionName

                    title.id = nameToId(sectionName)

                    title.addEventListener('click', onSectionClick)

                    sectionLinksElem.appendChild(title)
                } catch (error) {
                    logger.error(
                        'Unable to load help document ' + data[i].file + ':',
                        error
                    )
                }
            }
        }

        //Select the first section
        displaySection(nameToId(sectionLinksElem.firstChild.textContent))
    }
)

//Sections can contain links to headers, which will cause the window location hash to change
window.addEventListener('hashchange', () => {
    if (location.hash === '') {
        return false
    }

    let elemId = location.hash.slice(1)

    if (sections.hasOwnProperty(elemId)) {
        displaySection(elemId)
    } else {
        let elem = document.getElementById(elemId.toLowerCase())

        if (elem) {
            elem.scrollIntoView()
        }
    }

    location.hash = ''
})

//Because the "jump to" menu is only shown when a header is below the visible scroll height, it needs to be re-checked each time the window is resized
window.addEventListener('resize', toggleQuickNavVisibility)

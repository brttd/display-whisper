const { remote, shell } = require('electron')

const links = document.querySelectorAll('a')
const licenses_elem = document.getElementById('licenses')

function onLinkClick(event) {
    //All links should have their href='#', so open the actual page in an external browser, and disable any scrolling, etc the window would do
    shell.openExternal(event.target._href)
    event.preventDefault()
}
function onLicenseClick() {
    this.lastChild.style.maxHeight = ''
    //event.target.lastChild.style.maxHeight = ''
}

//By default, links will open the page in the current window. This shouldn't happen, so each link needs to be changed
for (let i = 0; i < links.length; i++) {
    links[i]._href = links[i].href
    links[i].href = '#'

    if (links[i].innerText === '') {
        links[i].innerText = '(' + links[i]._href + ')'
    }

    links[i].addEventListener('click', onLinkClick)
}

//Replace all elements with special ids with the relevant version information
{
    if (app_version) {
        app_version.textContent = remote.app.getVersion()
    }

    if (node_version) {
        node_version.textContent = process.versions.node
    }

    if (electron_version) {
        electron_version.textContent = process.versions.electron
    }

    if (chrome_version) {
        chrome_version.textContent = process.versions.chrome
    }
}

function addLicense(module) {
    let elem = document.createElement('div')
    let header = document.createElement('h2')
    let links = document.createElement('span')
    header.textContent = module.name || ''

    if (module.version) {
        header.textContent += ' (' + module.version + ')'
    }
    if (module.publisher) {
        header.textContent += ', ' + module.publisher
    }
    if (module.licenses) {
        header.textContent += ': ' + module.licenses
    }

    if (module.url) {
        let link = document.createElement('a')
        link._href = module.url
        link.href = '#'
        link.textContent = module.url

        link.addEventListener('click', onLinkClick)

        links.appendChild(link)
    }
    if (module.repository) {
        let link = document.createElement('a')
        link._href = module.repository
        link.href = '#'
        link.textContent = module.repository

        link.addEventListener('click', onLinkClick)

        links.appendChild(link)
    }

    elem.appendChild(header)

    if (links.childElementCount) {
        elem.appendChild(links)
    }

    if (module.licenseText) {
        elem.appendChild(document.createElement('pre'))
        elem.lastChild.textContent = module.licenseText
        elem.lastChild.style.maxHeight = '1.5em'

        elem.addEventListener('click', onLicenseClick)
    }

    licenses_elem.appendChild(elem)
}

addLicense({
    name: 'Inter UI',
    publisher: 'Rasmus Andersson',
    url: 'https://rsms.me/inter/',
    repository: 'https://github.com/rsms/inter/',
    licenses: 'SIL OPEN FONT LICENSE',

    licenseText: `Copyright (c) 2016-2018 The Inter Project Authors (me@rsms.me)

    This Font Software is licensed under the SIL Open Font License, Version 1.1.
    This license is copied below, and is also available with a FAQ at:
    http://scripts.sil.org/OFL
    
    -----------------------------------------------------------
    SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
    -----------------------------------------------------------
    
    PREAMBLE
    The goals of the Open Font License (OFL) are to stimulate worldwide
    development of collaborative font projects, to support the font creation
    efforts of academic and linguistic communities, and to provide a free and
    open framework in which fonts may be shared and improved in partnership
    with others.
    
    The OFL allows the licensed fonts to be used, studied, modified and
    redistributed freely as long as they are not sold by themselves. The
    fonts, including any derivative works, can be bundled, embedded,
    redistributed and/or sold with any software provided that any reserved
    names are not used by derivative works. The fonts and derivatives,
    however, cannot be released under any other type of license. The
    requirement for fonts to remain under this license does not apply
    to any document created using the fonts or their derivatives.
    
    DEFINITIONS
    "Font Software" refers to the set of files released by the Copyright
    Holder(s) under this license and clearly marked as such. This may
    include source files, build scripts and documentation.
    
    "Reserved Font Name" refers to any names specified as such after the
    copyright statement(s).
    
    "Original Version" refers to the collection of Font Software components as
    distributed by the Copyright Holder(s).
    
    "Modified Version" refers to any derivative made by adding to, deleting,
    or substituting -- in part or in whole -- any of the components of the
    Original Version, by changing formats or by porting the Font Software to a
    new environment.
    
    "Author" refers to any designer, engineer, programmer, technical
    writer or other person who contributed to the Font Software.
    
    PERMISSION AND CONDITIONS
    Permission is hereby granted, free of charge, to any person obtaining
    a copy of the Font Software, to use, study, copy, merge, embed, modify,
    redistribute, and sell modified and unmodified copies of the Font
    Software, subject to the following conditions:
    
    1) Neither the Font Software nor any of its individual components,
    in Original or Modified Versions, may be sold by itself.
    
    2) Original or Modified Versions of the Font Software may be bundled,
    redistributed and/or sold with any software, provided that each copy
    contains the above copyright notice and this license. These can be
    included either as stand-alone text files, human-readable headers or
    in the appropriate machine-readable metadata fields within text or
    binary files as long as those fields can be easily viewed by the user.
    
    3) No Modified Version of the Font Software may use the Reserved Font
    Name(s) unless explicit written permission is granted by the corresponding
    Copyright Holder. This restriction only applies to the primary font name as
    presented to the users.
    
    4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
    Software shall not be used to promote, endorse or advertise any
    Modified Version, except to acknowledge the contribution(s) of the
    Copyright Holder(s) and the Author(s) or with their explicit written
    permission.
    
    5) The Font Software, modified or unmodified, in part or in whole,
    must be distributed entirely under this license, and must not be
    distributed under any other license. The requirement for fonts to
    remain under this license does not apply to any document created
    using the Font Software.
    
    TERMINATION
    This license becomes null and void if any of the above conditions are
    not met.
    
    DISCLAIMER
    THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
    OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
    COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
    DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
    OTHER DEALINGS IN THE FONT SOFTWARE.`
})

require('fs').readFile(
    require('path').join(__dirname, '../', 'licenses.json'),
    'utf8',
    (error, data) => {
        if (error) {
            licenses_elem.innerText =
                'Unable to load licenses!\n' +
                (error.message || error.toString())

            return false
        }

        try {
            data = JSON.parse(data)

            if (Array.isArray(data)) {
                for (let i = 0; i < data.length; i++) {
                    addLicense(data[i])
                }
            } else {
                throw new Error('Data is not an Array!')
            }
        } catch (error) {
            licenses_elem.innerText =
                'Unable to parse licenses!\n' +
                (error.message || error.toString())
        }
    }
)

document.getElementById('close').addEventListener('click', () => {
    window.close()
})

function afterFrames(count, callback) {
    if (count <= 0) {
        callback()
    }

    requestAnimationFrame(afterFrames.bind(null, count - 1, callback))
}

window.addEventListener('load', () => {
    ipcRenderer.on('request-frame-render', () => {
        //wait for 5 animation frames, and then send back a message
        afterFrames(5, () => {
            ipcRenderer.send('frame-rendered')
        })
    })
})

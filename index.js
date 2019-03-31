// ==========================
//
// system
//

const fs = require('fs')
const env = require('./env')
const reg = /韓國|國瑜|國語|寒|韓|函|涵/g

// ==========================
//
// server
//

const ip = env.ip === 'auto' ? require('ip').address() : env.ip
const publicIp = env.publicIp ? env.publicIp : null
const http = require('http')
const express = require('express')
const app = express()
const server = http.createServer(app)
const io = require('socket.io')(server)

server.listen(80, ip)

app.use(express.static('./public'));
app.get('/', ( request, response )=>{
    let html = fs.readFileSync('./index.html', 'utf8')
    html = html.replace('--ip--', publicIp || ip).replace('--begin--', env.startTime)
    response.write(html)
    response.end()
})

io.on('connection', (socket)=>{
    socket.emit('update', { text: '即時字幕載入中...', count })
})

console.log(`< http://${publicIp || ip} >`)

// ==========================
//
// main
//

const url = env.youtubeUrl
const apiKey = env.apiKey
const ytdl = require('ytdl-core')
const request = require('request')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const ytdlOption = {
    liveBuffer: 10000
}

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

let recoreFile = 'minute.json'
let audioFile = 'audios'
if (fs.existsSync(recoreFile) === false) {
    fs.writeFileSync(recoreFile, JSON.stringify({text: '', count: 0 }))
}

if (fs.existsSync(audioFile) === false) {
    fs.mkdirSync(audioFile)
}

let recore = require('./' + recoreFile)
let count = recore.count || 0
let oldBase = null
let files = fs.readdirSync(audioFile)

for (let file of files) {
    fs.unlinkSync('./' + audioFile + '/' + file)
}

function action() {
    let fileName = `./${audioFile}/${Date.now()}.wav`
    let stream = ytdl(url, ytdlOption)
    new ffmpeg(stream).duration(10).audioChannels(1).audioFrequency(16000).format('wav').save(fileName).on('end', () => {
        stream.end()
        let base = fs.readFileSync(fileName).toString('base64')
        if (oldBase === base) return
        oldBase = base
        request({
            uri: 'https://speech.googleapis.com/v1/speech:recognize?key=' + apiKey,
            method: 'POST',
            json: {
                audio: {
                    content: base
                },
                config: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: 16000,
                    languageCode: 'zh-TW'
                }
            }
        }, (error, response, body) => {
            try{
                let text = body.results[0].alternatives[0].transcript
                let match = text.match(reg)
                if (match) {
                    count += match.length
                }
                console.log('語音 : ', text)
                console.log('計數 : ', count)
                io.emit('update', { text, count })
                fs.writeFileSync(recoreFile, JSON.stringify({ text, count }))
            } catch(e) {}
            fs.unlinkSync(fileName)
        })
    })
}

setInterval(action, 10000)
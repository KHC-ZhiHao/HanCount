// ==========================
//
// system
//

const fs = require('fs')
const env = require('./env')
const reg = /韓國|韓總|國瑜|國語|韓市長|高雄市長|挺韓|寒流|韓流|韓|函|涵/g

// ==========================
//
// server
//

const ip = env.ip === 'auto' ? require('ip').address() : env.ip
const http = require('http')
const express = require('express')
const app = express()
const server = http.createServer(app)
const io = require('socket.io')(server)

server.listen(3000, ip)

app.get('/', ( request, response )=>{
    let html = fs.readFileSync('./index.html', 'utf8')
    html = html.replace('--ip--', ip).replace('--keyword--', reg).replace('--begin--', env.startTime)
    response.write(html)
    response.end()
})

io.on('connection', (socket)=>{
    socket.emit('update', { text: 'wait...', count })
})

console.log(`< http://${ip}:3000 >`)

// ==========================
//
// main
//

const url = env.youtubeUrl
const apiKey = env.apiKey
const ytdl = require('ytdl-core')
const request = require('request')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const ffmpeg = require('fluent-ffmpeg')
const ytdlOption = {
    liveBuffer: 10000
}

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

let recoreFile = './files/minute.json'
let recore = require(recoreFile)
let count = recore.count || 0
let oldBase = null

try {
    fs.mkdirSync('./audios')
} catch(e) {}

let files = fs.readdirSync('./audios')

for (let file of files) {
    fs.unlinkSync('./audios/' + file)
}

function action() {
    let fileName = `./audios/${Date.now()}.wav`
    let stream = ytdl(url, ytdlOption)
    new ffmpeg(stream).duration(10).audioChannels(1).audioFrequency(8000).format('wav').save(fileName).on('end', () => {
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
                    sampleRateHertz: 8000,
                    languageCode: 'zh-TW',
                },
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
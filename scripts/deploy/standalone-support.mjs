// Two small servers for scripts/deploy/verify-standalone.sh.
//   node standalone-support.mjs resend <port>
//     Stand-in for api.resend.com (the Resend SDK reads RESEND_BASE_URL). POST /emails stores the message and answers {id};
//     GET /last?to=<address> answers the latest message for that address, GET /all every message.
//   node standalone-support.mjs proxy <listen-port> <upstream-port> <cert.pem> <key.pem>
//     TLS reverse proxy that sets what nginx sets: X-Forwarded-For (the client's, plus the remote address), X-Real-IP,
//     X-Forwarded-Proto: https and the original Host. It listens on 127.0.0.1 and ::1 and streams responses unbuffered.
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'

const [, , mode, ...args] = process.argv

function resend(port) {
  const mails = []
  http
    .createServer((req, res) => {
      const url = new URL(req.url, 'http://x')
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      if (req.method === 'GET' && url.pathname === '/last') {
        const to = url.searchParams.get('to')
        const mail = [...mails].reverse().find((m) => !to || JSON.stringify(m.to).toLowerCase().includes(to.toLowerCase()))
        return send(mail ? 200 : 404, mail ?? null)
      }
      if (req.method === 'GET' && url.pathname === '/all') return send(200, mails)
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        let json = {}
        try {
          json = JSON.parse(body)
        } catch {}
        mails.push({ path: url.pathname, ...json })
        console.log(JSON.stringify({ at: new Date().toISOString(), path: url.pathname, to: json.to, subject: json.subject }))
        send(200, { id: `fake-${mails.length}` })
      })
    })
    .listen(port, '127.0.0.1', () => console.log('fake resend on', port))
}

function proxy(listen, upstream, certFile, keyFile) {
  const tls = { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
  const handler = (req, res) => {
    const remote = (req.socket.remoteAddress || '').replace(/^::ffff:/, '')
    const headers = { ...req.headers }
    headers['x-forwarded-for'] = headers['x-forwarded-for'] ? `${headers['x-forwarded-for']}, ${remote}` : remote
    headers['x-real-ip'] = remote
    headers['x-forwarded-proto'] = 'https'
    const up = http.request({ host: '127.0.0.1', port: Number(upstream), method: req.method, path: req.url, headers }, (r) => {
      console.log(JSON.stringify({ at: new Date().toISOString(), remote, method: req.method, path: req.url.split('?')[0], status: r.statusCode }))
      res.writeHead(r.statusCode, r.headers)
      r.on('data', (chunk) => {
        res.write(chunk)
        res.flush?.()
      })
      r.on('end', () => res.end())
    })
    up.on('error', (e) => {
      res.writeHead(502)
      res.end(String(e))
    })
    req.pipe(up)
  }
  // ::1 may not exist on a runner; 127.0.0.1 is enough for the checks
  for (const host of ['127.0.0.1', '::1']) {
    const server = https.createServer(tls, handler)
    server.on('error', (e) => host === '::1' && e.code ? console.log('no listener on', host, e.code) : (console.error(e), process.exit(1)))
    server.listen(Number(listen), host, () => console.log('proxy', host, listen, '->', upstream))
  }
}

if (mode === 'resend') resend(Number(args[0]))
else if (mode === 'proxy') proxy(...args)
else {
  console.error('usage: standalone-support.mjs resend <port> | proxy <listen> <upstream> <cert> <key>')
  process.exit(2)
}

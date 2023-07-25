const fs = require('fs')
const dotenv = require('dotenv')
const express = require('express')
const { OAuth2Client } = require('google-auth-library')
const { getGeoJSON, addUser, checkUsername } = require('./models/profiles')

dotenv.config()
const app = express()
const client = new OAuth2Client()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static('public'))

const htmlFile = fs.readFileSync(`${__dirname}/index.html`, 'utf-8')
let jsFile = fs.readFileSync(`${__dirname}/script.js`, 'utf-8')
jsFile = `mapboxgl.accessToken = '${process.env.MAPBOX_TOKEN}'\n` + jsFile

app.route('/').get((req, res) => {
  res.status(200).send(`
  <script src="https://accounts.google.com/gsi/client" async></script>
  <div>
  <p>Get a personal travel log</p>
  <div id="g_id_onload"
  data-client_id="259494879046-t6ejuqrlbmgdlqotrkes0fgev4iak86e.apps.googleusercontent.com"
  data-context="signin"
  data-ux_mode="popup"
  data-login_uri="${process.env.URI}/welcome"
  data-auto_prompt="false">
</div>

<div class="g_id_signin"
  data-type="standard"
  data-shape="rectangular"
  data-theme="outline"
  data-text="continue_with"
  data-size="large"
  data-logo_alignment="left">
</div>
</div>
`)
})

async function verify(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.OAUTH_CLIENT_ID,
  })
  const payload = ticket.getPayload()
  addUser([payload.email, payload.name, null, null])
  return payload
}

app
  .route('/welcome')
  .post((req, res) => {
    const token = req.body.credential
    const userDetails = verify(token).catch(console.error)
    const requestURI = process.env.URI + '/api/profiles'
    res.status(200).send(`
  <div>
    <h1>Choose a username</h1>
    <input value='tenzin'/>
    <button id='check'>Check</button>
    <div id='message'>
    </div>
  </div>
  <script>
    async function checkUsername() {
      const res = await fetch('${requestURI}', {
      method: 'POST', 
      body: JSON.stringify({username: input.value}),
      headers: {
        'Content-type': 'application/json',
      },
    })
      const body = await res.json()
      console.log(body);
      return body
    }
    const check = document.querySelector('#check')
    const input = document.querySelector('input')
    check.addEventListener('click', (e) => {
      checkUsername()
    })
  </script>
  `)
  })
  .get((req, res) => {
    res.status(405).send('Method not allowed')
  })

app.route('/:username').get(async (req, res) => {
  const { username } = req.params
  if (username !== 'favicon') {
    const geoJSON = await getGeoJSON(username)
    const withGeoJSON = `\nconst geojson = ${geoJSON}\n` + jsFile
    const withScript = htmlFile.replace(
      '</body>',
      `<script type="module">${withGeoJSON}</script></body>`
    )
    res.status(200).send(withScript)
  } else {
    res.status(400).send('Error')
  }
})

app.route('/api/profiles').post(async (req, res) => {
  console.log(req.body)
  const checkRes = await checkUsername(req.body.username)
  if (checkRes.status === 'success') {
    res
      .status(200)
      .send({ status: 'success', data: { available: checkRes.available } })
  } else {
    res.status(500).send({ status: 'error' })
  }
})

app.listen(process.env.PORT, '0.0.0.0')

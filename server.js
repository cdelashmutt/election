/*
Copyright 2016 Chris DeLashmutt

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var CLIENT_ID = process.env.ST_CLIENT_ID;
var CLIENT_SECRET = process.env.ST_CLIENT_SECRET;

var request = require('request');
var express = require('express'),
  app = express();

var endpoints_uri = 'https://graph.api.smartthings.com/api/smartapps/endpoints';

var oauth2 = require('simple-oauth2').create({
	client: {
		id: CLIENT_ID,
  		secret: CLIENT_SECRET
	},
    	auth: {
		tokenHost: 'https://graph.api.smartthings.com'
	}
});

var vcap_application = JSON.parse(process.env.VCAP_APPLICATION || '{"application_uris": ["localhost"]}');

// Authorization uri definition 
var authorization_uri = oauth2.authorizationCode.authorizeURL({
  redirect_uri: `http://${vcap_application.application_uris[0]}/oauth/callback`,
  scope: 'app',
  state: '3(#0/!~'
});

var bearer = "";
var access_url = "";

var dem = 0;
var rep = 0;

var http = require("http");
var https = require("https");
var url = require("url");

var options = {
	host: 's3.amazonaws.com',
        path: '/origin-east-elections.politico.com/mapdata/2016/LIVE.xml'
};

function getResults() {
	str = '';
	http.request(options, function(response) {
		response.on('data', function(chunk) {
			str += chunk;
		});
		response.on('end', function() {
			data = str.split(/\r?\n/)[2].split("|")[0].split(";");

			dem = parseInt(data[0], 10);
			rep = parseInt(data[2], 10);
			console.log('Dem: '+dem+", Rep: "+rep);
			req_options = {
				protocol: access_url.protocol,
				hostname: access_url.hostname,
				port: access_url.port,
				path: access_url.path,
				method: "PUT",
				headers: {
					Authorization: 'Bearer '+bearer
				}
			}
			if(dem > rep) {
				req_options.path += '/devices/dem';
			}
			else if (dem < rep) {
				req_options.path += '/devices/gop';
			}
			else {
				req_options.path += '/devices/normal';
			}
			req = https.request(req_options, (res) => {
				console.log('statusCode:', res.statusCode);
				console.log('headers:', res.headers);
			});
			req.on('error', (e) => {
				console.log(`Error updating lights: ${e.message}`);
			});	
 			console.log('Getting ready to call:', req_options.path);
			req.end();
		});
	}).end();
	setTimeout(getResults, 30000);
}

// Initial page redirecting to Github 
app.get('/auth', function (req, res) {
  res.redirect(authorization_uri);
});
                            
// Callback service parsing the authorization token and asking for the access token 
app.get('/oauth/callback', function (req, res) {
  var code = req.query.code;
  // console.log('/callback got code' + code);
  oauth2.authorizationCode.getToken({
    code: code,
    redirect_uri: `http://${vcap_application.application_uris[0]}/oauth/callback`
  }, saveToken);

  function saveToken(error, result) {
    if (error) { console.log('Access Token Error', error.message); }

    // result.access_token is the token, get the endpoint
    bearer = result.access_token
    var sendreq = { method: "GET", uri: endpoints_uri + "?access_token=" + result.access_token };
    request(sendreq, function (err, res1, body) {
      var endpoints = JSON.parse(body);
      // we just show the final access URL and Bearer code
      access_url = url.parse('https://graph.api.smartthings.com' + endpoints[0].url);

	getResults();
      res.send('<pre>${access_url.href}</pre><br><pre>Bearer ${bearer}</pre>');
    });

  }
});

app.get('/', function (req, res) {
  res.send('<a href="/auth">Connect with SmartThings</a>');
});

app.get('/score', function(req, res) {
	res.send(`<h3>Hillary: ${dem}</h3><h3>Trump: ${rep}</h3>`);
});

port = (process.env.PORT || 3000);
app.listen(port);

console.log(`Express server started on port ${port}`);

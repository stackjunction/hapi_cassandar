
var Hapi = require('hapi');
var hapiAuthJWT = require('hapi-auth-jwt2'); // http://git.io/vT5dZ
var JWT         = require('jsonwebtoken');   // used to sign our content
var aguid       = require('aguid')  // https://github.com/ideaq/aguid
var url         = require('url');   // node core!

var services_routes = require('./services');
var redisClient = require('redis-connection')(); // instantiate redis-connection
redisClient.set('redis', 'working');
redisClient.get('redis', function (rediserror, reply) {
  /* istanbul ignore if */
  if(rediserror) {
    console.log(rediserror);
  }
  console.log('redis is ' +reply.toString()); // confirm we can access redis
});

// bring your own validation function
var validate = function (decoded, request, callback) {
  console.log(" - - - - - - - DECODED token:");
  console.log(decoded);
  // do your checks to see if the session is valid
  redisClient.get(decoded.id, function (rediserror, reply) {
    /* istanbul ignore if */
    if(rediserror) {
      console.log(rediserror);
    }
    console.log(' - - - - - - - REDIS reply - - - - - - - ', reply);
    var session;
    if(reply) {
      session = JSON.parse(reply);
    }
    else { // unable to find session in redis ... reply is null
      return callback(rediserror, false);
    }

    if (session.valid === true) {
      return callback(rediserror, true);
    }
    else {
      return callback(rediserror, false);
    }
  });
};

// Create a server with a host and port
var server = new Hapi.Server();
  server.connection({
  host: '0.0.0.0',
  port: 3000
});

server.register(hapiAuthJWT, function (err) {
  // if(err) { // uncomment this in prod
  //   console.log(err);
  // }
  // see: http://hapijs.com/api#serverauthschemename-scheme
  server.auth.strategy('jwt', 'jwt', true,
  { key: process.env.JWT_SECRET,  validateFunc: validate,
    verifyOptions: { ignoreExpiration: true }
  });

  server.route([
    {
      method: "GET", path: "/", config: { auth: false },
      handler: function(request, reply) {
        reply({text: 'Token not required'});
      }
    },
    {
      method: ['GET','POST'], path: '/restricted', config: { auth: 'jwt' },
      handler: function(request, reply) {
        reply({text: 'You used a Token!'})
        .header("Authorization", request.headers.authorization);
      }
    },
    { // implement your own login/auth function here
      method: ['GET','POST'], path: "/auth", config: { auth: false },
      handler: function(request, reply) {
        var session = {
          valid: true, // this will be set to false when the person logs out
          id: aguid(), // a random session id
          exp: new Date().getTime() + 30 * 6  // expires in 30 minutes time
        }
        // create the session in Redis
        redisClient.set(session.id, JSON.stringify(session));
        redisClient.expire(session.id,10);
        // sign the session as a JWT
        var token = JWT.sign(session, process.env.JWT_SECRET); // synchronous
        console.log(token);

        reply({text: 'Check Auth Header for your Token'})
        .header("Authorization", token);
      }
    },
    ...services_routes]);

});

server.start(
  function() { console.log('Hapi is listening to http://localhost:3000'); }
);

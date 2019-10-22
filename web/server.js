const config = require('./vue/dist/UIconfig');

const koa = require('koa');
const serve = require('koa-static');
const cors = require('@koa/cors');
const _ = require('lodash');
const bodyParser = require('koa-bodyparser');

const opn = require('opn');
const server = require('http').createServer();
const router = new require('koa-router')();
const ws = require('ws');
const app = new koa();

const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ server: server });

const cache = require('./state/cache');

const passport = require('koa-passport');
const session = require('koa-session');

require('./auth/passport');
const ensureAuthenticated = require('./auth/ensureAuthenticated');

const nodeCommand = _.last(process.argv[1].split('/'));
const isDevServer = nodeCommand === 'server' || nodeCommand === 'server.js';

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.ping(_.noop);
  ws.on('error', e => {
    console.error(new Date, '[WS] connection error:', e);
  });
});


setInterval(() => {
  wss.clients.forEach(ws => {
    if(!ws.isAlive) {
      console.log(new Date, '[WS] stale websocket client, terminiating..');
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping(_.noop);
  });
}, 10 * 1000);

// broadcast function
const broadcast = data => {
  if(_.isEmpty(data)) {
    return;
  }

  const payload = JSON.stringify(data);

  wss.clients.forEach(ws => {
    ws.send(payload, err => {
      if(err) {
        console.log(new Date, '[WS] unable to send data to client:', err);
      }
    });
  });
  wss.emit(data.type, data);
}
cache.set('broadcast', broadcast);
cache.set('wss', wss);

const ListManager = require('./state/listManager');
const GekkoManager = require('./state/gekkoManager');

const GekkosPersistent = require('./plugins/gekkosPersistent');
const DependencyManager = require('./state/dependencyManager');

// initialize lists and dump into cache
cache.set('imports', new ListManager);
cache.set('gekkos', new GekkoManager);
cache.set('dependencies', new DependencyManager());
cache.set('apiKeyManager', require('./apiKeyManager'));
cache.set('gekkosPersistent', new GekkosPersistent());

// setup API routes

const WEBROOT = __dirname + '/';
const ROUTE = n => WEBROOT + 'routes/' + n;

// attach routes
const apiKeys = require(ROUTE('apiKeys'));
router.get('/api/info', require(ROUTE('info')));
router.get('/api/strategies', ensureAuthenticated(), require(ROUTE('strategies')));
router.get('/api/configPart/:part', ensureAuthenticated(), require(ROUTE('configPart')));
router.get('/api/apiKeys', ensureAuthenticated(), apiKeys.get);

const listWraper = require(ROUTE('list'));
router.get('/api/imports', ensureAuthenticated('admin'), listWraper('imports'));
router.get('/api/gekkos', ensureAuthenticated(), listWraper('gekkos'));
router.get('/api/exchanges', ensureAuthenticated(), require(ROUTE('exchanges')));

router.post('/api/addApiKey', ensureAuthenticated(), apiKeys.add);
router.post('/api/removeApiKey', ensureAuthenticated(), apiKeys.remove);
router.post('/api/scan', ensureAuthenticated(), require(ROUTE('scanDateRange')));
router.post('/api/scansets', ensureAuthenticated('admin'), require(ROUTE('scanDatasets')));
router.post('/api/backtest', ensureAuthenticated('admin'), require(ROUTE('backtest')));
router.post('/api/import', ensureAuthenticated('admin'), require(ROUTE('import')));
router.post('/api/startGekko', ensureAuthenticated(), require(ROUTE('startGekko')));
router.post('/api/stopGekko', ensureAuthenticated(), require(ROUTE('stopGekko')));
router.post('/api/deleteGekko', ensureAuthenticated(), require(ROUTE('deleteGekko')));
router.post('/api/restartGekko', ensureAuthenticated(), require(ROUTE('restartGekko')));
router.post('/api/getCandles', ensureAuthenticated(), require(ROUTE('getCandles')));

router.post('/auth/login', require(ROUTE('login')));
// router.post('/auth/google', require(ROUTE('login')));
router.post('/auth/register', require(ROUTE('register')));
router.post('/auth/logout', require(ROUTE('logout')));
// router.post('/account/user-details', ensureAuthenticated(), require(ROUTE('account').userDetails));

// incoming WS:
// wss.on('connection', ws => {
//   ws.on('message', _.noop);
// });

app.keys = ['super-secret-key'];

app
  .use(cors({
    // origin: '*',
    origin: 'http://127.0.0.1:4000',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
    // allowHeaders: 'Origin, X-Requested-With, Content-Type, Accept',
    credentials: 'true'
  }))
  .use(serve(WEBROOT + 'vue/dist'))
  .use(session({}, app))
  .use(bodyParser())
  .use(require('koa-logger')())
  .use(passport.initialize()) // for user accounts
  .use(passport.session()) // for user accounts
  .use(router.routes())
  .use(router.allowedMethods())
  .use(async function(ctx, next) { // authenticate custom static files (logs):
    if (/\.log$/.test(ctx.originalUrl)) {
      return ensureAuthenticated('admin')(ctx, next);
    } else {
      return next();
    }
  })
  .use(serve(WEBROOT + '../logs')); // serve static logs (to admins-only)


server.timeout = config.api.timeout || 120000;
server.on('request', app.callback());
server.listen(config.api.port, config.api.host, '::', () => {
  const host = `${config.ui.host}:${config.ui.port}${config.ui.path}`;

  if(config.ui.ssl) {
    var location = `https://${host}`;
  } else {
    var location = `http://${host}`;
  }

  console.log('Serving Gekko UI on ' + location +  '\n');


  // only open a browser when running `node gekko`
  // this prevents opening the browser during development
  if(!isDevServer && !config.headless) {
    opn(location)
      .catch(err => {
        console.log('Something went wrong when trying to open your web browser. UI is running on ' + location + '.');
    });
  }
});

broadcast({
  type: 'server_started'
})

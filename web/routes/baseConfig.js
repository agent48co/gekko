var UIconfig = require('../vue/dist/UIconfig');

var config = {};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//                          GENERAL SETTINGS
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

config.silent = false;
config.debug = true;

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//                       CONFIGURING TRADING ADVICE
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

config.tradingAdvisor = {
}

config.candleWriter = {
  enabled: false
}

config.backtestResultExporter = {
  enabled: true,
  writeToDisk: true,
  data: {
    stratUpdates: true,
    roundtrips: true,
    stratCandles: true,
    trades: true
  }
}

config.childToParent = {
  enabled: false,
}

// ASYNC STRATEGIES:
config.asyncStrategies = [ '$lon-DEVELOP', '$lon-IAmRich-1', '$lon-IAmRich-2', '$lon-IAmRich-21',
  '$lon-turtles', '$lon-turtles-psycho',
  '$lon-krown-cave', '$lon-krown-cave-1.1', '$lon-krown-cave-1.2', '$lon-SuperStasAsync-1', '$lon-backfire-vial',
  '$lon-aaat-stats'
]; // TEMP! todo: move to config.js, when tested.
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//                       CONFIGURING ADAPTER
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// configurable in the UIconfig
config.adapter = UIconfig.adapter;

config.sqlite = {
  path: 'plugins/sqlite',
  version: 0.1,
  dataDirectory: 'history',
  journalMode: require('../isWindows.js') ? 'PERSIST' : 'WAL',
  dependencies: [{
    module: 'sqlite3',
    version: '3.1.4'
  }]
}

  // Postgres adapter example config (please note: requires postgres >= 9.5):
config.postgresql = {
  path: 'plugins/postgresql',
  version: 0.1,
  // connectionString: 'postgres://postgres:Slon48@postgresql:5432', // docker version, database - gekko
  connectionString: 'postgres://postgres:Slon48@localhost:5434', // local version, database - gekko2
  database: 'gekko2', // if set, we'll put all tables into a single database.
  schema: 'public',
  dependencies: [{
    module: 'pg',
    version: '8.5.1'
  }]
}

// Mongodb adapter, requires mongodb >= 3.3 (no version earlier tested)
config.mongodb = {
  path: 'plugins/mongodb',
  version: 0.1,
  connectionString: 'mongodb://mongodb/gekko', // connection to mongodb server
  dependencies: [{
    module: 'mongojs',
    version: '2.4.0'
  }]
}
config.telegrambotAsync = {
  enabled: false,
  emitUpdates: true,
  token: 'xxx', // Talk to botFather on Telegram to get your token and bot name
  botName: 'xxx'
};

// Ash's plugins
config.slackAsync = {
  enabled: false,
  token: 'xxx',
  sendMessageOnStart: true,
  muteSoft: true,
  channel: 'xxx',
  workspace: 'xxx'
}
config.userManager = {
  enabled: true,
}
config.gekkosManagerAsync = {
  enabled: true,
}
config.dependencyManager = {
  enabled: false
}
config.gekkosPersistent = {
  enabled: true
}
config.accountsPerformanceAnalyzer = {
  enabled: false,
  dependencies: ['gekkosPersistent'] // it's just a note, no real code behind
}
config.apiKeyNameForBacktest = 'backtest1';
config.bundleIdForBacktest = '9f9c1188-855c-49d4-8da2-117473172f57';
// end Ash's plugins

config.adviceWriter = {
  enabled: false,
  muteSoft: true,
}
config.adviceLogger = {
  enabled: true
}
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//                       CONFIGURING BACKTESTING
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Note that these settings are only used in backtesting mode, see here:
// @link: https://github.com/askmike/gekko/blob/stable/docs/Backtesting.md

config.backtest = {
  daterange: 'scan',
  batchSize: 50
}

config.importer = {
  daterange: {
    // NOTE: these dates are in UTC
    from: "2016-06-01 12:00:00"
  }
}

module.exports = config;

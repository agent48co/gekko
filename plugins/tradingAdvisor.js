var util = require('../core/util');
var _ = require('lodash');
var fs = require('fs');

var config = util.getConfig();
var dirs = util.dirs();
var log = require(dirs.core + 'log');
var CandleBatcher = require(dirs.core + 'candleBatcher');

var moment = require('moment');

var Actor = function(done) {
  _.bindAll(this);

  this.done = done;
  this.candle = {};
//  this.batchers = {};

  // create batcher for each timeframe in config
  this.timeframes = config.tradingAdvisor.timeframes;
  _.each(this.timeframes, function(timeframe, key) {
    this.timeframes[key].batcher = new CandleBatcher(timeframe);
  }, this);


  this.setupTradingMethod();

  var mode = util.gekkoMode();

// TODO: fix realtime stitcher for multitimeframe candles
  if(mode === 'realtime') {
    var Stitcher = require(dirs.core + 'dataStitcher');
    var stitcher = new Stitcher(this.batcher);
    stitcher.prepareHistoricalData(done);
  } else if(mode === 'backtest')
    done();
}

util.makeEventEmitter(Actor);

Actor.prototype.setupTradingMethod = function() {
  var methodName = config.tradingAdvisor.method;

  if(!fs.existsSync(dirs.methods + methodName + '.js'))
    util.die('Gekko doesn\'t know the method ' + methodName);

  log.info('\t', 'Using the trading method: ' + methodName);

  var method = require(dirs.methods + methodName);

  // bind all trading method specific functions
  // to the Consultant.
  var Consultant = require(dirs.core + 'baseTradingMethod');

  _.each(method, function(fn, name) {
    Consultant.prototype[name] = fn;
  });

  this.method = new Consultant;
  this.method
    .on('advice', this.relayAdvice);
    // listen to all propagated candles
    _.each(this.timeframes, function(timeframe, key) {
      this.timeframes[key].batcher
        .on('candle_'+key, this.processCustomCandle)
    }, this);


}

// HANDLERS
// process the 1m candles
Actor.prototype.processCandle = function(candle, done) {
  this.candle = candle;
  // write candle to each timeframe
  _.each(this.timeframes, function(timeframe, key) {
    this.timeframes[key].batcher.write([candle], key);
  }, this);

  done();
}

// propogate a custom sized candle to the trading method
Actor.prototype.processCustomCandle = function(candle, tf) {
    this.method.tick(candle, tf); // process custom candle size
}

// pass through shutdown handler
Actor.prototype.finish = function(done) {
  this.method.finish(done);
}

// EMITTERS
Actor.prototype.relayAdvice = function(advice) {
  this.emit('advice', advice);
}


module.exports = Actor;

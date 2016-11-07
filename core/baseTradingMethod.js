var _ = require('lodash');
var util = require('../core/util.js');
var config = util.getConfig();
var dirs = util.dirs();
var log = require('../core/log.js');
var moment = require('moment');

if(config.tradingAdvisor.talib.enabled) {
  // verify talib is installed properly
  var pluginHelper = require(dirs.core + 'pluginUtil');
  var pluginMock = {
    slug: 'tradingAdvisor',
    dependencies: [{
      module: 'talib',
      version: config.tradingAdvisor.talib.version
    }]
  };

  var cannotLoad = pluginHelper.cannotLoad(pluginMock);
  if(cannotLoad)
    util.die(cannotLoad);

  var talib = require(dirs.core + 'talib');
}

var indicatorsPath = '../methods/indicators/';

var Indicators = {
  MACD: {
    factory: require(indicatorsPath + 'MACD'),
    input: 'price'
  },
  EMA: {
    factory: require(indicatorsPath + 'EMA'),
    input: 'price'
  },
  DEMA: {
    factory: require(indicatorsPath + 'DEMA'),
    input: 'price'
  },
  PPO: {
    factory: require(indicatorsPath + 'PPO'),
    input: 'price'
  },
  LRC: {
    factory: require(indicatorsPath + 'LRC'),
    input: 'price'
  },
  SMA: {
    factory: require(indicatorsPath + 'SMA'),
    input: 'price'
  },

  RSI: {
    factory: require(indicatorsPath + 'RSI'),
    input: 'candle'
  },
  TSI: {
    factory: require(indicatorsPath + 'TSI'),
    input: 'candle'
  },
  UO: {
    factory: require(indicatorsPath + 'UO'),
    input: 'candle'
  },
  CCI: {
    factory: require(indicatorsPath + 'CCI'),
    input: 'candle'
  }
};

var allowedIndicators = _.keys(Indicators);
var allowedTalibIndicators = _.keys(talib);

var Base = function() {
  _.bindAll(this);


  // mock for each timeframe
  var mock = {
    // properties
    age:0,                          // no. of ticks started
    processedTicks:0,               // no of ticks processed and propogated

    // defaults
    requiredHistory: 0,             // required history before starting to propogate ticks
    priceValue: 'close',            // price to use in indicators
    indicators: {},                 // collection of used indicators
    talibIndicators: {},            // collection of used taLib indicators

    candle: {},                     // current candle

    historySize: 1000,          // candle & indicator history size
    history: {                  // storage of candle cache
      start: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volume: [],
      volume_buy: [],
      vwp: [],
      trades: [],
      trades_buy: []

    }
  }

  // create data object for all timeframes
  this.timeframes = config.tradingAdvisor.timeframes;

  // add mock to all configured timeframes
  _.each(this.timeframes, function(timeframe, key) {
      this.timeframes[key] = _.merge(_.clone(mock), timeframe);
  }, this);

  // is all initialized properly
  this.setup = false;
  // are we using async plugins / indicators
  this.asyncTick = false;
  // make sure we have all methods
  _.each(['init', 'check'], function(fn) {
    if(!this[fn])
      util.die('No ' + fn + ' function in this trading method found.')
  }, this);

  if(!this.update)
    this.update = function() {};

  // let's run the implemented starting point
  this.init(this.timeframes);

  // should be set up now, check some things
  // to make sure everything is implemented
  // correctly.
  if(!this.name)
    log.warn('Warning, trading method has no name');

  if(!config.debug || !this.log)
    this.log = function() {};

  this.setup = true;

  // check if we have async taLib plugins
  _.each(this.timeframes, function(timeframe, key) {
    if(_.size(this.timeframes[key].talibIndicators))
      this.asyncTick = true;
  }, this);


}

// teach our base trading method events
util.makeEventEmitter(Base);

// this is tick for every custom tf candle
Base.prototype.tick = function(candle, tf) {

  this.timeframes[tf].age++;
  this.timeframes[tf].candle = candle;


  // store candle history
  // TODO: add additional fields like trades, vwp, ...
  this.timeframes[tf].history.start.push(candle.start);
  this.timeframes[tf].history.open.push(candle.open);
  this.timeframes[tf].history.high.push(candle.high);
  this.timeframes[tf].history.low.push(candle.low);
  this.timeframes[tf].history.close.push(candle.close);
  this.timeframes[tf].history.vwp.push(candle.vwp);
  this.timeframes[tf].history.volume.push(candle.volume);
  this.timeframes[tf].history.volume_buy.push(candle.volume_buy);
  this.timeframes[tf].history.trades.push(candle.trades);
  this.timeframes[tf].history.trades_buy.push(candle.trades_buy);

  var basectx = this;

  // clean cache
  if(this.timeframes[tf].age > this.timeframes[tf].historySize) {
    _.each(this.timeframes[tf].history, function(item, key) {
        basectx.timeframes[tf].history[key].shift();
    })
  }


  // update all indicators
  var price = candle[this.timeframes[tf].priceValue];
  _.each(this.timeframes[tf].indicators, function(i, key) {
    if(i.input === 'price')
      i.update(price);
    if(i.input === 'candle')
      i.update(candle);
    basectx.timeframes[tf].history[key].push(i);
  });

  // update the trading method
  // first fill the history. we don't need to start calculating async indicators before that
  // if we are in synchronous mode just go to processSyncIndicators
    if(!this.asyncTick  || this.timeframes[tf].requiredHistory > this.timeframes[tf].age) {
          this.propogateTick(tf, candle);
    } else {
      // wait for all async indicators to finish before processing
      var next = _.after(
        _.size(this.timeframes[tf].talibIndicators),
      _.partial(this.propogateTick, tf, candle) // appends tf parameter to propagatetick function
    );


    // handle result from talib
    var talibResultHander = function(err, result) {
      if(err)
        util.die('TALIB ERROR:', err);

      // fn is bound to indicator
      this.result = _.mapValues(result, v => _.last(v));


      next();
    }

    // handle result from talib
    _.each(
      this.timeframes[tf].talibIndicators,
      indicator => indicator.run(
        basectx.timeframes[tf].history,
        talibResultHander.bind(indicator)
      )
    );
  }


}

// process synchronous indicators (only after all async ones have results)
// Base.prototype.processSyncIndicators = function(tf, candle) {
//
// }

// propogate tick to the strategy (method)
Base.prototype.propogateTick = function(tf) {

  // run update no mather what
  this.update(this.timeframes, tf);

  // run log / check when required history is filled
  if(this.timeframes[tf].requiredHistory <= this.timeframes[tf].age) {
    this.log(this.timeframes, tf);
    this.check(this.timeframes, tf);
  }
  this.timeframes[tf].processedTicks++;

  // are we totally finished
  var done = this.timeframes[tf].age === this.timeframes[tf].processedTicks;
  if(done && this.finishCb) {
    this.finishCb();

  }
}

Base.prototype.addTalibIndicator = function(name, type, parameters, tf) {
  if(!talib)
    util.die('Talib is not enabled');

  if(!_.contains(allowedTalibIndicators, type))
    util.die('I do not know the talib indicator ' + type);

  if(this.setup)
    util.die('Can only add talib indicators in the init method!');

  var basectx = this;

  // if timeframe is not specified, add indicator to all timeframes
  if (!tf) {
    _.each(this.timeframes, function(timeframe, key) {
      basectx.timeframes[key].talibIndicators[name] = {
        run: talib[type].create(parameters),
        result: NaN
      }
      // init history
      basectx.timeframes[key].history[name] = [];
    });
  } else {
    if (!this.timeframes[tf])
      util.die('Set proper timeframe for your taLiib indicator: ', name, type);
    this.timeframes[tf].talibIndicators[name] = {
      run: talib[type].create(parameters),
      result: NaN
    }
    // init history
    this.timeframes[tf].history[name] = [];
  }
}

Base.prototype.addIndicator = function(name, type, parameters, tf) {
  if(!_.contains(allowedIndicators, type))
    util.die('I do not know the indicator ' + type);

  if(this.setup)
    util.die('Can only add indicators in the init method!');

    var basectx = this;
    if (!tf) {
      _.each(this.timeframes, function(timeframe, key) {
        basectx.timeframes[key].indicators[name] = new Indicators[type].factory(parameters);
        // some indicators need a price stream, others need full candles
        basectx.timeframes[key].indicators[name].input = Indicators[type].input;
        // init history
        basectx.timeframes[key].history[name] = [];
      });
    } else {
      if (!this.timeframes[tf])
        util.die('Set proper timeframe for your indicator: ', name, type);
      this.timeframes[tf].indicators[name] = new Indicators[type].factory(parameters);
      // some indicators need a price stream, others need full candles
      this.timeframes[tf].indicators[name].input = Indicators[type].input;
      // init history
      this.timeframes[tf].history[name] = [];
  }
}

Base.prototype.advice = function(newPosition, ts) {
  // Possible values are long and short. Long will trigger a buy method
  // while short will trigger a sell method
  var advice = 'soft';
  if(newPosition) {
    advice = newPosition;
  }

  this.emit('advice', {
    recommendation: advice,
    portfolio: 1,
    moment: ts
  });
}

// Because the trading method might be async we need
// to be sure we only stop after all candles are
// processed.
Base.prototype.finish = function(done) {
  if(!this.asyncTick)
    return done();

    var asyncDone = false;
    _.each(this.timeframes, function(timeframe, key) {
      if(timeframe.age === timeframe.processedTicks)
        asyncDone = true;
    });
    if(asyncDone)
      return done();

  // we are not done, register cb
  // and call after we are..
  this.finishCb = done;
}

module.exports = Base;

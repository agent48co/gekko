// If you want to use your own trading methods you can
// write them here. For more information on everything you
// can use please refer to this document:
//
// https://github.com/askmike/gekko/blob/stable/docs/trading_methods.md
//
// The example below is pretty stupid: on every new candle there is
// a 10% chance it will recommand to change your position (to either
// long or short).
var _ = require('lodash');
var log = require('../core/log.js');

var config = require('../core/util.js').getConfig();
var settings = config.test;

// Let's create our own method
var method = {};

// Prepare everything our method needs
method.init = function(timeframes) {
  // keep state about the current trend
  // here, on every new candle we use this
  // state object to check if we need to
  // report it.
  this.trend = {
    direction: 'none',
    duration: 0,
    persisted: false,
    adviced: false
  };

  // how many candles do we need as a base
  // before we can start giving advice?
  this.requiredHistory = 25;

  // define the indicators we need
  this.addIndicator('macd', 'MACD', settings.macd);

  // define the indicators we need
  this.addTalibIndicator('mymacd', 'macd', settings.talibmacd);

}

// What happens on every new candle?
method.update = function(timeframes, tf) {


}

// For debugging purposes.
method.log = function(timeframes, tf) {
  var digits = 8;
  var macd = timeframes[tf].indicators.macd;
  var talibmacd = timeframes[tf].talibIndicators.mymacd;

  var history = timeframes[tf].history;

  var diff = macd.diff;
  var signal = macd.signal.result;

  // if (tf=='tf60')
  _.each(history, function(item, key) {
    log.debug(key, _.size(item));
  })
  // log.debug('tf', tf);
  // log.debug('macd ', signal);
  // log.debug('talib', talibmacd.result.outMACDSignal);
  // log.debug('calculated MACD properties for candle:');
  // log.debug('\t', 'short:', macd.short.result.toFixed(digits));
  // log.debug('\t', 'long:', macd.long.result.toFixed(digits));
  // log.debug('\t', 'macd:', diff.toFixed(digits));
  // log.debug('\t', 'signal:', signal.toFixed(digits));
  // log.debug('\t', 'macdiff:', macd.result.toFixed(digits));
}

// Based on the newly calculated
// information, check if we should
// update or not.
method.check = function(timeframes, tf) {

  var macddiff = timeframes[tf].indicators.macd.result;
  var candle = timeframes[tf].candle;

  if(macddiff > settings.thresholds.up) {

    // new trend detected
    if(this.trend.direction !== 'up')
      // reset the state for the new trend
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'up',
        adviced: false
      };

    this.trend.duration++;

    log.debug('In uptrend since', this.trend.duration, 'candle(s)');

    if(this.trend.duration >= settings.thresholds.persistence)
      this.trend.persisted = true;

    if(this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      this.advice('long', candle.start);
    } else
      this.advice();

  } else if(macddiff < settings.thresholds.down) {

    // new trend detected
    if(this.trend.direction !== 'down')
      // reset the state for the new trend
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'down',
        adviced: false
      };

    this.trend.duration++;

    log.debug('In downtrend since', this.trend.duration, 'candle(s)');

    if(this.trend.duration >= settings.thresholds.persistence)
      this.trend.persisted = true;

    if(this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      this.advice('short', candle.start);
    } else
      this.advice();

  } else {

    log.debug('In no trend');

    // we're not in an up nor in a downtrend
    // but for now we ignore sideways trends
    //
    // read more @link:
    //
    // https://github.com/askmike/gekko/issues/171

    // this.trend = {
    //   direction: 'none',
    //   duration: 0,
    //   persisted: false,
    //   adviced: false
    // };

    this.advice();
  }
}

module.exports = method;

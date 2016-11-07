// internally we only use 1m
// candles, this can easily
// convert them to any desired
// size.

// Acts as ~fake~ stream: takes
// 1m candles as input and emits
// bigger candles.
//
// input are transported candles.

var _ = require('lodash');
var moment = require('moment');
var util = require(__dirname + '/util');

var CandleBatcher = function(timeframe) {
  if(!_.isNumber(timeframe.tf))
    throw 'candleSize is not a number';

  this.candleSize = timeframe.tf;
  this.smallCandles = [];

  _.bindAll(this);
}

util.makeEventEmitter(CandleBatcher);

CandleBatcher.prototype.write = function(candles, tf) {
  if(!_.isArray(candles))
    throw 'candles is not an array';

    // add 1m candle to each timeframe
    _.each(candles, function(candle) {
      if ((candle.start / 1000 / 60) % this.candleSize === 0) {
        if (_.size(this.smallCandles)>0) {
          this.emit('candle_'+tf, this.calculate(), tf);
          this.smallCandles = [];
        }
      } else if (_.size(this.smallCandles)==0) {
        // correct the date of first candle to fit the desired timeframe (that means first candle is not full)
        // maybe we should skip all minutes until we get to proper start date
        var candleStart = Math.floor(candle.start / this.candleSize / 60 / 1000) * this.candleSize * 60;
        candle.start = moment.unix(candleStart).utc();
        console.log(candleStart, candle.start);
      }
      this.smallCandles.push(candle);
    }, this);
}

CandleBatcher.prototype.check = function() {
  if(_.size(this.smallCandles) % this.candleSize !== 0)
    return;

  this.emit('candle', this.calculate());
  this.smallCandles = [];
}

CandleBatcher.prototype.calculate = function() {
  var first = this.smallCandles.shift();

  first.vwp = first.vwp * first.volume;

  var candle = _.reduce(
    this.smallCandles,
    function(candle, m) {
      candle.high = _.max([candle.high, m.high]);
      candle.low = _.min([candle.low, m.low]);
      candle.close = m.close;
      candle.volume += m.volume;
      candle.vwp += m.vwp * m.volume;
      candle.trades += m.trades;
      candle.trades_buy += m.trades_buy;
      candle.volume_buy += m.volume_buy;
      candle.lag += _.max([candle.lag, m.lag]);
      return candle;
    },
    first
  );

  if(candle.volume)
    // we have added up all prices (relative to volume)
    // now divide by volume to get the Volume Weighted Price
    candle.vwp /= candle.volume;
  else
    // empty candle
    candle.vwp = candle.open;

  candle.start = first.start;
  return candle;
}

module.exports = CandleBatcher;

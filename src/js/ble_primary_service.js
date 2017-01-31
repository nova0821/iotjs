var events = require('events');
var util = require('util');

var debug = console.log; //requir('debug')('ble_primary_service');

var UuidUtil = require('ble_uuid_util');

function PrimaryService(options) {
  this.uuid = UuidUtil.removeDashes(options.uuid);
  this.characteristics = options.characteristics || [];
}

util.inherits(PrimaryService, events.EventEmitter);

PrimaryService.prototype.toString = function() {
  return JSON.stringify({
    uuid: this.uuid,
    characteristics: this.characteristics
  });
};

module.exports = PrimaryService;

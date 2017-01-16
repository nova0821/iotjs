/* The MIT License (MIT)
 *
 * Copyright (c) 2013 Sandeep Mistry
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/* Copyright 2016-present Samsung Electronics Co., Ltd. and other contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* This file include some APIs in 'bleno'.
 * (https://github.com/sandeepmistry/bleno)
 */

var EventEmiter = require('events').EventEmitter;
var util = require('util');

var ble = process.binding(process.binding.ble);


// Primary Service
function PrimaryService(options) {
  this.uuid = options.uuid;
  this.characteristics = options.characteristics || [];
}

util.inherits(PrimaryService, EventEmiter);


// Characteristric
function Characteristic(options) {
  this.uuid = options.uuid;
  this.properties = options.properties || [];
  this.secure = options.secure || [];
  this.value = options.value || null;
  this.descriptors = options.descriptors || [];

  if (options.onReadRequest) {
    this.onReadRequest = options.onReadRequest;
  }

  if (options.onWriteRequest) {
    this.onWriteRequest = options.onWriteRequest;
  }

  if (options.onSubscribe) {
    this.onSubscribe = options.onSubscribe;
  }

  if (options.onUnsubscribe) {
    this.onUnsubscribe = options.onUnsubscribe;
  }

  if (options.onNotify) {
    this.onNotify = options.onNotify;
  }

  if (options.onIndicate) {
    this.onIndicate = options.onIndicate;
  }

  this.on('readRequest', this.onReadRequest.bind(this));
  this.on('writeRequest', this.onWriteRequest.bind(this));
  this.on('subscribe', this.onSubscribe.bind(this));
  this.on('unsubscribe', this.onUnsubscribe.bind(this));
  this.on('notify', this.onNotify.bind(this));
  this.on('indicate', this.onIndicate.bind(this));
}

util.inherits(Characteristic, EventEmiter);

Characteristic.prototype.onReadRequest = function(offset, callback) {
  callback(this.RESULT_UNLIKELY_ERROR, null);
};

Characteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
  callback(this.RESULT_UNLIKELY_ERROR);
};

Characteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  this.maxValueSize = maxValueSize;
  this.updateValueCallback = updateValueCallback;
};

Characteristic.prototype.onUnsubscribe = function() {
  this.maxValueSize = null;
  this.updateValueCallback = null;
};

Characteristic.prototype.onNotify = function() {
};

Characteristic.prototype.onIndicate = function() {
};


// Descriptor
function Descriptor(options) {
  this.uuid = options.uuid;
  this.value = options.value || "";
}


function BLE() {
  this.state = 'unknown';
  // this.address = 'unknown';
  this._advertiseState = null;
  // this.rssi = 0;
  // this.mtu = 20;

  EventEmiter.call(this);

  this.on('stateChange', (function(_this) {
    return function(state) {
      _this.state = state;

      if (state == 'unauthorized') {
        console.log('ble warning: adapter state unauthorized.');
        console.log('             please run as root or with sudo.');
      }
    };
  })(this));

  // TODO: implement more events.
  // ...

  ble.init((function(_this) {
    return function(state) {
      _this.emit('stateChange', state);
    };
  })(this));

  this.setServices([]);

  process.on('exit', (function(_this) {
    return function() {
      if (_this._advertiseState != 'stoped') {
        _this.stopAdvertising();
      }
    };
  })(this));

}

util.inherits(BLE, EventEmiter);

BLE.prototype._runBleLoop = function() {
  if (this._advertiseState == 'started') {
    ble.runBleLoop((function(_this) {
      return function(curState) {
        if (curState != _this.state) {
          _this.emit('stateChange', curState);
        }
        setTimeout(_this._runBleLoop.bind(_this), 1000);
      };
    })(this));
  }
};

BLE.prototype.startAdvertising = function(name, serviceUuids, callback) {
  var advertisementDataLength = 3;
  var scanDataLength = 0;

  var serviceUuids16bit = [];
  var serviceUuids128bit = [];
  var i = 0;
  var j = 0;
  var k = 0;

  if (name && name.length) {
    scanDataLength += 2 + name.length;
  }

  if (serviceUuids && serviceUuids.length) {
    for (i = 0; i < serviceUuids.length; i++) {
      var convertedUuid = serviceUuids[i].match(/.{1,2}/g).reverse().join('');
      var serviceUuid = [];
      while (convertedUuid.length >= 2) {
        serviceUuid.push(parseInt(convertedUuid.substring(0, 2), 16));
        convertedUuid = convertedUuid.substring(2, convertedUuid.length);
      }

      if (serviceUuid.length === 2) {
        serviceUuids16bit.push(serviceUuid);
      } else if (serviceUuid.length === 16) {
        serviceUuids128bit.push(serviceUuid);
      }
    }
  }

  if (serviceUuids16bit.length) {
    advertisementDataLength += 2 + 2 * serviceUuids16bit.length;
  }

  if (serviceUuids128bit.length) {
    advertisementDataLength += 2 + 16 * serviceUuids128bit.length;
  }

  i = 0;
  var advertisementData = [];

  // flags
  advertisementData[i++] = 2;
  advertisementData[i++] = 0x01;
  advertisementData[i++] = 0x06;

  if (serviceUuids16bit.length) {
    advertisementData[i++] = 1 + 2 * serviceUuids16bit.length;
    advertisementData[i++] = 0x03;
    for (j = 0; j < serviceUuids16bit.length; j++) {
      for (k = 0; k < serviceUuids16bit[j].length; k++) {
        advertisementData[i++] = serviceUuids16bit[j][k];
      }
    }
  }

  if (serviceUuids128bit.length) {
    advertisementData[i++] = 1 + 16 * serviceUuids128bit.length;
    advertisementData[i++] = 0x06;
    for (j = 0; j < serviceUuids128bit.length; j++) {
      for (k = 0; k < serviceUuids128bit[j].length; k++) {
        advertisementData[i++] = serviceUuids128bit[j][k];
      }
    }
  }

  i = 0;
  var scanData = [];

  // name
  if (name && name.length) {
    scanData[i++] = name.length + 1;
    scanData[i++] = 0x08;
    for (j = 0; j < name.length; j++) {
      scanData[i++] = name[j].charCodeAt(0);
    }
  }

  this._advertiseState = 'started';

  ble.startAdvertising(advertisementData, scanData, function(err) {
    return process.nextTick(function() {
      return callback(err);
    });
  });

  setTimeout(this._runBleLoop.bind(this), 1000);
};

BLE.prototype.stopAdvertising = function(callback) {
  this._advertiseState = 'stoped';

  ble.stopAdvertising(function(err) {
    return process.nextTick(function() {
      return callback(err);
    });
  });
};

BLE.prototype.setServices = function(services, callback) {
  var deviceName = process.env.BLE_DEVICE_NAME || "BLE-IoT.js";

  // Default Services and Characteristics
  var allServices = [
    {
      uuid: '1800',
      characteristics: [
        {
          uuid: '2a00',
          properties: ['read'],
          secure: [],
          value: deviceName,
          descriptors: []
        },
        {
          uuid: '2a01',
          properties: ['read'],
          secure: [],
          value: [0x80, 0x00],
          descriptors: []
        }
      ]
    },
    {
      uuid: '1801',
      characteristics: [
        {
          uuid: '2a05',
          properties: ['indicate'],
          secure: [],
          value: [0x00, 0x00, 0x00, 0x00],
          descriptors: []
        }
      ]
    }
  ].concat(services);

  this._handles = [];

  var handle = 0;
  var i;
  var j;

  for (i = 0; i < allServices.length; i++) {
    var service = allServices[i];

    handle++;
    var serviceHandle = handle;

    this._handles[serviceHandle] = {
      type: 'service',
      uuid: service.uuid,
      attribute: service,
      startHandle: serviceHandle
    };

    for (j = 0; j < service.characteristics.length; j++) {
      var characteristic = service.characteristics[j];

      var properties = 0;
      var secure = 0;

      if (characteristic.properties.indexOf('read') !== -1) {
        properties |= 0x02;

        if (characteristic.secure.indexOf('read') !== -1) {
          secure |= 0x02;
        }
      }

      if (characteristic.properties.indexOf('writeWithoutResponse') !== -1) {
        properties |= 0x04;

        if (characteristic.secure.indexOf('writeWithoutResponse') !== -1) {
          secure |= 0x04;
        }
      }

      if (characteristic.properties.indexOf('write') !== -1) {
        properties |= 0x08;

        if (characteristic.secure.indexOf('write') !== -1) {
          secure |= 0x08;
        }
      }

      if (characteristic.properties.indexOf('notify') !== -1) {
        properties |= 0x10;

        if (characteristic.secure.indexOf('notify') !== -1) {
          secure |= 0x10;
        }
      }

      if (characteristic.properties.indexOf('indicate') !== -1) {
        properties |= 0x20;

        if (characteristic.secure.indexOf('indicate') !== -1) {
          secure |= 0x20;
        }
      }

      handle++;
      var characteristicHandle = handle;

      handle++;
      var characteristicValueHandle = handle;

      this._handles[characteristicHandle] = {
        type: 'characteristic',
        uuid: characteristic.uuid,
        properties: properties,
        secure: secure,
        attribute: characteristic,
        startHandle: characteristicHandle,
        valueHandle: characteristicValueHandle
      };

      this._handles[characteristicValueHandle] = {
        type: 'characteristicValue',
        handle: characteristicValueHandle,
        value: characteristic.value
      };

      if (properties & 0x30) { // notify or indicate
        // add client characteristic configuration descriptor

        handle++;
        var clientCharacteristicConfigurationDescriptorHandle = handle;
        this._handles[clientCharacteristicConfigurationDescriptorHandle] = {
          type: 'descriptor',
          handle: clientCharacteristicConfigurationDescriptorHandle,
          uuid: '2902',
          attribute: characteristic,
          properties: (0x02 | 0x04 | 0x08), // read/write
          secure: (secure & 0x10) ? (0x02 | 0x04 | 0x08) : 0,
          value: [0x00, 0x00]
        };
      }

      for (var k = 0; k < characteristic.descriptors.length; k++) {
        var descriptor = characteristic.descriptors[k];

        handle++;
        var descriptorHandle = handle;

        this._handles[descriptorHandle] = {
          type: 'descriptor',
          handle: descriptorHandle,
          uuid: descriptor.uuid,
          attribute: descriptor,
          properties: 0x02, // read only
          secure: 0x00,
          value: descriptor.value
        };
      }
    }

    this._handles[serviceHandle].endHandle = handle;
  }


  /*ble.setServices(services, function(err) {
    return process.nextTick(function() {
      return callback(err);
    });
  });*/
};

BLE.prototype.PrimaryService = PrimaryService;
BLE.prototype.Characteristic = Characteristic;
BLE.prototype.Descriptor = Descriptor;

module.exports = new BLE();

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

#ifndef IOTJS_MODULE_BLE_LINUX_GENERAL_INL_H
#define IOTJS_MODULE_BLE_LINUX_GENERAL_INL_H

#include <errno.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#include "module/iotjs_module_ble.h"


#define BLE_WORKER_INIT_TEMPLATE                                            \
  iotjs_ble_reqwrap_t* req_wrap = iotjs_ble_reqwrap_from_request(work_req); \
  iotjs_ble_reqdata_t* req_data = iotjs_ble_reqwrap_data(req_wrap);

#define BTPROTO_L2CAP 0
#define BTPROTO_HCI   1

#define SOL_HCI       0
#define HCI_FILTER    2

#define HCIGETDEVLIST _IOR('H', 210, int)
#define HCIGETDEVINFO _IOR('H', 211, int)

#define HCI_CHANNEL_RAW     0
#define HCI_CHANNEL_USER    1
#define HCI_CHANNEL_CONTROL 3

#define HCI_DEV_NONE  0xffff

#define HCI_MAX_DEV 16

#define ATT_CID 4

enum {
  HCI_UP,
  HCI_INIT,
  HCI_RUNNING,

  HCI_PSCAN,
  HCI_ISCAN,
  HCI_AUTH,
  HCI_ENCRYPT,
  HCI_INQUIRY,

  HCI_RAW,
};

struct sockaddr_hci {
  sa_family_t     hci_family;
  unsigned short  hci_dev;
  unsigned short  hci_channel;
};

struct hci_dev_req {
  uint16_t dev_id;
  uint32_t dev_opt;
};

struct hci_dev_list_req {
  uint16_t dev_num;
  struct hci_dev_req dev_req[0];
};

typedef struct {
  uint8_t b[6];
} __attribute__((packed)) bdaddr_t;

struct hci_dev_info {
  uint16_t dev_id;
  char     name[8];

  bdaddr_t bdaddr;

  uint32_t flags;
  uint8_t  type;

  uint8_t  features[8];

  uint32_t pkt_type;
  uint32_t link_policy;
  uint32_t link_mode;

  uint16_t acl_mtu;
  uint16_t acl_pkts;
  uint16_t sco_mtu;
  uint16_t sco_pkts;

  // hci_dev_stats
  uint32_t err_rx;
  uint32_t err_tx;
  uint32_t cmd_tx;
  uint32_t evt_rx;
  uint32_t acl_tx;
  uint32_t acl_rx;
  uint32_t sco_tx;
  uint32_t sco_rx;
  uint32_t byte_rx;
  uint32_t byte_tx;
};

struct sockaddr_l2 {
  sa_family_t    l2_family;
  unsigned short l2_psm;
  bdaddr_t       l2_bdaddr;
  unsigned short l2_cid;
  uint8_t        l2_bdaddr_type;
};

static int _mode;
static int _socket;
static int _devId;
static uv_poll_t _pollHandle;
static int _l2socket;
static uint8_t _address[6];
static uint8_t _addressType;


/* int devIdFor(int* pDevId, bool isUp) {
  int devId = 0; // default

  if (pDevId == NULL) {
    struct hci_dev_list_req* dl;
    struct hci_dev_req* dr;

    dl = (hci_dev_list_req*)calloc(HCI_MAX_DEV * sizeof(*dr) + sizeof(*dl), 1);
    dr = dl->dev_req;

    dl->dev_num = HCI_MAX_DEV;

    if (ioctl(_socket, HCIGETDEVLIST, dl) > -1) {
      for (int i = 0; i < dl->dev_num; i++, dr++) {
        bool devUp = dr->dev_opt & (1 << HCI_UP);
        bool match = isUp ? devUp : !devUp;

        if (match) {
          // choose the first device that is match
          // later on, it would be good to also HCIGETDEVINFO and check the HCI_RAW flag
          devId = dr->dev_id;
          break;
        }
      }
    }

    free(dl);
  } else {
    devId = *pDevId;
  }

  return devId;
} */

int bindRaw(int* devId) {
  struct sockaddr_hci a;
  struct hci_dev_info di;

  memset(&a, 0, sizeof(a));
  a.hci_family = AF_BLUETOOTH;
  a.hci_dev = 0; //devIdFor(devId, true);
  a.hci_channel = HCI_CHANNEL_RAW;

  _devId = a.hci_dev;
  _mode = HCI_CHANNEL_RAW;

  bind(_socket, (struct sockaddr *) &a, sizeof(a));

  // get the local address and address type
  memset(&di, 0x00, sizeof(di));
  di.dev_id = _devId;
  memset(_address, 0, sizeof(_address));
  _addressType = 0;

  if (ioctl(_socket, HCIGETDEVINFO, (void *)&di) > -1) {
    memcpy(_address, &di.bdaddr, sizeof(di.bdaddr));
    _addressType = di.type;

    if (_addressType == 3) {
      // 3 is a weird type, use 1 (public) instead
      _addressType = 1;
    }
  }

  return _devId;
}


int bindUser(int* devId) {
  struct sockaddr_hci a;

  memset(&a, 0, sizeof(a));
  a.hci_family = AF_BLUETOOTH;
  a.hci_dev = 0; //devIdFor(devId, false);
  a.hci_channel = HCI_CHANNEL_USER;

  _devId = a.hci_dev;
  _mode = HCI_CHANNEL_USER;

  bind(_socket, (struct sockaddr *) &a, sizeof(a));

  return _devId;
}


bool isDevUp() {
  struct hci_dev_info di;
  bool isUp = false;

  memset(&di, 0x00, sizeof(di));
  di.dev_id = _devId;

  if (ioctl(_socket, HCIGETDEVINFO, (void *)&di) > -1) {
    isUp = (di.flags & (1 << HCI_UP)) != 0;
  }

  return isUp;
}


void setFilter(char* data, int length) {
  if (setsockopt(_socket, SOL_HCI, HCI_FILTER, data, length) < 0) {
    //this->emitErrnoError();
    printf("ERRROR\n");
  }
}


void poll_cb(uv_poll_t* req, int status, int events) {
  printf("poll is called.\n");

  int length = 0;
  char data[1024];

  length = read(_socket, data, sizeof(data));

  if (length > 0) {
    if (_mode == HCI_CHANNEL_RAW) {
      // kernelDisconnectWorkArounds(length, data);
    }

    /* Local<Value> argv[2] = {
      Nan::New("data").ToLocalChecked(),
      Nan::CopyBuffer(data, length).ToLocalChecked()
    }; 

    Nan::MakeCallback(Nan::New<Object>(this->This), Nan::New("emit").ToLocalChecked(), 2, argv);*/
  }
}


void start() {
  uv_poll_start(&_pollHandle, UV_READABLE, poll_cb);
}


void stop() {
  uv_poll_stop(&_pollHandle);
}


void write_(char* data, int length) {
  if (write(_socket, data, length) < 0) {
    // emitErrnoError();
    printf("ERROR\n");
  }
}


void RunBleLoopWorker(uv_work_t* work_req) {
  BLE_WORKER_INIT_TEMPLATE;
}


void InitWorker(uv_work_t* work_req) {
  BLE_WORKER_INIT_TEMPLATE;

  _socket = socket(AF_BLUETOOTH, SOCK_RAW | SOCK_CLOEXEC, BTPROTO_HCI);

  uv_loop_t* loop = iotjs_environment_loop(iotjs_environment_get());
  uv_poll_init(loop, &_pollHandle, _socket);
}


void StartAdvertisingWorker(uv_work_t* work_req) {
  BLE_WORKER_INIT_TEMPLATE;

  start();
}


void StopAdvertisingWorker(uv_work_t* work_req) {
  BLE_WORKER_INIT_TEMPLATE;

  stop();
}


void SetServicesWorker(uv_work_t* work_req) {
  BLE_WORKER_INIT_TEMPLATE;
}


#endif /* IOTJS_MODULE_BLE_LINUX_GENERAL_INL_H */

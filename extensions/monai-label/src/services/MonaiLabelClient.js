/*
Copyright (c) MONAI Consortium
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import axios from 'axios';

export default class MonaiLabelClient {
  constructor(server_url, token, flagTimerReset) {
    this.server_url = new URL(server_url);
    this.token = token;
    this.flagTimerReset = flagTimerReset;
  }

  async get_elapsed_time() {
    // Get elapsed time of inactivity for the gpu-instance
    return await axios
      .get(
        `https://app.sonosamedical.com/get/timer_elapsed`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      .then(function(response) {
        return response;
      })
      .catch(function(error) {
        return error;
      })
      .finally(function() {});
  }

  async toggle_vm(state, token, zone, name) {
    if (state) {
      return this.manage_vm_post('stop', token, zone, name);
    }

    return this.manage_vm_post('start', token, zone, name);
  }

  async start_vm(token, zone, name) {
    return this.manage_vm_post('start', token, zone, name);
  }

  async stop_vm(token, zone, name) {
    return this.manage_vm_post('stop', token, zone, name);
  }

  async is_vm_running(token, zone, name) {
    return this.manage_vm_get('is_running', token, zone, name);
  }

  async manage_vm_post(action, token, zone, name) {
    return await axios
      .post(
        `https://app.sonosamedical.com/router/vm/${action}`,
        { instanceZone: zone, instanceName: name },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      .then(function(response) {
        console.debug(response);
        return response;
      })
      .catch(function(error) {
        return error;
      })
      .finally(function() {});
  }

  async manage_vm_get(action, token, zone, name) {
    return await axios
      .get(
        `https://app.sonosamedical.com/router/vm/${action}/${zone}/${name}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      .then(function(response) {
        console.debug(response);
        return response;
      })
      .catch(function(error) {
        return error;
      })
      .finally(function() {});
  }

  async info() {
    let url = new URL('info', this.server_url);
    return await this.api_get(url.toString(), this.token);
  }

  async segmentation(model, image, params = {}, label = null) {
    // label is used to send label volumes, e.g. scribbles,
    // that are to be used during segmentation
    return this.infer(model, image, params, label);
  }

  async deepgrow(model, image, foreground, background, params = {}) {
    params['foreground'] = foreground;
    params['background'] = background;
    return this.infer(model, image, params);
  }

  async infer(model, image, params, label = null, result_extension = '.nrrd') {
    let url = new URL('infer/' + encodeURIComponent(model), this.server_url);
    url.searchParams.append('image', image);
    url.searchParams.append('output', 'image');
    url = url.toString();

    if (result_extension) {
      params.result_extension = result_extension;
      params.result_dtype = 'uint16';
      params.result_compress = false;
    }

    return await this.api_post(
      url,
      this.token,
      params,
      label,
      true,
      'arraybuffer'
    );
  }

  async next_sample(stategy = 'random', params = {}) {
    const url = new URL(
      'activelearning/' + encodeURIComponent(stategy),
      this.server_url
    ).toString();

    return await this.api_post(url, this.token, params, null, false, 'json');
  }

  async save_label(image, label, params) {
    let url = new URL('datastore/label', this.server_url);
    url.searchParams.append('image', image);
    url = url.toString();

    const data = MonaiLabelClient.constructFormDataFromArray(
      params,
      label,
      'label',
      'label.bin'
    );

    return await this.api_put_data(url, this.token, data, 'json');
  }

  async is_train_running() {
    let url = new URL('train', this.server_url);
    url.searchParams.append('check_if_running', 'true');
    url = url.toString();

    const response = await this.api_get(url, this.token);
    return (
      response && response.status === 200 && response.data.status === 'RUNNING'
    );
  }

  async run_train(params) {
    const url = new URL('train', this.server_url).toString();
    return await this.api_post(url, this.token, params, null, false, 'json');
  }

  async stop_train() {
    const url = new URL('train', this.server_url).toString();
    return await this.api_delete(url, this.token);
  }

  static constructFormDataFromArray(params, data, name, fileName) {
    let formData = new FormData();
    formData.append('params', JSON.stringify(params));
    formData.append(name, data, fileName);
    return formData;
  }

  static constructFormData(params, files) {
    let formData = new FormData();
    formData.append('params', JSON.stringify(params));

    if (files) {
      if (!Array.isArray(files)) {
        files = [files];
      }
      for (let i = 0; i < files.length; i++) {
        formData.append(files[i].name, files[i].data, files[i].fileName);
      }
    }
    return formData;
  }

  static constructFormOrJsonData(params, files) {
    return files ? MonaiLabelClient.constructFormData(params, files) : params;
  }

  api_get(url, token) {
    console.debug('GET:: ' + url);
    return axios
      .get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(response => {
        console.debug(response);
        this.flagTimerReset.current = true;
        return response;
      })
      .catch(function(error) {
        return error;
      })
      .finally(function() {});
  }

  api_delete(url, token) {
    console.debug('DELETE:: ' + url);
    return axios
      .delete(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(response => {
        console.debug(response);
        this.flagTimerReset.current = true;
        return response;
      })
      .catch(function(error) {
        return error;
      })
      .finally(function() {});
  }

  api_post(
    url,
    token,
    params,
    files,
    form = true,
    responseType = 'arraybuffer'
  ) {
    const data = form
      ? MonaiLabelClient.constructFormData(params, files)
      : MonaiLabelClient.constructFormOrJsonData(params, files);
    return this.api_post_data(url, token, data, responseType);
  }

  api_post_data(url, token, data, responseType) {
    console.debug('POST:: ' + url);
    return axios
      .post(url, data, {
        responseType: responseType,
        headers: {
          Authorization: `Bearer ${token}`,
          accept: ['application/json', 'multipart/form-data'],
        },
      })
      .then(response => {
        console.debug(response);
        this.flagTimerReset.current = true;
        return response;
      })
      .catch(function(error) {
        return error;
      })
      .finally(function() {});
  }

  api_put(url, token, params, files, form = false, responseType = 'json') {
    const data = form
      ? MonaiLabelClient.constructFormData(params, files)
      : MonaiLabelClient.constructFormOrJsonData(params, files);
    return this.api_put_data(url, token, data, responseType);
  }

  api_put_data(url, token, data, responseType = 'json') {
    console.debug('PUT:: ' + url);
    return axios
      .put(url, data, {
        responseType: responseType,
        headers: {
          Authorization: `Bearer ${token}`,
          accept: ['application/json', 'multipart/form-data'],
        },
      })
      .then(response => {
        console.debug(response);
        this.flagTimerReset.current = true;
        return response;
      })
      .catch(function(error) {
        return error;
      });
  }
}

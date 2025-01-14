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

import React, {Component, useEffect, useState} from 'react';
import PropTypes from 'prop-types';

import './MonaiLabelPanel.styl';
import SegmentationList from './SegmentationList';
import MonaiLabelClient from '../services/MonaiLabelClient';
import { UINotificationService } from '@ohif/core';
import { getImageIdsForDisplaySet } from '../utils/SegmentationUtils';
import cornerstone from 'cornerstone-core';
import MD5 from 'md5.js';
import AutoSegmentation from './actions/AutoSegmentation';
import SmartEdit from './actions/SmartEdit';
import Scribbles from './actions/Scribbles';
import OptionTable from './actions/OptionTable';
import ActiveLearning from './actions/ActiveLearning';
import SettingsTable from './SettingsTable';

export default class MonaiLabelPanel extends Component {
  static propTypes = {
    studies: PropTypes.any,
    viewports: PropTypes.any,
    activeIndex: PropTypes.any,
  };

  constructor(props) {
    super(props);

    this.store = window.store.getState();
    // console.log(this.store);

    const { viewports, studies, activeIndex } = props;

    this.viewConstants = this.getViewConstants(viewports, studies, activeIndex);
    console.debug(this.viewConstants);

    this.notification = UINotificationService.create({});
    this.segmentationList = React.createRef();
    this.settings = React.createRef();
    this.actions = {
      options: React.createRef(),
      activelearning: React.createRef(),
      segmentation: React.createRef(),
      smartedit: React.createRef(),
      scribbles: React.createRef(),
    };

    // If the MonaiLabelClient is used to make a request to the GPU instance
    // then the reset is marked as true then the setTimeout function will reset the timer instead
    this.flagTimerReset = React.createRef();

    this.timer = null;

    this.state = {
      info: {},
      action: {},
      vmStarted: false,
      fetchingVMStatus: false,
      timerEstimate: 0,
    };
  }

  async componentDidMount() {
    this.setState({ fetchingVMStatus: true });
    await this.isVMStarted();
    this.setState({ fetchingVMStatus: false });

    if (!this.state.vmStarted) {
      const r = await this.client().start_vm(
        this.store.user.accessToken,
        'us-east4-c',
        'monai-gpu'
      );
      console.log(r)
      await this.isVMStarted();
    }

    if (this.state.vmStarted) {
      console.log('VM Started getting info...');
      await this.onInfo();

      // Create an estimate of the timer until the GPU instance is shutdown
      // Timer is reset for every request sent to the router
      this.timerLoop();
    }
  }

  async componentWillUnmount() {
    clearTimeout(this.timer);
  }

  async timerLoop() {
    if (this.flagTimerReset.current) {
      // Client successfully sent a request to the gpu-instance which reset the timer on the router
      // so reset local timer
      this.setState({ timerEstimate: 0 });
      this.flagTimerReset.current = false;
      
    } else {
      // Increment the timer by 15 seconds
      this.setState((prevState, props) => ({
        timerEstimate: prevState.timerEstimate + 15,
      }));
    }
    
    if (this.state.timerEstimate >= 1500) {
      // Once the timer reaches 25 minutes query the router for the actual inactivity timer
      const time = await this.client().get_elapsed_time();
      this.setState({ timerEstimate: time.data });
    }

    this.timer = setTimeout(() => this.timerLoop(), 15000); // Every 15 seconds
  }

  resetTimerEstimate() {
    this.setState({ timerEstimate: 0 });
  }

  client = () => {
    const settings =
      this.settings && this.settings.current && this.settings.current.state
        ? this.settings.current.state
        : null;
    return new MonaiLabelClient(
      'https://app.sonosamedical.com/router/monai/',
      this.store.user.accessToken,
      this.flagTimerReset
    );
  };

  getViewConstants = (viewports, studies, activeIndex) => {
    const viewport = viewports[activeIndex];
    const { PatientID } = studies[activeIndex];

    const {
      StudyInstanceUID,
      SeriesInstanceUID,
      displaySetInstanceUID,
    } = viewport;

    const imageIds = getImageIdsForDisplaySet(
      studies,
      StudyInstanceUID,
      SeriesInstanceUID
    );
    const imageIdsToIndex = new Map();
    for (let i = 0; i < imageIds.length; i++) {
      imageIdsToIndex.set(imageIds[i], i);
    }

    const element = cornerstone.getEnabledElements()[this.props.activeIndex]
      .element;
    const cookiePostfix = new MD5()
      .update(PatientID + StudyInstanceUID + SeriesInstanceUID)
      .digest('hex');

    return {
      PatientID: PatientID,
      StudyInstanceUID: StudyInstanceUID,
      SeriesInstanceUID: SeriesInstanceUID,
      displaySetInstanceUID: displaySetInstanceUID,
      imageIdsToIndex: imageIdsToIndex,
      element: element,
      numberOfFrames: imageIds.length,
      cookiePostfix: cookiePostfix,
    };
  };

  onInfo = async () => {
    const response = await this.client().info();
    if (response.status !== 200) {
      this.notification.show({
        title: 'MONAI Label',
        message: 'Failed to Connect to MONAI Label Server',
        type: 'error',
        duration: 5000,
      });
    } else {
      this.notification.show({
        title: 'MONAI Label',
        message: 'Connected to MONAI Label Server - Successful',
        type: 'success',
        duration: 2000,
      });

      this.setState({ info: response.data });
      this.resetTimerEstimate();
    }
  };

  onSegmentCreated = id => {
    console.info('Segment Created: ' + id);
    for (const action of Object.keys(this.actions)) {
      if (this.actions[action].current)
        this.actions[action].current.onSegmentCreated(id);
    }
  };
  onSegmentUpdated = id => {
    console.info('Segment Updated: ' + id);
    for (const action of Object.keys(this.actions)) {
      if (this.actions[action].current)
        this.actions[action].current.onSegmentUpdated(id);
    }
  };
  onSegmentDeleted = id => {
    console.info('Segment Deleted: ' + id);
    for (const action of Object.keys(this.actions)) {
      if (this.actions[action].current)
        this.actions[action].current.onSegmentDeleted(id);
    }
  };
  onSegmentSelected = id => {
    console.info('Segment Selected: ' + id);
    for (const action of Object.keys(this.actions)) {
      if (this.actions[action].current)
        this.actions[action].current.onSegmentSelected(id);
    }
  };

  onSelectActionTab = name => {
    // Leave Event
    for (const action of Object.keys(this.actions)) {
      if (this.state.action === action) {
        if (this.actions[action].current)
          this.actions[action].current.onLeaveActionTab();
      }
    }

    // Enter Event
    for (const action of Object.keys(this.actions)) {
      if (name === action) {
        if (this.actions[action].current)
          this.actions[action].current.onEnterActionTab();
      }
    }

    this.setState({ action: name });
  };

  onOptionsConfig = () => {
    return this.actions['options'].current &&
      this.actions['options'].current.state
      ? this.actions['options'].current.state.config
      : {};
  };

  updateView = async (
    response,
    labels,
    operation,
    slice,
    overlap,
    selectedIndex
  ) => {
    this.segmentationList.current.updateView(
      response,
      labels,
      operation,
      slice,
      overlap,
      selectedIndex
    );
  };

  onAddSegment = (name, description, color, selectActive, newLabelMap) => {
    this.segmentationList.current.onAddSegment(
      name,
      description,
      color,
      selectActive,
      newLabelMap
    );
  };

  onClearSegmentByName = name => {
    this.segmentationList.current.onClearSegmentByName(name);
  };

  onDeleteSegmentByName = name => {
    this.segmentationList.current.onDeleteSegmentByName(name);
  };

  isVMStarted = async () => {
    const v = await this.client().is_vm_running(
      this.store.user.accessToken,
      'us-east4-c',
      'monai-gpu'
    );
    
    console.log('Is VM Started: ' + v.data);
    this.setState({ vmStarted: v.data });
  };

  onClickToggleVM = async () => {
    const action = this.state.vmStarted ? {now: 'Stop', past: 'Stopped'} : {now: 'Start', past: 'Started'};
    this.setState({ fetchingVMStatus: true });

    const response = await this.client().toggle_vm(
      this.state.vmStarted,
      this.store.user.accessToken,
      'us-east4-c',
      'monai-gpu'
    );
    // console.log(response);

    if (response.status !== 200) {
      this.setState({ fetchingVMStatus: false });
      this.notification.show({
        title: 'MONAI Label',
        message: `Failed to ${action.now} the GPU MonaiLabel Instance`,
        type: 'error',
        duration: 5000,
      });
    } else {
      this.setState({ fetchingVMStatus: false });
      this.notification.show({
        title: 'MONAI Label',
        message: `${action.past} GPU MonaiLabel Instance!`,
        type: 'success',
        duration: 2000,
      });

      // Could replace with a simple setState, but just to be sure that it was turned on/off
      await this.isVMStarted();

      // Re fetch info from started vm
      await this.onInfo();
    }

  };

  getIndexByName = name => {
    return this.segmentationList.current.getIndexByName(name);
  };

  getNameByIndex = selectedIndex => {
    return this.segmentationList.current.getNameByIndex(selectedIndex);
  };

  getSelectedActiveIndex = () => {
    return this.segmentationList.current.getSelectedActiveIndex();
  };

  render() {
    return (
      (!this.state.fetchingVMStatus && this.state.vmStarted) ? <div className="monaiLabelPanel">
        { this.state.timerEstimate >= 1500 && // After 25 minutes
          <div style={{ display: 'flex', alignItems: 'center', padding: '2rem', textAlign: "center", background: "darkred"}}>
            <span style={{ fontSize: '1.5rem' }}>
              GPU Instance is about to shutdown due to inactivity
            </span>
          </div>
        }
        <SegmentationList
          ref={this.segmentationList}
          viewConstants={this.viewConstants}
          onSegmentCreated={this.onSegmentCreated}
          onSegmentUpdated={this.onSegmentUpdated}
          onSegmentDeleted={this.onSegmentDeleted}
          onSegmentSelected={this.onSegmentSelected}
        />
          {
            !this.state.vmStarted && <button
            className={
              'vmButton actionButton ' +
              (this.state.vmStarted ? 'vmStopped' : 'vmStarted')
            }
            disabled={this.state.fetchingVMStatus}
            // style={ this.state.vmStarted ? { backgroundColor: 'red', borderColor: 'darkgreen'} : { backgroundColor: 'green', borderColor: 'green'}}
            onClick={this.onClickToggleVM}
            title="Toggle GPU Instance"
          >
            {this.state.fetchingVMStatus && (
              <div className="loader" />
            )}
            {!this.state.fetchingVMStatus && (<span>
            {this.state.vmStarted ? 'Stop' : 'Start'} GPU Instance
          </span>)}

          </button>
        }

        <div className="tabs scrollbar" id="style-3">
          <OptionTable
            ref={this.actions['options']}
            tabIndex={1}
            info={this.state.info}
            viewConstants={this.viewConstants}
            client={this.client}
            notification={this.notification}
            updateView={this.updateView}
            onSelectActionTab={this.onSelectActionTab}
          />

          <ActiveLearning
            ref={this.actions['activelearning']}
            tabIndex={2}
            info={this.state.info}
            viewConstants={this.viewConstants}
            client={this.client}
            notification={this.notification}
            updateView={this.updateView}
            onSelectActionTab={this.onSelectActionTab}
            onOptionsConfig={this.onOptionsConfig}
            // additional function - delete scribbles before submit
            onDeleteSegmentByName={this.onDeleteSegmentByName}
          />

          <AutoSegmentation
            ref={this.actions['segmentation']}
            tabIndex={3}
            info={this.state.info}
            viewConstants={this.viewConstants}
            client={this.client}
            notification={this.notification}
            updateView={this.updateView}
            onSelectActionTab={this.onSelectActionTab}
            onOptionsConfig={this.onOptionsConfig}
          />
          <SmartEdit
            ref={this.actions['smartedit']}
            tabIndex={4}
            info={this.state.info}
            viewConstants={this.viewConstants}
            client={this.client}
            notification={this.notification}
            updateView={this.updateView}
            onSelectActionTab={this.onSelectActionTab}
            onOptionsConfig={this.onOptionsConfig}
          />
          <Scribbles
            ref={this.actions['scribbles']}
            tabIndex={5}
            info={this.state.info}
            viewConstants={this.viewConstants}
            client={this.client}
            notification={this.notification}
            updateView={this.updateView}
            onSelectActionTab={this.onSelectActionTab}
            onOptionsConfig={this.onOptionsConfig}
            // additional functions for scribbles volume updates
            onAddSegment={this.onAddSegment}
            onClearSegmentByName={this.onClearSegmentByName}
            onDeleteSegmentByName={this.onDeleteSegmentByName}
            getIndexByName={this.getIndexByName}
            getNameByIndex={this.getNameByIndex}
            getSelectedActiveIndex={this.getSelectedActiveIndex}
          />
        </div>

        <p>&nbsp;</p>
      </div> :
        <div style={{display: "flex", alignItems: "center", padding: "1rem", flexDirection: "column", gap: "1.5rem"}}>
          <div className="loading-dual-ring"></div>
          {this.state.fetchingVMStatus && <span style={{color: "white", fontSize: "1.25rem"}}>Fetching GPU Server Status...</span>}
          {!this.state.fetchingVMStatus && !this.state.vmStarted && <span style={{color: "white", fontSize: "1.25rem"}}>Starting GPU Server...</span>}
        </div>
    );
  }
}

// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target === 'offscreen') {
    switch (message.type) {
      case 'start-recording':
        startRecording(message.data);
        break;
      case 'stop-recording':
        stopRecording();
        break;
      default:
        throw new Error('Unrecognized message:', message.type);
    }
  }
});

let recorder;
let data = [];

async function startRecording(streamId) {
  if (recorder?.state === 'recording') {
    throw new Error('Called startRecording while recording is in progress.');
  }

  const media = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  });

  // Continue to play the captured audio to the user.
  const output = new AudioContext();
  const source = output.createMediaStreamSource(media);
  source.connect(output.destination);

  // Start recording.
  recorder = new MediaRecorder(media, { mimeType: 'video/webm' });
  recorder.ondataavailable = (event) => data.push(event.data);
  recorder.onstop = () => {
    const blob = new Blob(data, { type: 'video/webm' });
    window.open(URL.createObjectURL(blob), '_blank');

    // Clear state ready for next recording
    recorder = undefined;
    data = [];
  };
  recorder.start();

  // Record the current state in the URL. This provides a very low-bandwidth
  // way of communicating with the service worker (the service worker can check
  // the URL of the document and see the current recording state). We can't
  // store that directly in the service worker as it may be terminated while
  // recording is in progress. We could write it to storage but that slightly
  // increases the risk of things getting out of sync.
  window.location.hash = 'recording';
  // capture screenshot from video track
  const tracks = recorder.stream.getTracks();
  console.log(tracks);
  const videoTrack = tracks.find((t) => t.kind === 'video');
  console.log(videoTrack);
  const trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
  const trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const video = document.createElement('video');
  canvas.appendChild(video);
  document.body.appendChild(canvas);

  async function detectBarcodes(videoFrame) {
    console.log('detecting barcodes');
  }
  function highlightBarcodes(videoFrame, barcodes) {
    console.log('highlighting barcodes');
    return new VideoFrame(videoFrame);
  }

  const transformer = new TransformStream({
    async transform(videoFrame, controller) {
      console.log(videoFrame, controller);
      const barcodes = await detectBarcodes(videoFrame);
      const newFrame = highlightBarcodes(videoFrame, barcodes);
      videoFrame.close();
      controller.enqueue(newFrame);
    }
  });

  console.log(trackProcessor, trackGenerator, transformer);
  trackProcessor.readable
    .pipeThrough(transformer)
    .pipeTo(trackGenerator.writable);

  // draw stream on canvas
  video.srcObject = new MediaStream([trackGenerator]);
  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    video.play();
  };
}

async function stopRecording() {
  // recorder.stop();

  console.log(recorder, recorder.stream);
  const tracks = recorder.stream.getTracks();
  // Stopping the tracks makes sure the recording icon in the tab is removed.
  tracks.forEach((t) => t.stop());

  // Update current state
  window.location.hash = '';

  // Note: In a real extension, you would want to write the recording to a more
  // permanent location (e.g IndexedDB) and then close the offscreen document,
  // to avoid keeping a document around unnecessarily. Here we avoid that to
  // make sure the browser keeps the Object URL we create (see above) and to
  // keep the sample fairly simple to follow.
}
